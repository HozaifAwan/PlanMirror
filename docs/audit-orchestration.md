# Audit orchestration integration

This branch provides a coordinator that accepts normalized data and calls an injected comparator. It reuses the existing shared interfaces without changing teammates’ feature files. The fetched main at the start of this work was `ead161b`. Ayaan’s new implementation was not present there. The backup server action and Quillfox comparator were reviewed as references. Their fixed offer assumptions and financial rules were not imported.

## Files and entry points

- `lib/orchestration/contracts.ts` validates the existing shared claim, plan, and finding shapes with the installed Zod dependency. It adds claim IDs, ambiguity flags, provider and comparator signatures, and a result envelope.
- `lib/orchestration/run-audit.ts` provides `runAudit(input, comparator)` and `runAuditFromProviders(providers, comparator)`. Each invocation owns its result and supplies each comparison with an isolated input snapshot.
- `lib/orchestration/fixtures.ts` contains deliberately labeled sample providers and a scripted comparator. Its mismatch verdict is predetermined, so it demonstrates plumbing rather than financial correctness.
- `lib/orchestration/run-audit.test.ts` verifies flow, missing inputs, ambiguity, provider and comparator failures, malformed data, mismatched evidence, and comparator replacement.
- `scripts/test-orchestration.mjs` compiles the isolated tests using the existing TypeScript compiler, runs Node’s built-in test runner, and removes its temporary output even on failure. It adds no test framework.

Run `npm test` for the fixture integration and unit tests. Tests use no credentials or external services.

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

The current shared type supports fixed prices and optional setup fees. Resolve taxes, quantities, tiered pricing, and subscription overrides with Hozaif and Nilanee before returning those plans. The orchestration plan schema rejects unexpected fields rather than discarding additional billing context.

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

This work provides a library and executable fixture integration tests. Connecting it to a server action and UI should happen after teammates’ adapters and comparator are ready. No public endpoint or persistent storage is added.
