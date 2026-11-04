import { offer } from "../../lib/audit/quillfox";

export default function Quillfox() {
  return (
    <main className="min-h-screen bg-amber-50 px-8 py-24 text-slate-900">
      <article className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-800">Quillfox · Fictional demo merchant</p>
        <h1 className="mt-5 text-5xl font-bold">{offer.name}</h1>
        <p className="mt-6 text-2xl">{offer.quote}</p>
        <p className="mt-8 text-slate-600">Subscription offer used in the PlanMirror audit demo.</p>
      </article>
    </main>
  );
}
