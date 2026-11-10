import type { AdvertisedSubscriptionClaim } from "./types";
import type { CandidateClaim } from "../orchestration/contracts";

/** Canonical demo evidence URL. Quotes must appear verbatim on the Quillfox pricing page. */
export const quillfoxSourceUrl = "https://planmirror.local/quillfox";

export const quillfoxOffer = {
  name: "Quillfox Pro",
  trialDays: 30,
  monthlyPrice: "9.99",
  currency: "USD",
  /** Exact advertised sentence used as claim evidence. */
  quote: "30 days free, then USD 9.99 per month.",
} as const;

/** Plain text used for AI extraction audits. Must contain the claim quotes. */
export const quillfoxPricingSourceText = [
  "Quillfox Pro",
  "Quillfox · Fictional demo merchant",
  "Subscription offer used in the PlanMirror audit demo.",
  "Advertised subscription",
  quillfoxOffer.quote,
  "Trial: 30 days free",
  "Renewal: USD 9.99 per month",
  "Currency: USD",
].join("\n");

/** Deliberately stale FAQ line for conflicting-source demos. */
export const quillfoxFaqStaleQuote = "Quillfox Pro costs USD 49 per month after the free trial.";

export const quillfoxFaqSourceText = [
  "Quillfox billing FAQ",
  "How does the free trial work?",
  "New subscribers receive 30 days free before monthly billing begins.",
  "What does Quillfox Pro cost after the trial?",
  quillfoxOffer.quote,
  "Older help article note:",
  quillfoxFaqStaleQuote,
  "Prefer the pricing page when sources disagree.",
].join("\n");

export function quillfoxClaims(): CandidateClaim[] {
  const evidence = { url: quillfoxSourceUrl, quote: quillfoxOffer.quote };
  const trial: AdvertisedSubscriptionClaim = {
    field: "trial",
    offerLabel: quillfoxOffer.name,
    duration: { unit: "DAY", count: quillfoxOffer.trialDays },
    price: { value: "0.00", currencyCode: quillfoxOffer.currency },
    evidence,
  };
  const recurring: AdvertisedSubscriptionClaim = {
    field: "recurring_price",
    offerLabel: quillfoxOffer.name,
    price: { value: quillfoxOffer.monthlyPrice, currencyCode: quillfoxOffer.currency },
    quotedInterval: { unit: "MONTH", count: 1 },
    evidence,
  };
  return [
    { id: "quillfox-trial", claim: trial },
    { id: "quillfox-monthly", claim: recurring },
  ];
}
