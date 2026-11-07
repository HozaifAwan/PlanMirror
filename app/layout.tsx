import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AgentView from "./components/agent-view";
import AppShell from "./components/app-shell";
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
        <span className="pm-wordmark"><Image src="/assets/planmirror-wordmark-transparent.png" alt="PlanMirror" width={2170} height={725} className="pm-brand-wordmark" /></span>
        <p>An auditing aid, not a legal-compliance certification.</p>
      </>}>
      <AppShell brand={<Link className="pm-wordmark" href="/" aria-label="PlanMirror home"><Image src="/assets/planmirror-header-transparent.png" alt="PlanMirror" width={2181} height={721} className="pm-header-logo" priority /></Link>}>
        {children}
      </AppShell>
      </AgentView>

      </body>
    </html>
  );
}
