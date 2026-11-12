import type { StudioFinding, StudioRun } from "../../lib/studio/types";
import { safeEvidenceUrl } from "../../lib/studio/types";
import type { WebsiteEvidence } from "../../lib/audit/types";

function WebsiteReference({ evidence }: { evidence: WebsiteEvidence }) {
  const url = safeEvidenceUrl(evidence.url);
  const canonical = url ? new URL(url) : undefined;
  const href = canonical?.origin === "https://planmirror.local"
    && ["/quillfox", "/quillfox/faq"].includes(canonical.pathname)
    ? canonical.pathname + canonical.hash : url;
  return <><blockquote>{evidence.quote}</blockquote><p>Source: {href ? <a href={href}>{evidence.url}</a> : <span>{evidence.url} (link unavailable)</span>}</p></>;
}

export default function Evidence({
  record,
  panel = false,
  source = "fixture",
  includeTechnicalIds = false,
}: {
  record: StudioFinding;
  panel?: boolean;
  source?: StudioRun["source"];
  includeTechnicalIds?: boolean;
}) {
  const { finding } = record;
  const Heading = panel ? "h3" : "h4";
  const planLabel = source === "live" ? "PayPal plan ID" : "Illustrative plan ID";
  const retrievedLabel = source === "live" ? "PayPal retrieval time (UTC)" : "PayPal retrieval time (fixture, UTC)";
  return <>
    <p><strong>{finding.offerLabel}</strong> · {finding.field.replaceAll("_", " ")} · <span className={`studio-status studio-${finding.status}`}>{finding.status === "needs_review" ? "Needs review" : finding.status === "match" ? "Match" : "Mismatch"}</span></p>
    <p>{finding.summary}</p>
    {record.priority && <p>Priority: {record.priority.level}. {record.priority.reason}</p>}
    {finding.recommendation && <p>Recommendation: {finding.recommendation}</p>}
    {includeTechnicalIds && <p className="studio-meta">Finding ID: {record.id} · Claim ID: {record.claimId}</p>}
    {record.paymentTimeline && <section>
      <Heading>First-payment timeline</Heading>
      <p>Timing is relative to plan start. Amounts describe the recorded terms.</p>
      <div className="studio-evidence-columns">
        {(["advertised", "configured"] as const).map(side => <div key={side}>
          <p><strong>{side === "advertised" ? "Website offer" : "PayPal schedule"}</strong></p>
          <ol>{record.paymentTimeline?.[side].map((step, index) => <li key={index}>
            <strong>{step.label}</strong> · {step.detail}
            {step.fields && <p className="studio-meta">{step.fields.join(" · ")}</p>}
          </li>)}</ol>
        </div>)}
      </div>
    </section>}
    <div className="studio-evidence-columns">
      <section><Heading>Advertised evidence</Heading><p className="studio-evidence-value">{record.advertisedDisplay ?? "Advertised value unavailable"}</p>
        {finding.website ? <WebsiteReference evidence={finding.website} /> : <p>Website evidence unavailable.</p>}
        {record.additionalWebsiteEvidence?.map((ref, index) => <div key={`${ref.url}-${index}`}><p>Additional website reference</p><WebsiteReference evidence={ref} /></div>)}
      </section>
      <section><Heading>Configured evidence</Heading><p className="studio-evidence-value">{record.configuredDisplay ?? "Configured value unavailable"}</p>
        {finding.paypal ? <dl>
          <dt>{planLabel}</dt><dd>{finding.paypal.planId}</dd>
          <dt>PayPal field</dt><dd>{finding.paypal.fieldPath}</dd>
          <dt>{retrievedLabel}</dt><dd><time dateTime={finding.paypal.retrievedAt}>{finding.paypal.retrievedAt}</time></dd>
        </dl> : <p>PayPal evidence unavailable.</p>}
      </section>
    </div>
  </>;
}
