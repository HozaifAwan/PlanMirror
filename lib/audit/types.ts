// Shared contract: Sujeeth supplies claims, Nilanee produces findings, and Sebastian displays them. Coordinate changes with Hozaif.
/** Preserve decimal amounts as text across JSON and API boundaries. */
export interface Money {
  value: string;
  currencyCode: string;
}

export interface BillingInterval {
  unit: "DAY" | "WEEK" | "MONTH" | "YEAR";
  count: number;
}

export interface WebsiteEvidence {
  url: string;
  quote: string;
}

export interface PayPalEvidence {
  planId: string;
  fieldPath: string;
  retrievedAt: string;
}

/** A quoted monthly equivalent can have a separate annual collection cadence. */
export type AdvertisedSubscriptionClaim = {
  offerLabel: string;
  evidence: WebsiteEvidence;
} & (
  | { field: "trial"; duration: BillingInterval; price?: Money }
  | { field: "recurring_price"; price: Money; quotedInterval: BillingInterval; billedInterval?: BillingInterval }
  | { field: "billing_interval"; interval: BillingInterval }
  | { field: "setup_fee"; price: Money }
);

export type AuditFinding = {
  offerLabel: string;
  field: AdvertisedSubscriptionClaim["field"];
  summary: string;
  recommendation?: string;
} & (
  | { status: "match" | "mismatch"; website: WebsiteEvidence; paypal: PayPalEvidence }
  | { status: "needs_review"; website?: WebsiteEvidence; paypal?: PayPalEvidence }
);
