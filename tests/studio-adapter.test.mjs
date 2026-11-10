import assert from "node:assert/strict";
import test from "node:test";
import { evidenceReport } from "../lib/studio/types.ts";
import { formatAdvertisedDisplay, formatConfiguredDisplay, toStudioRun } from "../lib/studio/to-studio-run.ts";
import { studioRuns } from "../lib/studio/fixtures.ts";

const plan = {
  id: "P-LIVE-TEST",
  productId: "PROD-LIVE",
  name: "Quillfox Pro",
  status: "ACTIVE",
  retrievedAt: "2026-11-09T18:00:00.000Z",
  billingCycles: [
    { sequence: 1, tenure: "TRIAL", totalCycles: 1, interval: { unit: "DAY", count: 7 }, fixedPrice: { value: "0.00", currencyCode: "USD" } },
    { sequence: 2, tenure: "REGULAR", totalCycles: 0, interval: { unit: "MONTH", count: 1 }, fixedPrice: { value: "19.99", currencyCode: "USD" } },
  ],
};

const claims = [
  {
    id: "trial",
    claim: {
      field: "trial",
      offerLabel: "Quillfox Pro",
      duration: { unit: "DAY", count: 30 },
      price: { value: "0.00", currencyCode: "USD" },
      evidence: { url: "https://planmirror.local/quillfox", quote: "30 days free, then USD 9.99 per month." },
    },
  },
  {
    id: "monthly",
    claim: {
      field: "recurring_price",
      offerLabel: "Quillfox Pro",
      price: { value: "9.99", currencyCode: "USD" },
      quotedInterval: { unit: "MONTH", count: 1 },
      evidence: { url: "https://planmirror.local/quillfox", quote: "30 days free, then USD 9.99 per month." },
    },
  },
];

test("formatAdvertisedDisplay uses structured claim fields only", () => {
  assert.equal(formatAdvertisedDisplay(claims[0].claim), "30 days free");
  assert.equal(formatAdvertisedDisplay(claims[1].claim), "USD 9.99 / 1 month");
});

test("formatConfiguredDisplay reads only the PayPal field path", () => {
  assert.equal(formatConfiguredDisplay(plan, "billingCycles[0].interval"), "7 days");
  assert.equal(formatConfiguredDisplay(plan, "billingCycles[1].fixedPrice"), "USD 19.99");
  assert.match(formatConfiguredDisplay(plan, "billingCycles"), /Trial phase 1: 7 days; 1 cycles; USD 0.00/);
  assert.equal(formatConfiguredDisplay(plan, undefined), "Configured value unavailable");
  assert.equal(formatConfiguredDisplay(plan, "billingCycles[9].fixedPrice"), "Configured value unavailable");
});

test("toStudioRun maps live audit results without inventing missing claim displays", () => {
  const run = toStudioRun({
    id: "11111111-1111-4111-8111-111111111111",
    label: "Live audit",
    plan,
    claims,
    result: {
      status: "needs_review",
      issues: [{ code: "ambiguous_claim", claimId: "trial" }],
      findings: [
        {
          claimId: "trial",
          finding: {
            offerLabel: "Quillfox Pro",
            field: "trial",
            status: "mismatch",
            summary: "Advertised trial: 30 days. PayPal trial: 7 days.",
            website: claims[0].claim.evidence,
            paypal: { planId: plan.id, fieldPath: "billingCycles[0].interval", retrievedAt: plan.retrievedAt },
          },
        },
        {
          claimId: "orphan",
          finding: {
            offerLabel: "Unknown",
            field: "setup_fee",
            status: "needs_review",
            summary: "Missing claim mapping.",
          },
        },
      ],
    },
  });

  assert.equal(run.source, "live");
  assert.equal(run.status, "needs_review");
  assert.equal(run.planId, plan.id);
  assert.equal(run.retrievedAt, plan.retrievedAt);
  assert.equal(run.findings[0].id, "trial");
  assert.equal(run.findings[0].advertisedDisplay, "30 days free");
  assert.equal(run.findings[0].configuredDisplay, "7 days");
  assert.equal(run.findings[1].advertisedDisplay, "Advertised value unavailable");
  assert.equal(run.findings[1].configuredDisplay, "Configured value unavailable");
  assert.equal(evidenceReport(run).source, "live");
  assert.equal(evidenceReport(run).illustrative, false);
});

test("fixture evidence reports remain illustrative", () => {
  const report = evidenceReport(studioRuns[0]);
  assert.equal(report.source, "fixture");
  assert.equal(report.illustrative, true);
});
