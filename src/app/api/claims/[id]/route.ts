import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

// Get single claim
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        policy: true,
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: claim.id,
      claim_number: claim.claimNumber,
      policy_id: claim.policyId,
      policy_number: claim.policy.policyNumber,
      asset_id: claim.policy.assetId,
      claim_type: claim.claimType,
      description: claim.description,
      incident_date: claim.incidentDate.toISOString(),
      incident_location: claim.incidentLocation,
      claimed_amount_micros: claim.claimedAmountMicros,
      approved_amount_micros: claim.approvedAmountMicros,
      currency: claim.currency,
      status: claim.status,
      evidence_ids: claim.evidenceIds,
      anchor_event_ids: claim.anchorEventIds,
      attribution_packet_id: claim.attributionPacketId,
      attribution_score: claim.attributionScore,
      resolution_notes: claim.resolutionNotes,
      resolved_at: claim.resolvedAt?.toISOString(),
      resolved_by: claim.resolvedBy,
      created_at: claim.createdAt.toISOString(),
    });
  } catch (e: any) {
    console.error("Get claim error:", e);
    return NextResponse.json({ error: "Failed to get claim" }, { status: 500 });
  }
}

const UpdateClaimSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "APPROVED", "DENIED", "PAID"]).optional(),
  approved_amount_micros: z.string().optional(),
  resolution_notes: z.string().optional(),
  resolved_by: z.string().optional(),
  attribution_packet_id: z.string().optional(),
  attribution_score: z.number().min(0).max(1).optional(),
});

// Update claim (for adjudication)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = UpdateClaimSchema.parse(body);

    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (input.status) {
      updateData.status = input.status;
      
      // Set resolved timestamp for terminal states
      if (["APPROVED", "DENIED", "PAID"].includes(input.status)) {
        updateData.resolvedAt = new Date();
        if (input.resolved_by) updateData.resolvedBy = input.resolved_by;
      }
    }

    if (input.approved_amount_micros) {
      updateData.approvedAmountMicros = input.approved_amount_micros;
    }

    if (input.resolution_notes) {
      updateData.resolutionNotes = input.resolution_notes;
    }

    if (input.attribution_packet_id) {
      updateData.attributionPacketId = input.attribution_packet_id;
    }

    if (input.attribution_score !== undefined) {
      updateData.attributionScore = input.attribution_score;
    }

    const updated = await prisma.claim.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: `CLAIM_${input.status || "UPDATED"}`,
        resourceType: "claim",
        resourceId: claim.id,
        actorId: input.resolved_by,
        details: updateData,
      },
    });

    return NextResponse.json({
      id: updated.id,
      claim_number: updated.claimNumber,
      status: updated.status,
      approved_amount_micros: updated.approvedAmountMicros,
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: e.issues }, { status: 400 });
    }
    console.error("Update claim error:", e);
    return NextResponse.json({ error: "Failed to update claim" }, { status: 500 });
  }
}
