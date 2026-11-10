import type { AdvertisedSubscriptionClaim, BillingInterval, Money } from "../audit/types";
import type { AuditResult, CandidateClaim } from "../orchestration/contracts";
import type { PayPalBillingPlan } from "../paypal/types";
import type { StudioFinding, StudioRun } from "./types";

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

  const match = /^billingCycles\[(\d+)\](?:\.(interval|fixedPrice))?$/.exec(fieldPath);
  if (!match) return undefined;
  const cycle = plan.billingCycles[Number(match[1])];
  if (!cycle) return undefined;
  if (!match[2]) return cycle;
  return match[2] === "interval" ? cycle.interval : cycle.fixedPrice;
}

function formatConfiguredValue(value: unknown): string | undefined {
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
    return {
      id: claimId,
      claimId,
      finding,
      advertisedDisplay: claim ? formatAdvertisedDisplay(claim) : UNAVAILABLE_ADVERTISED,
      configuredDisplay: finding.paypal?.planId === input.plan.id && finding.paypal.retrievedAt === input.plan.retrievedAt
        ? formatConfiguredDisplay(input.plan, finding.paypal.fieldPath) : UNAVAILABLE_CONFIGURED,
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
