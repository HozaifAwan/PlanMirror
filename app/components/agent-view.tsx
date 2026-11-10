"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { pageMarkdown } from "../../lib/frontend/page-markdown";
import CheckBot from "./check-bot";

export default function AgentView({ children, footer, aiEnabled = false }: { children: ReactNode; footer: ReactNode; aiEnabled?: boolean }) {
  const source = useRef<HTMLDivElement>(null);
  const footerSource = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<{ path: string; markdown: string } | null>(null);
  const enabled = snapshot?.path === pathname;
  if (snapshot && snapshot.path !== pathname) setSnapshot(null);

  const getPageContext = useCallback(() => ({
    pathname,
    markdown: [source.current ? pageMarkdown(source.current, { hiddenViewRoot: true }) : "", footerSource.current ? pageMarkdown(footerSource.current) : ""].filter(Boolean).join("\n\n"),
  }), [pathname]);

  function toggle() {
    if (enabled) setSnapshot(null);
    else if (source.current) setSnapshot({ path: pathname, markdown: [pageMarkdown(source.current), footerSource.current ? pageMarkdown(footerSource.current) : ""].filter(Boolean).join("\n\n") });
  }

  return (
    <>
      <div id="agent-readable-content" data-view={enabled ? "markdown" : "website"}>
        <div ref={source} hidden={enabled}>{children}</div>
        {enabled && (
          <main id="agent-markdown" className="pm-markdown-view" aria-label="Page content as Markdown" data-testid="agent-markdown">
            <h1 className="pm-markdown-title">Markdown view</h1>
            <p className="pm-markdown-note">Read-only snapshot of complete supplied page data. Sensitive information and filled control values are withheld. Use the robot button to return to the website.</p>
            <pre tabIndex={0} aria-label="Markdown page content"><code>{snapshot.markdown}</code></pre>
          </main>
        )}
      </div>
      <footer className="pm-footer">
      <div className="pm-container pm-footer-inner" ref={footerSource}>
      <div className="pm-footer-copy">{footer}</div>
      <button data-markdown-exclude type="button" className="pm-agent-toggle" onClick={toggle} aria-label={enabled ? "Return to website view" : "Markdown view"} aria-pressed={enabled} aria-controls="agent-readable-content" title={enabled ? "Return to website" : "Markdown view"} data-testid="agent-view-toggle">
        <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v3m-6 0h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM1 11v4m22-4v4M9 16h6" />
          <circle cx="8.5" cy="11" r=".8" /><circle cx="15.5" cy="11" r=".8" />
        </svg>
        <span className="pm-agent-toggle-label" aria-hidden="true">{enabled ? "Website" : "Markdown view"}</span>
      </button>
      </div>
      </footer>
      <CheckBot getPageContext={getPageContext} aiEnabled={aiEnabled} />
      <span className="sr-only" role="status">{enabled ? "Markdown view enabled." : "Website view enabled."}</span>
    </>
  );
}
