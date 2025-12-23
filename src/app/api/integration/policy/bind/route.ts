import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canonicalize, hash256Hex } from "@/shared/crypto/src";
import { ledger } from "@/server/integration/ledger";
import { PolicyBindPayloadSchema } from "@/server/integration/schemas";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const payload = PolicyBindPayloadSchema.parse(body);

        const canonical_hash_hex = hash256Hex(
            canonicalize({ asset_id: payload.asset_id, request: payload.request })
        );

        const receipt = await ledger.appendEvent({
            type: "POLICY_BOUND",
            asset_id: payload.asset_id,
            payload: { ...payload.request, canonical_hash_hex },
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
