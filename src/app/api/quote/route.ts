
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PricingContextWireSchema, QuoteRequestSchema, QuoteResponseSchema } from "@/shared/contracts/src";
import { calculateDynamicPremium } from "@/engine/pricing";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Assume context is passed in body for now per original stub
        const context = PricingContextWireSchema.parse(body.context);
        const request = QuoteRequestSchema.parse(body.request);

        const result = calculateDynamicPremium(context);

        const response = {
            quote_id: crypto.randomUUID(),
            ...result,
            expires_at: new Date(Date.now() + 86400000).toISOString(), // 24h
        };

        const validResponse = QuoteResponseSchema.parse(response);

        return NextResponse.json(validResponse);
    } catch (e: any) {
        return NextResponse.json({ error: "VALIDATION_ERROR", details: e?.message ?? String(e) }, { status: 400 });
    }
}
