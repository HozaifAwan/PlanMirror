// Run after npm run build, using node --env-file=.env.local scripts/verify-sandbox-audit.mjs.
// Starts its own local production server and performs read-only real sandbox checks.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { once } from "node:events";

const base = "http://127.0.0.1:3137";
const gate = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
assert.ok(gate?.length >= 32, "Configure the local sandbox read token first.");
assert.ok(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET, "Configure sandbox credentials first.");
const secrets = [gate, process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET];
const passed = [];
const server = spawn(process.execPath, [
  "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3137",
], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });

async function read(path, options, status) {
  const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(60_000) });
  const text = await response.text();
  assert.equal(response.status, status, "Unexpected HTTP status for " + path);
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const value of secrets) assert.ok(!text.includes(value), "Response contains a credential");
  assert.ok(!text.includes('"access_token"'), "Response contains an OAuth token field");
  return JSON.parse(text);
}

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Local verification server did not start.")), 15_000);
    server.stdout.on("data", chunk => {
      if (chunk.toString().includes("Ready")) { clearTimeout(timeout); resolve(); }
    });
    server.once("exit", () => { clearTimeout(timeout); reject(Error("Local verification server exited.")); });
    server.once("error", () => { clearTimeout(timeout); reject(Error("Local verification server could not start.")); });
  });
  const headers = { Authorization: "Bearer " + gate };
  await read("/api/paypal/plans", {}, 401);
  await read("/api/paypal/plans?page=0", { headers }, 400);
  await read("/api/audits", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, 401);
  passed.push("unauthorized and invalid requests rejected");

  const listing = await read("/api/paypal/plans?page_size=1", { headers }, 200);
  assert.ok(Array.isArray(listing.plans), "Invalid listing structure");
  const id = process.env.PAYPAL_SANDBOX_PLAN_ID || listing.plans[0]?.id;
  assert.ok(id, "The account has no plans. Individual-plan verification cannot proceed.");
  const plan = await read("/api/paypal/plans/" + id, { headers }, 200);
  assert.equal(plan.id, id);
  assert.ok(plan.productId && plan.status && plan.retrievedAt);
  assert.ok(Array.isArray(plan.billingCycles) && plan.billingCycles.length > 0);
  assert.ok(plan.billingCycles.some(cycle => cycle.tenure === "REGULAR"));
  for (const cycle of plan.billingCycles) {
    assert.ok(cycle.interval.count > 0);
    if (cycle.fixedPrice) {
      assert.match(cycle.fixedPrice.value, /^\d+(\.\d+)?$/);
      assert.match(cycle.fixedPrice.currencyCode, /^[A-Z]{3}$/);
    }
  }
  passed.push("real sandbox listing and normalized detail retrieval");

  const claims = [{
    id: "live-bridge-fixture-trial",
    claim: {
      field: "trial", offerLabel: plan.name,
      duration: { unit: "DAY", count: 30 },
      evidence: { url: "https://example.com/fixture-pricing", quote: "FIXTURE: 30 days free." },
    },
  }];
  const result = await read("/api/audits", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ planId: id, claims }),
  }, 200);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.issues, []);
  assert.equal(result.findings.length, 1);
  const finding = result.findings[0].finding;
  assert.equal(finding.status, "mismatch");
  assert.equal(finding.paypal.planId, id);
  assert.ok(finding.paypal.retrievedAt);
  assert.deepEqual(finding.website, claims[0].claim.evidence);
  passed.push("real sandbox plan flows through protected audit orchestration");
  passed.push("comparator preserves evidence");

  const report = {
    passed: true, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    checkedAt: new Date().toISOString(), planId: id,
    billingSource: "real_paypal_sandbox", claimsSource: "labeled_fixture",
    comparatorConnected: true, checks: passed,
  };
  writeFileSync(".next/sandbox-audit-verification.json", JSON.stringify(report, null, 2) + "\n");
  for (const check of passed) console.log("PASS:", check);
  console.log("Live backend and orchestration verified. Claims were fixtures; the comparator used the selected plan.");
} catch {
  console.error("Verification failed. No live success is claimed. Check server configuration and sandbox connectivity.");
  process.exitCode = 1;
} finally {
  if (server.exitCode === null && !server.killed) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
}
