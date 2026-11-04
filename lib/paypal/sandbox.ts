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
  taxes: z.object({ percentage: z.string(), inclusive: z.boolean() }).optional(),
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

export async function readSandboxPlan(id: string): Promise<PayPalBillingPlan> {
  const planId = planIdSchema.parse(id);
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new PayPalSandboxError(503, "PayPal sandbox credentials are missing.");
  }

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
  const { access_token: token } = z.object({ access_token: z.string().min(1) }).parse(await tokenResponse.json());

  const response = await fetch(origin + "/v1/billing/plans/" + planId, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
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
