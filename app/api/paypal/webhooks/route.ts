import { z } from "zod";
import { readJsonRequest, JsonRequestError } from "../../../../lib/backend/json-request";
import { createRequestLimits, RequestLimitError } from "../../../../lib/backend/request-limits";
import { planIdSchema } from "../../../../lib/paypal/normalize";
import { readSandboxPlan, sandboxClient } from "../../../../lib/paypal/sandbox";
import { runStudioAudit } from "../../../../lib/studio/audit-workflow";
import { getStudioRun, saveStudioRun } from "../../../../lib/studio/run-store";

const eventSchema = z.object({
  id: z.string().min(1).max(128),
  event_type: z.enum(["BILLING.PLAN.UPDATED", "BILLING.PLAN.PRICING-CHANGE.ACTIVATED"]),
  resource: z.object({ id: planIdSchema }),
});
const signatureHeaders = ["auth_algo", "cert_url", "transmission_id", "transmission_sig", "transmission_time"] as const;
const webhookLimits = createRequestLimits();
const deliveries = new Map<string, Promise<string>>();

export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const planId = process.env.PAYPAL_SANDBOX_PLAN_ID;
  if (!webhookId || !planId) return Response.json({ error: "Webhook disabled." }, { status: 503 });

  try {
    const body = await readJsonRequest(request);
    const event = eventSchema.safeParse(body);
    if (!event.success || event.data.resource.id !== planId) return new Response(null, { status: 204 });

    const signature: Record<string, string> = {};
    for (const key of signatureHeaders) {
      const value = request.headers.get(`paypal-${key.replaceAll("_", "-")}`);
      if (!value || value.length > 2048) return Response.json({ error: "Invalid signature headers." }, { status: 400 });
      signature[key] = value;
    }

    return await webhookLimits.runProviderWork(async () => {
      const valid = await sandboxClient().verifyWebhookSignature({
        ...signature, webhook_id: webhookId, webhook_event: body,
      });
      if (!valid) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });

      const id = event.data.id;
      const previous = deliveries.get(id);
      if (previous) {
        const runId = await previous;
        if (getStudioRun(runId)) return Response.json({ runId }, { headers: { "Cache-Control": "no-store" } });
      }

      const pending = (async () => {
        const { run } = await runStudioAudit({ planId, mode: "cross_page" }, {
          readPlan: readSandboxPlan,
          extract: async () => { throw new Error("Webhook audits use published claims."); },
        });
        if (!run) throw new Error("Re-audit failed.");
        return saveStudioRun(run);
      })();
      deliveries.set(id, pending);
      try {
        const runId = await pending;
        if (deliveries.size > 128) {
          const oldest = deliveries.keys().next().value;
          if (oldest) deliveries.delete(oldest);
        }
        return Response.json({ runId }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        if (deliveries.get(id) === pending) deliveries.delete(id);
        throw error;
      }
    });
  } catch (error) {
    const status = error instanceof JsonRequestError ? error.status : error instanceof RequestLimitError ? 429 : 502;
    return Response.json({ error: "Webhook could not be processed." }, { status });
  }
}
