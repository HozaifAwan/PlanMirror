import { z } from "zod";
import type { AdvertisedSubscriptionClaim, AuditFinding } from "../audit/types";
import type { PayPalBillingPlan } from "../paypal/types";

const text = z.string().trim().min(1);
const money = z.object({ value: z.string().regex(/^\d+(\.\d+)?$/), currencyCode: z.string().regex(/^[A-Z]{3}$/) });
const interval = z.object({ unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]), count: z.number().int().positive() });
const website = z.object({ url: z.url().refine(value => ["https:", "http:"].includes(new URL(value).protocol)), quote: z.string().refine(value => value.trim().length > 0) });
const paypal = z.object({ planId: text, fieldPath: text, retrievedAt: z.iso.datetime() });
const baseClaim = { offerLabel: text, evidence: website };
export const claimSchema: z.ZodType<AdvertisedSubscriptionClaim> = z.discriminatedUnion("field", [
  z.object({ ...baseClaim, field: z.literal("trial"), duration: interval, price: money.optional() }),
  z.object({ ...baseClaim, field: z.literal("recurring_price"), price: money, quotedInterval: interval, billedInterval: interval.optional() }),
  z.object({ ...baseClaim, field: z.literal("billing_interval"), interval }),
  z.object({ ...baseClaim, field: z.literal("setup_fee"), price: money }),
]);

export const planSchema: z.ZodType<PayPalBillingPlan> = z.strictObject({
  id: text, productId: text, name: text, status: text, retrievedAt: z.iso.datetime(),
  billingCycles: z.array(z.strictObject({
    sequence: z.number().int().positive(), tenure: z.enum(["TRIAL", "REGULAR"]), interval,
    totalCycles: z.number().int().nonnegative(), fixedPrice: money.optional(),
    pricingModel: text.optional(),
  })).min(1),
  setupFee: money.optional(),
  quantitySupported: z.boolean().optional(),
  taxes: z.object({ percentage: z.string().regex(/^\d+(\.\d+)?$/), inclusive: z.boolean() }).optional(),
  source: z.record(z.string(), z.unknown()).optional(),
});

const baseFinding = { offerLabel: text, field: z.enum(["trial", "recurring_price", "billing_interval", "setup_fee"]), summary: text, recommendation: text.optional() };
export const findingSchema: z.ZodType<AuditFinding> = z.discriminatedUnion("status", [
  z.object({ ...baseFinding, status: z.literal("match"), website, paypal }),
  z.object({ ...baseFinding, status: z.literal("mismatch"), website, paypal }),
  z.object({ ...baseFinding, status: z.literal("needs_review"), website: website.optional(), paypal: paypal.optional() }),
]);

export type CandidateClaim = {
  id: string;
  claim: AdvertisedSubscriptionClaim;
  ambiguity?: string;
};

export type AuditInput = {
  /** Caller establishes merchant/offer mapping before invoking orchestration. */
  plan?: PayPalBillingPlan;
  claims: CandidateClaim[];
};

export const claimsSchema: z.ZodType<CandidateClaim[]> = z.array(
  z.object({ id: text, claim: claimSchema, ambiguity: text.optional() }),
).max(100).refine(claims => new Set(claims.map(claim => claim.id)).size === claims.length);

export const inputSchema: z.ZodType<AuditInput> = z.object({
  plan: planSchema.optional(),
  claims: claimsSchema,
});

export type Comparator = (input: {
  plan: PayPalBillingPlan;
  claim: AdvertisedSubscriptionClaim;
}) => AuditFinding | Promise<AuditFinding>;

export type AuditIssue = {
  code: "missing_plan" | "missing_claims" | "ambiguous_claim" | "comparison_failed" | "invalid_finding" | "provider_failed" | "invalid_input" | "comparator_unavailable";
  claimId?: string;
  stage?: "plan" | "claims";
};

export type AuditResult = {
  status: "completed" | "needs_review" | "failed";
  findings: { claimId: string; finding: AuditFinding }[];
  issues: AuditIssue[];
};

/** Adapters return normalized data, never raw provider responses. */
export type AuditProviders = {
  loadPlan: () => Promise<PayPalBillingPlan | undefined>;
  loadClaims: () => Promise<CandidateClaim[]>;
};
