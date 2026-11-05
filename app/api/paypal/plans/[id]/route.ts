import { authorize, failure, reply } from "../../../../../lib/paypal/http";
import { readSandboxPlan } from "../../../../../lib/paypal/sandbox";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { authorize(request); return reply(await readSandboxPlan((await context.params).id)); }
  catch (error) { return failure(error); }
}
