import test from "node:test";
import assert from "node:assert/strict";
import { createRequestLimits, RequestLimitError } from "../lib/backend/request-limits.ts";
import { JsonRequestError, readJsonRequest } from "../lib/backend/json-request.ts";

test("authenticated request budget resets and returns a bounded retry delay", () => {
  let now = 0;
  const limits = createRequestLimits(() => now);
  for (let i = 0; i < 60; i++) limits.checkRequest();
  now = 10_000;
  assert.throws(() => limits.checkRequest(), error => error instanceof RequestLimitError && error.retryAfter === 50);
  now = 60_000;
  assert.doesNotThrow(() => limits.checkRequest());
});

test("provider budget counts failures and refuses more work until the next window", async () => {
  let now = 0;
  const limits = createRequestLimits(() => now);
  for (let i = 0; i < 10; i++) await assert.rejects(limits.runProviderWork(async () => { throw Error("provider failed"); }));
  let called = false;
  await assert.rejects(limits.runProviderWork(async () => { called = true; }), { status: 429, retryAfter: 60 });
  assert.equal(called, false);
  now = 60_000;
  assert.equal(await limits.runProviderWork(async () => "recovered"), "recovered");
});

test("provider concurrency rejects excess work and releases slots after success and failure", async () => {
  const limits = createRequestLimits();
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const a = limits.runProviderWork(() => waiting);
  const b = limits.runProviderWork(() => waiting);
  await assert.rejects(limits.runProviderWork(async () => assert.fail("must not run")), { status: 429, retryAfter: 1 });
  release();
  await Promise.all([a, b]);
  await assert.rejects(limits.runProviderWork(async () => { throw Error("failed"); }));
  assert.equal(await limits.runProviderWork(async () => "released"), "released");
});

function streamedRequest(stream, signal) {
  return new Request("http://localhost/api/audits", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half", signal,
  });
}

test("JSON upload timeout cancels a stalled stream without waiting for cancellation", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } });
  await assert.rejects(readJsonRequest(streamedRequest(stream), 5), error => error instanceof JsonRequestError && error.status === 408);
  assert.equal(cancelled, true);
});

test("interrupted and failed request streams produce safe client errors", async () => {
  const controller = new AbortController();
  const pending = readJsonRequest(streamedRequest(new ReadableStream(), controller.signal));
  controller.abort(new Error("PRIVATE"));
  await assert.rejects(pending, { status: 400, message: "Request was interrupted." });
  await assert.rejects(readJsonRequest(streamedRequest(new ReadableStream({ start(c) { c.error(Error("PRIVATE")); } }))),
    { status: 400, message: "Request body could not be read." });
});
