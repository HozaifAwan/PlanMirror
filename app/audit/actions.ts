"use server";

import { timingSafeEqual } from "node:crypto";
import { extractionSourceSchema } from "../../lib/orchestration/extracted-audit";
import { readMerchantPricing } from "../../lib/audit/merchant-page";
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

const auditInput = z.union([
  z.strictObject({ planId: planIdSchema, mode: z.enum(["labeled", "extract", "corrected", "cross_page"]) }),
  z.strictObject({
    planId: planIdSchema, mode: z.literal("custom"),
    source: extractionSourceSchema.extend({ sourceText: z.string().max(20_000), sourceUrl: extractionSourceSchema.shape.sourceUrl.max(2048) }),
    password: z.string().max(256),
  }),
]);

export async function runPlanAudit(input: z.input<typeof auditInput>): Promise<RunAuditResult> {
  try {
    authorizeAction();
    const parsed = auditInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid sandbox plan and audit mode.", code: "invalid_input" };
    if (parsed.data.mode === "custom") {
      requestLimits.checkRequest();
      const expected = Buffer.from(process.env.PLANMIRROR_DEMO_PASSWORD ?? "");
      const provided = Buffer.from(parsed.data.password);
      if (expected.length < 16 || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        return { ok: false, error: "Enter a valid demo password.", code: "unauthorized" };
      }
      if (!process.env.OPENAI_API_KEY?.trim()) {
        return { ok: false, error: "AI extraction is unavailable.", code: "ai_unavailable" };
      }
    }
    if (parsed.data.mode === "extract" && !process.env.OPENAI_API_KEY?.trim()) {
      return { ok: false, error: "AI extraction is unavailable. Run the audit with the published Quillfox claims.", code: "ai_unavailable" };
    }
    return await requestLimits.runProviderWork(async () => {
      const audit = parsed.data;
      if (audit.mode === "custom" && !audit.source.sourceText.trim()) {
        try {
          audit.source.sourceText = await readMerchantPricing(audit.source.sourceUrl);
        } catch {
          return { ok: false as const, error: "Could not read this pricing page. Check the URL or paste the pricing text and try again.", code: "source_unavailable" };
        }
      }
      const { run, result } = await runStudioAudit(audit, {
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
