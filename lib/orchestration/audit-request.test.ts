import test from "node:test";
import assert from "node:assert/strict";
import { fixtureProviders } from "./fixtures";
import { AuditRequestError, readAuditRequest } from "./audit-request";

function request(body: string, type = "application/json") {
  return new Request("http://localhost/api/audits", { method: "POST", headers: { "Content-Type": type }, body });
}

test("audit request accepts normalized claims and plan selection", async () => {
  const data = { planId: "P-FIXTURE", claims: await fixtureProviders.loadClaims() };
  assert.deepEqual(await readAuditRequest(request(JSON.stringify(data))), data);
});

test("audit request rejects malformed bodies, unexpected fields and media types", async () => {
  for (const body of ["{", "null", '{"planId":"../bad","claims":[]}', '{"planId":"P-TEST","claims":[],"token":"wrong-place"}']) {
    await assert.rejects(readAuditRequest(request(body)),
      error => error instanceof AuditRequestError && error.status === 400);
  }
  await assert.rejects(readAuditRequest(request("{}", "text/plain")),
    error => error instanceof AuditRequestError && error.status === 415);
});

test("audit body limits apply without a Content-Length header", async () => {
  await assert.rejects(readAuditRequest(request(" ".repeat(32769))),
    error => error instanceof AuditRequestError && error.status === 413);
});

test("duplicate claim IDs and excessive claim counts are rejected", async () => {
  const [claim] = await fixtureProviders.loadClaims();
  for (const claims of [[claim, claim], Array.from({ length: 101 }, (_, i) => ({ ...claim, id: String(i) }))]) {
    await assert.rejects(readAuditRequest(request(JSON.stringify({ planId: "P-TEST", claims }))),
      error => error instanceof AuditRequestError && error.status === 400);
  }
});

test("source evidence quotes retain their exact whitespace", async () => {
  const claims = await fixtureProviders.loadClaims();
  claims[0].claim.evidence.quote = "  USD 9.99 per month.\n";
  const result = await readAuditRequest(request(JSON.stringify({ planId: "P-TEST", claims })));
  assert.ok("claims" in result);
  assert.equal(result.claims[0].claim.evidence.quote, claims[0].claim.evidence.quote);
});
