import assert from "node:assert/strict";
import test from "node:test";
import { compareSubscriptionTerms } from "../lib/audit/compare-subscription-terms.ts";
import { runAudit } from "../lib/orchestration/run-audit.ts";

const interval = (unit, count = 1) => ({ unit, count });
const price = (value, currencyCode = "USD") => ({ value, currencyCode });
const regular = (value, cadence = interval("MONTH"), sequence = 1) => ({
  tenure: "REGULAR", sequence, totalCycles: 0, interval: cadence, fixedPrice: price(value),
});
const intro = (cadence, sequence = 1, value = "0", totalCycles = 1) => ({
  tenure: "TRIAL", sequence, totalCycles, interval: cadence, fixedPrice: price(value),
});
const plan = (...billingCycles) => ({
  id: "P-QUILLFOX", productId: "PROD-QUILLFOX", name: "Team", status: "ACTIVE",
  retrievedAt: "2026-11-05T12:00:00Z", billingCycles,
});
const source = (quote, page = "pricing") => ({ url: "https://example.com/" + page, quote });
const claim = (fields, evidence) => ({ offerLabel: "Team", evidence, ...fields });
const renewal = (value, evidence = source(value + " USD per month"), fields = {}) =>
  claim({ field: "recurring_price", price: price(value), quotedInterval: interval("MONTH"), ...fields }, evidence);
const trial = (duration, quote, fields = {}) =>
  claim({ field: "trial", duration, price: price("0"), ...fields }, source(quote));

function check(plan, claim, status, fieldPath, values) {
  const finding = compareSubscriptionTerms({ plan, claim });
  assert.equal(finding.status, status);
  assert.equal(finding.field, claim.field);
  assert.equal(finding.offerLabel, claim.offerLabel);
  assert.deepEqual(finding.website, claim.evidence);
  assert.deepEqual(finding.paypal, { planId: plan.id, retrievedAt: plan.retrievedAt, fieldPath });
  for (const value of values) assert.ok(finding.summary.includes(value), finding.summary);
}

test("Quillfox trial duration mismatch", () => {
  check(plan(intro(interval("DAY", 7)), regular("19", undefined, 2)),
    trial(interval("DAY", 30), "30 days free"), "mismatch", "billingCycles", ["30 days", "7 days"]);
});

test("Quillfox recurring price mismatch", () => {
  check(plan(regular("24")), renewal("19"), "mismatch", "billingCycles[0].fixedPrice", ["19 USD", "24 USD"]);
});

test("finite renewals preserve price mismatches and flag matching rates for review", () => {
  const configured = plan({ ...regular("19"), totalCycles: 12 });
  check(configured, renewal("19"), "needs_review", "billingCycles[0].totalCycles",
    ["19 USD", "stops after 12 regular collections"]);
  check(configured, renewal("24"), "mismatch", "billingCycles[0].fixedPrice",
    ["24 USD", "19 USD"]);
});

test("Quillfox conflicting FAQ and pricing page retain separate evidence and verdicts", async () => {
  const advertised = [renewal("59"), renewal("49", source("49 USD per month", "faq"))];
  const configured = plan(regular("59"));
  const claims = advertised.map((claim, i) => ({ claim, id: String(i) }));
  const result = await runAudit({ plan: configured, claims }, compareSubscriptionTerms);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.findings.map(({ claimId, finding }) => [claimId, finding.status, finding.website]),
    [["0", "match", advertised[0].evidence], ["1", "mismatch", advertised[1].evidence]]);
  assert.deepEqual(result.findings[1].finding.paypal, {
    planId: configured.id, retrievedAt: configured.retrievedAt, fieldPath: "billingCycles[0].fixedPrice",
  });
  assert.match(result.findings[1].finding.summary, /49 USD.*59 USD/);
});

test("Quillfox annual price equivalence requires annual collection", () => {
  const configured = plan(regular("99.00", interval("YEAR")));
  check(configured, renewal("8.25", source("8.25 USD/month, billed annually"), { billedInterval: interval("YEAR") }),
    "match", "billingCycles[0].fixedPrice", ["8.25 USD", "99 USD", "99.00 USD"]);
  check(configured, renewal("8.25"), "mismatch", "billingCycles[0].interval", ["1 calendar months", "12 calendar months"]);
});

