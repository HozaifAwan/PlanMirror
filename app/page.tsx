export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-slate-950 px-6 py-16 text-slate-50">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-semibold tracking-widest text-teal-300 uppercase">
          PayPal AI Hackathon 2026
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
          PlanMirror
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-slate-300">
          Compare the subscription terms your website advertises with the
          billing plans configured in PayPal.
        </p>
        <p className="mt-8 border-l-2 border-teal-400 pl-4 text-sm text-slate-300">
          Foundation preview. Auditing and the findings dashboard are in development.
        </p>
      </section>
    </main>
  );
}
