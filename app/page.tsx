const auditSteps = [
  { id: "advertised-offer", title: "Start with the promise.", label: "Advertised offer", detail: "Bring the exact subscription terms from your pricing page, FAQ, and offer copy." },
  { id: "paypal-plan", title: "Look behind the billing.", label: "PayPal billing plan", detail: "Retrieve the trial, price, and renewal cadence configured in your PayPal sandbox plan." },
  { id: "audit-findings", title: "See where they differ.", label: "Audit findings", detail: "Inspect matches, discrepancies, and terms that need review, with evidence from both sources." },
];

export default function Home() {
  return (
      <main id="main-content" tabIndex={-1} aria-labelledby="hero-title" aria-describedby="workspace-status" data-testid="home-page">
        <section className="pm-container pm-hero" aria-labelledby="hero-title">
          <p className="pm-eyebrow pm-secondary-surface">Subscription billing integrity</p>
          <h1 id="hero-title" className="pm-hero-title">See if your billing<br className="pm-desktop-break" /> matches your promise.</h1>
          <p className="pm-hero-copy">Your pricing page makes a promise. PlanMirror helps you check that your PayPal billing plan keeps it.</p>
          <a href="#workflow" className="pm-primary-action">
            Explore the workflow
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <p id="workspace-status" className="pm-caption pm-hero-note" data-testid="workspace-status" data-state="in-development">In development · Read-only sandbox auditing</p>
        </section>
        {/* Sai owns merchant/audit screens; coordinate the dashboard handoff with Sebastian. */}
        <section id="workflow" className="pm-workflow" aria-labelledby="workflow-title">
          <div className="pm-container">
            <div className="pm-section-heading">
              <p className="pm-eyebrow">How it works</p>
              <h2 id="workflow-title" className="pm-section-title">One offer. Both sides of the story.</h2>
              <p>Follow the promise from your website to your billing configuration.</p>
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
            <p className="pm-caption pm-workflow-note">Workflow preview. Audit tools are still in development.</p>
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
