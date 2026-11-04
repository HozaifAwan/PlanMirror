import Decimal from "decimal.js";
import type { PayPalBillingPlan } from "../paypal/types";

export const offer = {
  name: "Quillfox Pro",
  trialDays: 30,
  monthlyPrice: "9.99",
  currency: "USD",
  quote: "30 days free, then $9.99 USD per month.",
};

export function samplePlan(corrected: boolean): PayPalBillingPlan {
  return {
    id: "P-QUILLFOXDEMO", productId: "PROD-QUILLFOX", name: offer.name, status: "ACTIVE",
    retrievedAt: "2026-11-04T00:00:00Z",
    billingCycles: [
      { sequence: 1, tenure: "TRIAL", totalCycles: 1, interval: { unit: "DAY", count: corrected ? 30 : 7 }, fixedPrice: { value: "0.00", currencyCode: "USD" } },
      { sequence: 2, tenure: "REGULAR", totalCycles: 0, interval: { unit: "MONTH", count: 1 }, fixedPrice: { value: corrected ? "9.99" : "19.99", currencyCode: "USD" } },
    ],
  };
}

export function auditQuillfox(plan: PayPalBillingPlan, claim: Pick<typeof offer, "trialDays" | "monthlyPrice" | "currency"> = offer) {
  const trials = plan.billingCycles.filter(cycle => cycle.tenure === "TRIAL");
  const regular = plan.billingCycles.filter(cycle => cycle.tenure === "REGULAR");
  const trial = trials[0];
  const recurring = regular[0];
  const trialDays = trials.length === 1 && trial.interval.unit === "DAY" &&
    trial.totalCycles > 0 && trial.fixedPrice?.currencyCode === claim.currency &&
    new Decimal(trial.fixedPrice.value).isZero() && !trial.pricingModel
    ? trial.interval.count * trial.totalCycles : undefined;
  const monthlyPrice = regular.length === 1 && recurring.interval.unit === "MONTH" &&
    recurring.interval.count === 1 && recurring.totalCycles === 0 && !recurring.pricingModel &&
    !plan.quantitySupported && recurring.fixedPrice?.currencyCode === claim.currency &&
    (!plan.taxes || plan.taxes.inclusive || new Decimal(plan.taxes.percentage).isZero())
    ? recurring.fixedPrice.value : undefined;

  const setupFee = plan.setupFee;
  const setupStatus = !setupFee ? "Match" : setupFee.currencyCode !== claim.currency ? "Needs review"
    : new Decimal(setupFee.value).isZero() ? "Match" : "Mismatch";

  return [
    {
      field: "Free trial", advertised: `${claim.trialDays} days`,
      configured: trials.length === 0 ? "No trial configured" : trialDays === undefined ? "Review trial configuration" : `${trialDays} days`,
      status: trials.length === 0 ? "Mismatch" : trialDays === undefined ? "Needs review" : trialDays === claim.trialDays ? "Match" : "Mismatch",
      paypalField: "billing_cycles (TRIAL)", planId: plan.id,
    },
    {
      field: "Monthly renewal", advertised: `USD ${claim.monthlyPrice}`,
      configured: monthlyPrice === undefined ? "Review renewal configuration" : `USD ${monthlyPrice}`,
      status: monthlyPrice === undefined ? "Needs review" : new Decimal(monthlyPrice).eq(claim.monthlyPrice) ? "Match" : "Mismatch",
      paypalField: "billing_cycles (REGULAR)", planId: plan.id,
    },
    {
      field: "Upfront setup fee", advertised: "No upfront fee (free trial)",
      configured: setupFee ? `${setupFee.currencyCode} ${setupFee.value}` : "No setup fee configured",
      status: setupStatus, paypalField: "payment_preferences.setup_fee", planId: plan.id,
    },
    {
      field: "Plan availability", advertised: "Available to subscribe",
      configured: plan.status,
      status: plan.status === "ACTIVE" ? "Match" : "Needs review",
      paypalField: "status", planId: plan.id,
    },
  ];
}
