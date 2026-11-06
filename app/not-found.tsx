import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-page-state" aria-labelledby="not-found-title" data-testid="not-found-page" data-state="not-found">
      <h1 id="not-found-title" className="pm-section-title">Page not found</h1>
      <p>The requested page does not exist. Return to the PlanMirror overview to continue.</p>
      <Link href="/" className="pm-primary-action">Return to PlanMirror home</Link>
    </main>
  );
}
