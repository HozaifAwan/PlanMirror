import { z } from "zod";
import type { AdvertisedSubscriptionClaim, BillingInterval, Money } from "../audit/types";

const moneySchema = z.object({ value: z.string().regex(/^\d+(\.\d+)?$/), currencyCode: z.string().regex(/^[A-Z]{3}$/) });
const intervalSchema = z.object({ unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]), count: z.number().int().positive() });
const evidenceSchema = z.object({ url: z.string().url(), quote: z.string().min(1) });

export const extractedClaimSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("trial"), offerLabel: z.string().min(1), evidence: evidenceSchema, duration: intervalSchema, price: moneySchema.optional() }),
  z.object({ field: z.literal("recurring_price"), offerLabel: z.string().min(1), evidence: evidenceSchema, price: moneySchema, quotedInterval: intervalSchema, billedInterval: intervalSchema.optional() }),
  z.object({ field: z.literal("billing_interval"), offerLabel: z.string().min(1), evidence: evidenceSchema, interval: intervalSchema }),
  z.object({ field: z.literal("setup_fee"), offerLabel: z.string().min(1), evidence: evidenceSchema, price: moneySchema }),
]);

export const extractionResponseSchema = z.object({ status: z.enum(["ok", "needs_review"]), claims: z.array(extractedClaimSchema), reason: z.string().min(1).optional() }).superRefine((value, ctx) => {
  if (value.status === "ok" && value.claims.length === 0) ctx.addIssue({ code: "custom", message: "A successful extraction requires at least one claim." });
  if (value.status === "needs_review" && !value.reason) ctx.addIssue({ code: "custom", message: "Review results require a reason." });
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
export type Claim = AdvertisedSubscriptionClaim;
export type { BillingInterval, Money };
