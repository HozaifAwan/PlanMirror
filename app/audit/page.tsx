import Link from "next/link";
import MerchantSearch from "./merchant-search";

export default function AuditPage() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-merchant-page">
      <h1>Merchant Search</h1>
      <p>Enter a merchant’s pricing page and compare its advertised terms with the matching plan in the connected PayPal Sandbox account.</p>
      <Link href="/quillfox#audit">Try the Quillfox walkthrough</Link>
      <MerchantSearch />
    </main>
  );
}
