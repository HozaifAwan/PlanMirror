import type { BillingInterval, Money } from "../audit/types";

/** Normalized values for the initial fixed-price plan audit. */
export interface PayPalBillingPlan {
  id: string;
  productId: string;
  name: string;
  status: string;
  retrievedAt: string;
  billingCycles: PayPalBillingCycle[];
  setupFee?: Money;
  quantitySupported?: boolean;
  taxes?: { percentage: string; inclusive: boolean };
}

export interface PayPalBillingCycle {
  sequence: number;
  tenure: "TRIAL" | "REGULAR";
  interval: BillingInterval;
  /** PayPal uses zero for an unlimited number of regular cycles. */
  totalCycles: number;
  fixedPrice?: Money;
  pricingModel?: string;
}
