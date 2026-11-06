export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} className="pm-container pm-page-state" aria-labelledby="loading-title" data-testid="loading-page" data-state="loading" aria-busy="true">
      <h1 id="loading-title" className="pm-section-title">Loading PlanMirror</h1>
      <p role="status">Loading the page. Please wait.</p>
    </main>
  );
}