test("Quillfox equivalent wording and verified trial units", () => {
  check(plan(intro(interval("DAY", 30)), regular("19", undefined, 2)),
    trial(interval("DAY", 30), "Try free for thirty days"), "match", "billingCycles", ["30 days", "0 USD"]);
  check(plan(intro(interval("WEEK")), regular("19", undefined, 2)),
    trial(interval("DAY", 7), "Seven days free"), "match", "billingCycles", ["7 days", "0 USD"]);
  check(plan(intro(interval("MONTH")), regular("19", undefined, 2)),
    trial(interval("DAY", 30), "Try free for thirty days"), "needs_review", "billingCycles", ["30 days", "1 calendar months"]);
});

test("currency and high-precision amounts remain distinct", () => {
  check(plan({ ...regular("9.99"), fixedPrice: price("9.99", "EUR") }), renewal("9.99"),
    "mismatch", "billingCycles[0].fixedPrice", ["9.99 USD", "9.99 EUR"]);
  const tiny = "0.000000000000000000001";
  check(plan(regular("0.000000000000000000012", interval("YEAR"))),
    renewal(tiny, undefined, { billedInterval: interval("YEAR") }),
    "match", "billingCycles[0].fixedPrice", [tiny, "0.000000000000000000012"]);
  const precise = "1.000000000000000000000000000001";
  check(plan(regular("12.000000000000000000000000000013", interval("YEAR"))),
    renewal(precise, undefined, { billedInterval: interval("YEAR") }),
    "mismatch", "billingCycles[0].fixedPrice", [precise, "12.000000000000000000000000000012", "12.000000000000000000000000000013"]);
});

test("two trial phases follow sequence and count every cycle", () => {
  const configured = plan(regular("19", undefined, 3), intro(interval("DAY", 2), 2, "0", 2), intro(interval("WEEK")));
  check(configured, trial(interval("DAY", 11), "Eleven days free"), "match", "billingCycles", ["11 days", "0 USD"]);
  configured.billingCycles[1].fixedPrice = price("5");
  check(configured, trial(interval("DAY", 11), "Eleven days free"), "needs_review", "billingCycles", ["different or unsupported pricing"]);
  check(configured, renewal("19"), "match", "billingCycles[0].fixedPrice", ["19 USD"]);
  check(plan(intro(interval("WEEK"), 1, "5"), regular("19", undefined, 2)),
    trial(interval("DAY", 7), "First week for $5", { price: price("5") }),
    "match", "billingCycles[0].fixedPrice", ["7 days", "5 USD"]);
});

test("mixed free and paid introductory phases do not imply a longer free trial", () => {
  const configured = plan(intro(interval("DAY", 7)), intro(interval("DAY", 30), 2, "5"), regular("19", undefined, 3));
  for (const days of [7, 30, 37]) {
    check(configured, trial(interval("DAY", days), `${days} days free`),
      "needs_review", "billingCycles", ["different or unsupported pricing"]);
  }
});

test("paid trial money verdicts require supported quantity and tax context", () => {
  const configured = plan(intro(interval("WEEK"), 1, "5"), regular("19", undefined, 2));
  for (const context of [
    { quantitySupported: true },
    { taxes: { percentage: "5", inclusive: false } },
    { taxes: { percentage: "5", inclusive: true } },
  ]) {
    for (const value of ["5", "7"]) {
      check({ ...configured, ...context }, trial(interval("DAY", 7), `First week for $${value}`, { price: price(value) }),
        "needs_review", "billingCycles[0].fixedPrice", ["quantity or taxes"]);
    }
  }
  check({ ...configured, quantitySupported: false, taxes: { percentage: "0", inclusive: false } },
    trial(interval("DAY", 7), "First week for $5", { price: price("5") }),
    "match", "billingCycles[0].fixedPrice", ["5 USD"]);
});

