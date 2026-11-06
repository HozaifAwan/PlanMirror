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
process.env.PLANMIRROR_SANDBOX_READ_TOKEN = gate;

const rawPlan = {
  id: "P-ROUTETEST", product_id: "PROD-ROUTETEST", name: "Route fixture", status: "ACTIVE",
  billing_cycles: [{ sequence: 1, tenure_type: "REGULAR", total_cycles: 0,
    frequency: { interval_unit: "MONTH", interval_count: 1 },
    pricing_scheme: { fixed_price: { value: "9.99", currency_code: "USD" } } }],
};
let upstreamCalls = 0;
let failUpstream = false;
globalThis.fetch = async (url, options) => {
  upstreamCalls++;
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

async function check(label, handler, path, options, expected, context) {
  const response = await handler(new Request("http://localhost" + path, options), context);
  const text = await response.text();
  assert.equal(response.status, expected, label);
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const value of [gate, "route-test-client", "route-test-secret", "route-test-oauth", "Private upstream failure"]) {
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
assert.equal(plan.billingCycles[0].fixedPrice.value, "9.99");
const requestBody = JSON.stringify({
  planId: rawPlan.id,
  claims: [{ id: "renewal", claim: { field: "recurring_price", offerLabel: "Route fixture",
    price: { value: "9.99", currencyCode: "USD" }, quotedInterval: { unit: "MONTH", count: 1 },
    evidence: { url: "https://example.com/pricing", quote: "USD 9.99 monthly" } } }],
});
const result = await check("audit without comparator requires review", audit, "/api/audits",
  { method: "POST", headers: json, body: requestBody }, 200);
assert.equal(result.status, "needs_review");
assert.equal(result.findings[0].finding.status, "needs_review");
assert.ok(result.issues.some(issue => issue.code === "comparator_unavailable"));
failUpstream = true;
const failed = await check("upstream failure stops audit safely", audit, "/api/audits",
  { method: "POST", headers: json, body: requestBody }, 502);
assert.equal(failed.status, "failed");
process.env.PLANMIRROR_SANDBOX_READ_TOKEN = "";
await check("disabled gate fails closed", audit, "/api/audits", { method: "POST", headers: json, body: requestBody }, 503);
console.log("Compiled route checks passed with mock PayPal transport.");
