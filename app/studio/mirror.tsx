import { useId } from "react";
import type { StudioFinding } from "../../lib/studio/types";

/** Compact advertised-vs-configured mirror for the selected finding. */
export default function Mirror({ record, compact = false }: { record: StudioFinding; compact?: boolean }) {
  const titleId = useId();
  const status = record.finding.status === "needs_review" ? "Needs review" : record.finding.status === "match" ? "Match" : "Mismatch";
  return (
    <section className="studio-mirror" aria-labelledby={titleId} data-testid="studio-mirror">
      <div className="studio-section-heading">
        <div>
          <p className="studio-eyebrow">Side by side</p>
          <h3 id={titleId}>Mirror</h3>
        </div>
        <span className={`studio-status studio-${record.finding.status}`}>{status}</span>
      </div>
      <div className="studio-mirror-grid">
        <div className="studio-mirror-pane studio-mirror-advertised">
          <p className="studio-mirror-label">Advertised</p>
          <p className="studio-mirror-value">{record.advertisedDisplay ?? "Advertised value unavailable"}</p>
        </div>
        <span className="studio-mirror-connector" aria-hidden="true">↔</span>
        <div className="studio-mirror-pane studio-mirror-configured">
          <p className="studio-mirror-label">Configured</p>
          {compact && record.configuredDisplay?.includes(" | ")
            ? <ul className="studio-mirror-phases">{record.configuredDisplay.split(" | ").map((phase, index) => <li key={index}>{phase}</li>)}</ul>
            : <p className="studio-mirror-value">{record.configuredDisplay ?? "Configured value unavailable"}</p>}
        </div>
      </div>
    </section>
  );
}
