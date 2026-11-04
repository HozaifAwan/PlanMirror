const auditSteps = [
  { title: "Advertised offer", detail: "Show the pricing page and the exact subscription terms it promises." },
  { title: "PayPal billing plan", detail: "Display the trial and renewal terms from the merchant’s sandbox plan." },
  { title: "Audit findings", detail: "Compare both sources and surface discrepancies with evidence." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5 text-lg font-bold tracking-tight">PlanMirror</div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <section className="rounded-3xl border border-line bg-linear-to-br from-white to-wash p-7 sm:p-12">
          <p className="text-sm font-semibold text-accent">Subscription audit workspace</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            See if your billing matches your promise.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Compare the terms on your pricing page with the billing plan configured in PayPal.
          </p>
        </section>
        {/* Crystalline owns the audit screens. Coordinate the findings slot with Sebastian. */}
        <section className="mt-10" aria-labelledby="workflow">
          <h2 id="workflow" className="text-xl font-semibold">Audit workflow</h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {auditSteps.map(({ title, detail }, index) => (
              <li key={title} className="rounded-2xl border border-line bg-white p-6">
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
