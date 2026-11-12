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
const quillfoxFaqStalePrice = "49";
export const quillfoxFaqStaleQuote = `Quillfox Pro costs USD ${quillfoxFaqStalePrice} per month after the free trial.`;

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

export const quillfoxCorrectedOffer = {
  ...quillfoxOffer,
  trialDays: 7,
  quote: "7 days free, then USD 9.99 per month.",
} as const;

export function quillfoxClaims(corrected = false, sourceUrl = quillfoxSourceUrl): CandidateClaim[] {
  const offer = corrected ? quillfoxCorrectedOffer : quillfoxOffer;
  const evidence = { url: corrected ? `${sourceUrl}#corrected-offer` : sourceUrl, quote: offer.quote };
  const trial: AdvertisedSubscriptionClaim = {
    field: "trial",
    offerLabel: quillfoxOffer.name,
    duration: { unit: "DAY", count: offer.trialDays },
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

export function quillfoxCrossPageClaims(sourceUrl = quillfoxSourceUrl): CandidateClaim[] {
  return [
    ...quillfoxClaims(false, sourceUrl),
    {
      id: "quillfox-faq-monthly",
      claim: {
        field: "recurring_price",
        offerLabel: quillfoxOffer.name,
        price: { value: quillfoxFaqStalePrice, currencyCode: quillfoxOffer.currency },
        quotedInterval: { unit: "MONTH", count: 1 },
        evidence: { url: `${sourceUrl}/faq#stale-note`, quote: quillfoxFaqStaleQuote },
      },
    },
  ];
}
