# Ayaan integration review and next phase

Reviewed November 5, 2026. GitHub commit `9af71229281c7d631359315f2cde6eab42c2f97a`, authored by `ayaansyed157`, is visible on main in Safari. The exact commit archive was downloaded through the signed-in browser because shell DNS could not resolve GitHub. The archive was reviewed and tested in an isolated temporary directory. The local main checkout was not replaced.

## Implemented work

- `lib/paypal/client.ts` implements sandbox-only OAuth, shared token requests, early expiry, and one retry after a rejected token. It supports an injected fetch transport for tests.
- `lib/paypal/normalize.ts` validates upstream plan IDs, amounts, currencies, and billing cycle structure, then preserves exact price strings, trial/regular cadence, taxes, quantity support, pricing models, and upstream source evidence.
- `lib/paypal/sandbox.ts` is the server-only environment-backed client wrapper and exposes `readSandboxPlan(id)`.
- `lib/paypal/http.ts` requires a configured 32-character-or-longer bearer gate token, compares it with timingSafeEqual, returns no-store JSON, and sanitizes errors.
- `GET /api/paypal/plans` supports explicit pagination and retrieves complete details for each plan.
- `GET /api/paypal/plans/[id]` returns a normalized selected plan.
- Nine mocked tests cover normalization, two trials, money, cadence, caching, token retry/expiry, pagination, input rejection, and safe failure handling.
- Read-only verification scripts and a separately invoked resource-provisioning script are documented. Provisioning was not run during this review.
- Shared PayPal interfaces gained optional context fields. CI, README, and sandbox documentation were updated.

## Verified in this review

| Check | Result |
| --- | --- |
| Nine PayPal mocked tests | Passed using a temporary TypeScript loader on Node 20 |
| Ayaan snapshot lint / typecheck / production build | Passed |
| Nine orchestration tests with updated schema | Passed |
| Combined Ayaan source plus orchestration tests | Passed |
| Actual client and normalizer feeding orchestration, using mock transport | Passed; taxes, quantity, pricing model, and raw evidence preserved |
| Direct sandbox verification using Ayaan's actual client | Blocked by this execution environment's DNS/network access |
| New sandbox resources | None created |

Ayaan's own documentation reports successful live OAuth, listing, plan retrieval, HTTP authorization checks, and fixture provisioning. That is recorded as his reported verification, separate from the mocked checks and blocked live attempt performed here.

## Integration fix

The orchestration's original strict schema rejected the optional `quantitySupported`, `taxes`, `source`, and per-cycle `pricingModel` fields Ayaan now returns. This branch adds those fields to the runtime schema and a regression test confirming they survive unchanged through the comparator boundary. Teammate implementation files were not edited.

## Remaining work

1. On a machine with outbound sandbox access, update the checkout to Ayaan's commit and configure the bearer gate token, sandbox environment, and selected plan ID. Preserve existing credentials.
2. Run the documented verification and HTTP smoke scripts against the actual Next.js server. Confirm genuine response data and secret exclusion.
3. Integrate the orchestration change with main in the integration branch. Resolve both branches' `test` commands so both test suites run.
4. Ayaan's native TypeScript CLI/tests require Node 22.18+ or 24, while package engines currently allow Node 20.9+. Agree on the team runtime or adapt the test runner before combining CI.
5. Bind `loadPlan` to authorized server-side `readSandboxPlan(selectedPlanId)`. Supply Sujeeth's extracted claims and Nilanee's comparator through the existing interfaces.
6. Give Sebastian the resulting evidence records and run status for the dashboard. Unsupported pricing context should result in review findings from the comparator.
7. Leen owns application authentication and rate limiting before public deployment. The current bearer gate is documented for a controlled demo.

The list endpoint fetches detail records sequentially with a timeout per upstream call. A full page can take longer than a single request timeout. Validate deployment duration limits during integration.

## Source

[Reviewed commit](https://github.com/HozaifAwan/hackathon-project/commit/9af71229281c7d631359315f2cde6eab42c2f97a) · [Ayaan's sandbox instructions](https://github.com/HozaifAwan/hackathon-project/blob/9af71229281c7d631359315f2cde6eab42c2f97a/docs/paypal-sandbox.md)

## Subsequent integration status — November 5

The sandbox reader is now bound to the protected audit coordinator. Combined tests and compiled-route checks pass. A later actual Next.js HTTP run on Hozaif’s Mac verified real sandbox listing, normalized plan retrieval, authorization, and audit evidence propagation. See `audit-orchestration.md` for the verified boundary: claims were labeled fixtures and financial comparison remains unconnected. The earlier network-blocked results above are historical. DevOps/security ownership is now open; Leen has left the project.
