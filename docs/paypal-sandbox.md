# PayPal sandbox integration

This is a single controlled demo merchant integration, not production readiness or multi-merchant onboarding.

## Local configuration

1. In the [Developer Dashboard](https://developer.paypal.com/dashboard/), open Testing Tools → Sandbox Accounts. Use the sandbox **Business** account associated with your app. A Personal sandbox account is only needed for buyer checkout tests.
2. Under Apps & Credentials select **Sandbox**, then create/select a Merchant REST app associated with that Business account. Copy its Client ID and Secret locally; never share your actual PayPal login.
3. Copy `.env.example` to `.env.local` only if it does not already exist. Fill `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENVIRONMENT=sandbox`.
4. Generate a local API gate token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Save it as `PLANMIRROR_SANDBOX_READ_TOKEN`. Keep it server-side. Missing/short tokens disable the routes.
5. Optionally set `PAYPAL_SANDBOX_PLAN_ID` to the test plan ID (`P-...`). Do not commit filled environment files.
6. Run `npm ci` and `npm run dev`, then open http://localhost:3000. Restart the server after changing environment variables.

Native TypeScript test/CLI scripts require **Node 22.18+ or Node 24**. The application retains its existing Next.js Node requirement.

## Read endpoints

Both endpoints require `Authorization: Bearer <PLANMIRROR_SANDBOX_READ_TOKEN>` and return `Cache-Control: no-store`. Use Postman or another local HTTP client; the gate token must not be embedded in frontend source or query strings.

- `GET /api/paypal/plans?page=1&page_size=20`: returns `plans`, `page`, `pageSize`, `totalItems`, `totalPages`, and `nextPage`. Follow `nextPage` until null. Page size is 1–20. Each listed plan is retrieved individually for complete details.
- `GET /api/paypal/plans/P-...`: returns one normalized `PayPalBillingPlan`.

Responses: 400 invalid input, 401 invalid/missing bearer credential, 404 unknown sandbox plan, 503 disabled/misconfigured integration, 502 PayPal/network/validation failure. Upstream error bodies, credentials, and OAuth tokens are never returned or logged. Requests use a fixed sandbox origin, no redirects, no caching, and 10-second upstream timeouts. OAuth requests are shared, tokens expire early, and a rejected token is refreshed once.

This bearer gate is appropriate only for a controlled demo. Keep it disabled on public deployments unless you add application user authentication, authorization and rate limits. API credentials may have write privileges even though the web routes are read-only; distribute them only to teammates who need backend access.

## Tests and fixture

```powershell
npm test
npm run lint
npm run typecheck
npm run build
node --env-file=.env.local scripts/paypal-verify.mjs
# Explicit sandbox-only product/plan provisioning, if a suitable fixture does not exist:
node --env-file=.env.local scripts/paypal-create-fixture.mjs
# With the local Next server running and gate token configured:
node --env-file=.env.local scripts/paypal-http-check.mjs
```

Mock tests exercise normalization, two trials, exact money, nonmonthly billing, token reuse/refresh/expiry, pagination and safe failures. They are separate from live tests. The provisioning script reuses a suitable plan/product, creates a Quillfox Pro fixture if needed (7 free days, then USD 9.99/month), verifies retrieval, and saves its ID in ignored `.env.local`. It does not create subscriptions or payments. PayPal request IDs protect retries, but do not run provisioning concurrently.

Verified on November 5, 2026: actual sandbox OAuth, plan listing, fixture creation and detailed retrieval succeeded. Product `PROD-6BF53774BG918645P`, plan `P-8BL77335HB870063TNLWDC7Q`. The returned trial was USD 0.0 for one 7-day cycle; recurring billing was USD 9.99 every month, unlimited cycles. Local HTTP checks passed for unauthorized access (401), invalid inputs (400), missing plan (404), and authenticated listing/detail retrieval (200), with no credentials in responses. Nine mocked tests, lint, typecheck and the webpack production build passed. The default build command uses webpack because Turbopack's CSS subprocess failed on this Windows environment.

If you see `ENOTFOUND` or a connection failure, check your execution environment's network permissions, DNS, VPN and proxy. Failed connections do not establish that credentials are invalid. Run the same read-only verification in an environment with outbound access to `api-m.sandbox.paypal.com`; never switch to production to work around sandbox connectivity.

## Comparison handoff

Authorized server code can import `readSandboxPlan(id)` from `lib/paypal/sandbox.ts`. It returns the existing `PayPalBillingPlan` contract with additive optional evidence fields. Keep this import out of client components. The AI engineer supplies website claims; the comparison engineer compares those claims with `billingCycles` and `setupFee`, then attaches plan ID, `retrievedAt` and source field paths to findings.

Money stays in exact decimal strings; no arithmetic or currency conversion occurs here, so Decimal.js is not needed in this adapter. Each cycle retains its cadence and count; `totalCycles=0` means unlimited. A 7-day interval executed once is seven trial days. Do not flatten two trials or convert calendar months into days. Missing fixed prices, tiered pricing, quantity-dependent plans, taxes and differing currencies require explicit comparison support or `needs_review`. Full upstream plan fields are retained in `source` for evidence; `pricingModel`, taxes and quantity support are also exposed. The adapter does not implement the comparison engine, AI extraction or dashboard.

## Official references

- [REST setup and OAuth](https://developer.paypal.com/api/rest/)
- [Sandbox accounts](https://developer.paypal.com/sandbox-testing/accounts)
- [Subscriptions API](https://developer.paypal.com/api/subscriptions/v1/)
- [Create a plan](https://developer.paypal.com/api/subscriptions/v1/plans-create)
