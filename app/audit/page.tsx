import { approvedMerchantPricingUrl } from "../../lib/audit/merchant-page";
import MerchantSearch from "./merchant-search";

export const dynamic = "force-dynamic";

export default function AuditPage() {
  const demoUrl = approvedMerchantPricingUrl(process.env.PLANMIRROR_MERCHANT_DEMO_URL?.trim() ?? "")?.href;
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-merchant-page">
      <h1>Merchant Search</h1>
      <p>Enter a merchant’s pricing page and compare its advertised terms with the configured PayPal Sandbox test plan.</p>
      <MerchantSearch demoUrl={demoUrl} />
    </main>
  );
}
