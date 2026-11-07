// Verify the compiled Next.js route handlers with mock upstream transport.
// Run after npm run build. No local listener or real credentials are required.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const require = createRequire(import.meta.url);
const gate = randomBytes(32).toString("hex");
process.env.PAYPAL_CLIENT_ID = "route-test-client";
process.env.PAYPAL_CLIENT_SECRET = "route-test-secret";
process.env.PAYPAL_ENVIRONMENT = "sandbox";
process.env.OPENAI_API_KEY = "route-test-openai";
process.env.PLANMIRROR_SANDBOX_READ_TOKEN = gate;

const rawPlan = {
  id: "P-ROUTETEST", product_id: "PROD-ROUTETEST", name: "Route fixture", status: "ACTIVE",
  billing_cycles: [{ sequence: 1, tenure_type: "TRIAL", total_cycles: 1,
    frequency: { interval_unit: "DAY", interval_count: 7 },
    pricing_scheme: { fixed_price: { value: "0", currency_code: "USD" } } },
    { sequence: 2, tenure_type: "REGULAR", total_cycles: 0,
    frequency: { interval_unit: "MONTH", interval_count: 1 },
    pricing_scheme: { fixed_price: { value: "9.99", currency_code: "USD" } } }],
};
let upstreamCalls = 0;
let failUpstream = false;
let extractionMode = "ok";
let extractionCalls = 0;
globalThis.fetch = async (url, options) => {
  upstreamCalls++;
  if (String(url) === "https://api.openai.com/v1/responses") {
    extractionCalls++;
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    if (extractionMode === "timeout") throw new DOMException("Private upstream failure", "TimeoutError");
    if (extractionMode === "failure") throw Error("Private upstream failure");
    const output = extractionMode === "review"
      ? { status: "needs_review", claims: [], reason: "Ambiguous fixture" }
      : { status: "ok", reason: null, claims: [{ field: "trial", offerLabel: "Route fixture", price: null,
          duration: { unit: "DAY", count: 30 }, evidence: { url: "https://example.com/pricing", quote: "30 days free." } }] };
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
  }
  assert.ok(String(url).startsWith("https://api-m.sandbox.paypal.com/"));
  assert.equal(options.redirect, "error");
  assert.equal(options.cache, "no-store");
  if (failUpstream) throw Error("Private upstream failure");
  if (String(url).endsWith("/token")) return Response.json({ access_token: "route-test-oauth", expires_in: 3600 });
  assert.equal(options.headers.Prefer, "return=representation");
  if (String(url).includes("/plans?")) return Response.json({
    plans: [{ id: rawPlan.id }], total_items: 1, total_pages: 1,
  });
  if (String(url).endsWith("/P-MISSING")) return Response.json({}, { status: 404 });
  return Response.json(rawPlan);
};

const audit = require("../.next/server/app/api/audits/route.js").routeModule.userland.POST;
const list = require("../.next/server/app/api/paypal/plans/route.js").routeModule.userland.GET;
const detail = require("../.next/server/app/api/paypal/plans/[id]/route.js").routeModule.userland.GET;
const extract = require("../.next/server/app/api/ai/extract/route.js").routeModule.userland.POST;

async function check(label, handler, path, options, expected, context) {
  const response = await handler(new Request("http://localhost" + path, options), context);
  const text = await response.text();
  assert.equal(response.status, expected, label);
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const value of [gate, "route-test-client", "route-test-secret", "route-test-oauth", "route-test-openai", "Private upstream failure"]) {
    assert.ok(!text.includes(value), "Sensitive data in " + label);
  }
  console.log("PASS", label);
  return JSON.parse(text);
}
const authorized = { Authorization: "Bearer " + gate };
const json = { ...authorized, "Content-Type": "application/json" };
await check("unauthorized plan listing", list, "/api/paypal/plans", {}, 401);
await check("wrong gate token", list, "/api/paypal/plans", { headers: { Authorization: "Bearer wrong" } }, 401);
await check("invalid pagination", list, "/api/paypal/plans?page=0", { headers: authorized }, 400);
await check("unknown listing query", list, "/api/paypal/plans?token=bad", { headers: authorized }, 400);
await check("unauthorized audit", audit, "/api/audits", { method: "POST", body: "{}" }, 401);
await check("invalid audit input", audit, "/api/audits", { method: "POST", headers: json, body: '{"planId":"../bad","claims":[]}' }, 400);
await check("invalid audit JSON", audit, "/api/audits", { method: "POST", headers: json, body: "{" }, 400);
await check("invalid audit media type", audit, "/api/audits", { method: "POST", headers: authorized, body: "{}" }, 415);
await check("oversized audit body", audit, "/api/audits", { method: "POST", headers: json, body: " ".repeat(32769) }, 413);
assert.equal(upstreamCalls, 0, "Unauthorized or invalid requests must not reach PayPal");
const plans = await check("normalized plan listing", list, "/api/paypal/plans", { headers: authorized }, 200);
assert.equal(plans.plans[0].billingCycles[0].fixedPrice.currencyCode, "USD");
await check("missing plan", detail, "/api/paypal/plans/P-MISSING", { headers: authorized }, 404, { params: Promise.resolve({ id: "P-MISSING" }) });
const plan = await check("normalized plan details", detail, "/api/paypal/plans/P-ROUTETEST", { headers: authorized }, 200,
  { params: Promise.resolve({ id: rawPlan.id }) });
