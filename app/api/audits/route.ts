import { authorize, failure, reply } from "../../../lib/paypal/http";
import { AuditRequestError, readAuditRequest } from "../../../lib/orchestration/audit-request";
import { auditSandboxPlan } from "../../../lib/orchestration/sandbox-audit";

import { compareSubscriptionTerms } from "../../../lib/audit/compare-subscription-terms";

export const runtime = "nodejs";

/** Authorized callers supply claims already mapped to the selected PayPal plan. */
export async function POST(request: Request) {
  try {
    authorize(request);
    const { planId, claims } = await readAuditRequest(request);
    const result = await auditSandboxPlan(planId, async () => claims, compareSubscriptionTerms);
    return reply(result, result.status === "failed" ? 502 : 200);
  } catch (error) {
    if (error instanceof AuditRequestError) return reply({ error: error.message }, error.status);
    return failure(error);
  }
}
