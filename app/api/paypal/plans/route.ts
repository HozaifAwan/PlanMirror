import { authorize, failure, reply } from "../../../../lib/paypal/http";
import { sandboxClient } from "../../../../lib/paypal/sandbox";
import { PayPalError } from "../../../../lib/paypal/client";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    authorize(request);
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(k => !["page", "page_size"].includes(k))) throw new PayPalError(400, "Unknown query parameter.");
    return reply(await sandboxClient().listPlans(Number(params.get("page") ?? 1), Number(params.get("page_size") ?? 20)));
  } catch (error) { return failure(error); }
}
