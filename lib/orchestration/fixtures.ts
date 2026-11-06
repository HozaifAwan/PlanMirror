/** Test data and scripted verdicts only. No financial comparison rules are implemented here. */
import type { AuditProviders, Comparator } from "./contracts";

export const fixtureProviders: AuditProviders = {
  async loadPlan() {
    return {
      id: "P-FIXTURE", productId: "PROD-FIXTURE", name: "Fixture offer",
      status: "ACTIVE", retrievedAt: "2026-11-05T12:00:00Z",
      billingCycles: [{ sequence: 1, tenure: "REGULAR", totalCycles: 0,
        interval: { unit: "MONTH", count: 1 }, fixedPrice: { value: "19.99", currencyCode: "USD" } }],
    };
  },
  async loadClaims() {
    return [{
      id: "fixture-renewal",
      claim: {
        offerLabel: "Fixture offer", field: "recurring_price",
        price: { value: "9.99", currencyCode: "USD" },
        quotedInterval: { unit: "MONTH", count: 1 },
        evidence: { url: "https://example.com/fixture-pricing", quote: "USD 9.99 per month." },
      },
    }];
  },
};

export const fixtureComparator: Comparator = ({ plan, claim }) => ({
  status: "mismatch", offerLabel: claim.offerLabel, field: claim.field,
  summary: "FIXTURE: scripted mismatch for orchestration verification.",
  website: claim.evidence,
  paypal: { planId: plan.id, fieldPath: "billingCycles[0].fixedPrice", retrievedAt: plan.retrievedAt },
});
