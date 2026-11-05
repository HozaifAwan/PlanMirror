import { z } from "zod";
import type { PayPalBillingPlan } from "./types";

export const planIdSchema = z.string().regex(/^P-[A-Z0-9]{1,48}$/);
const money = z.object({ value: z.string().regex(/^\d+(\.\d+)?$/), currency_code: z.string().regex(/^[A-Z]{3}$/) });
const cycle = z.object({
  sequence: z.number().int().min(1).max(3),
  tenure_type: z.enum(["TRIAL", "REGULAR"]),
  total_cycles: z.number().int().nonnegative(),
  frequency: z.object({ interval_unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]), interval_count: z.number().int().positive() }),
  pricing_scheme: z.object({ fixed_price: money.optional(), pricing_model: z.string().optional() }).optional(),
});
const schema = z.object({
  id: planIdSchema, product_id: z.string().min(1), name: z.string().min(1), status: z.enum(["CREATED", "ACTIVE", "INACTIVE"]),
  billing_cycles: z.array(cycle).min(1).max(3),
  payment_preferences: z.object({ setup_fee: money.optional() }).optional(),
  quantity_supported: z.boolean().optional(),
  taxes: z.object({ percentage: z.string().regex(/^\d+(\.\d+)?$/), inclusive: z.boolean() }).optional(),
}).superRefine((plan, ctx) => {
  const cycles = plan.billing_cycles;
  if (cycles.filter(c => c.tenure_type === "REGULAR").length !== 1 || cycles.filter(c => c.tenure_type === "TRIAL").length > 2 ||
      new Set(cycles.map(c => c.sequence)).size !== cycles.length ||
      cycles.some(c => c.tenure_type === "TRIAL" && c.total_cycles === 0)) {
    ctx.addIssue({ code: "custom", message: "Invalid billing cycle structure" });
  }
  const sorted = [...cycles].sort((a,b) => a.sequence - b.sequence);
  if (sorted.some((c,i) => c.sequence !== i+1 || (c.tenure_type === "REGULAR" && i !== sorted.length-1))) {
    ctx.addIssue({ code: "custom", message: "Invalid billing cycle sequence" });
  }
});

export function normalizePlan(input: unknown, retrievedAt = new Date().toISOString()): PayPalBillingPlan {
  const p = schema.parse(input);
  const fee = p.payment_preferences?.setup_fee;
  return {
    id: p.id, productId: p.product_id, name: p.name, status: p.status, retrievedAt,
    setupFee: fee && { value: fee.value, currencyCode: fee.currency_code },
    quantitySupported: p.quantity_supported, taxes: p.taxes,
    source: structuredClone(input) as Record<string, unknown>,
    billingCycles: p.billing_cycles.map(c => ({ sequence: c.sequence, tenure: c.tenure_type,
      totalCycles: c.total_cycles, interval: { unit: c.frequency.interval_unit, count: c.frequency.interval_count },
      fixedPrice: c.pricing_scheme?.fixed_price && { value: c.pricing_scheme.fixed_price.value, currencyCode: c.pricing_scheme.fixed_price.currency_code },
      pricingModel: c.pricing_scheme?.pricing_model,
    })).sort((a,b) => a.sequence-b.sequence),
  };
}
