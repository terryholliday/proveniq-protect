"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDynamicPremium = calculateDynamicPremium;
const crypto_1 = require("@proveniq/crypto");
function calculateDynamicPremium(ctx) {
    const PRICING_VERSION = "1.0.0";
    const BASE_RATE_BPS = 1000; // 10.00%
    let risk_bps = BASE_RATE_BPS;
    const reasons = [];
    if (ctx.last_verified_service_days < 90) {
        risk_bps -= 150; // -1.50%
        reasons.push("VERIFIED_MAINTENANCE_RECENT");
    }
    if (!ctx.transit_damage_history) {
        risk_bps -= 50; // -0.50%
        reasons.push("CLEAN_TRANSIT_HISTORY");
    }
    if (ctx.security_level === "VERIFIED") {
        risk_bps -= 100; // -1.00%
        reasons.push("SECURITY_VERIFIED");
    }
    // Floor/Ceiling
    if (risk_bps < 200)
        risk_bps = 200;
    const valuation = BigInt(ctx.asset_valuation_micros);
    const premium_micros = (valuation * BigInt(risk_bps)) / BigInt(10000);
    const inputs_snapshot_hash = (0, crypto_1.hash256Hex)((0, crypto_1.canonicalize)(ctx));
    return {
        pricing_version: PRICING_VERSION,
        premium_micros: premium_micros.toString(),
        currency: "USD",
        risk_bps,
        reasons,
        inputs_snapshot_hash,
    };
}
