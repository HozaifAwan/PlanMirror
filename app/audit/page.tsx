import MerchantSearch from "./merchant-search";

export default function AuditPage() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-merchant-page">
      <h1>Merchant Search</h1>
      <p>Extract offers from a public pricing page, then choose whether to compare one with a PayPal sandbox test plan.</p>
      <MerchantSearch />
    </main>
  );
}