assert.equal(plan.productId, rawPlan.product_id);
assert.equal(plan.billingCycles[1].fixedPrice.value, "9.99");
const requestBody = JSON.stringify({
  planId: rawPlan.id,
  claims: [{ id: "renewal", claim: { field: "recurring_price", offerLabel: "Route fixture",
    price: { value: "9.99", currencyCode: "USD" }, quotedInterval: { unit: "MONTH", count: 1 },
    evidence: { url: "https://example.com/pricing", quote: "USD 9.99 monthly" } } }],
});
const result = await check("audit compares a normalized claim with sandbox plan", audit, "/api/audits",
  { method: "POST", headers: json, body: requestBody }, 200);
assert.equal(result.status, "completed");
assert.deepEqual(result.issues, []);
assert.equal(result.findings[0].finding.status, "match");
assert.equal(result.findings[0].finding.paypal.fieldPath, "billingCycles[1].fixedPrice");
const sourceBody = JSON.stringify({ planId: rawPlan.id, source: {
  sourceUrl: "https://example.com/pricing", sourceText: "30 days free.", offerLabel: "Route fixture",
} });
await check("unauthorized extraction audit", audit, "/api/audits", { method: "POST", body: sourceBody }, 401);
assert.equal(extractionCalls, 0);
const extracted = await check("extracted claims join real audit route", audit, "/api/audits", { method: "POST", headers: json, body: sourceBody }, 200);
assert.equal(extracted.status, "completed");
assert.equal(extracted.findings[0].finding.status, "mismatch");
assert.match(extracted.findings[0].finding.summary, /30 days.*7 days/);
assert.equal(extracted.findings[0].finding.website.quote, "30 days free.");
assert.equal(extracted.findings[0].finding.paypal.planId, rawPlan.id);
assert.deepEqual(extracted.issues, []);
assert.equal(extractionCalls, 1);
extractionMode = "review";
const reviewed = await check("ambiguous extraction requires review", audit, "/api/audits", { method: "POST", headers: json, body: sourceBody }, 200);
assert.equal(reviewed.findings.length, 0);
assert.ok(reviewed.issues.some(issue => issue.code === "extraction_needs_review"));
extractionMode = "failure";
const extractionFailure = await check("extraction provider failure is explicit", audit, "/api/audits", { method: "POST", headers: json, body: sourceBody }, 502);
assert.ok(extractionFailure.issues.some(issue => issue.code === "provider_failed" && issue.stage === "claims"));
extractionMode = "timeout";
const timedOut = await check("extraction timeout fails safely", audit, "/api/audits", { method: "POST", headers: json, body: sourceBody }, 502);
assert.equal(timedOut.status, "failed");
assert.ok(timedOut.issues.some(issue => issue.code === "provider_failed" && issue.stage === "claims"));
failUpstream = true;
const failed = await check("upstream failure stops audit safely", audit, "/api/audits",
  { method: "POST", headers: json, body: requestBody }, 502);
assert.equal(failed.status, "failed");
extractionMode = "ok";
const extractBody = JSON.stringify({ sourceUrl: "https://example.com/pricing", sourceText: "30 days free." });
await check("standalone extraction shares protected input handling", extract, "/api/ai/extract",
  { method: "POST", headers: json, body: extractBody }, 200);
await check("standalone extraction rejects non-JSON input", extract, "/api/ai/extract",
  { method: "POST", headers: authorized, body: extractBody }, 415);
let limited;
for (let i = 0; i < 11; i++) {
  const response = await extract(new Request("http://localhost/api/ai/extract", { method: "POST", headers: json, body: extractBody }));
  if (response.status === 429) { limited = response; break; }
  assert.equal(response.status, 200);
}
assert.ok(limited, "Provider budget must be enforced");
assert.match(limited.headers.get("retry-after"), /^\d+$/);
assert.equal(limited.headers.get("cache-control"), "no-store");
const callsAtLimit = upstreamCalls;
await check("provider budget is shared across extraction and audit bundles", audit, "/api/audits",
  { method: "POST", headers: json, body: sourceBody }, 429);
assert.equal(upstreamCalls, callsAtLimit);
for (let i = 0; i < 61; i++) {
  const response = await list(new Request("http://localhost/api/paypal/plans?page=0", { headers: authorized }));
  if (response.status === 429) { limited = response; break; }
  assert.equal(response.status, 400);
  limited = undefined;
}
assert.ok(limited, "Authenticated request budget must be enforced");
await check("request budget is shared with standalone extraction", extract, "/api/ai/extract",
  { method: "POST", headers: json, body: extractBody }, 429);
assert.equal(upstreamCalls, callsAtLimit);
process.env.PLANMIRROR_SANDBOX_READ_TOKEN = "";
await check("disabled gate fails closed", audit, "/api/audits", { method: "POST", headers: json, body: requestBody }, 503);
console.log("Compiled route checks passed with mock PayPal transport.");
