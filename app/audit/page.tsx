import MerchantSearch from "./merchant-search";

export default function AuditPage() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-merchant-page">
      <h1>Merchant Search</h1>
      <p>Paste your pricing page URL. AI extracts the offer’s billing terms and compares them with the corresponding plan in your connected PayPal sandbox account.</p>
      <MerchantSearch />
    </main>
  );
}
