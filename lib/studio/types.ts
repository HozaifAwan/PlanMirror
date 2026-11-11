import type { AuditFinding, WebsiteEvidence } from "../audit/types";

/** Presentation envelope for fixture samples and live audit runs. */
export interface StudioFinding {
  id: string;
  claimId: string;
  finding: AuditFinding;
  advertisedDisplay?: string;
  configuredDisplay?: string;
  additionalWebsiteEvidence?: WebsiteEvidence[];
  priority?: { level: "high" | "medium" | "review"; reason: string };
}

export interface StudioRun {
  id: string;
  label: string;
  source: "fixture" | "live";
  status: "completed" | "needs_review" | "failed" | "not_started";
  description: string;
  findings: StudioFinding[];
  issues: { code: string; message: string; claimId?: string; stage?: "plan" | "claims" }[];
  retrievedAt?: string;
  planId?: string;
  activeSubscriptions?: number | null;
}

export type StatusFilter = "all" | AuditFinding["status"];
export type FieldFilter = "all" | AuditFinding["field"];
export type LiveRunState = "none" | "loaded" | "expired";

export function visibleFindings(run: StudioRun, status: StatusFilter, field: FieldFilter) {
  return run.findings.filter(({ finding }) => (status === "all" || finding.status === status) && (field === "all" || finding.field === field));
}

export function evidenceReport(run: StudioRun) {
  return {
    schemaVersion: 1,
    source: run.source,
    illustrative: run.source === "fixture",
    scope: "All findings in the selected run; visual filters do not apply.",
    run,
  };
}

export function safeEvidenceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
