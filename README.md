# PlanMirror

PlanMirror compares a merchant’s advertised subscription terms with its PayPal sandbox billing plan.

## Start developing

Use Node.js 20.9 or later. Run `npm ci` and `npm run dev`, then open [localhost:3000](http://localhost:3000). For integrations, copy `.env.example` to `.env.local` and keep credentials there. Use sandbox credentials and read-only billing requests.

Branch from `main` for your work and target `main` with your pull request. Run `npm run lint`, `npm run typecheck`, and `npm run build` before opening it.

## Team roles

| Teammate | Role | Start here | Coordinate with |
| --- | --- | --- | --- |
| Hozaif | Project Lead & System Architect | Shared contracts in `lib/audit/types.ts` and `lib/paypal/types.ts`, integration, and PRs | Everyone on contract changes |
| Ayaan | PayPal API & Backend | `lib/paypal/types.ts`, then add the sandbox client under `lib/paypal/` and routes under `app/api/paypal/` | Nilanee on normalized plans and Leen on endpoint security |
| Sujeeth | AI/LLM | `lib/audit/types.ts`, then add extraction and evidence validation under `lib/ai/` | Nilanee on claim shapes and Sebastian on evidence for the agent |
| Nilanee | Business Logic & QA | `lib/audit/types.ts`, then add comparisons and tests under `lib/audit/` | Ayaan and Sujeeth on inputs and Sebastian on findings |
| Crystalline | Frontend/UI | `app/page.tsx` and `app/globals.css`, then add the Quillfox pricing page under `app/quillfox/` | Sebastian on dashboard placement and Sujeeth on pricing copy |
| Sebastian | AG Studio & Agent | `lib/audit/types.ts`, then add the dashboard, Mirror widget, and Auditor agent under `app/studio/` | Crystalline on layout, Nilanee on findings, and Sujeeth on source evidence |
| Leen | DevOps, Security & Demo | `.env.example` and `.github/workflows/checks.yml`, then own deployment and demo verification | Ayaan and Sujeeth on credentials and Hozaif on release readiness |

The starter provides a placeholder page, shared TypeScript types, environment placeholders, and CI. Coordinate changes to shared types with the project lead.

[Devpost rules](https://paypalaihackathon.devpost.com/rules) · [AG Grid sponsor guidance](https://paypalaihackathon.devpost.com/details/aggrid)
