"use server";

import { randomUUID } from "node:crypto";
import { extractedCandidates, extractionSourceSchema } from "../../lib/orchestration/extracted-audit";
import { MerchantPageError, readMerchantPricing } from "../../lib/audit/merchant-page";
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
  z.strictObject({ mode: z.literal("custom"), sourceUrl: extractionSourceSchema.shape.sourceUrl.max(2048), planId: planIdSchema, offerLabel: extractionSourceSchema.shape.offerLabel.optional() }),
]);

export async function runPlanAudit(input: z.input<typeof auditInput>): Promise<RunAuditResult> {
  try {
    authorizeAction();
    const parsed = auditInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Enter a valid pricing page URL or choose a valid Sandbox plan.", code: "invalid_input" };
    if (parsed.data.mode === "custom") {
      requestLimits.checkRequest();
      if (!process.env.OPENAI_API_KEY?.trim()) {
        return { ok: false, error: "AI extraction is unavailable.", code: "ai_unavailable" };
      }
    }
    if (parsed.data.mode === "extract" && !process.env.OPENAI_API_KEY?.trim()) {
      return { ok: false, error: "AI extraction is unavailable. Run the audit with the published Quillfox claims.", code: "ai_unavailable" };
    }
    return await requestLimits.runProviderWork(async () => {
      let audit: Parameters<typeof runStudioAudit>[0];
      if (parsed.data.mode === "custom") {
        const { sourceUrl, planId, offerLabel } = parsed.data;
        let sourceText: string;
        try {
          sourceText = await readMerchantPricing(sourceUrl);
        } catch {
          return { ok: false as const, error: "Could not read this pricing page. Try a supported pricing URL.", code: "source_unavailable" };
        }
        audit = { mode: "custom", planId, source: { sourceUrl, sourceText, offerLabel } };
      } else {
        audit = parsed.data;
      }
      const { run, result } = await runStudioAudit(audit, {
        readPlan: readSandboxPlan,
        extract: extractOffers,
        countActiveSubscriptions: audit.mode !== "custom" && process.env.PLANMIRROR_SUBSCRIPTION_COUNTS === "true"
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

type MerchantPreview = {
  expiresAt: number;
  sourceUrl: string;
  sourceText: string;
  claims: Extract<Awaited<ReturnType<typeof extractOffers>>, { status: "ok" }>["claims"];
};
const previewState = globalThis as typeof globalThis & { planMirrorMerchantPreviews?: Map<string, MerchantPreview> };
const previews = previewState.planMirrorMerchantPreviews ??= new Map<string, MerchantPreview>();

export async function extractMerchantPreview(input: string) {
  try {
    authorizeAction();
    requestLimits.checkRequest();
    const parsed = extractionSourceSchema.shape.sourceUrl.max(2048).safeParse(input);
    if (!parsed.success) return { ok: false as const, error: "Enter a valid public HTTPS pricing URL." };
    if (!process.env.OPENAI_API_KEY?.trim()) return { ok: false as const, error: "AI extraction is unavailable on this deployment." };

    return await requestLimits.runProviderWork(async () => {
      const sourceUrl = parsed.data;
      let sourceText: string;
      try {
        sourceText = await readMerchantPricing(sourceUrl);
      } catch (error) {
        return { ok: false as const, error: error instanceof MerchantPageError ? error.message : "The pricing site did not respond. Try a direct HTTPS pricing URL." };
      }
      const output = await extractOffers({ sourceUrl, sourceText });
      if (output.status !== "ok") return { ok: false as const, error: output.reason };
      const claims = extractedCandidates({ sourceUrl, sourceText }, output).map(item => item.claim);
      if (!claims.length) return { ok: false as const, error: "No verified offer terms were found on this page." };

      const now = Date.now();
      for (const [id, preview] of previews) if (preview.expiresAt <= now) previews.delete(id);
      const oldest = previews.keys().next().value;
      if (previews.size >= 64 && oldest) previews.delete(oldest);
      const previewId = randomUUID();
      previews.set(previewId, { sourceUrl, sourceText, claims, expiresAt: now + 15 * 60_000 });
      return { ok: true as const, previewId, claims };
    });
  } catch (error) {
    return failure(error, "Pricing extraction could not finish. Try again.");
  }
}

const comparisonInput = z.strictObject({
  previewId: z.uuid(),
  offerLabel: extractionSourceSchema.shape.offerLabel,
  planId: planIdSchema,
});

export async function compareMerchantPreview(input: z.input<typeof comparisonInput>): Promise<RunAuditResult> {
  try {
    authorizeAction();
    requestLimits.checkRequest();
    const parsed = comparisonInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose an extracted offer and a sandbox test plan.", code: "invalid_input" };
    const { previewId, planId, offerLabel } = parsed.data;
    const preview = previews.get(previewId);
    if (!preview || preview.expiresAt <= Date.now()) return { ok: false, error: "The extraction expired. Extract the pricing page again.", code: "preview_expired" };
    const claims = preview.claims.filter(claim => claim.offerLabel === offerLabel);
    if (!claims.length) return { ok: false, error: "Choose an offer from this extraction.", code: "invalid_offer" };

    return await requestLimits.runProviderWork(async () => {
      const { run } = await runStudioAudit({
        mode: "custom", planId, source: { sourceUrl: preview.sourceUrl, sourceText: preview.sourceText, offerLabel },
      }, {
        readPlan: readSandboxPlan,
        extract: async () => ({ status: "ok", claims }),
      });
      if (!run) return { ok: false as const, error: "The PayPal sandbox comparison could not finish. Check the test plan and retry.", code: "comparison_failed" };
      saveStudioRun(run);
      return { ok: true as const, runId: run.id, run };
    });
  } catch (error) {
    return failure(error, "The PayPal sandbox comparison could not finish. Try again.");
  }
}
