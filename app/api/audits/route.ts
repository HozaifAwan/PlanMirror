import { authorize, failure, reply } from "../../../lib/paypal/http";
import { AuditRequestError, readAuditRequest } from "../../../lib/orchestration/audit-request";
import { auditSandboxPlan, auditExtractedSandboxPlan } from "../../../lib/orchestration/sandbox-audit";

import { compareSubscriptionTerms } from "../../../lib/audit/compare-subscription-terms";
import { requestLimits } from "../../../lib/backend/request-limits";

export const runtime = "nodejs";

/** Authorized callers supply normalized claims or source text for AI extraction. */
export async function POST(request: Request) {
  try {
    authorize(request);
    const input = await readAuditRequest(request);
    const result = await requestLimits.runProviderWork(() => "source" in input
      ? auditExtractedSandboxPlan(input.planId, input.source, compareSubscriptionTerms)
      : auditSandboxPlan(input.planId, async () => input.claims, compareSubscriptionTerms));
    return reply(result, result.status === "failed" ? 502 : 200);
  } catch (error) {
    if (error instanceof AuditRequestError) return reply({ error: error.message }, error.status);
    return failure(error);
  }
}
