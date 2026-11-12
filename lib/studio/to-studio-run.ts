import type { AdvertisedSubscriptionClaim, BillingInterval, Money } from "../audit/types";
import type { AuditResult, CandidateClaim } from "../orchestration/contracts";
import type { PayPalBillingPlan } from "../paypal/types";
import type { PaymentTimelineStep, StudioFinding, StudioRun } from "./types";

type ClaimInput = CandidateClaim | AdvertisedSubscriptionClaim;

const UNAVAILABLE_ADVERTISED = "Advertised value unavailable";
const UNAVAILABLE_CONFIGURED = "Configured value unavailable";

function isCandidate(claim: ClaimInput): claim is CandidateClaim {
  return "claim" in claim && "id" in claim;
}

function moneyLabel(money: Money) {
  return `${money.currencyCode} ${money.value}`;
}

function intervalLabel(interval: BillingInterval) {
  if (interval.unit === "DAY") return `${interval.count} ${interval.count === 1 ? "day" : "days"}`;
  if (interval.unit === "WEEK") return `${interval.count} ${interval.count === 1 ? "week" : "weeks"}`;
  if (interval.unit === "MONTH") return `${interval.count} ${interval.count === 1 ? "month" : "months"}`;
  return `${interval.count} ${interval.count === 1 ? "year" : "years"}`;
}

/** Format advertised values only from structured claim fields. */
export function formatAdvertisedDisplay(claim: AdvertisedSubscriptionClaim): string {
  if (claim.field === "trial") {
    const duration = intervalLabel(claim.duration);
    if (!claim.price) return `${duration}; trial price unavailable`;
    if (/^0+(?:\.0+)?$/.test(claim.price.value)) return `${duration} free`;
    return `${duration} at ${moneyLabel(claim.price)}`;
  }
  if (claim.field === "recurring_price") {
    const quoted = intervalLabel(claim.quotedInterval);
    const billed = claim.billedInterval ? `; billed ${intervalLabel(claim.billedInterval)}` : "";
    return `${moneyLabel(claim.price)} / ${quoted}${billed}`;
  }
  if (claim.field === "billing_interval") return intervalLabel(claim.interval);
  return moneyLabel(claim.price);
}

function readPath(plan: PayPalBillingPlan, fieldPath: string): unknown {
  if (fieldPath === "setupFee") return plan.setupFee;
  if (fieldPath === "billingCycles") return plan.billingCycles;

  const match = /^billingCycles\[(\d+)\](?:\.(interval|fixedPrice|totalCycles))?$/.exec(fieldPath);
  if (!match) return undefined;
  const cycle = plan.billingCycles[Number(match[1])];
  if (!cycle) return undefined;
  if (!match[2]) return cycle;
  return match[2] === "totalCycles" ? `${cycle.totalCycles} regular collections` : match[2] === "interval" ? cycle.interval : cycle.fixedPrice;
}

function formatConfiguredValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  if ("currencyCode" in value && "value" in value) {
    const money = value as Money;
    if (typeof money.value === "string" && typeof money.currencyCode === "string") return moneyLabel(money);
  }
  if ("unit" in value && "count" in value) {
    const interval = value as BillingInterval;
    if (typeof interval.unit === "string" && typeof interval.count === "number") return intervalLabel(interval);
  }
  return undefined;
}

/** Resolve configured display only through the finding's PayPal field path on the retrieved plan. */
export function formatConfiguredDisplay(plan: PayPalBillingPlan, fieldPath: string | undefined): string {
  if (!fieldPath) return UNAVAILABLE_CONFIGURED;
  if (fieldPath === "billingCycles") return plan.billingCycles.map(cycle =>
    `${cycle.tenure === "TRIAL" ? "Trial" : "Regular"} phase ${cycle.sequence}: ${intervalLabel(cycle.interval)}; ${cycle.totalCycles === 0 ? "ongoing" : `${cycle.totalCycles} cycles`}; ${cycle.fixedPrice ? moneyLabel(cycle.fixedPrice) : "fixed price unavailable"}`,
  ).join(" | ") || UNAVAILABLE_CONFIGURED;
  const value = readPath(plan, fieldPath);
  return formatConfiguredValue(value) ?? UNAVAILABLE_CONFIGURED;
}

function resolveClaim(claims: ClaimInput[], claimId: string, offerLabel: string, field: AdvertisedSubscriptionClaim["field"]) {
  const matches = claims.filter(item => isCandidate(item)
    ? item.id === claimId && item.claim.offerLabel === offerLabel && item.claim.field === field
    : item.offerLabel === offerLabel && item.field === field);
  if (matches.length !== 1) return undefined;
  return isCandidate(matches[0]) ? matches[0].claim : matches[0];
}

