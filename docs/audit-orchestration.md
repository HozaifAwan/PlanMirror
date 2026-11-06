# Audit orchestration integration

This branch provides a coordinator that accepts normalized data and calls an injected comparator. It reuses the existing shared interfaces without changing teammates’ feature files. The fetched main at the start of this work was `ead161b`. Ayaan’s new implementation was not present there. The backup server action and Quillfox comparator were reviewed as references. Their fixed offer assumptions and financial rules were not imported.

## Files and entry points

- `lib/orchestration/contracts.ts` validates the existing shared claim, plan, and finding shapes with the installed Zod dependency. It adds claim IDs, ambiguity flags, provider and comparator signatures, and a result envelope.
- `lib/orchestration/run-audit.ts` provides `runAudit(input, comparator)` and `runAuditFromProviders(providers, comparator)`. Each invocation owns its result and supplies each comparison with an isolated input snapshot.
- `lib/orchestration/fixtures.ts` contains deliberately labeled sample providers and a scripted comparator. Its mismatch verdict is predetermined, so it demonstrates plumbing rather than financial correctness.
- `lib/orchestration/run-audit.test.ts` verifies flow, missing inputs, ambiguity, provider and comparator failures, malformed data, mismatched evidence, and comparator replacement.
- `scripts/test-all.mjs` compiles the PayPal and orchestration tests using the existing TypeScript compiler, runs Node’s built-in test runner, and removes its temporary output even on failure. It adds no test framework.

Run `npm test` for both the PayPal and orchestration unit/integration suites. After `npm run build`, run `npm run test:routes` to exercise the compiled Next.js handlers with mock PayPal transport. Tests use no credentials or external services.

## Minimal contracts

The existing types in `lib/paypal/types.ts` and `lib/audit/types.ts` remain the source of truth.

| Input | Required information |
| --- | --- |
| PayPalBillingPlan | Plan and product IDs, name, status, retrieval timestamp, and normalized billing cycles |
| Billing cycle | Sequence, trial or regular tenure, interval unit/count, total cycles, and optional fixed price |
| Money | Decimal value as text and three-letter uppercase currency |
| AdvertisedSubscriptionClaim | Offer label, field discriminator, normalized terms, HTTP(S) source URL, and verbatim quote |
| CandidateClaim | Stable unique ID for this run, claim, and optional ambiguity reason |
| AuditFinding | Same offer label and field as the input, status, summary, and evidence |
| AuditResult | Overall status, findings paired with claim IDs, and structured issues |

A completed run can contain mismatches. Completed means every requested comparison returned a valid result. Missing inputs or any review finding make the run `needs_review`. Invalid input or failed providers make it `failed`.

`match` and `mismatch` findings must have website and PayPal evidence. Website quotes and URLs must match the supplied claim. PayPal plan IDs and retrieval timestamps must match the supplied plan. The comparator owns the accuracy of the normalized PayPal field path and its comparison semantics.

## Teammate handoffs

### Ayaan

Implement an adapter with the signature `() => Promise<PayPalBillingPlan | undefined>`. Return the normalized plan from the authorized sandbox merchant. Return undefined for an explicitly absent plan and throw for retrieval/authentication/normalization failures. Use ISO UTC retrieval timestamps. Preserve decimal amounts as text.

The current shared type supports fixed prices and optional setup fees. Resolve taxes, quantities, tiered pricing, and subscription overrides with Hozaif and Nilanee before returning those plans. The orchestration plan schema accepts Ayaan’s optional quantitySupported, taxes, source, and per-cycle pricingModel fields and preserves them for the comparator. Unexpected fields are rejected.

### Sujeeth

Implement `() => Promise<CandidateClaim[]>`. Return an empty list when there are no extracted claims, and throw if the extraction service failed. Each candidate needs a unique ID, an existing `AdvertisedSubscriptionClaim`, and source URL and quote. Put an ambiguity reason on every candidate that should wait for human review. Establish the selected offer and merchant context before supplying claims.

### Nilanee

Implement `Comparator`, accepting `{ plan, claim }` and returning an `AuditFinding` synchronously or asynchronously. One claim produces one finding. Return `needs_review` when pricing semantics are unsupported. Carry forward the exact website evidence, plan ID, and timestamp. Use paths into the normalized plan such as `billingCycles[0].fixedPrice`. A thrown error becomes a review result for that claim while the other comparisons continue.

### Sebastian

Consume `AuditResult`. Render `findings[].claimId` as the identity and `findings[].finding` as the evidence record. Display run status independently from finding status. Explain missing inputs and failures using `issues[].code`; provider issues include the failing stage. Only supplied evidence should drive dashboard or agent explanations.

## Fixture example

```ts
import { runAuditFromProviders } from "../lib/orchestration/run-audit";
import { fixtureProviders, fixtureComparator } from "../lib/orchestration/fixtures";

const result = await runAuditFromProviders(fixtureProviders, fixtureComparator);
// result.status === "completed"
// result.findings[0].finding.status === "mismatch"
// The summary explicitly labels the result as a scripted fixture.
```

