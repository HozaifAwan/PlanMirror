"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { listSandboxPlans, runPlanAudit, type AuditPlanOption, type RunAuditResult } from "./actions";
import { quillfoxCorrectedOffer } from "../../lib/audit/quillfox";
import Evidence from "../studio/evidence";

type UiState =
  | { kind: "loading_plans" }
  | { kind: "plans_unavailable"; error: string; code: string }
  | { kind: "ready"; plans: AuditPlanOption[]; planId: string; mode: "labeled" | "extract" }
  | { kind: "auditing"; plans: AuditPlanOption[]; planId: string; mode: "labeled" | "extract" }
  | { kind: "success"; plans: AuditPlanOption[]; planId: string; mode: "labeled" | "extract"; result: Extract<RunAuditResult, { ok: true }> }
  | { kind: "failed"; plans: AuditPlanOption[]; planId: string; mode: "labeled" | "extract"; error: string; code: string };

function countByStatus(run: Extract<RunAuditResult, { ok: true }>["run"]) {
  return {
    match: run.findings.filter((item) => item.finding.status === "match").length,
    mismatch: run.findings.filter((item) => item.finding.status === "mismatch").length,
    needs_review: run.findings.filter((item) => item.finding.status === "needs_review").length,
  };
}

export default function AuditForm({ aiEnabled = true }: { aiEnabled?: boolean }) {
  const [state, setState] = useState<UiState>({ kind: "loading_plans" });
  const [pending, startTransition] = useTransition();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recentRuns, setRecentRuns] = useState<Extract<RunAuditResult, { ok: true }>[]>([]);

  useEffect(() => {
    let active = true;
    startTransition(async () => {
      let listed;
      try { listed = await listSandboxPlans(); }
      catch { listed = { ok: false as const, error: "The plan request was interrupted. Retry loading plans.", code: "request_failed" }; }
      if (!active) return;
      if (!listed.ok) {
        setState({ kind: "plans_unavailable", error: listed.error, code: listed.code });
        return;
      }
      if (!listed.plans.length) {
        setState({ kind: "plans_unavailable", error: "No PayPal sandbox plans were returned for this merchant.", code: "no_plans" });
        return;
      }
      setState({
        kind: "ready",
        plans: listed.plans,
        planId: listed.defaultPlanId ?? listed.plans[0].id,
        mode: "labeled",
      });
    });
    return () => { active = false; };
  }, [loadAttempt]);

  function updateReady(patch: Partial<{ planId: string; mode: "labeled" | "extract" }>) {
    setState((current) => {
      if (current.kind !== "ready" && current.kind !== "success" && current.kind !== "failed") return current;
      return { kind: "ready", plans: current.plans, planId: patch.planId ?? current.planId, mode: patch.mode ?? current.mode };
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    audit();
  }

  function audit(override?: "corrected" | "cross_page") {
    if (state.kind !== "ready" && state.kind !== "success" && state.kind !== "failed") return;
    const { plans, planId, mode } = state;
    setState({ kind: "auditing", plans, planId, mode });
    startTransition(async () => {
      let result;
      try { result = await runPlanAudit({ planId, mode: override ?? mode }); }
      catch { result = { ok: false as const, error: "The audit request was interrupted. Try running it again.", code: "request_failed" }; }
      if (!result.ok) {
        setState({ kind: "failed", plans, planId, mode, error: result.error, code: result.code });
        return;
      }
      setRecentRuns(previous => [result, ...previous].slice(0, 3));
      setState({ kind: "success", plans, planId, mode, result });
    });
  }

  if (state.kind === "loading_plans") {
    return <p className="pm-audit-status" role="status" data-testid="audit-status">Loading PayPal sandbox plans…</p>;
  }

  if (state.kind === "plans_unavailable") {
    return (
      <div className="pm-audit-status" data-state="failed" role="alert" data-testid="audit-status">
        <p><strong>Plans unavailable</strong></p>
        <p>{state.error}</p>
        <p>Issue: {state.code}</p>
        <button type="button" className="pm-secondary-action" onClick={() => {
          setState({ kind: "loading_plans" });
          setLoadAttempt(value => value + 1);
        }}>Retry loading plans</button>
      </div>
    );
  }

  const counts = state.kind === "success" ? countByStatus(state.result.run) : undefined;
  const busy = state.kind === "auditing" || pending;
  const selectedPlan = state.plans.find(plan => plan.id === state.planId);

  return (
    <>
      <form className="pm-audit-form" onSubmit={onSubmit} aria-busy={busy} data-testid="audit-form">
        <label>
          PayPal sandbox plan
          <span className="pm-audit-plan-select">
          <span className={`pm-audit-plan-dot${selectedPlan?.status === "ACTIVE" ? " is-active" : ""}`} aria-hidden="true" />
          <select
            name="planId"
            aria-describedby="audit-plan-help audit-plan-status"
            value={state.planId}
            disabled={busy}
            onChange={(event) => updateReady({ planId: event.target.value })}
          >
            {state.plans.map((plan) => {
              const name = plan.name.startsWith("P-") ? "Sandbox plan" : plan.name;
              const active = plan.status === "ACTIVE";
              return <option key={plan.id} value={plan.id} aria-label={`${name}, ${active ? "Active" : `Not active (${plan.status})`}`}>{name}</option>;
            })}
          </select>
          </span>
        </label>
        <span id="audit-plan-status" className="sr-only">Selected plan status: {selectedPlan?.status === "ACTIVE" ? "Active" : `Not active (${selectedPlan?.status ?? "unknown"})`}.</span>
        <p id="audit-plan-help" className="pm-caption pm-audit-plan-help">Choose the plan intended for this offer.</p>
        <label className="pm-audit-toggle">
          <input
            type="checkbox"
            checked={state.mode === "extract"}
            disabled={busy || !aiEnabled}
            onChange={(event) => updateReady({ mode: event.target.checked ? "extract" : "labeled" })}
          />
          <span>Extract Quillfox advertised terms with AI</span>
        </label>
        <p className="pm-caption">
          {!aiEnabled
            ? "AI extraction is unavailable. This audit uses the published Quillfox trial and monthly price claims."
            : state.mode === "labeled"
            ? "Uses the labeled Quillfox trial and monthly price claims."
            : "Sends Quillfox pricing copy through the server-side OpenAI extractor before comparison."}
        </p>
        <button className="pm-primary-action" type="submit" disabled={busy}>
          {busy ? "Running audit…" : "Run Audit"}
        </button>
        <button className="pm-secondary-action" type="button" disabled={busy}
          onClick={() => audit("cross_page")}>Compare pricing and FAQ</button>
      </form>

      <section id="corrected-offer" aria-label="Corrected offer preview">
        <p><strong>Corrected offer preview</strong></p>
        <blockquote>{quillfoxCorrectedOffer.quote}</blockquote>
        <p className="pm-caption">Re-audit the revised copy against the same live PayPal plan.</p>
        <button type="button" className="pm-secondary-action"
          disabled={busy || (state.kind !== "success" && state.kind !== "failed")}
          onClick={() => audit("corrected")}>Re-audit corrected offer</button>
      </section>

      {recentRuns.length > 1 && (
        <section aria-labelledby="recent-audits">
          <h3 id="recent-audits">Recent audits</h3>
          <ul>
            {recentRuns.map(({ run, runId }) => {
              const counts = countByStatus(run);
              return <li key={runId}>
                <Link href={`/studio?run=${runId}`}>{run.label}</Link>
                {" · "}{counts.mismatch} mismatches, {counts.needs_review} to review, {counts.match} matches
              </li>;
            })}
          </ul>
        </section>
      )}

      {state.kind === "auditing" && (
        <p className="pm-audit-status" role="status" data-testid="audit-status">Running audit against the selected sandbox plan…</p>
      )}

      {state.kind === "failed" && (
        <div className="pm-audit-status" data-state="failed" role="alert" data-testid="audit-status">
          <p><strong>Audit failed</strong></p>
          <p>{state.error}</p>
          <p>Issue: {state.code}</p>
        </div>
      )}

      {state.kind === "success" && counts && (
        <div className="pm-audit-status" data-state="success" data-testid="audit-status">
          <p><strong>Audit {state.result.run.status === "completed" ? "completed" : "needs review"}</strong></p>
          <p role="status">Results ready: {counts.mismatch} mismatches, {counts.needs_review} need review, {counts.match} matches.</p>
          <p>{state.result.run.description}</p>
          <div className="pm-audit-counts" aria-label="Finding counts">
            <span data-verdict="mismatch"><strong>{counts.mismatch}</strong><small>Mismatches</small></span>
            <span data-verdict="needs_review"><strong>{counts.needs_review}</strong><small>Need review</small></span>
            <span data-verdict="match"><strong>{counts.match}</strong><small>Matches</small></span>
            <span><strong>{state.result.run.findings.length}</strong><small>Total findings</small></span>
          </div>
          {state.result.run.issues.length > 0 && (
            <ul>
              {state.result.run.issues.map((issue) => (
                <li key={`${issue.code}-${issue.claimId ?? "run"}`}><strong>{issue.code}:</strong> {issue.message}</li>
              ))}
            </ul>
          )}
          <div className="pm-merchant-actions">
            <Link className="pm-primary-action" href={`/studio?run=${state.result.runId}`}>Open in AG Studio</Link>
            <a className="pm-secondary-action" href="#offer-title">Review offer</a>
          </div>
          <section data-markdown-only style={{ display: "none" }}>
            <h2>Complete loaded audit evidence</h2>
            <p>Live sandbox audit · Read-only. Run ID: {state.result.runId}. Plan ID: {state.result.run.planId}. PayPal retrieval time (UTC): {state.result.run.retrievedAt}.</p>
            {state.result.run.findings.map(record => <article key={record.id}>
              <h3>{record.finding.offerLabel} — {record.finding.field.replaceAll("_", " ")}</h3>
              <Evidence record={record} source="live" includeTechnicalIds />
            </article>)}
          </section>
        </div>
      )}
    </>
  );
}
