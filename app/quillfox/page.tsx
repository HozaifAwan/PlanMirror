import Link from "next/link";
import { quillfoxOffer } from "../../lib/audit/quillfox";
import AuditForm from "../audit/audit-form";

export const dynamic = "force-dynamic";

export default function QuillfoxPricingPage() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-merchant-page pm-quillfox-workspace" aria-labelledby="quillfox-title" data-testid="quillfox-pricing-page">
      <header className="pm-quillfox-heading">
        <div>
          <p className="pm-eyebrow pm-secondary-surface">Fictional demo merchant</p>
          <h1 id="quillfox-title" className="pm-section-title">{quillfoxOffer.name}</h1>
          <p className="pm-merchant-lead">A clear promise. A closer look at the billing behind it.</p>
        </div>
        <Link className="pm-secondary-action" href="/quillfox/faq">Read billing FAQ <span aria-hidden="true">↗</span></Link>
      </header>

      <div className="pm-quillfox-grid">
        <section className="pm-quillfox-offer" aria-labelledby="offer-title">
          <div className="pm-quillfox-offer-body">
            <p className="pm-quillfox-kicker">01 · The advertised offer</p>
            <h2 id="offer-title">A little time to try.<br />One simple monthly price.</h2>
            <span className="pm-quillfox-trial">{quillfoxOffer.trialDays} days free</span>
            <p className="pm-quillfox-price"><span>${quillfoxOffer.monthlyPrice}</span><span>USD / month<br />after your trial</span></p>
            <dl className="pm-quillfox-terms">
              <div><dt>Free trial</dt><dd>{quillfoxOffer.trialDays} days</dd></div>
              <div><dt>Billing frequency</dt><dd>Monthly</dd></div>
              <div><dt>Currency</dt><dd>{quillfoxOffer.currency}</dd></div>
            </dl>
            <div className="pm-quillfox-source">
              <p>Published promise</p>
              <blockquote data-testid="quillfox-offer-quote">{quillfoxOffer.quote}</blockquote>
            </div>
          </div>
          <div className="pm-quillfox-offer-footer">
            <p>Fictional merchant · No checkout or charges</p>
          </div>
        </section>

        <section id="audit" className="pm-merchant-audit pm-quillfox-audit" aria-labelledby="audit-title" data-testid="audit-section">
          <div className="pm-quillfox-audit-heading">
            <p className="pm-quillfox-kicker">02 · Check the billing</p>
            <span className="pm-quillfox-readonly">Read-only</span>
          </div>
          <h2 id="audit-title">Does the plan match the promise?</h2>
          <p className="pm-merchant-lead">Choose the PayPal sandbox plan for Quillfox Pro. Compare its billing settings with the offer alongside it.</p>
          <AuditForm aiEnabled={Boolean(process.env.OPENAI_API_KEY?.trim())} />
          <p className="pm-caption"><Link href="/studio">Explore sample audits in AG Studio</Link></p>
          <p className="pm-quillfox-audit-note">Your audit reads the plan’s settings. It never changes prices or charges a customer.</p>
        </section>
      </div>
    </main>
  );
}
