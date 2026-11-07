import type { StudioFinding } from "../../lib/studio/types";
import { safeEvidenceUrl } from "../../lib/studio/types";
import type { WebsiteEvidence } from "../../lib/audit/types";

function WebsiteReference({ evidence }: { evidence: WebsiteEvidence }) {
  const href = safeEvidenceUrl(evidence.url);
  return <><blockquote>{evidence.quote}</blockquote><p>Source: {href ? <a href={href}>{evidence.url}</a> : <span>{evidence.url} (link unavailable)</span>}</p></>;
}

export default function Evidence({ record, panel = false }: { record: StudioFinding; panel?: boolean }) {
  const { finding } = record;
  const Heading = panel ? "h3" : "h4";
  return <>
    <p><strong>{finding.offerLabel}</strong> · {finding.field.replaceAll("_", " ")} · <span className={`studio-status studio-${finding.status}`}>{finding.status === "needs_review" ? "Needs review" : finding.status === "match" ? "Match" : "Mismatch"}</span></p>
    <p>{finding.summary}</p>
    {finding.recommendation && <p>Recommendation: {finding.recommendation}</p>}
    <p className="studio-meta">Finding ID: {record.id} · Claim ID: {record.claimId}</p>
    <div className="studio-evidence-columns">
      <section><Heading>Advertised evidence</Heading><p className="studio-evidence-value">{record.advertisedDisplay ?? "Advertised value unavailable"}</p>
        {finding.website ? <WebsiteReference evidence={finding.website} /> : <p>Website evidence unavailable.</p>}
        {record.additionalWebsiteEvidence?.map((ref, index) => <div key={`${ref.url}-${index}`}><p>Additional website reference</p><WebsiteReference evidence={ref} /></div>)}
      </section>
      <section><Heading>Configured evidence</Heading><p className="studio-evidence-value">{record.configuredDisplay ?? "Configured value unavailable"}</p>
        {finding.paypal ? <dl><dt>Illustrative plan ID</dt><dd>{finding.paypal.planId}</dd><dt>Normalized PayPal field path</dt><dd>{finding.paypal.fieldPath}</dd><dt>PayPal retrieval time (fixture, UTC)</dt><dd><time dateTime={finding.paypal.retrievedAt}>{finding.paypal.retrievedAt}</time></dd></dl> : <p>PayPal evidence unavailable.</p>}
      </section>
    </div>
  </>;
}