test("unknown prices, unsupported billing and absent trial terms", () => {
  const configured = plan(intro(interval("DAY", 7)), regular("19", undefined, 2));
  check(configured, trial(interval("DAY", 7), "Seven-day trial", { price: undefined }),
    "needs_review", "billingCycles", ["7 days", "unspecified"]);
  check(plan(regular("19")), trial(interval("DAY", 7), "Seven days free"),
    "mismatch", "billingCycles", ["7 days", "no trial"]);
  for (const unsupported of [
    plan({ ...regular("19"), fixedPrice: undefined }),
    plan({ ...regular("19"), pricingModel: "TIERED" }),
    { ...plan(regular("19")), quantitySupported: true },
    { ...plan(regular("19")), taxes: { percentage: "5", inclusive: false } },
  ]) check(unsupported, renewal("19"), "needs_review", "billingCycles[0].fixedPrice", ["pricing requires review"]);
  check(plan(regular("19", undefined, 2)), renewal("19"), "needs_review", "billingCycles", ["sequence"]);
  check(configured, claim({ field: "setup_fee", price: price("0") }, source("No setup fee")),
    "needs_review", "setupFee", ["explicit setup fee"]);
  check({ ...configured, setupFee: price("5") }, claim({ field: "setup_fee", price: price("0") }, source("No setup fee")),
    "mismatch", "setupFee", ["0 USD", "5 USD"]);
});

test("orchestration rejects malformed data and keeps unresolved mappings in review", async () => {
  const candidate = { id: "renewal", claim: renewal("19") };
  const configured = plan(regular("19"));
  for (const input of [
    { plan: configured, claims: [{ ...candidate, claim: { ...candidate.claim, price: null } }] },
    { plan: configured, claims: [{ ...candidate, claim: { ...candidate.claim, price: undefined } }] },
    { plan: configured, claims: [{ ...candidate, claim: { ...candidate.claim, evidence: undefined } }] },
    { plan: configured, claims: [{ ...candidate, claim: { ...candidate.claim, quotedInterval: interval("MONTH", 0) } }] },
    { plan: configured, claims: [{ ...candidate, claim: { ...candidate.claim, evidence: { url: "file:///fake", quote: "19 USD" } } }] },
    { plan: plan(), claims: [candidate] },
  ]) assert.deepEqual(await runAudit(input, compareSubscriptionTerms),
    { status: "failed", findings: [], issues: [{ code: "invalid_input" }] });
  assert.deepEqual(await runAudit({ plan: configured, claims: [] }, compareSubscriptionTerms),
    { status: "needs_review", findings: [], issues: [{ code: "missing_claims" }] });
  const unresolved = await runAudit({ claims: [candidate] }, compareSubscriptionTerms);
  assert.deepEqual(unresolved.issues, [{ code: "missing_plan" }]);
  assert.equal(unresolved.findings[0].finding.status, "needs_review");
  assert.deepEqual(unresolved.findings[0].finding.website, candidate.claim.evidence);
});

test("billing cadence can be evaluated independently of renewal price", () => {
  const configured = plan({ ...regular("99", interval("YEAR")), fixedPrice: undefined });
  check(configured, claim({ field: "billing_interval", interval: interval("MONTH", 12) }, source("Billed every 12 months")),
    "match", "billingCycles[0].interval", ["12 calendar months"]);
  check(configured, claim({ field: "billing_interval", interval: interval("MONTH") }, source("Billed monthly")),
    "mismatch", "billingCycles[0].interval", ["1 calendar months", "12 calendar months"]);
});

test("ambiguous offer mapping prevents a price verdict", async () => {
  const advertised = renewal("19");
  const result = await runAudit({
    plan: plan(regular("19")), claims: [{ id: "ambiguous", claim: advertised, ambiguity: "Offer mapping unverified" }],
  }, compareSubscriptionTerms);
  assert.equal(result.status, "needs_review");
  assert.deepEqual(result.issues, [{ code: "ambiguous_claim", claimId: "ambiguous" }]);
  assert.equal(result.findings[0].finding.status, "needs_review");
  assert.deepEqual(result.findings[0].finding.website, advertised.evidence);
});
