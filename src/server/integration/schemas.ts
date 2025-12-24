import { z } from "zod";
import {
    HandoffAcceptanceSchema,
    HandoffChallengeSchema,
    PolicyBindRequestSchema,
} from "@/shared/contracts/src";

export const TransitHandoffPayloadSchema = z.object({
    asset_id: z.string().uuid(),
    challenge: HandoffChallengeSchema,
    acceptance: HandoffAcceptanceSchema,
});

export type TransitHandoffPayload = z.infer<typeof TransitHandoffPayloadSchema>;

export const PolicyBindPayloadSchema = z.object({
    asset_id: z.string().uuid(),
    request: PolicyBindRequestSchema,
});

export type PolicyBindPayload = z.infer<typeof PolicyBindPayloadSchema>;
