import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import prisma from "@/lib/db";
import { hash256Hex, canonicalize } from "@/shared/crypto/src";
import { MockLedgerClient } from "@/shared/ledger-client/src/mock";
import { LiveLedgerClient } from "@/shared/ledger-client/src/live";

const USE_REAL_LEDGER = process.env.USE_REAL_LEDGER === "true";
const ledger = USE_REAL_LEDGER ? new LiveLedgerClient() : new MockLedgerClient();

const ClaimSubmitSchema = z.object({
  policy_id: z.string().uuid(),
  claim_type: z.enum(["THEFT", "DAMAGE", "LOSS"]),
  description: z.string().min(10).max(2000),
  incident_date: z.string().datetime(),
  incident_location: z.string().optional(),
  claimed_amount_micros: z.string(), // BigInt as string
  evidence_ids: z.array(z.string()).optional(),
  anchor_event_ids: z.array(z.string()).optional(),
});

function generateClaimNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CLM-${year}${month}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ClaimSubmitSchema.parse(body);

    // Get the policy
    const policy = await prisma.policy.findUnique({
      where: { id: input.policy_id },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    if (policy.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Cannot file claim on ${policy.status} policy` },
        { status: 400 }
      );
    }

    // Check incident date is within policy term
    const incidentDate = new Date(input.incident_date);
    if (incidentDate < policy.effectiveDate || incidentDate > policy.expirationDate) {
      return NextResponse.json(
        { error: "Incident date is outside policy coverage period" },
        { status: 400 }
      );
    }

    // Create claim
    const claim = await prisma.claim.create({
      data: {
        claimNumber: generateClaimNumber(),
        policyId: policy.id,
        claimType: input.claim_type,
        description: input.description,
        incidentDate,
        incidentLocation: input.incident_location,
        claimedAmountMicros: input.claimed_amount_micros,
        currency: policy.currency,
        status: "SUBMITTED",
        evidenceIds: input.evidence_ids || [],
        anchorEventIds: input.anchor_event_ids || [],
      },
    });

    // Write to Ledger
    const claimPayload = {
      claim_id: claim.id,
      claim_number: claim.claimNumber,
      policy_id: policy.id,
      policy_number: policy.policyNumber,
      asset_id: policy.assetId,
      claim_type: claim.claimType,
      incident_date: claim.incidentDate.toISOString(),
      claimed_amount_micros: claim.claimedAmountMicros,
      evidence_ids: claim.evidenceIds,
      anchor_event_ids: claim.anchorEventIds,
    };

    const canonicalHash = hash256Hex(canonicalize(claimPayload));

    try {
      const receipt = await ledger.appendEvent({
        type: "PROTECT_QUOTE_CREATED", // Using existing type, should add CLAIM_SUBMITTED
        asset_id: policy.assetId,
        payload: { 
          event_subtype: "CLAIM_SUBMITTED",
          ...claimPayload, 
          canonical_hash_hex: canonicalHash 
        },
        correlation_id: crypto.randomUUID(),
        idempotency_key: `claim-submit-${claim.id}`,
        created_at: new Date().toISOString(),
        schema_version: "1.0.0",
      });

      await prisma.claim.update({
        where: { id: claim.id },
        data: { ledgerEventId: receipt.ledger_event_id },
      });
    } catch (ledgerError) {
      console.error("Ledger write failed:", ledgerError);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CLAIM_SUBMITTED",
        resourceType: "claim",
        resourceId: claim.id,
        details: { 
          policy_id: policy.id, 
          claim_number: claim.claimNumber,
          claimed_amount_micros: claim.claimedAmountMicros,
        },
      },
    });

    return NextResponse.json({
      claim_id: claim.id,
      claim_number: claim.claimNumber,
      policy_id: policy.id,
      claim_type: claim.claimType,
      status: claim.status,
      claimed_amount_micros: claim.claimedAmountMicros,
      created_at: claim.createdAt.toISOString(),
    }, { status: 201 });

  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: e.issues }, { status: 400 });
    }
    console.error("Claim submit error:", e);
    return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 });
  }
}

// Get claims for a policy
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const policyId = searchParams.get("policy_id");
    const status = searchParams.get("status");

    const where: any = {};
    if (policyId) where.policyId = policyId;
    if (status) where.status = status;

    const claims = await prisma.claim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      claims: claims.map((c) => ({
        id: c.id,
        claim_number: c.claimNumber,
        policy_id: c.policyId,
        claim_type: c.claimType,
        description: c.description,
        incident_date: c.incidentDate.toISOString(),
        claimed_amount_micros: c.claimedAmountMicros,
        approved_amount_micros: c.approvedAmountMicros,
        status: c.status,
        created_at: c.createdAt.toISOString(),
      })),
      total: claims.length,
    });
  } catch (e: any) {
    console.error("Get claims error:", e);
    return NextResponse.json({ error: "Failed to get claims" }, { status: 500 });
  }
}