To integrate real modules, pass adapters exposing the same provider signatures and Nilanee’s comparator. The orchestration code stays the same.

## Failure handling and integration limits

Providers run concurrently and both settle before a result is returned. A failed provider aborts comparisons with a structured stage issue. Raw exceptions are excluded from output. Missing plans and ambiguous claims bypass the comparator. Invalid comparator outputs produce review findings.

Adapters own request timeouts, authorization, cancellation, and response normalization. The caller owns merchant/offer mapping and trusted source collection. The coordinator validates evidence references but cannot establish the truth of an extracted quote or pricing calculation. It does not fetch arbitrary URLs or call providers itself.

The server-only adapter in `lib/orchestration/sandbox-audit.ts` binds Ayaan's actual `readSandboxPlan` to `createPlanAudit`. Authorized backend callers pass a selected plan ID, claim provider, and optional comparator.

The protected `POST /api/audits` endpoint accepts already normalized claims until Sujeeth's extraction adapter is connected. It uses Ayaan's existing bearer authorization and response helpers. Requests must use JSON, fit within 32 KiB, and contain at most 100 unique claim IDs. It rejects unknown top-level fields and validates inputs before calling PayPal. Upstream failures return HTTP 502 with a failed audit envelope. When the comparator is absent, successful retrieval returns HTTP 200 with `needs_review`, a `comparator_unavailable` issue, and plan/source references. This result does not assess whether advertised and configured prices match.

The UI and extraction provider remain teammate dependencies. The endpoint is intended for the same controlled single-merchant demo as Ayaan's existing routes. The open DevOps/security role should add application user authentication and rate limits before exposing it publicly.


## Integration handoff for tomorrow

Sujeeth should return `CandidateClaim[]` via a server-side function. Each candidate needs `id`, `claim`, and optional `ambiguity`. Use `claimsSchema.safeParse` to check his output. He can call `auditSandboxPlan(planId, () => extractClaims(...), comparator)` after authorizing the request. The current HTTP endpoint instead accepts those claims directly as JSON.

Nilanee should implement `Comparator`. Pass it as the third argument in `sandbox-audit.ts` or from the route's server call once her module is available. Retain `needs_review` for unsupported semantics and evidence references on every conclusive finding.

Example request body, using a deliberately illustrative plan ID and source:

```json
{
  "planId": "P-REPLACEWITHYOURPLAN",
  "claims": [{
    "id": "renewal",
    "claim": {
      "offerLabel": "Selected offer",
      "field": "recurring_price",
      "price": { "value": "9.99", "currencyCode": "USD" },
      "quotedInterval": { "unit": "MONTH", "count": 1 },
      "evidence": { "url": "https://example.com/pricing", "quote": "USD 9.99 per month." }
    }
  }]
}
```

Send the locally configured audit gate token in the Authorization Bearer header. Keep credentials out of JSON bodies and URLs.

Ayaan's native TypeScript CLI scripts still need Node 22.18+ or 24. The combined `npm test` command now compiles modules with the installed TypeScript compiler, so the existing application minimum of Node 20.9 also supports both test suites. The DevOps owner can standardize the team's Node version.


## Verification of the combined implementation

The combined test runner uses the installed TypeScript compiler and Node's built-in test runner, with no added dependencies. The compiled handler tests call the real Next.js route exports with a mocked upstream fetch. They cover both PayPal read routes and the new audit route, including authorization failures, validation, size limits, missing plans, normalized results, absent comparators, upstream failures, and exclusion of test credentials from responses.

An earlier restricted execution attempt returned a safe HTTP 502 because outbound DNS/network access and local listeners were blocked there. This limitation was subsequently bypassed by running the application normally on Hozaif’s Mac; the successful live verification below supersedes the earlier pending status.

A local random read-gate token was added to ignored `.env.local` where it was missing. Existing PayPal credentials were preserved. No sandbox products, plans, subscriptions, or payments were created.

## Live application verification

After building, use Node 22.18+ or 24 to run:

```bash
node --env-file=.env.local scripts/verify-sandbox-audit.mjs
```

The script starts and stops its own local Next.js production server on port 3137. It checks unauthorized requests, real plan listing and details, normalization, and the protected audit endpoint using the real sandbox reader. It uses an explicitly labeled fixture claim to test the orchestration handoff while extraction and comparison are pending. Success requires a review result with the selected real plan ID and preserved website evidence. It saves a safe summary in ignored `.next/sandbox-audit-verification.json`. No billing resources are created or modified.

Live verification completed on Hozaif's Mac on November 5, 2026 using Node 22.23.4 and implementation commit `bebe340`. The running Next.js server rejected unauthorized/invalid requests, listed the sandbox account's real plans, retrieved and normalized plan `P-8BL77335HB870063TNLWDC7Q`, and carried that plan through `POST /api/audits`. Website evidence and plan references were retained. The comparison module was explicitly reported as unavailable. Claims were labeled fixtures, so this verifies the live PayPal-to-orchestration bridge. Real extraction, financial verdicts, and dashboard integration remain pending teammate work. No credentials were printed or billing resources modified.
