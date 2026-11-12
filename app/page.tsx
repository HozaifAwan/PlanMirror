import Link from "next/link";
import ScrollAnimations from "./components/scroll-animations";

const auditSteps = [
  { id: "advertised-offer", title: "Start with the promise.", label: "Advertised offer", detail: "Enter a merchant’s pricing page to identify the subscription terms being audited." },
  { id: "paypal-plan", title: "Look behind the billing.", label: "PayPal billing plan", detail: "Choose a PayPal sandbox plan and run a read-only audit without exposing secrets in the browser." },
  { id: "audit-findings", title: "See where they differ.", label: "Audit findings", detail: "Inspect matches, discrepancies, and terms that need review in AG Studio, with evidence from both sources." },
];

export default function Home() {
  return (
      <main id="main-content" tabIndex={-1} aria-labelledby="hero-title" aria-describedby="workspace-status" data-testid="home-page">
        <ScrollAnimations />
        <section className="pm-container pm-hero" aria-labelledby="hero-title">
          <p className="pm-eyebrow pm-secondary-surface">Subscription billing integrity</p>
          <h1 id="hero-title" className="pm-hero-title">See if your billing<br className="pm-desktop-break" /> matches your promise.</h1>
          <p className="pm-hero-copy">Your pricing page makes a promise. PlanMirror helps you check that your PayPal billing plan keeps it.</p>
          <div className="pm-hero-actions">
            <Link href="/audit" className="pm-primary-action">
              Run an audit
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
                <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <p id="workspace-status" className="pm-caption pm-hero-note" data-testid="workspace-status"></p>
          <figure className="pm-overview-preview" aria-labelledby="preview-title" aria-describedby="preview-note">
            <div className="pm-preview-topline"><span className="pm-eyebrow">The promise meets the plan</span><span className="pm-preview-label">Illustrative sample</span></div>
            <h2 id="preview-title">Small differences.<br />A clearer picture.</h2>
            <div className="pm-preview-comparison">
              <div className="pm-preview-card pm-preview-promise">
                <p className="pm-preview-card-label">Advertised offer</p>
                <p className="pm-preview-number">30{" "}<span>days free</span></p>
                <p>Then USD 19 per month</p>
                <span className="pm-preview-card-note">What your website promises</span>
              </div>
              <span className="pm-preview-connector" aria-hidden="true">↔</span>
              <div className="pm-preview-card pm-preview-plan">
                <p className="pm-preview-card-label">Configured billing</p>
                <p className="pm-preview-number">7{" "}<span>days free</span></p>
                <p>Then USD 24 per month</p>
                <span className="pm-preview-card-note">What the sample plan contains</span>
              </div>
            </div>
            <figcaption id="preview-note"><p><strong>23 fewer trial days. USD 5 more per month.</strong></p><p>Fictional values to explain the workflow. No live audit has run.</p></figcaption>
          </figure>
        </section>
        <section id="workflow" className="pm-workflow" aria-labelledby="workflow-title">
          <div className="pm-container">
            <div className="pm-section-heading">
              <p className="pm-eyebrow">How it works</p>
              <h2 id="workflow-title" className="pm-section-title">One offer. Both sides of the story.</h2>
              <p>Compare a merchant’s advertised promise with the configured PayPal sandbox plan.</p>
            </div>
            <ol className="pm-step-grid" aria-labelledby="workflow-title" data-testid="audit-workflow">
              {auditSteps.map(({ id, title, label, detail }, index) => (
                <li key={id} id={id} className="pm-step-card" aria-labelledby={`${id}-title`} aria-describedby={`${id}-detail`}>
                  <span className="pm-step-number" aria-hidden="true">0{index + 1}</span>
                  <p className="pm-step-label">{label}</p>
                  <h3 id={`${id}-title`}>{title}</h3>
                  <p id={`${id}-detail`} className="pm-step-detail">{detail}</p>
                </li>
              ))}
            </ol>
            <div className="pm-merchant-actions pm-workflow-actions">
              <Link className="pm-primary-action" href="/audit">Search merchants</Link>
              <Link className="pm-secondary-action" href="/studio">Open AG Studio</Link>
            </div>
            <p className="pm-caption pm-workflow-note">Merchant search → Run audit → AG Studio evidence.</p>
          </div>
        </section>
        <section id="evidence" className="pm-container pm-evidence" aria-labelledby="evidence-title">
          <div>
            <p className="pm-eyebrow">Clarity at every step</p>
            <h2 id="evidence-title" className="pm-section-title">A finding should come with the facts.</h2>
          </div>
          <div className="pm-principles">
            <article aria-labelledby="source-evidence-title"><h3 id="source-evidence-title">Keep the evidence close.</h3><p>Findings should connect the original website quote with the PayPal plan, billing field, and retrieval time.</p></article>
            <article aria-labelledby="uncertainty-title"><h3 id="uncertainty-title">Make uncertainty visible.</h3><p>AI interprets the wording. Deterministic comparisons check supported terms. Missing or ambiguous evidence needs review.</p></article>
            <article aria-labelledby="read-only-title"><h3 id="read-only-title">Review before changing.</h3><p>The initial auditor is read-only. You decide how to resolve a discrepancy; PlanMirror does not change billing plans.</p></article>
          </div>
        </section>
      </main>
  );
}
