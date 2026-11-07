import type { AuditFinding } from "../audit/types";
import type { StudioFinding, StudioRun } from "./types";

const retrievedAt = "2026-11-05T15:00:00.000Z";
const website = (quote: string, path = "pricing") => ({ url: `https://example.com/planmirror-demo/${path}`, quote });
const paypal = (fieldPath: string) => ({ planId: "P-ILLUSTRATIVE-STUDIO-001", fieldPath, retrievedAt });
function record(runId: string, claimId: string, finding: AuditFinding, advertisedDisplay?: string, configuredDisplay?: string): StudioFinding {
  return { id: `${runId}--${claimId}`, claimId, finding, advertisedDisplay, configuredDisplay };
}
const mixedId = "fixture-mixed-v1";
const mixed: StudioRun = {
  id: mixedId, label: "Mixed findings", source: "fixture", status: "needs_review",
  description: "Scripted presentation examples. FAQ evidence needs review; mismatches are separately identified. All URLs and plan IDs are fictional.", issues: [{ code: "CONFLICTING_WEBSITE_SOURCES", claimId: "faq-conflict", message: "FAQ and pricing promises conflict and require review." }],
  findings: [
    record(mixedId, "trial", { offerLabel: "Demo Monthly", field: "trial", status: "mismatch", summary: "The configured trial is 23 days shorter than the advertised trial.", recommendation: "Review the public promise and intended trial configuration.", website: website("Start with a 30-day free trial."), paypal: paypal("billingCycles[0].interval") }, "30 days free", "7 days free"),
    record(mixedId, "monthly-price", { offerLabel: "Demo Monthly", field: "recurring_price", status: "mismatch", summary: "The configured recurring price exceeds the advertised price by USD 5 per month.", website: website("USD 19 per month after your trial."), paypal: paypal("billingCycles[1].fixedPrice") }, "USD 19 / month", "USD 24 / month"),
    record(mixedId, "annual-equivalent", { offerLabel: "Demo Annual", field: "recurring_price", status: "match", summary: "The quoted monthly equivalent equals USD 99 annually in this fixture; collection remains annual upfront.", website: website("USD 8.25 per month, billed annually at USD 99."), paypal: { ...paypal("billingCycles[0].fixedPrice"), planId: "P-ILLUSTRATIVE-ANNUAL-002" } }, "USD 8.25 / month equivalent; USD 99 billed annually", "USD 99 / year, collected upfront"),
    { ...record(mixedId, "faq-conflict", { offerLabel: "Demo Team", field: "recurring_price", status: "needs_review", summary: "FAQ and pricing copy conflict. The FAQ may be stale; these records do not establish which promise is authoritative.", recommendation: "Review both published sources before deciding the intended offer.", website: website("Team costs USD 49 per month.", "faq"), paypal: { ...paypal("billingCycles[0].fixedPrice"), planId: "P-ILLUSTRATIVE-TEAM-003" } }, "FAQ: USD 49 / month; pricing: USD 59 / month", "USD 59 / month"), additionalWebsiteEvidence: [website("Team costs USD 59 per month.")] },
    record(mixedId, "wording", { offerLabel: "Demo Wording", field: "trial", status: "match", summary: "The wording describes the same 30-day free trial; this does not establish equivalence to a calendar month.", website: website("Try free for thirty days."), paypal: { ...paypal("billingCycles[0].interval"), planId: "P-ILLUSTRATIVE-WORDING-004" } }, "Thirty days free", "30 days free"),
  ],
};
const correctedId = "fixture-corrected-v1";
const corrected: StudioRun = { id: correctedId, label: "Corrected sample", source: "fixture", status: "completed", description: "A separate scripted sample with matching trial and monthly price. No provider configuration was changed.", issues: [], findings: [
  record(correctedId, "trial", { ...mixed.findings[0].finding, status: "match", summary: "Both supplied fixture values describe a 30-day free trial.", recommendation: undefined, website: website("Start with a 30-day free trial."), paypal: paypal("billingCycles[0].interval") }, "30 days free", "30 days free"),
  record(correctedId, "monthly-price", { ...mixed.findings[1].finding, status: "match", summary: "Both supplied fixture values describe USD 19 per month.", website: website("USD 19 per month after your trial."), paypal: paypal("billingCycles[1].fixedPrice") }, "USD 19 / month", "USD 19 / month"),
] };
const reviewId = "fixture-partial-v1";
export const studioRuns: StudioRun[] = [mixed, corrected,
  { id: reviewId, label: "Partial evidence / review", source: "fixture", status: "needs_review", description: "Missing evidence and unsupported terms require human review; no financial verdict was produced.", issues: [{ code: "COMPARATOR_UNAVAILABLE", message: "No supported comparison was available for these terms." }], findings: [
    record(reviewId, "setup-fee", { offerLabel: "Demo Unmapped", field: "setup_fee", status: "needs_review", summary: "The setup-fee claim has no mapped plan evidence.", website: website("A setup fee may apply.", "terms") }),
    record(reviewId, "interval", { offerLabel: "Demo Missing Source", field: "billing_interval", status: "needs_review", summary: "The website evidence is unavailable; the configured interval alone cannot establish a match.", paypal: paypal("billingCycles[0].interval") }, undefined, "1 month"),
  ] },
  { id: "fixture-failure-v1", label: "Provider failure", source: "fixture", status: "failed", description: "Illustrative provider failure. No request was sent and no results were substituted.", findings: [], issues: [{ code: "PROVIDER_UNAVAILABLE", message: "The simulated plan provider failed. Choose another sample scenario to inspect evidence." }] },
  { id: "fixture-empty-v1", label: "Empty loaded run", source: "fixture", status: "needs_review", description: "A loaded sample contains no findings. This does not establish that an offer is correct.", findings: [], issues: [{ code: "NO_CLAIMS", message: "No supported claims were supplied for comparison." }] },
  { id: "fixture-not-started-v1", label: "No audit yet", source: "fixture", status: "not_started", description: "No audit has been loaded in this sample state. Choose a sample scenario to explore the dashboard.", findings: [], issues: [] },
];
