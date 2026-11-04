"use server";

import { timingSafeEqual } from "node:crypto";
import { auditQuillfox, samplePlan } from "../lib/audit/quillfox";
import { PayPalSandboxError, planIdSchema, readSandboxPlan } from "../lib/paypal/sandbox";

export type AuditState = {
  source?: "fixture" | "paypal_sandbox";
  rows?: ReturnType<typeof auditQuillfox>;
  retrievedAt?: string;
  error?: string;
};

export async function runAudit(_previous: AuditState, data: FormData): Promise<AuditState> {
  const mode = data.get("mode");
  if (mode === "fixture" || mode === "corrected") {
    return { source: "fixture", rows: auditQuillfox(samplePlan(mode === "corrected")) };
  }
  if (mode !== "sandbox") return { error: "Select an audit source." };

  const secret = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
  const supplied = data.get("token");
  if (!secret || secret.length < 32 || typeof supplied !== "string") {
    return { error: "Sandbox access is disabled or the audit token is missing." };
  }
  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
    return { error: "Sandbox audit token is invalid." };
  }
  const id = planIdSchema.safeParse(data.get("planId"));
  if (!id.success) return { error: "Enter a valid PayPal sandbox plan ID." };

  try {
    const plan = await readSandboxPlan(id.data);
    return { source: "paypal_sandbox", rows: auditQuillfox(plan), retrievedAt: plan.retrievedAt };
  } catch (error) {
    return { error: error instanceof PayPalSandboxError ? error.message : "The sandbox plan could not be processed." };
  }
}
