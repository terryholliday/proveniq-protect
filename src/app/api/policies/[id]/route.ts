import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const policy = await prisma.policy.findUnique({
      where: { id },
      include: {
        quote: true,
        claims: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: policy.id,
      policy_number: policy.policyNumber,
      asset_id: policy.assetId,
      coverage_type: policy.coverageType,
      premium_micros: policy.premiumMicros,
      currency: policy.currency,
      effective_date: policy.effectiveDate.toISOString(),
      expiration_date: policy.expirationDate.toISOString(),
      status: policy.status,
      owner_id: policy.ownerId,
      anchor_id: policy.anchorId,
      anchor_status: policy.anchorStatus,
      quote: {
        id: policy.quote.id,
        risk_bps: policy.quote.riskBps,
        reasons: policy.quote.reasons,
        security_level: policy.quote.securityLevel,
      },
      claims: policy.claims.map((c) => ({
        id: c.id,
        claim_number: c.claimNumber,
        claim_type: c.claimType,
        status: c.status,
        claimed_amount_micros: c.claimedAmountMicros,
        approved_amount_micros: c.approvedAmountMicros,
        created_at: c.createdAt.toISOString(),
      })),
      created_at: policy.createdAt.toISOString(),
    });
  } catch (e: any) {
    console.error("Get policy error:", e);
    return NextResponse.json({ error: "Failed to get policy" }, { status: 500 });
  }
}
