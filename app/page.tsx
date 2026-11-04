import Link from "next/link";
import AuditConsole from "./audit-console";
import { auditQuillfox, offer, samplePlan } from "../lib/audit/quillfox";

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-12 text-ink sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-9 border-b border-line pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">PayPal AI Hackathon 2026</p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight sm:text-7xl">PlanMirror</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">Find discrepancies between what a merchant promises and what PayPal is configured to charge.</p>
        </header>
        <section className="mb-7 rounded-2xl border border-line bg-paper p-5 sm:p-7">
          <p className="text-sm font-semibold text-accent">Advertised offer</p>
          <h2 className="mt-2 text-2xl font-semibold">{offer.name}</h2>
          <blockquote className="mt-2 text-muted">“{offer.quote}”</blockquote>
          <Link href="/quillfox" className="mt-3 inline-block text-sm text-accent underline">View Quillfox pricing page</Link>
        </section>
        <AuditConsole initial={{ source: "fixture", rows: auditQuillfox(samplePlan(false)) }} />
      </div>
    </main>
  );
}
