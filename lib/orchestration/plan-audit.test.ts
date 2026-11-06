import test from "node:test";
import assert from "node:assert/strict";
import { createSandboxClient } from "../paypal/client";
import { fixtureProviders, fixtureComparator } from "./fixtures";
import { createPlanAudit } from "./plan-audit";

const upstream = () => ({
  id: "P-BRIDGE", product_id: "PROD-BRIDGE", name: "Fixture offer", status: "ACTIVE",
  quantity_supported: true, taxes: { percentage: "8.25", inclusive: false },
  billing_cycles: [{ sequence: 1, tenure_type: "REGULAR", total_cycles: 0,
    frequency: { interval_unit: "MONTH", interval_count: 1 },
    pricing_scheme: { fixed_price: { value: "19.99", currency_code: "USD" }, pricing_model: "TIERED" } }],
});

test("Ayaan client normalizes data and feeds the replaceable comparator", async () => {
  let auth = 0;
  const client = createSandboxClient({ clientId: "fixture-client", clientSecret: "fixture-secret" }, async url => {
    assert.ok(String(url).startsWith("https://api-m.sandbox.paypal.com/"));
    if (String(url).endsWith("/token")) {
      auth++;
      return Response.json({ access_token: "fixture-token", expires_in: 3600 });
    }
    return Response.json(upstream());
  });
  const audit = createPlanAudit(client.readPlan);
  const result = await audit("P-BRIDGE", fixtureProviders.loadClaims, ({ plan, claim }) => {
    assert.equal(plan.taxes?.percentage, "8.25");
    assert.equal(plan.quantitySupported, true);
    assert.equal(plan.billingCycles[0].pricingModel, "TIERED");
    assert.deepEqual(plan.source, upstream());
    return { field: claim.field, offerLabel: claim.offerLabel, status: "needs_review",
      website: claim.evidence, summary: "Fixture comparator defers tiered pricing." };
  });
  assert.equal(auth, 1);
  assert.equal(result.status, "needs_review");
  assert.deepEqual(result.issues, []);
});

test("unconnected comparator is explicit and cannot report a match", async () => {
  const audit = createPlanAudit(async () => (await fixtureProviders.loadPlan())!);
  const result = await audit("P-FIXTURE", fixtureProviders.loadClaims);
  assert.equal(result.status, "needs_review");
  assert.equal(result.findings[0].finding.status, "needs_review");
  assert.ok(result.issues.some(issue => issue.code === "comparator_unavailable"));
});

test("invalid plan selection triggers no providers", async () => {
  let calls = 0;
  const audit = createPlanAudit(async () => { calls++; throw Error("must not run"); });
  const result = await audit("../not-a-plan", async () => { calls++; return []; }, fixtureComparator);
  assert.equal(result.status, "failed");
  assert.equal(calls, 0);
});

test("upstream authentication failure stops the audit without exposing credentials", async () => {
  const client = createSandboxClient({ clientId: "fixture-client", clientSecret: "fixture-secret" },
    async () => Response.json({ error: "private upstream details" }, { status: 401 }));
  const result = await createPlanAudit(client.readPlan)("P-BRIDGE", fixtureProviders.loadClaims, fixtureComparator);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.issues, [{ code: "provider_failed", stage: "plan" }]);
  assert.ok(!JSON.stringify(result).includes("private upstream"));
});

test("a provider returning a different plan cannot reach the comparator", async () => {
  // Ayaan's client owns verifying that returned IDs match the selected ID.
  const client = createSandboxClient({ clientId: "fixture-client", clientSecret: "fixture-secret" },
    async url => Response.json(String(url).endsWith("/token")
      ? { access_token: "fixture-token", expires_in: 3600 }
      : { ...upstream(), id: "P-OTHER" }));
  const result = await createPlanAudit(client.readPlan)("P-BRIDGE", fixtureProviders.loadClaims, () => {
    throw Error("must not run");
  });
  assert.equal(result.status, "failed");
  assert.equal(result.findings.length, 0);
});

test("replacement claim provider and comparator complete a run", async () => {
  const result = await createPlanAudit(async () => (await fixtureProviders.loadPlan())!)(
    "P-FIXTURE", fixtureProviders.loadClaims, fixtureComparator);
  assert.equal(result.status, "completed");
  assert.equal(result.findings[0].finding.status, "mismatch");
});
