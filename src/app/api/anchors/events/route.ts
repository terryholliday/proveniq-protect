import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

/**
 * Webhook endpoint for receiving anchor events from the Anchors service.
 * This allows Protect to adjust risk in real-time based on physical events.
 */

const AnchorEventSchema = z.object({
  anchor_id: z.string(),
  event_type: z.enum([
    "ANCHOR_REGISTERED",
    "ANCHOR_SEAL_ARMED",
    "ANCHOR_SEAL_BROKEN",
    "ANCHOR_ENVIRONMENTAL_ALERT",
    "ANCHOR_CUSTODY_SIGNAL",
  ]),
  payload: z.record(z.unknown()),
  event_timestamp: z.string().datetime(),
  ledger_event_id: z.string(),
});

// Map event types to risk impact
function calculateRiskImpact(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "ANCHOR_SEAL_BROKEN":
      const triggerType = payload.trigger_type as string;
      if (triggerType === "TAMPER" || triggerType === "FORCE") {
        return "CRITICAL"; // Immediate claim trigger
      }
      return "MAJOR";
    
    case "ANCHOR_ENVIRONMENTAL_ALERT":
      const metric = payload.metric as string;
      if (metric === "SHOCK") {
        return "MAJOR";
      }
      return "MINOR";
    
    case "ANCHOR_CUSTODY_SIGNAL":
      return "MINOR"; // Custody change noted
    
    case "ANCHOR_SEAL_ARMED":
      return "NONE"; // Positive signal
    
    default:
      return "NONE";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = AnchorEventSchema.parse(body);

    // Find policies linked to this anchor
    const policies = await prisma.policy.findMany({
      where: {
        anchorId: input.anchor_id,
        status: "ACTIVE",
      },
    });

    const riskImpact = calculateRiskImpact(input.event_type, input.payload as Record<string, unknown>);

    // Store the anchor event
    const anchorEvent = await prisma.anchorEvent.create({
      data: {
        anchorId: input.anchor_id,
        eventType: input.event_type,
        payload: input.payload,
        eventTimestamp: new Date(input.event_timestamp),
        ledgerEventId: input.ledger_event_id,
        policyId: policies[0]?.id, // Link to first matching policy
        riskImpact,
        processed: false,
      },
    });

    // Update policy anchor status
    for (const policy of policies) {
      const updateData: any = {
        lastAnchorEventAt: new Date(input.event_timestamp),
      };

      // Update anchor status based on event
      if (input.event_type === "ANCHOR_SEAL_ARMED") {
        updateData.anchorStatus = "SEALED";
      } else if (input.event_type === "ANCHOR_SEAL_BROKEN") {
        updateData.anchorStatus = "BREACHED";
      }

      await prisma.policy.update({
        where: { id: policy.id },
        data: updateData,
      });

      // If CRITICAL risk, auto-create claim draft notification
      if (riskImpact === "CRITICAL") {
        await prisma.auditLog.create({
          data: {
            action: "ANCHOR_BREACH_DETECTED",
            resourceType: "policy",
            resourceId: policy.id,
            details: {
              anchor_id: input.anchor_id,
              event_type: input.event_type,
              risk_impact: riskImpact,
              message: "Tamper detected - potential claim trigger",
            },
          },
        });
      }
    }

    // Mark as processed
    await prisma.anchorEvent.update({
      where: { id: anchorEvent.id },
      data: { 
        processed: true,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      received: true,
      anchor_event_id: anchorEvent.id,
      policies_affected: policies.length,
      risk_impact: riskImpact,
    });

  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: e.issues }, { status: 400 });
    }
    console.error("Anchor event processing error:", e);
    return NextResponse.json({ error: "Failed to process anchor event" }, { status: 500 });
  }
}
