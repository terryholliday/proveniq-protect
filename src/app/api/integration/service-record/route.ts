import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ServiceRecordSchema } from "@/shared/contracts/src";
import { canonicalize, hash256Hex, stripSig } from "@/shared/crypto/src";
import { ledger } from "@/server/integration/ledger";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const record = ServiceRecordSchema.parse(body);
        const canonical_hash_hex = hash256Hex(canonicalize(stripSig(record)));

        const receipt = await ledger.appendEvent({
            type: "SERVICE_RECORDED",
            asset_id: record.asset_id,
            payload: { ...record, canonical_hash_hex },
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
