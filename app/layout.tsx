import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AgentView from "./components/agent-view";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanMirror",
  description: "Subscription billing integrity auditor for merchants.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
      <AgentView footer={<>
        <span className="pm-wordmark">PlanMirror<span aria-hidden="true">.</span></span>
        <p>An auditing aid, not a legal-compliance certification.</p>
      </>}>
      <a data-markdown-exclude className="pm-skip-link" href="#main-content">Skip to content</a>
      <header className="pm-header">
        <div className="pm-container pm-header-inner">
          <Link className="pm-wordmark" href="/" aria-label="PlanMirror home">PlanMirror<span aria-hidden="true">.</span></Link>
          <nav aria-label="Main navigation" data-testid="main-navigation" className="pm-nav">
            <Link className="pm-nav-link" href="/#workflow">How it works</Link>
            <Link className="pm-secondary-action" href="/#evidence">Our approach</Link>
          </nav>
        </div>
      </header>
        {children}
      </AgentView>

      </body>
    </html>
  );
}
