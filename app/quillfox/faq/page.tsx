import Link from "next/link";
import { quillfoxFaqStaleQuote, quillfoxOffer } from "../../../lib/audit/quillfox";

export default function QuillfoxFaqPage() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-merchant-page" aria-labelledby="faq-title" data-testid="quillfox-faq-page">
      <p className="pm-eyebrow pm-secondary-surface">Quillfox · Billing FAQ</p>
      <h1 id="faq-title" className="pm-section-title">Billing questions</h1>
      <p className="pm-merchant-lead">Published help copy that PlanMirror can cite as website evidence.</p>

      <section aria-labelledby="trial-question">
        <h2 id="trial-question">How does the free trial work?</h2>
        <p>New subscribers receive 30 days free before monthly billing begins.</p>
      </section>

      <section aria-labelledby="price-question">
        <h2 id="price-question">What does Quillfox Pro cost after the trial?</h2>
        <p>{quillfoxOffer.quote}</p>
      </section>

      <section aria-labelledby="stale-note">
        <h2 id="stale-note">Older help article note</h2>
        <p data-testid="quillfox-faq-stale">{quillfoxFaqStaleQuote}</p>
        <p className="pm-caption">This FAQ line is intentionally stale for demo conflict scenarios. Prefer the pricing page when sources disagree.</p>
      </section>

      <div className="pm-merchant-actions">
        <Link className="pm-secondary-action" href="/quillfox">Back to pricing</Link>
        <Link className="pm-primary-action" href="/quillfox#audit">Run an audit</Link>
      </div>
    </main>
  );
}
