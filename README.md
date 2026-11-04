# PlanMirror

PlanMirror compares a merchant’s advertised subscription terms with its PayPal sandbox billing plan.

## Start developing

Use Node.js 20.9 or later. Run `npm ci` and `npm run dev`, then open [localhost:3000](http://localhost:3000). For integrations, copy `.env.example` to `.env.local` and keep credentials there. Use sandbox credentials and read-only billing requests.

Branch from `main` for your work and target `main` with your pull request. Run `npm run lint`, `npm run typecheck`, and `npm run build` before opening it.

## Team roles

| Role | Owns |
| --- | --- |
| Project Lead & System Architect | Architecture, shared contracts, branch coordination, and integration |
| PayPal API & Backend | Sandbox OAuth, plan retrieval, and server routes |
| AI/LLM | Evidence extraction, schemas, prompts, and grounded explanations |
| Business Logic & QA | Deterministic comparisons, normalization, and automated tests |
| Frontend/UI | Quillfox pricing page, PlanMirror interface, and responsive styling |
| AG Studio & Agent | Evidence dashboard, Mirror widget, and Auditor agent |
| DevOps, Security & Demo | Deployment, secrets, endpoint security, integration testing, and submission |

The starter provides a placeholder page, shared TypeScript types, environment placeholders, and CI. Coordinate changes to shared types with the project lead.

[Devpost rules](https://paypalaihackathon.devpost.com/rules) · [AG Grid sponsor guidance](https://paypalaihackathon.devpost.com/details/aggrid)
