"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-page-state" aria-labelledby="error-title" data-testid="error-page" data-state="error">
      <div role="alert">
        <h1 id="error-title" className="pm-section-title">This page could not load</h1>
        <p>Try loading this page again, or use the navigation to return to the overview.</p>
      </div>
      <button type="button" className="pm-primary-action" onClick={reset}>Try loading this page again</button>
    </main>
  );
}
