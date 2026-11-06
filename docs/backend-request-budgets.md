# Backend request budgets

The controlled single-merchant demo uses one server-side bearer gate. All four API entry points fail closed when `PLANMIRROR_SANDBOX_READ_TOKEN` is absent or shorter than 32 characters. Invalid credentials are rejected before body parsing or provider calls.

## Local limits

- All authenticated API requests share a 60-request fixed window per minute.
- Audit and standalone extraction requests share a separate limit of 10 provider runs per minute and two concurrent runs. Invalid JSON/schema inputs do not consume this provider budget. Failed provider runs do consume it; concurrent-capacity rejections do not. Slots are released on success and failure.
- Exhausted limits return HTTP 429 with a positive integer `Retry-After` in seconds. Retrying cannot create another upstream request until capacity is available.
- Counters are shared across separately compiled Next route bundles within a Node process. They are independent of caller-supplied forwarding/IP headers and store no credentials.

These are in-memory, per-process demo safeguards. Restarting a process resets its counters, and replicas have independent counters. A public multi-instance service needs a shared limiter and application user/merchant authentication; the shared bearer token does not supply that identity model. Do not describe these controls as a global account spend cap.

## Request and provider bounds

Both JSON POST routes require `application/json`, accept at most 32 KiB of streamed bytes, and allow five seconds to finish reading the body. Oversized requests return 413, slow uploads 408, and interrupted or unreadable streams a safe 400. Invalid JSON/schema data returns 400; unsupported media types return 415. Responses, including errors, use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

Source text retains its exact whitespace, is nonblank, and is limited to 20,000 characters within the byte limit. Source URLs must be HTTP(S). The standalone extraction endpoint rejects unknown fields instead of accepting caller-supplied configuration. It does not fetch these URLs. The caller remains responsible for trusted text and merchant/offer mapping.

OpenAI extraction retains its 15-second timeout and now sends `max_output_tokens: 4096` and `store: false`. A truncated/incomplete response remains a failed extraction; partial claims are not compared. The model and credentials have not changed. See the [official OpenAI token documentation](https://developers.openai.com/api/docs/guides/token-counting) for output-token limit semantics.

PayPal requests retain a ten-second upstream timeout. A complete listing page, including OAuth, listing, and detailed plan reads, additionally has a 30-second deadline. Expiry aborts in-flight listing/detail transport, returns a safe 504, and prevents starting later detail requests. A shared OAuth request keeps its own ten-second timeout so one listing cannot cancel another caller's token acquisition. Unexpected upstream pages larger than the requested page size are rejected before fetching their details. Use a smaller `page_size` if the page exceeds its deadline.

## Verification

Run the following in order:

```sh
npm test
npm run lint -- --max-warnings=0
npm run typecheck
npm run build
npm run test:routes
```

The unit tests cover request-window recovery, concurrency cleanup, failed-run accounting, stalled and interrupted uploads, malformed URLs, strict extraction inputs, output-token/storage options, listing cancellation, and excessive upstream pages. Compiled-handler checks verify shared 429 behavior across independently bundled routes and that rejected requests make no upstream calls. These checks use mock provider transport.

For read-only live PayPal verification, explicitly select the intended existing seven-day Quillfox sandbox fixture:

```sh
PAYPAL_SANDBOX_PLAN_ID=P-YOUR_EXISTING_FIXTURE node --env-file=.env.local scripts/verify-sandbox-audit.mjs
```

This script no longer falls back to an arbitrary first plan. It starts a production server on localhost, checks authorization and real sandbox retrieval, and compares a labeled 30-day website fixture claim with the selected plan. It does not call OpenAI, create resources, or modify billing. Its report is written under ignored `.next/`. Missing OpenAI configuration remains a separate teammate dependency.
