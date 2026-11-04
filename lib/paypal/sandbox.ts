import { z } from "zod";
import type { PayPalBillingPlan } from "./types";

const origin = "https://api-m.sandbox.paypal.com";
export const planIdSchema = z.string().regex(/^P-[A-Z0-9]{1,48}$/);
const money = z.object({
  currency_code: z.string().regex(/^[A-Z]{3}$/),
  value: z.string().regex(/^\d+(\.\d+)?$/),
}).transform(({ currency_code, value }) => ({ currencyCode: currency_code, value }));

const planSchema = z.object({
  id: planIdSchema,
  product_id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  quantity_supported: z.boolean().optional(),
  taxes: z.object({ percentage: z.string().regex(/^\d+(\.\d+)?$/), inclusive: z.boolean() }).optional(),
  payment_preferences: z.object({ setup_fee: money.optional() }).optional(),
  billing_cycles: z.array(z.object({
    sequence: z.number().int().positive(),
    tenure_type: z.enum(["TRIAL", "REGULAR"]),
    total_cycles: z.number().int().nonnegative(),
    frequency: z.object({
      interval_unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
      interval_count: z.number().int().positive(),
    }),
    pricing_scheme: z.object({
      fixed_price: money.optional(),
      pricing_model: z.string().optional(),
    }).optional(),
  })).min(1),
});

export class PayPalSandboxError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

type SandboxToken = { value: string; expiresAt: number };
let session: {
  clientId: string;
  clientSecret: string;
  token: Promise<SandboxToken>;
} | undefined;

async function requestToken(clientId: string, clientSecret: string): Promise<SandboxToken> {
  const requestedAt = Date.now();
  const tokenResponse = await fetch(origin + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenResponse.ok) {
    throw new PayPalSandboxError(502, "PayPal sandbox authentication failed.");
  }
  const token = tokenSchema.parse(await tokenResponse.json());
  return { value: token.access_token, expiresAt: requestedAt + token.expires_in * 1000 - Math.min(30_000, token.expires_in * 100) };
}

async function getToken(): Promise<SandboxToken> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new PayPalSandboxError(503, "PayPal sandbox credentials are missing.");
  }

  const current = session;
  if (current?.clientId === clientId && current.clientSecret === clientSecret) {
    const token = await current.token;
    if (token.expiresAt > Date.now()) return token;
    if (session === current) session = undefined;
    return getToken();
  }

  const token = requestToken(clientId, clientSecret);
  session = { clientId, clientSecret, token };
  try {
    return await token;
  } catch (error) {
    if (session?.token === token) session = undefined;
    throw error;
  }
}

function fetchPlan(planId: string, token: SandboxToken) {
  return fetch(origin + "/v1/billing/plans/" + planId, {
    headers: { Authorization: "Bearer " + token.value },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
}

export async function readSandboxPlan(id: string): Promise<PayPalBillingPlan> {
  const planId = planIdSchema.parse(id);
  const token = await getToken();
  let response = await fetchPlan(planId, token);
  if (response.status === 401) {
    const current = session;
    if (current && await current.token.catch(() => undefined) === token && session === current) session = undefined;
    response = await fetchPlan(planId, await getToken());
  }
  if (response.status === 404) {
    throw new PayPalSandboxError(404, "Plan was not found in the PayPal sandbox.");
  }
  if (!response.ok) {
    throw new PayPalSandboxError(502, "PayPal sandbox plan retrieval failed.");
  }
  const plan = planSchema.parse(await response.json());
  if (plan.id !== planId) {
    throw new PayPalSandboxError(502, "PayPal returned a different plan ID.");
  }

  return {
    id: plan.id,
    productId: plan.product_id,
    name: plan.name,
    status: plan.status,
    retrievedAt: new Date().toISOString(),
    setupFee: plan.payment_preferences?.setup_fee,
    quantitySupported: plan.quantity_supported,
    taxes: plan.taxes,
    billingCycles: plan.billing_cycles.map((cycle) => ({
      sequence: cycle.sequence,
      tenure: cycle.tenure_type,
      totalCycles: cycle.total_cycles,
      interval: { unit: cycle.frequency.interval_unit, count: cycle.frequency.interval_count },
      fixedPrice: cycle.pricing_scheme?.fixed_price,
      pricingModel: cycle.pricing_scheme?.pricing_model,
    })).sort((a, b) => a.sequence - b.sequence),
  };
}
