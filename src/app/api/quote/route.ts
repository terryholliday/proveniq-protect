
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PricingContextWireSchema, QuoteRequestSchema, QuoteResponseSchema } from "@/shared/contracts/src";
import { calculateDynamicPremium } from "@/engine/pricing";
import { MockLedgerClient } from "@/shared/ledger-client/src/mock";
import { LiveLedgerClient } from "@/shared/ledger-client/src/live";
import { hash256Hex, canonicalize } from "@/shared/crypto/src";
import prisma from "@/lib/db";

const USE_REAL_LEDGER = process.env.USE_REAL_LEDGER === "true";
const ledger = USE_REAL_LEDGER ? new LiveLedgerClient() : new MockLedgerClient();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const context = PricingContextWireSchema.parse(body.context);
        const request = QuoteRequestSchema.parse(body.request);

        const result = calculateDynamicPremium(context);

        const expiresAt = new Date(Date.now() + 86400000); // 24h

        // Save quote to database
        const quote = await prisma.quote.create({
            data: {
                assetId: context.asset_id,
                assetValuationMicros: context.asset_valuation_micros,
                securityLevel: context.security_level,
                lastVerifiedServiceDays: context.last_verified_service_days,
                transitDamageHistory: context.transit_damage_history,
                premiumMicros: result.premium_micros,
                currency: result.currency,
                riskBps: result.risk_bps,
                pricingVersion: result.pricing_version,
                reasons: result.reasons,
                inputsSnapshotHash: result.inputs_snapshot_hash,
                coverageType: request.coverage_type,
                termDays: request.term_days,
                status: "PENDING",
                expiresAt,
            },
        });

        const response = {
            quote_id: quote.id,
            ...result,
            expires_at: expiresAt.toISOString(),
        };

        const validResponse = QuoteResponseSchema.parse(response);

        // Publish to ledger
        const canonical_hash_hex = hash256Hex(canonicalize(validResponse));

        try {
            const receipt = await ledger.appendEvent({
                type: "PROTECT_QUOTE_CREATED",
                asset_id: context.asset_id,
                payload: { ...validResponse, canonical_hash_hex },
                correlation_id: crypto.randomUUID(),
                idempotency_key: `quote-${quote.id}`,
                created_at: new Date().toISOString(),
                schema_version: "1.0.0",
            });

            // Update quote with ledger event ID
            await prisma.quote.update({
                where: { id: quote.id },
                data: { ledgerEventId: receipt.ledger_event_id },
            });
        } catch (ledgerError) {
            console.error("Ledger write failed:", ledgerError);
            // Quote is still valid, just not synced
        }

        return NextResponse.json(validResponse);
    } catch (e: any) {
        console.error("Quote error:", e);
        return NextResponse.json({ error: "VALIDATION_ERROR", details: e?.message ?? String(e) }, { status: 400 });
    }
}
