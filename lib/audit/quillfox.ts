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

export function auditQuillfox(plan: PayPalBillingPlan) {
  const trials = plan.billingCycles.filter(cycle => cycle.tenure === "TRIAL");
  const regular = plan.billingCycles.filter(cycle => cycle.tenure === "REGULAR");
  const trial = trials[0];
  const recurring = regular[0];
  const trialDays = trials.length === 1 && trial.interval.unit === "DAY" &&
    trial.totalCycles > 0 && trial.fixedPrice?.currencyCode === offer.currency &&
    new Decimal(trial.fixedPrice.value).isZero() && !trial.pricingModel
    ? trial.interval.count * trial.totalCycles : undefined;
  const monthlyPrice = regular.length === 1 && recurring.interval.unit === "MONTH" &&
    recurring.interval.count === 1 && recurring.totalCycles === 0 && !recurring.pricingModel &&
    !plan.quantitySupported && recurring.fixedPrice?.currencyCode === offer.currency &&
    (!plan.taxes || plan.taxes.inclusive || new Decimal(plan.taxes.percentage).isZero())
    ? recurring.fixedPrice.value : undefined;

  return [
    {
      field: "Free trial", advertised: `${offer.trialDays} days`,
      configured: trialDays === undefined ? "Review trial configuration" : `${trialDays} days`,
      status: trialDays === undefined ? "Needs review" : trialDays === offer.trialDays ? "Match" : "Mismatch",
      paypalField: "billing_cycles (TRIAL)", planId: plan.id,
    },
    {
      field: "Monthly renewal", advertised: `USD ${offer.monthlyPrice}`,
      configured: monthlyPrice === undefined ? "Review renewal configuration" : `USD ${monthlyPrice}`,
      status: monthlyPrice === undefined ? "Needs review" : new Decimal(monthlyPrice).eq(offer.monthlyPrice) ? "Match" : "Mismatch",
      paypalField: "billing_cycles (REGULAR)", planId: plan.id,
    },
  ];
}
