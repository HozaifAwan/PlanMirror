"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

export const navigationItems: ReadonlyArray<{ href: string; label: string; match?: "exact" | "prefix" }> = [
  { href: "/", label: "Overview", match: "exact" },
  { href: "/quillfox", label: "Quillfox", match: "prefix" },
  { href: "/studio", label: "AG Studio", match: "exact" },
];

function NavIcon({ href }: { href: string }) {
  if (href === "/") return <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h5v-7h4v7h5V9" /></>;
  if (href === "/quillfox") return <><path d="M4 7h16v12H4z" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /><path d="M9 12h6" /></>;
  return <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 9v12m4-4 2-3 3 2" /></>;
}

export default function AppShell({ brand, children }: { brand: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [navigation, setNavigation] = useState({ path: pathname, open: false });
  const sidebarId = useId();
  if (navigation.path !== pathname) setNavigation({ path: pathname, open: false });
  const open = navigation.path === pathname && navigation.open;
  const expand = () => setNavigation({ path: pathname, open: true });
  const close = () => setNavigation({ path: pathname, open: false });
  const isCurrent = (href: string, match: "exact" | "prefix" = "exact") =>
    match === "prefix" ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  return <>
    <a data-markdown-exclude className="pm-skip-link" href="#main-content">Skip to content</a>
    <header className="pm-header">
      <div className="pm-container pm-header-inner pm-shell-header">{brand}</div>
    </header>
    <section data-markdown-only className="pm-shell-markdown">
      <h2>Application navigation</h2>
      <p>Current route: {pathname}. Sidebar: {open ? "expanded" : "icon rail"}.</p>
      <nav aria-label="All application destinations">{navigationItems.map(item => <p key={item.href}><Link href={item.href}>{item.label}</Link>{isCurrent(item.href, item.match) && " · Current page"}</p>)}</nav>
    </section>
    <div className="pm-app-shell" data-sidebar-open={open} data-testid="app-shell">
      <aside id={sidebarId} className="pm-sidebar" data-expanded={open} data-markdown-exclude data-testid="navigation-sidebar"
        onMouseEnter={expand}
        onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) close(); }}
        onFocus={expand}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); close(); document.getElementById("main-content")?.focus(); }
        }}>
        <nav aria-label="Main navigation" data-testid="main-navigation">
          {navigationItems.map(item => <Link key={item.href} className={`pm-sidebar-link${item.href === "/studio" ? " pm-sidebar-studio" : ""}`} href={item.href} aria-label={item.label} title={item.label} aria-current={isCurrent(item.href, item.match) ? "page" : undefined} onClick={() => {
            close();
            document.getElementById("main-content")?.focus();
          }}>
            <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <NavIcon href={item.href} />
            </svg>
            <span className="pm-sidebar-label">{item.label}</span>
          </Link>)}
        </nav>
      </aside>
      <div className="pm-shell-content">{children}</div>
    </div>
  </>;
}
