import { timingSafeEqual } from "node:crypto";
import { PayPalSandboxError, planIdSchema, readSandboxPlan } from "../../../../../lib/paypal/sandbox";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
  if (!token || token.length < 32) {
    return json({ error: "Sandbox plan endpoint is disabled." }, 503);
  }

  const expected = Buffer.from("Bearer " + token);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const id = planIdSchema.safeParse((await context.params).id);
  if (!id.success) return json({ error: "Invalid PayPal plan ID." }, 400);

  try {
    return json({ source: "paypal_sandbox", plan: await readSandboxPlan(id.data) });
  } catch (error) {
    if (error instanceof PayPalSandboxError) return json({ error: error.message }, error.status);
    return json({ error: "PayPal sandbox response could not be processed." }, 502);
  }
}
