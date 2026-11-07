import type { PayPalBillingPlan } from "../paypal/types";
import type { AuditProviders, AuditResult, Comparator } from "./contracts";
import { runAuditFromProviders } from "./run-audit";
import { planIdSchema } from "../paypal/normalize";

type PlanReader = (id: string) => Promise<PayPalBillingPlan>;

/** Wire Ayaan's reader to Sujeeth's claim provider and Nilanee's comparator. */
export function createPlanAudit(readPlan: PlanReader) {
  return async (
    planId: string,
    loadClaims: AuditProviders["loadClaims"],
    compare?: Comparator,
  ): Promise<AuditResult> => {
    const parsed = planIdSchema.safeParse(planId);
    if (!parsed.success) return { status: "failed", findings: [], issues: [{ code: "invalid_input" }] };

    const result = await runAuditFromProviders({
      loadPlan: async () => {
        const plan = await readPlan(parsed.data);
        if (plan.id !== parsed.data) throw new Error("Selected plan did not match returned evidence.");
        return plan;
      },
      loadClaims,
    }, compare ?? (({ plan, claim }) => ({
      offerLabel: claim.offerLabel, field: claim.field, status: "needs_review",
      summary: "The comparison module is not connected yet.",
      website: claim.evidence,
      paypal: { planId: plan.id, fieldPath: "billingCycles", retrievedAt: plan.retrievedAt },
    })));
    if (!compare && result.status !== "failed") {
      result.issues.push({ code: "comparator_unavailable" });
      result.status = "needs_review";
    }
    return result;
  };
}
