import type { AuditFinding, WebsiteEvidence } from "../audit/types";

/** Fixture-only presentation envelope. Live producers require a separately agreed adapter. */
export interface StudioFinding {
  id: string;
  claimId: string;
  finding: AuditFinding;
  advertisedDisplay?: string;
  configuredDisplay?: string;
  additionalWebsiteEvidence?: WebsiteEvidence[];
}

export interface StudioRun {
  id: string;
  label: string;
  source: "fixture";
  status: "completed" | "needs_review" | "failed" | "not_started";
  description: string;
  findings: StudioFinding[];
  issues: { code: string; message: string; claimId?: string }[];
}

export type StatusFilter = "all" | AuditFinding["status"];
export type FieldFilter = "all" | AuditFinding["field"];

export function visibleFindings(run: StudioRun, status: StatusFilter, field: FieldFilter) {
  return run.findings.filter(({ finding }) => (status === "all" || finding.status === status) && (field === "all" || finding.field === field));
}

export function evidenceReport(run: StudioRun) {
  return { schemaVersion: 1, source: "fixture", illustrative: true, scope: "All findings in the selected run; visual filters do not apply.", run };
}

export function safeEvidenceUrl(value: string): string | undefined {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