function paymentTimeline(
  trial: Extract<AdvertisedSubscriptionClaim, { field: "trial" }>,
  claims: ClaimInput[],
  plan: PayPalBillingPlan,
): NonNullable<StudioFinding["paymentTimeline"]> {
  const advertised: PaymentTimelineStep[] = [
    { label: "Trial", detail: formatAdvertisedDisplay(trial) },
  ];
  const renewals = claims.flatMap(input => {
    if (isCandidate(input) && input.ambiguity) return [];
    const claim = isCandidate(input) ? input.claim : input;
    return claim.field === "recurring_price" && claim.offerLabel === trial.offerLabel
      && claim.evidence.url === trial.evidence.url && claim.evidence.quote === trial.evidence.quote ? [claim] : [];
  });
  advertised.push({
    label: "First payment",
    detail: !trial.price ? "Trial charge needs review."
      : !/^0+(?:\.0+)?$/.test(trial.price.value) ? "A trial charge is advertised. Its collection timing needs review."
      : `After ${intervalLabel(trial.duration)} if no earlier charge applies. Check the quote for the first payment amount and any setup fees.`,
  }, {
    label: "Regular billing",
    detail: renewals.length === 1 ? formatAdvertisedDisplay(renewals[0]) : "Rate or cadence needs review for this quote.",
  });

  const configured: PaymentTimelineStep[] = [];
  if (plan.setupFee && !/^0+(?:\.0+)?$/.test(plan.setupFee.value)) {
    configured.push({ label: "Setup charge", detail: moneyLabel(plan.setupFee), fields: ["setupFee"] });
  }
  let firstPaymentShown = configured.length > 0;
  if (!plan.setupFee) configured.push({ label: "Setup charge", detail: "Setup fee needs review.", fields: ["setupFee"] });
  let firstPaymentKnown = true;
  const elapsed: string[] = [];
  const elapsedFields: string[] = [];
  const ordered = plan.billingCycles.map((cycle, index) => ({ cycle, index })).sort((a, b) => a.cycle.sequence - b.cycle.sequence);
  for (const { cycle, index } of ordered) {
    const path = `billingCycles[${index}]`;
    const price = cycle.pricingModel === undefined ? cycle.fixedPrice : undefined;
    const free = price && /^0+(?:\.0+)?$/.test(price.value);
    const start = elapsed.length ? `After ${elapsed.join(" plus ")}` : "At plan start";
    const label = cycle.tenure === "REGULAR" ? "Regular billing" : free ? "Free trial phase" : "Introductory phase";
    const detail = price ? `${moneyLabel(price)} per ${intervalLabel(cycle.interval)}` : "Price needs review";
    if (!price) firstPaymentKnown = false;
    if (!firstPaymentShown && firstPaymentKnown && price && !free) {
      configured.push({ label: "First scheduled billing payment", detail: `${start} · ${moneyLabel(price)}`, fields: [`${path}.fixedPrice`, ...elapsedFields] });
      firstPaymentShown = true;
    }
    configured.push({
      label,
      detail: `${start} · ${detail}${cycle.totalCycles ? ` · ${cycle.totalCycles} collection cycles` : ""}`,
      fields: [`${path}.interval`, `${path}.fixedPrice`, `${path}.totalCycles`],
    });
    if (cycle.tenure === "TRIAL") {
      elapsed.push(intervalLabel({ ...cycle.interval, count: cycle.interval.count * cycle.totalCycles }));
      elapsedFields.push(`${path}.interval`, `${path}.totalCycles`);
    }
  }
  if (!firstPaymentShown) configured.push({ label: "First payment", detail: "Timing or amount needs review from the configured terms." });
  return { advertised, configured };
}

export function toStudioRun(input: {
  id: string;
  label: string;
  result: AuditResult;
  claims: ClaimInput[];
  plan: PayPalBillingPlan;
  description?: string;
}): StudioRun {
  const findings: StudioFinding[] = input.result.findings.map(({ claimId, finding }) => {
    const claim = resolveClaim(input.claims, claimId, finding.offerLabel, finding.field);
    const sameSnapshot = finding.paypal?.planId === input.plan.id && finding.paypal.retrievedAt === input.plan.retrievedAt;
    return {
      id: claimId,
      claimId,
      finding,
      priority: finding.status === "match" ? undefined : finding.status === "needs_review"
        ? { level: "review", reason: "The available terms do not support a definitive verdict." }
        : finding.field === "trial"
          ? { level: "high", reason: "A different free-trial term can change when the first payment is due." }
          : finding.field === "setup_fee"
            ? { level: "medium", reason: "A one-time charge differs from the published terms." }
            : { level: "high", reason: "The recurring amount or collection schedule differs from the published terms." },
      paymentTimeline: sameSnapshot && claim?.field === "trial" && finding.status !== "needs_review"
        ? paymentTimeline(claim, input.claims, input.plan) : undefined,
      advertisedDisplay: claim ? formatAdvertisedDisplay(claim) : UNAVAILABLE_ADVERTISED,
      configuredDisplay: sameSnapshot
        ? formatConfiguredDisplay(input.plan, finding.paypal?.fieldPath) : UNAVAILABLE_CONFIGURED,
    };
  });

  return {
    id: input.id,
    label: input.label,
    source: "live",
    status: input.result.status,
    description: input.description ?? `Live sandbox audit for plan ${input.plan.id}.`,
    findings,
    issues: input.result.issues.map((issue) => ({
      code: issue.code,
      message: issue.claimId ? `${issue.code.replaceAll("_", " ")} (${issue.claimId})` : issue.code.replaceAll("_", " "),
      claimId: issue.claimId,
      stage: issue.stage,
    })),
    retrievedAt: input.plan.retrievedAt,
    planId: input.plan.id,
  };
}
