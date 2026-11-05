import { z } from "zod";
import { normalizePlan, planIdSchema } from "./normalize.ts";

const origin = "https://api-m.sandbox.paypal.com";
export class PayPalError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });

/** Server-side only. Inject fetch for isolated tests; never pass credentials from a browser. */
export function createSandboxClient(config: { clientId: string; clientSecret: string; environment?: string }, fetcher: typeof fetch = fetch) {
  let cached: Promise<{ value: string; expiresAt: number }> | undefined;
  function checkConfig() {
    if ((config.environment ?? "sandbox") !== "sandbox") throw new PayPalError(503, "Only the PayPal sandbox is supported.");
    if (!config.clientId || !config.clientSecret) throw new PayPalError(503, "PayPal sandbox credentials are missing.");
  }
  async function request(path: string, init: RequestInit) {
    try {
      return await fetcher(origin + path, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    } catch { throw new PayPalError(502, "Cannot reach PayPal sandbox. Check DNS, network, or proxy settings."); }
  }
  async function json(response: Response): Promise<unknown> {
    try { return await response.json(); } catch { throw new PayPalError(502, "PayPal returned an invalid response."); }
  }
  async function token(): Promise<{ value: string; expiresAt: number }> {
    checkConfig();
    if (cached) {
      const current = cached;
      const t = await current;
      if (t.expiresAt > Date.now()) return t;
      if (cached === current) cached = undefined;
      return token();
    }
    const pending = (async () => {
      const start = Date.now();
      const response = await request("/v1/oauth2/token", { method: "POST", headers: {
        Authorization: "Basic " + Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      }, body: "grant_type=client_credentials" });
      if (!response.ok) throw new PayPalError(502, "PayPal sandbox authentication failed. Check sandbox app credentials.");
      const parsed = tokenSchema.safeParse(await json(response));
      if (!parsed.success) throw new PayPalError(502, "PayPal returned an invalid token response.");
      return { value: parsed.data.access_token, expiresAt: start + parsed.data.expires_in*1000 - Math.min(30000, parsed.data.expires_in*100) };
    })();
    cached = pending;
    try { return await pending; } catch (e) { if (cached === pending) cached = undefined; throw e; }
  }
  async function get(path: string) {
    const t = await token();
    const send = (value: string) => request(path, { headers: { Authorization: "Bearer " + value, Prefer: "return=representation" } });
    let response = await send(t.value);
    if (response.status === 401) {
      if (cached && await cached === t) cached = undefined;
      response = await send((await token()).value);
    }
    if (!response.ok) throw new PayPalError(response.status === 404 ? 404 : 502,
      response.status === 404 ? "Sandbox plan not found." : "PayPal sandbox request failed.");
    return json(response);
  }
  async function readPlan(id: string) {
    if (!planIdSchema.safeParse(id).success) throw new PayPalError(400, "Invalid plan ID.");
    const data = await get("/v1/billing/plans/" + id);
    try {
      const plan = normalizePlan(data);
      if (plan.id !== id) throw new Error();
      return plan;
    } catch { throw new PayPalError(502, "PayPal returned invalid plan details."); }
  }
  async function listPlans(page = 1, pageSize = 20) {
    if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) throw new PayPalError(400, "Invalid pagination.");
    const data = await get(`/v1/billing/plans?page=${page}&page_size=${pageSize}&total_required=true`);
    const parsed = z.object({ plans: z.array(z.object({ id: planIdSchema })), total_items: z.number().int().nonnegative(), total_pages: z.number().int().nonnegative() }).safeParse(data);
    if (!parsed.success) throw new PayPalError(502, "PayPal returned an invalid plan list.");
    // Always retrieve details: list representations may omit fields required by the auditor.
    const plans = [];
    for (const item of parsed.data.plans) plans.push(await readPlan(item.id));
    return { plans, page, pageSize, totalItems: parsed.data.total_items, totalPages: parsed.data.total_pages,
      nextPage: page < parsed.data.total_pages ? page + 1 : null };
  }
  return { readPlan, listPlans };
}
