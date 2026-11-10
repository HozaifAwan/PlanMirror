import { randomUUID } from "node:crypto";
import { compareSubscriptionTerms } from "../audit/compare-subscription-terms";
import { quillfoxClaims, quillfoxOffer, quillfoxPricingSourceText, quillfoxSourceUrl } from "../audit/quillfox";
import type { ExtractionResponse } from "../ai/schema";
import type { CandidateClaim } from "../orchestration/contracts";
import { createExtractedPlanAudit } from "../orchestration/extracted-audit";
import { createPlanAudit } from "../orchestration/plan-audit";
import type { PayPalBillingPlan } from "../paypal/types";
import { toStudioRun } from "./to-studio-run";

/** The caller applies the server authorization and provider budget before entering. */
export async function runStudioAudit(input: { planId: string; mode: "labeled" | "extract" }, providers: {
  readPlan: (id: string) => Promise<PayPalBillingPlan>;
  extract: (source: { sourceUrl: string; sourceText: string }) => Promise<ExtractionResponse>;
}) {
  let plan: PayPalBillingPlan | undefined;
  let claims: CandidateClaim[] = [];
  // Capture the exact inputs used by the existing coordinator. A second PayPal
  // read could pair new display values with a previous finding's evidence.
  const auditPlan = createPlanAudit(async id => {
    plan = await providers.readPlan(id);
    return plan;
  });
  const result = input.mode === "labeled"
    ? await auditPlan(input.planId, async () => (claims = quillfoxClaims()), compareSubscriptionTerms)
    : await createExtractedPlanAudit(async (id, loadClaims, compare) => auditPlan(id, async () => {
      claims = await loadClaims();
      return claims;
    }, compare), providers.extract)(input.planId, {
      sourceUrl: quillfoxSourceUrl,
      sourceText: quillfoxPricingSourceText,
      offerLabel: quillfoxOffer.name,
    }, compareSubscriptionTerms);

  if (result.status === "failed" || !plan) return { result };
  return {
    result,
    run: toStudioRun({ id: randomUUID(), label: "Live audit", result, claims, plan,
      description: `Live sandbox audit of ${plan.name} using ${input.mode === "labeled" ? "labeled Quillfox claims" : "AI-extracted Quillfox pricing text"}.` }),
  };
}
