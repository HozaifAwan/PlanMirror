import "server-only";
import { readSandboxPlan } from "../paypal/sandbox";
import { createPlanAudit } from "./plan-audit";

/** Server entry point. The caller must authorize the merchant and selected plan. */
export const auditSandboxPlan = createPlanAudit(readSandboxPlan);
