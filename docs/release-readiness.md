# PlanMirror release handoff

Updated November 11, 2026. Freeze feature scope and ship the Quillfox sandbox walkthrough.

## Verification

The current checkout passed `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:routes` on November 11. Route checks use mocked provider transport. This release review did not repeat live provider calls or browser QA. The README records earlier live verification separately.

## Remaining release gates

- [ ] Team confirms ownership and selects an open-source license; add its LICENSE file. Do not apply the project's license to third-party dependencies.
- [ ] Owner approves and verifies public repository visibility. Check tracked files and history for credentials before publication.
- [ ] Select the judge access path: hosted demo recommended, or complete reproducible setup with a documented way to obtain sandbox access. Never publish provider credentials.
- [ ] For hosting, use one long-running Node instance. Configure server credentials from `.env.example`, the sandbox plan ID, public origin, and Studio license before building. Audit links and budgets are process-local; restarts clear runs. Multiple instances cannot reliably share run links.
- [ ] In a fresh browser, run Quillfox with AI extraction against the dedicated sandbox plan. Confirm the 30-day versus 7-day mismatch, monthly price match, exact quote, plan ID, retrieval time, and Studio handoff.
- [ ] Re-audit the corrected offer against the same sandbox plan; confirm two matches. Test pricing plus FAQ separately and inspect both sources.
- [ ] Verify filtering, Inspect, full evidence export, accessible records, Markdown view and keyboard navigation. Ask Auditor to explain a recorded finding and inspect its cited evidence. Only show dashboard-edit claims after observing the actual chart change.
- [ ] Check provider-unavailable recovery and visibly labeled fixtures. Verify Studio licensing in the deployed browser; test harness trial warnings do not establish license validity.
- [ ] Record and upload a public YouTube demo under three minutes, then verify the link while signed out.
- [ ] Finalize the project description and AI-tools disclosure below, add the repository/demo/video links to Devpost, and submit before the deadline. Verify submission confirmation.

The [official rules](https://paypalaihackathon.devpost.com/rules), checked November 11, specify November 12 at noon PST (2 PM CST), a public repository with an open-source license, functional demo access, and a public YouTube demonstration under three minutes. Hosting is optional when complete run instructions provide working access. Keep judge access available through the judging period, which ends December 15. Confirm the current form fields before submitting.

## Submission description draft

**PlanMirror — catch subscription billing discrepancies before customers do.**

Merchants maintain marketing copy and payment settings in different places. PlanMirror compares advertised subscription promises with a real PayPal sandbox billing plan and preserves the evidence behind each finding.

OpenAI extracts candidate terms from pricing copy; validated structured output feeds a deterministic comparator using exact decimal arithmetic. AG Studio presents matches, discrepancies, and cases requiring review. Website quotes, source links, plan fields, and retrieval times remain inspectable and exportable. The custom Auditor agent helps investigate the recorded run using restricted evidence and dashboard tools.

Our fictional Quillfox demo advertises a 30-day free trial while its sandbox plan provides seven days. PlanMirror identifies the discrepancy, then re-audits a corrected seven-day offer against the same plan. A separate pricing-and-FAQ audit exposes conflicting website promises.

The prototype reads sandbox billing data and does not change prices or charge customers. Unsupported terms require review. Current limitations include process-local run storage and usage budgets, single-merchant demo configuration, and incomplete hosted verification of optional webhooks and subscription counts.

## Recording script (2 minutes 30 seconds)

| Time | Screen and narration |
| --- | --- |
| 0:00–0:20 | Show Quillfox's 30-day promise. Explain that website copy can drift from payment settings. |
| 0:20–0:55 | Select the dedicated sandbox plan, enable AI extraction, and run the audit. Explain AI extraction followed by deterministic comparison. |
| 0:55–1:30 | Open Studio. Inspect the trial discrepancy, exact quote, seven-day configuration, plan ID, and retrieval time. Show the matching monthly price. |
| 1:30–1:55 | Ask Auditor to explain the selected finding; show the evidence action. Filter discrepancies and download the complete evidence. |
| 1:55–2:20 | Re-audit the corrected offer against the same live plan. Show the two matches. |
| 2:20–2:30 | Close with read-only sandbox scope and the benefit: finding inconsistent billing promises before customers encounter them. |

Use successful actual runs. Hide credential configuration and private account data while recording. Keep source labels visible.

## AI-tools disclosure draft — team review required

The application uses OpenAI for structured billing-term extraction, the grounded Studio Auditor, and a page guide. Financial verdicts come from validated inputs and deterministic comparison code rather than model-generated arithmetic. Exact source quotes are checked, unsupported evidence requires review, and the Auditor's tools restrict its actions. Provider keys remain server-side.

AI coding assistance was used during development, including Codex for this release review and documentation. The team must complete the list of other development tools/models actually used and confirm human review details. Automated suites and earlier live sandbox checks are documented in the repository; this draft does not claim that every model output has been manually verified.
