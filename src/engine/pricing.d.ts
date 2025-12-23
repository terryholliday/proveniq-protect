import { PricingContextWire } from "@proveniq/contracts";
export declare function calculateDynamicPremium(ctx: PricingContextWire): {
    pricing_version: string;
    premium_micros: string;
    currency: string;
    risk_bps: number;
    reasons: string[];
    inputs_snapshot_hash: any;
};
