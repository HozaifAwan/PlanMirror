import { createHash } from "node:crypto";
import { z } from "zod";
import type { ExtractionResponse } from "../ai/schema";
import { claimSchema, claimsSchema, type CandidateClaim } from "./contracts";
import type { createPlanAudit } from "./plan-audit";

/** Text is supplied by a trusted caller; this adapter never fetches a URL. */
export const extractionSourceSchema = z.strictObject({
  sourceUrl: z.url().refine(value => /^https?:\/\//i.test(value)),
  sourceText: z.string().min(1).max(20_000).refine(value => value.trim().length > 0),
  offerLabel: z.string().trim().min(1).max(200),
});
export type ExtractionSource = z.infer<typeof extractionSourceSchema>;
export type PricingSource = Omit<ExtractionSource, "offerLabel"> & { offerLabel?: string };
const pricingSourceSchema = extractionSourceSchema.extend({ offerLabel: extractionSourceSchema.shape.offerLabel.optional() });
type Extractor = (input: { sourceUrl: string; sourceText: string; offerLabel?: string }) => Promise<ExtractionResponse>;
type PlanAudit = ReturnType<typeof createPlanAudit>;

/** Only map verified claims for the caller-selected offer. No financial decisions here. */
export function extractedCandidates(source: PricingSource, output: ExtractionResponse): CandidateClaim[] {
  if (output.status === "needs_review") return [];
  const occurrences = new Map<string, number>();
  const candidates = output.claims.map(claim => claimSchema.parse(claim)).filter(claim => source.offerLabel === undefined || claim.offerLabel === source.offerLabel).map(claim => {
    if (claim.evidence.url !== source.sourceUrl || !source.sourceText.includes(claim.evidence.quote)) {
      throw new Error("Extraction evidence did not match supplied source.");
    }
    const digest = createHash("sha256").update(JSON.stringify(claim)).digest("hex");
    const occurrence = (occurrences.get(digest) ?? 0) + 1;
    occurrences.set(digest, occurrence);
    return { id: `extracted-${digest}-${occurrence}`, claim };
  });
  return claimsSchema.parse(candidates);
}

/** Bind Sujeeth's extractor to the existing plan audit; Nilanee's comparator stays optional. */
export function createExtractedPlanAudit(auditPlan: PlanAudit, extract: Extractor) {
  return async (planId: string, sourceInput: PricingSource, compare?: Parameters<PlanAudit>[2]) => {
    const parsed = pricingSourceSchema.safeParse(sourceInput);
    if (!parsed.success) return { status: "failed" as const, findings: [], issues: [{ code: "invalid_input" as const }] };
    let requiresReview = false;
    const result = await auditPlan(planId, async () => {
      const output = await extract({ sourceUrl: parsed.data.sourceUrl, sourceText: parsed.data.sourceText, offerLabel: parsed.data.offerLabel });
      requiresReview = output.status === "needs_review" || (parsed.data.offerLabel === undefined && new Set(output.claims.map(claim => claim.offerLabel)).size !== 1);
      if (requiresReview) return [];
      return extractedCandidates(parsed.data, output);
    }, compare);
    if (requiresReview) result.issues.push({ code: "extraction_needs_review", stage: "claims" });
    return result;
  };
}
