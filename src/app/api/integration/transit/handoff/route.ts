import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canonicalize, hash256Hex, stripSig } from "@/shared/crypto/src";
import { ledger } from "@/server/integration/ledger";
import { TransitHandoffPayloadSchema } from "@/server/integration/schemas";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const payload = TransitHandoffPayloadSchema.parse(body);

        const canonicalTarget = {
            asset_id: payload.asset_id,
            challenge: stripSig(payload.challenge),
            acceptance: stripSig(payload.acceptance),
        };
        const canonical_hash_hex = hash256Hex(canonicalize(canonicalTarget));

        const receipt = await ledger.appendEvent({
            type: "TRANSIT_HANDOFF_COMPLETED",
            asset_id: payload.asset_id,
            custody_token_id: payload.challenge.custody_token_id,
            payload: {
                ...payload,
                canonical_hash_hex,
            },
            correlation_id: crypto.randomUUID(),
            idempotency_key: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            schema_version: "1.0.0",
        });

        return NextResponse.json({
            status: "ok",
            canonical_hash_hex,
            receipt,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: "VALIDATION_ERROR", details: error?.message ?? String(error) },
            { status: 400 }
        );
    }
}
