import { randomUUID } from "node:crypto";
import { compareSubscriptionTerms } from "../audit/compare-subscription-terms";
import { quillfoxClaims, quillfoxCrossPageClaims, quillfoxOffer, quillfoxPricingSourceText, quillfoxSourceUrl } from "../audit/quillfox";
import type { ExtractionResponse } from "../ai/schema";
import type { CandidateClaim } from "../orchestration/contracts";
import { createExtractedPlanAudit, type PricingSource } from "../orchestration/extracted-audit";
import { createPlanAudit } from "../orchestration/plan-audit";
import type { PayPalBillingPlan } from "../paypal/types";
import { toStudioRun } from "./to-studio-run";

/** The caller applies the server authorization and provider budget before entering. */
export async function runStudioAudit(input: { planId: string; mode: "labeled" | "extract" | "corrected" | "cross_page" } | { planId: string; mode: "custom"; source: PricingSource }, providers: {
  readPlan: (id: string) => Promise<PayPalBillingPlan>;
  countActiveSubscriptions?: (id: string) => Promise<number>;
  extract: (source: { sourceUrl: string; sourceText: string; offerLabel?: string }) => Promise<ExtractionResponse>;
}) {
  const configuredOrigin = process.env.PLANMIRROR_PUBLIC_ORIGIN?.trim();
  const origin = configuredOrigin ? URL.parse(configuredOrigin) : null;
  const sourceUrl = origin && ["http:", "https:"].includes(origin.protocol) && !origin.username && !origin.password
    ? new URL("/quillfox", origin).href : quillfoxSourceUrl;
  let plan: PayPalBillingPlan | undefined;
  let claims: CandidateClaim[] = [];
  // Capture the exact inputs used by the existing coordinator. A second PayPal
  // read could pair new display values with a previous finding's evidence.
  const auditPlan = createPlanAudit(async id => {
    plan = await providers.readPlan(id);
    return plan;
  });
  const result = input.mode !== "extract" && input.mode !== "custom"
    ? await auditPlan(input.planId, async () => (claims = input.mode === "cross_page" ? quillfoxCrossPageClaims(sourceUrl) : quillfoxClaims(input.mode === "corrected", sourceUrl)), compareSubscriptionTerms)
    : await createExtractedPlanAudit(async (id, loadClaims, compare) => auditPlan(id, async () => {
      claims = await loadClaims();
      return claims;
    }, compare), providers.extract)(input.planId, input.mode === "custom" ? input.source : {
      sourceUrl,
      sourceText: quillfoxPricingSourceText,
      offerLabel: quillfoxOffer.name,
    }, compareSubscriptionTerms);

  if (result.status === "failed" || !plan) return { result };
  const merchantLabel = input.mode === "custom" ? claims[0]?.claim.offerLabel ?? input.source.offerLabel ?? new URL(input.source.sourceUrl).hostname : undefined;
  const description = input.mode === "custom"
    ? "Compared " + merchantLabel + " with the configured PayPal Sandbox test plan."
    : input.mode === "cross_page"
    ? "Quillfox pricing and its older FAQ quote different monthly rates. Each source is compared separately against the same PayPal plan."
    : `Live sandbox audit of ${plan.name} using ${input.mode === "corrected" ? "the corrected Quillfox offer preview" : input.mode === "extract" ? "AI-extracted Quillfox pricing text" : "labeled Quillfox claims"}.`;
  const run = toStudioRun({ id: randomUUID(), label: merchantLabel ?? (input.mode === "corrected" ? "Corrected offer re-audit" : input.mode === "cross_page" ? "Pricing and FAQ audit" : "Live audit"), result, claims, plan,
      description });
  if (providers.countActiveSubscriptions && result.findings.some(item => item.finding.status === "mismatch")) {
    run.activeSubscriptions = await providers.countActiveSubscriptions(plan.id).catch(() => null);
  }
  return { result, run };
}
