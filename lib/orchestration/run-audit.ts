import type { AdvertisedSubscriptionClaim, AuditFinding } from "../audit/types";
import {
  findingSchema, inputSchema,
  type AuditInput, type AuditProviders, type AuditResult, type Comparator,
} from "./contracts";

function review(claim: AdvertisedSubscriptionClaim, summary: string): AuditFinding {
  return { offerLabel: claim.offerLabel, field: claim.field, status: "needs_review", summary, website: claim.evidence };
}

/** Validate both boundaries and isolate individual comparator failures. */
export async function runAudit(input: AuditInput, compare: Comparator): Promise<AuditResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "failed", findings: [], issues: [{ code: "invalid_input" }] };
  const { plan, claims } = parsed.data;
  const result: AuditResult = { status: "completed", findings: [], issues: [] };
  if (!plan) result.issues.push({ code: "missing_plan" });
  if (!claims.length) result.issues.push({ code: "missing_claims" });

  for (const candidate of claims) {
    const { id, claim, ambiguity } = candidate;
    if (!plan || ambiguity) {
      if (ambiguity) result.issues.push({ code: "ambiguous_claim", claimId: id });
      result.findings.push({ claimId: id, finding: review(claim, ambiguity ? "Advertised terms require clarification." : "PayPal plan evidence is missing.") });
      continue;
    }

    let output: unknown;
    try {
      // Give each comparison its own snapshot so a plugin cannot mutate later inputs.
      output = await compare(structuredClone({ plan, claim }));
    } catch {
      result.issues.push({ code: "comparison_failed", claimId: id });
      result.findings.push({ claimId: id, finding: review(claim, "Comparison could not be completed.") });
      continue;
    }

    const validated = findingSchema.safeParse(output);
    const finding = validated.success ? validated.data : undefined;
    const sameWebsite = !finding?.website || (finding.website.url === claim.evidence.url && finding.website.quote === claim.evidence.quote);
    const samePlan = !finding?.paypal || (finding.paypal.planId === plan.id && finding.paypal.retrievedAt === plan.retrievedAt);
    if (!finding || finding.field !== claim.field || finding.offerLabel !== claim.offerLabel || !sameWebsite || !samePlan) {
      result.issues.push({ code: "invalid_finding", claimId: id });
      result.findings.push({ claimId: id, finding: review(claim, "Comparison returned invalid or unrelated evidence.") });
      continue;
    }
    result.findings.push({ claimId: id, finding });
  }

  if (result.issues.length || result.findings.some(item => item.finding.status === "needs_review")) result.status = "needs_review";
  return result;
}

/** Provider failures stop the run and cannot become empty inputs or sample data. */
export async function runAuditFromProviders(providers: AuditProviders, compare: Comparator): Promise<AuditResult> {
  const [plan, claims] = await Promise.allSettled([
    Promise.resolve().then(() => providers.loadPlan()),
    Promise.resolve().then(() => providers.loadClaims()),
  ]);
  if (plan.status === "rejected" || claims.status === "rejected") {
    const issues: AuditResult["issues"] = [];
    if (plan.status === "rejected") issues.push({ code: "provider_failed", stage: "plan" });
    if (claims.status === "rejected") issues.push({ code: "provider_failed", stage: "claims" });
    return { status: "failed", findings: [], issues };
  }
  return runAudit({ plan: plan.value, claims: claims.value }, compare);
}
