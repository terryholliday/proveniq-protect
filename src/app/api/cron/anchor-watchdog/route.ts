import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Anchor Watchdog Cron
 * 
 * Runs externally (e.g. via Vercel Cron or Cloud Scheduler).
 * Checks for policies that expect Anchor heartbeats but haven't received one in 24h.
 */

// If running in edge, be capable of long execution or pagination
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Basic shared secret protection
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-cron-secret'}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const SIGNAL_LOSS_THRESHOLD_HOURS = 24;
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - SIGNAL_LOSS_THRESHOLD_HOURS);

    console.log(`[Watchdog] Checking for anchors silent since ${cutoffDate.toISOString()}`);

    // Find active policies with active anchors that haven't reported recently
    const silentPolicies = await prisma.policy.findMany({
        where: {
            status: "ACTIVE",
            anchorId: { not: null },
            anchorStatus: { in: ["ACTIVE", "SEALED"] },
            lastAnchorEventAt: {
                lt: cutoffDate
            }
        }
    });

    console.log(`[Watchdog] Found ${silentPolicies.length} silent policies.`);

    const results = [];

    for (const policy of silentPolicies) {
        // Update Status
        await prisma.policy.update({
            where: { id: policy.id },
            data: { anchorStatus: "SILENT" }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                action: "ANCHOR_SIGNAL_LOSS",
                resourceType: "policy",
                resourceId: policy.id,
                details: {
                    message: `No anchor signal received for > ${SIGNAL_LOSS_THRESHOLD_HOURS}h`,
                    previous_status: policy.anchorStatus,
                    last_seen: policy.lastAnchorEventAt
                }
            }
        });

        // If policy is High Security (Verified), this is a risk event
        // TODO: Trigger risk degradation logic here (notify insurer, etc.)

        results.push({ policyId: policy.id, lastSeen: policy.lastAnchorEventAt });
    }

    return NextResponse.json({
        success: true,
        processed: silentPolicies.length,
        silent_policies: results
    });
}
