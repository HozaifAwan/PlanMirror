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
      const timeout = AbortSignal.timeout(10000);
      return await fetcher(origin + path, { ...init, cache: "no-store", redirect: "error",
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
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
  async function get(path: string, signal?: AbortSignal) {
    const t = await token();
    const send = (value: string) => {
      signal?.throwIfAborted();
      return request(path, { signal, headers: { Authorization: "Bearer " + value, Prefer: "return=representation" } });
    };
    let activeToken = t;
    let response = await send(activeToken.value);
    if (response.status === 401) {
      if (cached && await cached === t) cached = undefined;
      activeToken = await token();
      response = await send(activeToken.value);
    }
    if ([502, 503, 504].includes(response.status)) {
      void response.body?.cancel().catch(() => {});
      response = await send(activeToken.value);
    }
    if (!response.ok) throw new PayPalError(response.status === 404 ? 404 : 502,
      response.status === 404 ? "Sandbox plan not found." : "PayPal sandbox request failed.");
    return json(response);
  }
  async function readPlan(id: string, signal?: AbortSignal) {
    if (!planIdSchema.safeParse(id).success) throw new PayPalError(400, "Invalid plan ID.");
    const data = await get("/v1/billing/plans/" + id, signal);
    try {
      const plan = normalizePlan(data);
      if (plan.id !== id) throw new Error();
      return plan;
    } catch { throw new PayPalError(502, "PayPal returned invalid plan details."); }
  }
  async function listPlans(page = 1, pageSize = 20) {
    if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) throw new PayPalError(400, "Invalid pagination.");
    const signal = AbortSignal.timeout(30_000);
    const timedOut = () => new PayPalError(504, "Sandbox plan listing took too long. Retry with a smaller page_size.");
    let abort: () => void = () => {};
    const deadline = new Promise<never>((_, reject) => {
      abort = () => reject(timedOut());
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    try {
      return await Promise.race([deadline, (async () => {
        signal.throwIfAborted();
        const data = await get(`/v1/billing/plans?page=${page}&page_size=${pageSize}&total_required=true`, signal);
        const parsed = z.object({ plans: z.array(z.object({ id: planIdSchema })).max(pageSize), total_items: z.number().int().nonnegative(), total_pages: z.number().int().nonnegative() }).safeParse(data);
        if (!parsed.success) throw new PayPalError(502, "PayPal returned an invalid plan list.");
        // Always retrieve details, but keep the entire page within one deadline.
        const plans = [];
        for (const item of parsed.data.plans) plans.push(await readPlan(item.id, signal));
        signal.throwIfAborted();
        return { plans, page, pageSize, totalItems: parsed.data.total_items, totalPages: parsed.data.total_pages,
          nextPage: page < parsed.data.total_pages ? page + 1 : null };
      })()]);
    } catch (error) {
      if (signal.aborted) throw timedOut();
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  async function countActiveSubscriptions(id: string) {
    if (!planIdSchema.safeParse(id).success) throw new PayPalError(400, "Invalid plan ID.");
    const signal = AbortSignal.timeout(8_000);
    const seen = new Set<string>();
    for (let page = 1; page <= 5; page++) {
      const query = new URLSearchParams({ plan_ids: id, statuses: "ACTIVE", page_size: "20", page: String(page) });
      const data = await get(`/v1/billing/subscriptions?${query}`, signal);
      const parsed = z.object({
        subscriptions: z.array(z.object({ id: z.string().min(1), plan_id: z.literal(id), status: z.literal("ACTIVE") })).max(20),
        links: z.array(z.object({ rel: z.string() })),
      }).safeParse(data);
      if (!parsed.success) throw new PayPalError(502, "PayPal returned an invalid subscription list.");
      for (const item of parsed.data.subscriptions) seen.add(item.id);
      if (!parsed.data.links.some(link => link.rel === "next")) return seen.size;
    }
    throw new PayPalError(502, "The subscription count exceeded the page limit.");
  }

  async function verifyWebhookSignature(payload: Record<string, unknown>) {
    const access = await token();
    const response = await request("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: { Authorization: "Bearer " + access.value, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new PayPalError(502, "PayPal webhook verification failed.");
    return z.object({ verification_status: z.literal("SUCCESS") }).safeParse(await json(response)).success;
  }

  return { readPlan, listPlans, countActiveSubscriptions, verifyWebhookSignature };
}
