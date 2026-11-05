import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureComparator, fixtureProviders } from "./fixtures";
import { runAudit, runAuditFromProviders } from "./run-audit";

async function input() {
  return { plan: await fixtureProviders.loadPlan(), claims: await fixtureProviders.loadClaims() };
}

test("fixtures flow through providers, comparator, and evidence validation", async () => {
  const result = await runAuditFromProviders(fixtureProviders, fixtureComparator);
  assert.equal(result.status, "completed");
  assert.equal(result.findings[0].finding.status, "mismatch");
  assert.equal(result.findings[0].claimId, "fixture-renewal");
  assert.deepEqual(result.issues, []);
});

test("missing inputs require review and never invoke comparison", async () => {
  const never = () => { throw new Error("must not run"); };
  const empty = await runAudit({ claims: [] }, never);
  assert.equal(empty.status, "needs_review");
  assert.deepEqual(empty.issues.map(issue => issue.code), ["missing_plan", "missing_claims"]);
  const missing = await runAudit({ claims: (await input()).claims }, never);
  assert.equal(missing.findings[0].finding.status, "needs_review");
  assert.equal(missing.issues.length, 1);
});

test("ambiguous claims are held for review", async () => {
  const data = await input();
  data.claims[0].ambiguity = "Two conflicting prices";
  const result = await runAudit(data, () => { throw new Error("must not run"); });
  assert.equal(result.issues[0].code, "ambiguous_claim");
  assert.equal(result.findings[0].finding.status, "needs_review");
});

test("comparator errors are isolated and raw errors are not exposed", async () => {
  const data = await input();
  data.claims.push({ ...data.claims[0], id: "second" });
  let calls = 0;
  const result = await runAudit(data, args => {
    if (++calls === 1) throw new Error("private provider error");
    return fixtureComparator(args);
  });
  assert.equal(result.status, "needs_review");
  assert.equal(result.findings[1].finding.status, "mismatch");
  assert.equal(result.issues[0].code, "comparison_failed");
  assert.ok(!JSON.stringify(result).includes("private provider error"));
});

test("findings with missing or unrelated evidence are rejected", async () => {
  for (const variant of ["missing", "plan", "website", "time", "field", "label"]) {
    const result = await runAudit(await input(), async args => {
      const finding = await fixtureComparator(args);
      const edits: Record<string, Record<string, unknown>> = {
        missing: { paypal: undefined },
        plan: { paypal: { ...finding.paypal, planId: "WRONG" } },
        website: { website: { url: "https://example.com/other", quote: "Other" } },
        time: { paypal: { ...finding.paypal, retrievedAt: "2020-01-01T00:00:00Z" } },
        field: { field: "trial" },
        label: { offerLabel: "Other offer" },
      };
      return { ...finding, ...edits[variant] } as typeof finding;
    });
    assert.equal(result.issues[0].code, "invalid_finding", variant);
  }
});

test("malformed inputs and duplicate claim IDs fail at the boundary", async () => {
  const data = await input();
  data.claims.push(data.claims[0]);
  assert.equal((await runAudit(data, fixtureComparator)).status, "failed");
  const malformed = await input();
  malformed.claims[0].claim.evidence.url = "javascript:alert(1)";
  assert.equal((await runAudit(malformed, fixtureComparator)).issues[0].code, "invalid_input");
});

test("provider failures stop comparison, including synchronous adapter errors", async () => {
  const result = await runAuditFromProviders({
    loadPlan() { throw new Error("secret"); },
    async loadClaims() { throw new Error("secret"); },
  }, () => { throw new Error("must not run"); });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.issues, [
    { code: "provider_failed", stage: "plan" },
    { code: "provider_failed", stage: "claims" },
  ]);
});

test("replacement comparator can return needs_review and receives isolated input", async () => {
  const data = await input();
  const result = await runAudit(data, ({ plan, claim }) => {
    plan.name = "changed";
    return { status: "needs_review", offerLabel: claim.offerLabel, field: claim.field,
      summary: "Unsupported pricing model", website: claim.evidence };
  });
  assert.equal(result.status, "needs_review");
  assert.equal(data.plan?.name, "Fixture offer");
});
