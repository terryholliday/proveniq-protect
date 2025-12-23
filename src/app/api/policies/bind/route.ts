import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import prisma from "@/lib/db";
import { hash256Hex, canonicalize } from "@/shared/crypto/src";
import { MockLedgerClient } from "@/shared/ledger-client/src/mock";
import { LiveLedgerClient } from "@/shared/ledger-client/src/live";

const USE_REAL_LEDGER = process.env.USE_REAL_LEDGER === "true";
const ledger = USE_REAL_LEDGER ? new LiveLedgerClient() : new MockLedgerClient();

const BindRequestSchema = z.object({
  quote_id: z.string().uuid(),
  owner_id: z.string().optional(),
  anchor_id: z.string().optional(),
});

function generatePolicyNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `PRO-${year}${month}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = BindRequestSchema.parse(body);

    // Get the quote
    const quote = await prisma.quote.findUnique({
      where: { id: input.quote_id },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status !== "PENDING") {
      return NextResponse.json(
        { error: `Quote cannot be bound. Status: ${quote.status}` },
        { status: 400 }
      );
    }

    if (new Date(quote.expiresAt) < new Date()) {
      // Mark as expired
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Quote has expired" }, { status: 400 });
    }

    // Calculate effective dates
    const effectiveDate = new Date();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + quote.termDays);

    // Create policy
    const policy = await prisma.policy.create({
      data: {
        policyNumber: generatePolicyNumber(),
        quoteId: quote.id,
        assetId: quote.assetId,
        coverageType: quote.coverageType,
        premiumMicros: quote.premiumMicros,
        currency: quote.currency,
        effectiveDate,
        expirationDate,
        status: "ACTIVE",
        ownerId: input.owner_id,
        anchorId: input.anchor_id,
      },
    });

    // Update quote status
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "BOUND" },
    });

    // Write to Ledger
    const policyPayload = {
      policy_id: policy.id,
      policy_number: policy.policyNumber,
      quote_id: quote.id,
      asset_id: policy.assetId,
      coverage_type: policy.coverageType,
      premium_micros: policy.premiumMicros,
      effective_date: policy.effectiveDate.toISOString(),
      expiration_date: policy.expirationDate.toISOString(),
      anchor_id: policy.anchorId,
    };

    const canonicalHash = hash256Hex(canonicalize(policyPayload));

    try {
      const receipt = await ledger.appendEvent({
        type: "POLICY_BOUND",
        asset_id: policy.assetId,
        payload: { ...policyPayload, canonical_hash_hex: canonicalHash },
        correlation_id: crypto.randomUUID(),
        idempotency_key: `policy-bind-${policy.id}`,
        created_at: new Date().toISOString(),
        schema_version: "1.0.0",
      });

      // Update with ledger event ID
      await prisma.policy.update({
        where: { id: policy.id },
        data: { ledgerEventId: receipt.ledger_event_id },
      });
    } catch (ledgerError) {
      console.error("Ledger write failed:", ledgerError);
      // Policy is still valid, just not synced to ledger
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "POLICY_BOUND",
        resourceType: "policy",
        resourceId: policy.id,
        actorId: input.owner_id,
        details: { quote_id: quote.id, policy_number: policy.policyNumber },
      },
    });

    return NextResponse.json({
      policy_id: policy.id,
      policy_number: policy.policyNumber,
      asset_id: policy.assetId,
      coverage_type: policy.coverageType,
      premium_micros: policy.premiumMicros,
      effective_date: policy.effectiveDate.toISOString(),
      expiration_date: policy.expirationDate.toISOString(),
      status: policy.status,
    }, { status: 201 });

  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: e.errors }, { status: 400 });
    }
    console.error("Policy bind error:", e);
    return NextResponse.json({ error: "Failed to bind policy" }, { status: 500 });
  }
}
