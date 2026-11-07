import "server-only";
import { readSandboxPlan } from "../paypal/sandbox";
import { createPlanAudit } from "./plan-audit";
import { extractOffers } from "../ai/extract";
import { createExtractedPlanAudit } from "./extracted-audit";

/** Server entry point. The caller must authorize the merchant and selected plan. */
export const auditSandboxPlan = createPlanAudit(readSandboxPlan);

/** Calls existing provider modules without changing their implementations. */
export const auditExtractedSandboxPlan = createExtractedPlanAudit(auditSandboxPlan, extractOffers);
