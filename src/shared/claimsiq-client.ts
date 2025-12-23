export class ClaimsIQClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || process.env.CLAIMSIQ_BASE_URL || "http://claimsiq:3000";
    }

    /**
     * Submits a claim payload to ClaimsIQ for adjudication.
     * @param claimPayload The full claim data packet
     */
    async submitClaimForAdjudication(claimPayload: any): Promise<{ adjudicationId: string, status: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/claims/ingest`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Add internal auth if needed
                    "Authorization": "Bearer internal-service-token"
                },
                body: JSON.stringify(claimPayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ClaimsIQ API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return {
                adjudicationId: data.adjudication_id,
                status: data.status
            };

        } catch (error: any) {
            console.error("Failed to submit claim to ClaimsIQ:", error);
            // We do not throw here to avoid failing the Protect claim submission if the downstream is down
            // The claim is already in Ledger and DB. We can retry later.
            // TODO: Add retry queue mechanism
            return { adjudicationId: "PENDING_RETRY", status: "QUEUED" };
        }
    }
}
