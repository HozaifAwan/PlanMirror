"use server";

import { z } from "zod";
import { extractOffers } from "../../lib/ai/extract";
import { authorize } from "../../lib/backend/authorize";
import { requestLimits, RequestLimitError } from "../../lib/backend/request-limits";
import { PayPalError } from "../../lib/paypal/client";
import { planIdSchema } from "../../lib/paypal/normalize";
import { readSandboxPlan, sandboxClient } from "../../lib/paypal/sandbox";
import { saveStudioRun } from "../../lib/studio/run-store";
import { runStudioAudit } from "../../lib/studio/audit-workflow";
import type { StudioRun } from "../../lib/studio/types";

export type AuditPlanOption = { id: string; name: string; status: string };
export type ListPlansResult =
  | { ok: true; plans: AuditPlanOption[]; defaultPlanId: string }
  | { ok: false; error: string; code: string };
export type RunAuditResult =
  | { ok: true; runId: string; run: StudioRun }
  | { ok: false; error: string; code: string };

// The controlled single-merchant demo uses the existing server gate. Next's
// Server Action origin checks remain in place; no credential reaches the client.
function authorizeAction() {
  authorize(new Request("https://planmirror.local/api/audits", {
    headers: { authorization: `Bearer ${process.env.PLANMIRROR_SANDBOX_READ_TOKEN ?? ""}` },
  }));
}

function failure(error: unknown, fallback: string): { ok: false; error: string; code: string } {
  if (error instanceof RequestLimitError) {
    return { ok: false, error: `Request limit reached. Try again in ${error.retryAfter} seconds.`, code: "rate_limited" };
  }
  if (error instanceof PayPalError) {
    return { ok: false, error: error.message, code: `paypal_${error.status}` };
  }
  // Provider bodies and arbitrary exception messages are not browser-safe.
  return { ok: false, error: fallback, code: "provider_failed" };
}

export async function listSandboxPlans(): Promise<ListPlansResult> {
  try {
    authorizeAction();
    return await requestLimits.runProviderWork(async () => {
      const plans: AuditPlanOption[] = [];
      let page: number | null = 1;
      while (page !== null) {
        // Bound demo list work and fail explicitly rather than silently hiding plans.
        if (page > 5) return { ok: false as const, error: "This demo supports up to 100 sandbox plans. Use a sandbox merchant with fewer plans.", code: "plan_list_limit" };
        const listed = await sandboxClient().listPlans(page, 20);
        plans.push(...listed.plans.map(({ id, name, status }) => ({ id, name, status })));
        page = listed.nextPage;
      }
      const preferred = process.env.PAYPAL_SANDBOX_PLAN_ID;
      const defaultPlanId = plans.find(plan => plan.id === preferred)?.id ?? plans.find(plan => plan.status === "ACTIVE")?.id;
      if (!defaultPlanId) return { ok: false as const, error: "No active PayPal sandbox plan is available. Activate a demo plan and retry.", code: "no_active_plans" };
      return { ok: true as const, plans, defaultPlanId };
    });
  } catch (error) {
    return failure(error, "PayPal sandbox plans could not be loaded. Try again.");
  }
}

const auditInput = z.strictObject({ planId: planIdSchema, mode: z.enum(["labeled", "extract", "corrected", "cross_page"]) });

export async function runPlanAudit(input: { planId: string; mode: "labeled" | "extract" | "corrected" | "cross_page" }): Promise<RunAuditResult> {
  try {
    authorizeAction();
    const parsed = auditInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid sandbox plan and audit mode.", code: "invalid_input" };
    if (parsed.data.mode === "extract" && !process.env.OPENAI_API_KEY?.trim()) {
      return { ok: false, error: "AI extraction is unavailable. Run the audit with the published Quillfox claims.", code: "ai_unavailable" };
    }
    return await requestLimits.runProviderWork(async () => {
      const { run, result } = await runStudioAudit(parsed.data, {
        readPlan: readSandboxPlan,
        extract: extractOffers,
        countActiveSubscriptions: process.env.PLANMIRROR_SUBSCRIPTION_COUNTS === "true"
          ? id => sandboxClient().countActiveSubscriptions(id) : undefined,
      });
      if (!run) {
        const issue = result.issues[0];
        return { ok: false as const, error: "The audit could not be completed. Review the selected plan and provider configuration, then retry.", code: issue ? `${issue.code}${issue.stage ? `_${issue.stage}` : ""}` : "audit_failed" };
      }
      saveStudioRun(run);
      return { ok: true as const, runId: run.id, run };
    });
  } catch (error) {
    return failure(error, "The sandbox audit could not be completed. Check provider configuration and retry.");
  }
}
