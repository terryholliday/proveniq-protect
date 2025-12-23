
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PricingContextWireSchema, QuoteRequestSchema, QuoteResponseSchema } from "@/shared/contracts/src";
import { calculateDynamicPremium } from "@/engine/pricing";
import { MockLedgerClient } from "@/shared/ledger-client/src/mock";
import { LiveLedgerClient } from "@/shared/ledger-client/src/live";
import { hash256Hex, canonicalize } from "@/shared/crypto/src";

const USE_REAL_LEDGER = process.env.USE_REAL_LEDGER === "true";
const ledger = USE_REAL_LEDGER ? new LiveLedgerClient() : new MockLedgerClient();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const context = PricingContextWireSchema.parse(body.context);
        const request = QuoteRequestSchema.parse(body.request);

        const result = calculateDynamicPremium(context);

        const quote_id = crypto.randomUUID();
        const response = {
            quote_id,
            ...result,
            expires_at: new Date(Date.now() + 86400000).toISOString(), // 24h
        };

        const validResponse = QuoteResponseSchema.parse(response);

        // Publish to ledger as required by contract
        const canonical_hash_hex = hash256Hex(canonicalize(validResponse));

        await ledger.appendEvent({
            type: "PROTECT_QUOTE_CREATED",
            asset_id: context.asset_id, // Context must have asset_id
            payload: { ...validResponse, canonical_hash_hex },
            correlation_id: crypto.randomUUID(), // New correlation for the quote event
            idempotency_key: crypto.randomUUID(), // In real app, derived from request
            created_at: new Date().toISOString(),
            schema_version: "1.0.0",
        });

        return NextResponse.json(validResponse);
    } catch (e: any) {
        return NextResponse.json({ error: "VALIDATION_ERROR", details: e?.message ?? String(e) }, { status: 400 });
    }
}
