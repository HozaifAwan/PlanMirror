const auditSteps = [
  { title: "Advertised offer", detail: "Show the pricing page and the exact subscription terms it promises." },
  { title: "PayPal billing plan", detail: "Display the trial and renewal terms from the merchant’s sandbox plan." },
  { title: "Audit findings", detail: "Compare both sources and surface discrepancies with evidence." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5 text-lg font-bold tracking-tight">PlanMirror</div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <section className="pm-hero px-2 py-8 text-center sm:py-14">
          <p className="inline-block rounded-full pm-secondary-surface px-4 py-2 text-sm font-semibold text-ink">Subscription audit workspace</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance pm-hero-title">
            See if your billing matches your promise.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Compare the terms on your pricing page with the billing plan configured in PayPal.
          </p>
          <a href="#workflow" className="mt-7 inline-flex pm-primary-action focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Explore the workflow
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>
        {/* Crystalline owns the audit screens. Coordinate the findings slot with Sebastian. */}
        <section className="mt-8 rounded-3xl bg-wash p-6 sm:p-10" aria-labelledby="workflow">
          <h2 id="workflow" className="text-xl font-semibold">Audit workflow</h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {auditSteps.map(({ title, detail }, index) => (
              <li key={title} className="rounded-3xl border border-line bg-white p-6">
                <span aria-hidden="true" className="inline-grid size-9 place-items-center rounded-full bg-wash font-semibold text-accent">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted">Scaffold preview. Audit tools are in development.</p>
        </section>
      </div>
    </main>
  );
}
