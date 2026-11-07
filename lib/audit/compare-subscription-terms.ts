import Decimal from "decimal.js";
import type { Comparator } from "../orchestration/contracts";
import type { PayPalBillingCycle } from "../paypal/types";
import type { AuditFinding, BillingInterval, Money } from "./types";

// Calendar units and elapsed days are intentionally separate.
function duration(interval: BillingInterval) {
  const days = interval.unit === "DAY" || interval.unit === "WEEK";
  const multiplier = interval.unit === "WEEK" ? BigInt(7) : interval.unit === "YEAR" ? BigInt(12) : BigInt(1);
  return { unit: days ? "days" : "calendar months", count: BigInt(interval.count) * multiplier };
}

function fixedPrice(cycle: PayPalBillingCycle) {
  return cycle.pricingModel === undefined ? cycle.fixedPrice : undefined;
}

function moneyLabel(money: Money) {
  return `${money.value} ${money.currencyCode}`;
}

/** Compare one validated claim against the plan already mapped by the caller. */
export const compareSubscriptionTerms: Comparator = ({ plan, claim }): AuditFinding => {
  function finding(status: AuditFinding["status"], summary: string, fieldPath: string): AuditFinding {
    return {
      status, summary, field: claim.field, offerLabel: claim.offerLabel,
      website: claim.evidence,
      paypal: { planId: plan.id, retrievedAt: plan.retrievedAt, fieldPath },
    };
  }

  function compareMoney(advertised: Money, configured: Money, path: string, multiplier = BigInt(1)) {
    // Multiplication must retain every digit, including unusually precise inputs.
    const Exact = Decimal.clone({ precision: advertised.value.length + multiplier.toString().length });
    const expected = new Exact(advertised.value).times(multiplier.toString());
    const equal = advertised.currencyCode === configured.currencyCode && expected.eq(configured.value);
    const basis = multiplier === BigInt(1) ? moneyLabel(advertised) :
      `${moneyLabel(advertised)} × ${multiplier} = ${expected.toFixed()} ${advertised.currencyCode} per collection`;
    return finding(equal ? "match" : "mismatch", `Advertised: ${basis}. PayPal: ${moneyLabel(configured)}.`, path);
  }

  if (claim.field === "setup_fee") {
    return plan.setupFee ? compareMoney(claim.price, plan.setupFee, "setupFee") :
      finding("needs_review", "PayPal did not provide an explicit setup fee.", "setupFee");
  }

  const cycles = plan.billingCycles.map((cycle, index) => ({ cycle, index }))
    .sort((a, b) => a.cycle.sequence - b.cycle.sequence);
  const regular = cycles.at(-1);
  const trials = cycles.slice(0, -1);
  if (!regular || regular.cycle.tenure !== "REGULAR" || trials.length > 2 ||
      cycles.some(({ cycle }, index) => cycle.sequence !== index + 1) ||
      trials.some(({ cycle }) => cycle.tenure !== "TRIAL" || cycle.totalCycles === 0)) {
    return finding("needs_review", "PayPal billing cycle sequence is unsupported.", "billingCycles");
  }

  if (claim.field === "trial") {
    const advertised = duration(claim.duration);
    const label = `${advertised.count} ${advertised.unit}`;
    if (!trials.length) {
      return finding("mismatch", `Advertised trial: ${label}. PayPal has no trial cycle.`, "billingCycles");
    }
    // A paid introductory phase does not extend the advertised free period.
    // Aggregate only phases with the same known price.
    if (trials.length > 1) {
      const prices = trials.map(({ cycle }) => fixedPrice(cycle));
      const first = prices[0];
      if (!first || prices.some((price) => !price || price.currencyCode !== first.currencyCode ||
          !new Decimal(price.value).eq(first.value))) {
        return finding("needs_review", `Advertised trial: ${label}. PayPal trial phases have different or unsupported pricing; their durations cannot be combined reliably.`, "billingCycles");
      }
    }
    let total = BigInt(0);
    for (const { cycle } of trials) {
      const actual = duration(cycle.interval);
      if (actual.unit !== advertised.unit) {
        return finding("needs_review", `Advertised trial: ${label}. PayPal includes a cycle of ${actual.count} ${actual.unit}; exact conversion requires calendar context.`, "billingCycles");
      }
      total += actual.count * BigInt(cycle.totalCycles);
    }
    const summary = `Advertised trial: ${label}. PayPal trial: ${total} ${advertised.unit}.`;
    if (total !== advertised.count) return finding("mismatch", summary, "billingCycles");
    if (!claim.price) return finding("needs_review", `${summary} Advertised trial price is unspecified.`, "billingCycles");

    const trialPrice = claim.price;
    if (new Decimal(trialPrice.value).isZero()) {
      for (const { cycle, index } of trials) {
        const configured = fixedPrice(cycle);
        const path = `billingCycles[${index}].fixedPrice`;
        if (!configured) return finding("needs_review", `${summary} PayPal trial pricing is unavailable or unsupported.`, path);
        if (configured.currencyCode !== trialPrice.currencyCode || !new Decimal(configured.value).isZero()) {
          return compareMoney(trialPrice, configured, path);
        }
      }
      return finding("match", `${summary} Both specify a free trial (${moneyLabel(trialPrice)}).`, "billingCycles");
    }

    const [{ cycle, index }] = trials;
    const configured = fixedPrice(cycle);
    if (plan.quantitySupported || (plan.taxes && !new Decimal(plan.taxes.percentage).isZero())) {
      return finding("needs_review", `${summary} Paid trial pricing requires review for quantity or taxes.`, `billingCycles[${index}].fixedPrice`);
    }
    if (trials.length === 1 && cycle.totalCycles === 1 && configured) {
      const result = compareMoney(trialPrice, configured, `billingCycles[${index}].fixedPrice`);
      return { ...result, summary: `${summary} ${result.summary}` };
    }
    return finding("needs_review", `${summary} Paid trial pricing requires a single fixed-price collection.`, "billingCycles");
  }

  const cadencePath = `billingCycles[${regular.index}].interval`;
  const billed = duration(claim.field === "billing_interval" ? claim.interval : claim.billedInterval ?? claim.quotedInterval);
  const configuredCadence = duration(regular.cycle.interval);
  const cadenceSummary = `Advertised collection: every ${billed.count} ${billed.unit}. PayPal collection: every ${configuredCadence.count} ${configuredCadence.unit}.`;
  if (billed.unit !== configuredCadence.unit || billed.count !== configuredCadence.count) {
    return finding("mismatch", cadenceSummary, cadencePath);
  }
  if (claim.field === "billing_interval") return finding("match", cadenceSummary, cadencePath);

  const path = `billingCycles[${regular.index}].fixedPrice`;
  const configured = fixedPrice(regular.cycle);
  if (!configured || plan.quantitySupported || (plan.taxes && !new Decimal(plan.taxes.percentage).isZero())) {
    return finding("needs_review", "PayPal pricing requires review for missing fixed prices, pricing models, quantity, or taxes.", path);
  }
  const quoted = duration(claim.quotedInterval);
  if (quoted.unit !== billed.unit || billed.count % quoted.count !== BigInt(0)) {
    return finding("needs_review", "The advertised rate cannot be scaled to the collection interval exactly.", cadencePath);
  }
  return compareMoney(claim.price, configured, path, billed.count / quoted.count);
};
