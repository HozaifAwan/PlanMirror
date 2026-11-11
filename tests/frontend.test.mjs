import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { pageMarkdown } from '../lib/frontend/page-markdown.ts';

function snapshot(html) {
  const dom = new JSDOM(html);
  const previous = Object.fromEntries(['window', 'Node', 'HTMLElement'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const key of Object.keys(previous)) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
    return pageMarkdown(dom.window.document.body);
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
}

test('semantic alternative preserves every finding when virtualized grid is excluded', () => {
  const markdown = snapshot(`<main><h1>Audit studio</h1><p>Sample data. Showing 2 of 5 findings.</p>
    <div data-markdown-exclude><div>Only one virtualized row</div></div>
    <section data-markdown-only style="display:none"><h2>Filtered findings</h2>
      <table><tr><th>Claim</th><th>Advertised</th><th>Configured</th></tr><tr><td>trial</td><td>30 days</td><td>7 days</td></tr><tr><td>renewal</td><td>USD 19/month</td><td>USD 24/month</td></tr></table>
      <p>Exact quote: Thirty days free.</p><a href="https://example.com/pricing">Pricing source</a><p>Plan P-FIXTURE, billingCycles[0], 2026-11-05T12:00:00Z</p>
    </section></main>`);
  for (const text of ['# Audit studio', 'Showing 2 of 5', '30 days', '7 days', 'USD 19/month', 'USD 24/month', 'Thirty days free.', 'https://example.com/pricing', 'P-FIXTURE', '2026-11-05T12:00:00Z']) assert.ok(markdown.includes(text), text);
  assert.ok(!markdown.includes('Only one virtualized row'));
  assert.match(markdown, /\| Claim \| Advertised \| Configured \|/);
});

test('ordinary hidden content, excluded controls and form values remain absent', () => {
  const markdown = snapshot(`<main><script>privateScript()</script><p hidden>Hidden record</p><p aria-hidden="true">Decorative</p><p style="display:none">Filtered out</p>
    <input aria-label="Audit token" type="password" value="secret-token"><textarea aria-label="Private question">private-input</textarea>
    <button data-markdown-exclude>Markdown view</button><p>Visible result</p>
    <section data-markdown-only hidden>Still hidden</section></main>`);
  assert.ok(markdown.includes('Visible result'));
  assert.ok(markdown.includes('password control: Audit token'));
  for (const text of ['privateScript', 'Hidden record', 'Decorative', 'Filtered out', 'secret-token', 'private-input', 'Markdown view', 'Still hidden']) assert.ok(!markdown.includes(text), text);
});

test('hidden table rows do not reappear in a Markdown snapshot', () => {
  const markdown = snapshot('<table><tr><th>Finding</th></tr><tr><td>Visible finding</td></tr><tr style="display:none"><td>Filtered finding</td></tr><tr aria-hidden="true"><td>Excluded finding</td></tr></table>');
  assert.ok(markdown.includes('Visible finding'));
  assert.ok(!markdown.includes('Filtered finding'));
  assert.ok(!markdown.includes('Excluded finding'));
});

test('list ordering, links and closed detail contents are available without interaction', () => {
  const markdown = snapshot('<ol><li>First finding</li><li><a href="#trial">Trial evidence</a></li></ol><details><summary>Additional evidence</summary><p>Collapsed content</p></details>');
  assert.match(markdown, /1\. First finding/);
  assert.match(markdown, /2\. \[Trial evidence\]\(<#trial>\)/);
  assert.ok(markdown.includes('Collapsed content'));
  assert.ok(!markdown.includes('[Details collapsed]'));
});

const { studioRuns } = await import('../lib/studio/fixtures.ts');
const { visibleFindings, evidenceReport, safeEvidenceUrl } = await import('../lib/studio/types.ts');

test('combined filters preserve finding identity and never narrow the full-run export', () => {
  const run = studioRuns.find(run => run.findings.length >= 5);
  const allIds = run.findings.map(record => record.id);
  const filtered = visibleFindings(run, 'mismatch', 'trial');
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(record => record.finding.status === 'mismatch' && record.finding.field === 'trial'));
  assert.equal(new Set(allIds).size, allIds.length);
  const report = evidenceReport(run);
  assert.equal(report.source, 'fixture');
  assert.equal(report.illustrative, true);
  assert.deepEqual(report.run.findings.map(record => record.id), allIds);
  assert.deepEqual(visibleFindings(run, 'all', 'all').map(record => record.id), allIds);
  assert.deepEqual(visibleFindings(run, 'match', 'setup_fee'), []);
});

test('review and failed fixtures retain uncertainty without fabricated conclusive evidence', () => {
  const partial = studioRuns.find(run => run.findings.some(record => record.finding.status === 'needs_review' && !record.finding.paypal));
  assert.equal(partial.status, 'needs_review');
  assert.ok(partial.findings.some(record => !record.finding.website));
  assert.ok(partial.issues.length > 0);
  const failed = studioRuns.find(run => run.status === 'failed');
  assert.deepEqual(failed.findings, []);
  assert.ok(failed.issues.length > 0);
  for (const run of studioRuns) {
    assert.equal(run.source, 'fixture');
    for (const record of run.findings) {
      assert.ok(record.id.includes(run.id));
      if (record.finding.status !== 'needs_review') {
        assert.ok(record.finding.website?.quote);
        assert.ok(record.finding.paypal?.fieldPath);
      }
    }
  }
});

test('evidence navigation accepts only HTTP(S) sources', () => {
  assert.equal(safeEvidenceUrl('https://example.com/pricing'), 'https://example.com/pricing');
  for (const input of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/private', '/unverified']) assert.equal(safeEvidenceUrl(input), undefined);
});

// Compile the production JSX with the project's TypeScript dependency, so the
// regression exercises Evidence/StudioShell/AgentView rather than invented HTML.
const { readFileSync, existsSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { resolve, dirname, extname } = await import('node:path');
const ts = (await import('typescript')).default;
const require = createRequire(import.meta.url);
const componentCache = new Map();
let currentPath = "/studio";
let auditActionsMock;
let checkBotActionMock;
function componentModule(path) {
  path = resolve(path);
  if (componentCache.has(path)) return componentCache.get(path).exports;
  const componentEntry = { exports: {} };
  componentCache.set(path, componentEntry);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    const portablePath = path.replaceAll('\\', '/');
    if (name === 'server-only') return {};
    if (portablePath.endsWith('/app/components/check-bot.tsx') && name === './check-bot-actions') return { askCheckBot: (...args) => checkBotActionMock(...args) };
    if (portablePath.endsWith('/app/audit/audit-form.tsx') && name === './actions') return {
      listSandboxPlans: (...args) => auditActionsMock.listSandboxPlans(...args),
      runPlanAudit: (...args) => auditActionsMock.runPlanAudit(...args),
    };
    if (name === 'next/navigation') return { usePathname: () => currentPath };
    if (name === 'next/link') return { __esModule: true, default: ({ children, onClick, ...props }) => React.createElement('a', { ...props, onClick: event => { event.preventDefault(); onClick?.(event); } }, children) };
    if (name === 'next/dynamic') return { __esModule: true, default: () => () => 'Virtual grid placeholder' };
    if (name.startsWith('.')) {
      const target = resolve(dirname(path), name);
      const entry = extname(target) ? target : ['.tsx', '.ts', '.js'].map(extension => target + extension).find(existsSync);
      if (!entry) throw new Error(`Cannot resolve local component ${target}`);
      return componentModule(entry);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, componentEntry, componentEntry.exports);
  return componentEntry.exports;
}
const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const StudioMarkdown = componentModule('app/studio/studio-markdown.tsx').default;
const studioCss = readFileSync(new URL('../app/studio/studio.css', import.meta.url), 'utf8');
// JSDOM does not process Tailwind imports/theme directives; retain all real selectors.
const globalCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/@import[^;]+;/g, '').replace(/@theme\s*\{[^}]*\}/g, '');

function studioSnapshot(run, status = 'all', field = 'all') {
  return snapshot(`<style>${studioCss}</style><main class="studio-page">${renderToStaticMarkup(React.createElement(StudioMarkdown, { run, availableRuns: studioRuns, status, field, view: "accessible", selectedId: run.findings[0]?.id }))}</main>`);
}
const plain = value => value.replace(/([\\`*_[\]<>])/g, '\\$1');

test('production Studio semantic evidence with real CSS includes the complete run under restrictive and empty filters', () => {
  for (const run of studioRuns) {
    for (const [status, field] of [['all', 'all'], ['mismatch', 'trial'], ['match', 'setup_fee']]) {
      const markdown = studioSnapshot(run, status, field);
      for (const value of [run.id, run.label, run.status, run.description, ...run.issues.map(issue => issue.message)]) assert.ok(markdown.includes(plain(value)), value);
      assert.ok(markdown.includes(`Markdown includes all ${run.findings.length} findings`));
      for (const record of run.findings) {
        for (const value of [record.id, record.claimId, record.finding.offerLabel, record.finding.summary, record.advertisedDisplay, record.configuredDisplay, record.finding.recommendation, record.finding.website?.quote, record.finding.paypal?.planId, record.finding.paypal?.fieldPath, record.finding.paypal?.retrievedAt].filter(Boolean)) assert.ok(markdown.includes(plain(value)), value);
        for (const reference of [record.finding.website, ...(record.additionalWebsiteEvidence ?? [])].filter(Boolean)) {
          assert.ok(markdown.includes(plain(reference.quote)), reference.quote);
          assert.ok(markdown.includes(reference.url), reference.url);
        }
        if (!record.finding.website) assert.ok(markdown.includes('Website evidence unavailable.'));
        if (!record.finding.paypal) assert.ok(markdown.includes('PayPal evidence unavailable.'));
      }
    }
  }
});

test('semantic opt-in cannot bypass inherited visibility or hidden descendants', () => {
  const markdown = snapshot('<main><section style="visibility:hidden" data-markdown-only><p>Invisible semantic secret</p></section><section data-markdown-only style="display:none"><p>Public evidence</p><p hidden>Hidden semantic secret</p><p style="display:none">Hidden CSS secret</p><input value="secret-token" aria-label="Token"></section></main>');
  assert.ok(markdown.includes('Public evidence'));
  for (const value of ['Invisible semantic secret', 'Hidden semantic secret', 'Hidden CSS secret', 'secret-token']) assert.ok(!markdown.includes(value), value);
});

test('serializer accepts HTML belonging to another window and omits SVG contents', () => {
  const foreign = new JSDOM('<main><p>Cross-window evidence</p><svg><text>Decorative SVG</text></svg></main>');
  try {
    const markdown = pageMarkdown(foreign.window.document.body);
    assert.ok(markdown.includes('Cross-window evidence'));
    assert.ok(!markdown.includes('Decorative SVG'));
  } finally { foreign.window.close(); }
});

test('actual footer toggle captures production Studio evidence and returns to the website', async () => {
  const dom = new JSDOM(`<html><head><style>${globalCss}\n${studioCss}</style></head><body><div id="root"></div></body></html>`, { url: 'http://localhost/studio' });
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root;
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] });
    const { createRoot } = await import('react-dom/client');
    const AgentView = componentModule('app/components/agent-view.tsx').default;
    const StudioShell = componentModule('app/studio/studio-shell.tsx').default;
    const AppShell = componentModule('app/components/app-shell.tsx').default;
    root = createRoot(dom.window.document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(AgentView, { footer: 'PlanMirror footer' }, React.createElement(AppShell, { brand: React.createElement('a', { href: '/' }, 'PlanMirror') }, React.createElement(StudioShell)))));
    const button = dom.window.document.querySelector('[data-testid="agent-view-toggle"]');
    assert.ok(button.closest('footer'));
    assert.equal(dom.window.document.querySelector('[data-testid="navigation-sidebar"]').dataset.expanded, "false");
    await React.act(async () => button.click());
    const markdown = dom.window.document.querySelector('#agent-markdown code').textContent;
    for (const record of studioRuns.flatMap(run => run.findings)) {
      assert.ok(markdown.includes(plain(record.id)), record.id);
      assert.ok(markdown.includes(plain(record.finding.summary)), record.finding.summary);
    }
    assert.ok(markdown.includes('PlanMirror footer'));
    for (const href of ['/', '/studio']) assert.ok(markdown.includes(`](<${href}>)`), href);
    assert.ok(markdown.includes('Current route: /studio. Sidebar: icon rail.'));
    assert.ok(markdown.includes(`Selected run ID: ${studioRuns[0].id}`));
    assert.ok(markdown.includes(`Selected finding ID: ${plain(studioRuns[0].findings[0].id)}`));
    assert.ok(markdown.includes('Current records view: grid'));
    for (const run of studioRuns) {
      assert.ok(markdown.includes(run.id));
      for (const issue of run.issues) assert.ok(markdown.includes(plain(issue.message)));
    }
    assert.ok(!markdown.includes('Virtual grid placeholder'));
    assert.ok(markdown.includes('[Button: Audit workspace; pressed: true]'));
    assert.ok(markdown.includes('Audit scenario'));
    assert.ok(markdown.indexOf('All finding evidence') < markdown.indexOf('[Button: All findings'));
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    await React.act(async () => button.click());
    assert.equal(dom.window.document.querySelector('#agent-markdown'), null);
    assert.equal(dom.window.document.querySelector('[data-testid="studio-page"]').closest('[hidden]'), null);
    const mismatchButton = Array.from(dom.window.document.querySelectorAll('.studio-counts button')).find(node => node.textContent.includes('Mismatches'));
    await React.act(async () => mismatchButton.click());
    await React.act(async () => button.click());
    const filteredMarkdown = dom.window.document.querySelector('#agent-markdown code').textContent;
    assert.ok(filteredMarkdown.includes('Website filter scope: 2 of 5 findings'));
    assert.ok(filteredMarkdown.includes('Included in current website filters: No.'));
    for (const record of studioRuns[0].findings) assert.ok(filteredMarkdown.includes(plain(record.finding.summary)));
    await React.act(async () => button.click());
    assert.equal(mismatchButton.getAttribute('aria-pressed'), 'true');
  } finally {
    if (root) await React.act(async () => root.unmount());
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});


test('flagged sensitive content and nested pre/table secrets are withheld without interaction', () => {
  const markdown = snapshot(`<main><details><summary>Closed disclosure</summary><p>Available detail</p><p data-agent-sensitive data-agent-label="Account credential">secret-disclosure</p></details>
    <pre>public code<span hidden>secret-hidden-pre</span><span data-agent-sensitive aria-label="Private token">secret-pre</span><input aria-label="Token input" value="secret-input"><script>secret-script</script></pre>
    <table><thead><tr><th>Evidence</th></tr></thead><tbody hidden><tr><td>secret-hidden-table</td></tr></tbody><tbody data-agent-sensitive data-agent-label="Private account rows"><tr><td>secret-table-group</td></tr></tbody><tbody><tr><td>Public row <span data-agent-sensitive>secret-table-cell</span></td></tr><tr data-agent-sensitive><td>secret-table-row</td></tr></tbody></table>
    <section data-agent-sensitive data-agent-label="License"><pre>secret-license</pre></section></main>`);
  for (const value of ['Available detail', 'public code', 'Public row', 'Sensitive information withheld: Account credential', 'Sensitive information withheld: Private token', 'Sensitive information withheld: Private account rows', 'Sensitive information withheld: sensitive content', 'Sensitive information withheld: License']) assert.ok(markdown.includes(value), value);
  assert.ok(!markdown.includes('secret-'));
});


test('ordinary controls describe public options and button states without filled values', () => {
  const markdown = snapshot('<main><button aria-pressed="true" aria-expanded="false" aria-selected="true">Audit controls</button><select aria-label="Scenario"><option value="private-value">Public sample</option><optgroup hidden><option>Hidden sample</option></optgroup><optgroup data-agent-sensitive><option>Private sample</option></optgroup></select></main>');
  for (const value of ['pressed: true', 'expanded: false', 'selected: true', 'available options: Public sample', 'value omitted', 'Sensitive information withheld: sensitive content']) assert.ok(markdown.includes(value), value);
  for (const value of ['private-value', 'Hidden sample', 'Private sample']) assert.ok(!markdown.includes(value), value);
});


test('captions survive while sensitive and hidden label descendants never become control labels', () => {
  const markdown = snapshot('<main><label>Public label<span data-agent-sensitive>secret-label</span><span hidden>secret-hidden-label</span><input value="secret-control"></label><table><caption>Public evidence caption</caption><tbody><tr><td>Evidence row</td></tr></tbody><tfoot data-markdown-exclude><tr><td>secret-footer</td></tr></tfoot></table></main>');
  assert.ok(markdown.includes('Public evidence caption'));
  assert.ok(markdown.includes('control: Public label'));
  assert.ok(markdown.includes('Sensitive information withheld: sensitive content'));
  assert.ok(!markdown.includes('secret-'));
});

test('icon sidebar expands on hover and focus, collapses on leave and selection, and supports Escape', async () => {
  const dom = new JSDOM(`<html><head><style>${globalCss}</style></head><body><div id="root"></div></body></html>`, { url: 'http://localhost/studio' });
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root;
  currentPath = '/studio';
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] });
    const { createRoot } = await import('react-dom/client');
    const AppShell = componentModule('app/components/app-shell.tsx').default;
    root = createRoot(dom.window.document.getElementById('root'));
    const render = () => root.render(React.createElement(AppShell, { brand: React.createElement('a', { href: '/' }, 'PlanMirror') }, React.createElement('main', { id: 'main-content', tabIndex: -1 }, React.createElement('h1', null, 'Studio'))));
    await React.act(async () => render());
    const sidebar = dom.window.document.querySelector('[data-testid="navigation-sidebar"]');
    const shell = dom.window.document.querySelector('[data-testid="app-shell"]');
    const links = sidebar.querySelectorAll('a');
    assert.equal(dom.window.document.querySelector('[data-testid="navigation-toggle"]'), null);
    assert.equal(sidebar.hidden, false);
    assert.equal(sidebar.dataset.expanded, 'false');
    assert.deepEqual(Array.from(links, link => link.getAttribute('aria-label')), ['Overview', 'Quillfox', 'AG Studio']);
    assert.equal(dom.window.getComputedStyle(shell).gridTemplateColumns, '3rem minmax(0, 1fr)');
    const studioLink = Array.from(links).find(link => link.getAttribute('aria-label') === 'AG Studio');
    assert.equal(studioLink.getAttribute('aria-current'), 'page');
    await React.act(async () => sidebar.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })));
    assert.equal(sidebar.dataset.expanded, 'true');
    await React.act(async () => sidebar.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true, relatedTarget: dom.window.document.body })));
    assert.equal(sidebar.dataset.expanded, 'false');
    await React.act(async () => links[0].focus());
    assert.equal(sidebar.dataset.expanded, 'true');
    await React.act(async () => studioLink.focus());
    assert.equal(sidebar.dataset.expanded, 'true');
    await React.act(async () => studioLink.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(sidebar.dataset.expanded, 'false');
    assert.equal(dom.window.document.activeElement.id, 'main-content');
    await React.act(async () => studioLink.focus());
    await React.act(async () => studioLink.click());
    assert.equal(sidebar.dataset.expanded, 'false');
    assert.equal(dom.window.document.activeElement.id, 'main-content');
    await React.act(async () => links[0].focus());
    await React.act(async () => dom.window.document.getElementById('main-content').focus());
    assert.equal(sidebar.dataset.expanded, 'false');
    await React.act(async () => sidebar.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })));
    currentPath = '/';
    await React.act(async () => render());
    assert.equal(sidebar.dataset.expanded, 'false');
    assert.equal(links[0].getAttribute('aria-current'), 'page');
    // Mobile reflow needs browser QA; JSDOM has no responsive layout engine.
  } finally {
    if (root) await React.act(async () => root.unmount());
    currentPath = '/studio';
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});


test('Overview sample comparison remains complete in the agent snapshot without animation or interaction', () => {
  const Home = componentModule('app/page.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Home));
  const markdown = snapshot(`<style>${globalCss}</style>${html}`);
  for (const value of ['Advertised offer', 'Configured billing', '30 days free', '7 days free', 'USD 19 per month', 'USD 24 per month', '23 fewer trial days', 'USD 5 more per month', 'Illustrative sample', 'No live audit has run.']) assert.ok(markdown.includes(value), value);
  assert.ok(!markdown.includes('↔'));
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('h1').length, 1);
  const ids = Array.from(dom.window.document.querySelectorAll('[id]'), node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const link of dom.window.document.querySelectorAll('a[href^="#"]')) assert.ok(dom.window.document.getElementById(link.getAttribute('href').slice(1)));
  dom.window.close();
});

test('scroll motion starts at rest, follows position in both directions and respects reduced motion', async () => {
  const dom = new JSDOM('<div id="root"></div><section class="pm-hero"><figure class="pm-overview-preview"></figure></section>');
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root;
  let pending;
  let preferenceChanged;
  const preference = { matches: false, addEventListener: (_, callback) => { preferenceChanged = callback; }, removeEventListener: () => {} };
  dom.window.matchMedia = () => preference;
  dom.window.requestAnimationFrame = callback => { pending = callback; return 1; };
  dom.window.cancelAnimationFrame = () => { pending = undefined; };
  Object.defineProperty(dom.window, 'innerHeight', { value: 1000 });
  const hero = dom.window.document.querySelector('.pm-hero');
  const preview = dom.window.document.querySelector('.pm-overview-preview');
  preview.getBoundingClientRect = () => ({ top: 1200 - dom.window.scrollY });
  const remaining = element => Number(element.style.getPropertyValue('--pm-scroll-remaining'));
  const scrollTo = position => {
    dom.window.scrollY = position;
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
    const callback = pending;
    pending = undefined;
    callback();
  };
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] });
    const { createRoot } = await import('react-dom/client');
    root = createRoot(dom.window.document.getElementById('root'));
    const ScrollAnimations = componentModule('app/components/scroll-animations.tsx').default;
    await React.act(async () => root.render(React.createElement(ScrollAnimations)));
    assert.equal(remaining(hero), 1);
    assert.equal(remaining(preview), 1);
    scrollTo(120);
    assert.equal(remaining(hero), 0.5);
    scrollTo(600);
    assert.equal(remaining(preview), 0.5);
    scrollTo(850);
    assert.equal(remaining(preview), 0);
    scrollTo(0);
    assert.equal(remaining(hero), 1);
    assert.equal(remaining(preview), 1);
    preference.matches = true;
    preferenceChanged();
    pending();
    assert.equal(remaining(hero), 0);
    assert.equal(remaining(preview), 0);
    await React.act(async () => root.unmount());
    root = undefined;
    assert.equal(hero.style.getPropertyValue('--pm-scroll-remaining'), '');
  } finally {
    if (root) await React.act(async () => root.unmount());
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});

test('check bot hydrates without snapshot loops and supports clicking and keyboard movement', async () => {
  const CheckBot = componentModule('app/components/check-bot.tsx').default;
  const getPageContext = () => ({ pathname: '/studio', markdown: '# Current audit' });
  const { renderToString } = await import('react-dom/server');
  const html = renderToString(React.createElement(CheckBot, { getPageContext }));
  assert.ok(html.includes('data-testid="check-bot"'), 'the mascot is present before client JavaScript loads');
  const dom = new JSDOM(`<div id="root">${html}</div>`, { url: 'http://localhost/studio', pretendToBeVisual: true });
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const errors = [];
  const oldError = console.error;
  let root;
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] });
    dom.window.sessionStorage.setItem('planmirror-check-bot-pos', '{"x":120,"y":200}');
    console.error = (...args) => errors.push(args.map(String).join(' '));
    const { hydrateRoot } = await import('react-dom/client');
    await React.act(async () => { root = hydrateRoot(dom.window.document.getElementById('root'), React.createElement(CheckBot, { getPageContext })); });
    const bot = dom.window.document.querySelector('[data-testid="check-bot"]');
    assert.equal(bot.style.transform, 'translate3d(120px, 200px, 0)');
    const button = bot.querySelector('.pm-check-bot-fab');
    await React.act(async () => button.click());
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.match(bot.textContent, /Scripted preview/);
    await React.act(async () => button.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    assert.equal(bot.style.transform, 'translate3d(136px, 200px, 0)');
    assert.deepEqual(JSON.parse(dom.window.sessionStorage.getItem('planmirror-check-bot-pos')), { x: 136, y: 200 });
    await React.act(async () => button.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    await React.act(async () => {
      dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 210, clientY: 224 }));
      await new Promise(resolve => dom.window.requestAnimationFrame(resolve));
    });
    assert.ok(parseFloat(bot.style.getPropertyValue('--bot-gaze-x')) > 0);
    await React.act(async () => {
      dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 900, clientY: 600 }));
      await new Promise(resolve => dom.window.requestAnimationFrame(resolve));
    });
    assert.equal(bot.style.getPropertyValue('--bot-gaze-x'), '0px');
    button.setPointerCapture = () => {};
    button.releasePointerCapture = () => {};
    const pointer = (type, x, y) => {
      const event = new dom.window.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      button.dispatchEvent(event);
    };
    await React.act(async () => pointer('pointerdown', 140, 210));
    await React.act(async () => {
      pointer('pointermove', 220, 240);
      await new Promise(resolve => dom.window.requestAnimationFrame(resolve));
    });
    assert.equal(bot.style.transform, 'translate3d(216px, 230px, 0)');
    assert.ok(Number(bot.style.getPropertyValue('--bot-stretch')) > 0);
    await React.act(async () => { pointer('pointerup', 220, 240); button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 1 })); });
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(bot.style.getPropertyValue('--bot-stretch'), '0');
    assert.deepEqual(JSON.parse(dom.window.sessionStorage.getItem('planmirror-check-bot-pos')), { x: 216, y: 230 });
    assert.deepEqual(errors, []);
  } finally {
    if (root) await React.act(async () => root.unmount());
    console.error = oldError;
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});

test('AI chat reads fresh sanitized page data even in Markdown view and recovers from connection errors', async () => {
  const AgentView = componentModule('app/components/agent-view.tsx').default;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/quillfox', pretendToBeVisual: true });
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const requests = [];
  let root;
  const oldPath = currentPath;
  try {
    currentPath = '/quillfox';
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] });
    checkBotActionMock = async input => { requests.push(input); return { ok: true, reply: 'Choose a plan and click Run Audit.' }; };
    const { createRoot } = await import('react-dom/client');
    root = createRoot(dom.window.document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(AgentView, { footer: 'PlanMirror', aiEnabled: true }, React.createElement('main', null,
      React.createElement('p', { id: 'fresh-content' }, 'Old page content'),
      React.createElement('p', { hidden: true }, 'hidden-secret'),
      React.createElement('p', { 'data-agent-sensitive': true }, 'sensitive-secret')))));
    await React.act(async () => dom.window.document.querySelector('[data-testid="agent-view-toggle"]').click());
    dom.window.document.querySelector('#fresh-content').textContent = 'Fresh audit evidence';
    await React.act(async () => dom.window.document.querySelector('.pm-check-bot-fab').click());
    assert.match(dom.window.document.querySelector('.pm-check-bot-kicker').textContent, /AI guide/);
    const input = dom.window.document.querySelector('.pm-check-bot-form input');
    // React's input tracking is initialized before JSDOM globals in this suite;
    // invoke the real controlled input's handler through its React props.
    const propsKey = Object.keys(input).find(key => key.startsWith('__reactProps$'));
    await React.act(async () => input[propsKey].onChange({ target: { value: 'How do I audit?' } }));
    await React.act(async () => dom.window.document.querySelector('.pm-check-bot-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(requests.length, 1);
    assert.match(requests[0].markdown, /Fresh audit evidence/);
    for (const excluded of ['Old page content', 'hidden-secret', 'sensitive-secret', 'How do I audit?']) assert.ok(!requests[0].markdown.includes(excluded), excluded);
    assert.deepEqual(requests[0].history, []);
    assert.match(dom.window.document.querySelector('.pm-check-bot-messages').textContent, /Choose a plan/);
    checkBotActionMock = async value => { requests.push(value); throw new Error('disconnected'); };
    await React.act(async () => input[propsKey].onChange({ target: { value: 'What next?' } }));
    await React.act(async () => dom.window.document.querySelector('.pm-check-bot-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(requests[1].history.length, 2);
    assert.match(dom.window.document.querySelector('.pm-check-bot-messages').textContent, /connection was interrupted/);
    assert.equal(input.disabled, false);
    const savedChat = JSON.parse(dom.window.sessionStorage.getItem('planmirror-check-bot-chat-v1'));
    assert.ok(savedChat.some(item => item.text === 'How do I audit?'));
    await React.act(async () => root.unmount());
    root = createRoot(dom.window.document.getElementById('root'));
    currentPath = '/studio';
    await React.act(async () => root.render(React.createElement(AgentView, { footer: 'PlanMirror', aiEnabled: true }, React.createElement('main', null, 'New page evidence'))));
    await React.act(async () => dom.window.document.querySelector('.pm-check-bot-fab').click());
    assert.match(dom.window.document.querySelector('.pm-check-bot-messages').textContent, /How do I audit\?/);
    assert.match(dom.window.document.querySelector('.pm-check-bot-messages').textContent, /Choose a plan/);
    checkBotActionMock = async value => { requests.push(value); return { ok: true, reply: 'You are now in Studio.' }; };
    const restoredInput = dom.window.document.querySelector('.pm-check-bot-form input');
    const restoredProps = Object.keys(restoredInput).find(key => key.startsWith('__reactProps$'));
    await React.act(async () => restoredInput[restoredProps].onChange({ target: { value: 'Where am I now?' } }));
    await React.act(async () => dom.window.document.querySelector('.pm-check-bot-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(requests[2].pathname, '/studio');
    assert.match(requests[2].markdown, /New page evidence/);
    assert.ok(requests[2].history.some(item => item.text === 'How do I audit?'));
    assert.ok(!requests[2].history.some(item => item.text.includes('connection was interrupted')));
  } finally {
    if (root) await React.act(async () => root.unmount());
    currentPath = oldPath;
    checkBotActionMock = undefined;
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});

test('live Studio preserves all evidence in Markdown and export under empty filters', async () => {
  const live = structuredClone(studioRuns[0]);
  live.id = '11111111-1111-4111-8111-111111111111';
  live.source = 'live';
  live.label = 'Live audit';
  live.planId = 'P-DEMO';
  const markdown = snapshot(renderToStaticMarkup(React.createElement(StudioMarkdown, { run: live, availableRuns: [live, ...studioRuns], status: 'match', field: 'setup_fee', liveRunState: 'loaded' })));
  assert.match(markdown, /Live sandbox audit data/);
  for (const record of live.findings) {
    assert.ok(markdown.includes(plain(record.finding.summary)));
    assert.ok(markdown.includes(plain(record.finding.paypal.planId)));
  }
  assert.equal(evidenceReport(live).illustrative, false);
  assert.equal(evidenceReport(live).run.findings.length, live.findings.length);
});

test('audit UI recovers from transport failures and includes loaded findings in its first Markdown snapshot', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/audit' });
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'FormData', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const live = { ...structuredClone(studioRuns[0]), source: 'live', id: 'live-test', planId: 'P-DEMO' };
  let lists = 0;
  let audits = 0;
  auditActionsMock = {
    listSandboxPlans: async () => {
      if (++lists === 1) throw new Error('transport interrupted');
      return { ok: true, plans: [{ id: 'P-DEMO', name: 'Quillfox Pro', status: 'ACTIVE' }], defaultPlanId: 'P-DEMO' };
    },
    runPlanAudit: async ({ mode }) => {
      assert.equal(mode, 'labeled');
      if (++audits === 1) throw new Error('transport interrupted');
      return { ok: true, run: live, runId: live.id };
    },
  };
  let root;
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] });
    const { createRoot } = await import('react-dom/client');
    const AuditForm = componentModule('app/audit/audit-form.tsx').default;
    root = createRoot(dom.window.document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(AuditForm, { aiEnabled: false })));
    assert.match(dom.window.document.body.textContent, /Plans unavailable/);
    await React.act(async () => dom.window.document.querySelector('button').click());
    assert.equal(dom.window.document.querySelector('option').textContent, 'Quillfox Pro');
    assert.equal(dom.window.document.querySelector('input[type=checkbox]').disabled, true);
    assert.match(dom.window.document.body.textContent, /AI extraction is unavailable/);
    assert.ok(dom.window.document.querySelector('.pm-audit-plan-dot.is-active'));
    assert.equal(dom.window.document.querySelector('option').getAttribute('aria-label'), 'Quillfox Pro, Active');
    const submit = () => dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await React.act(async () => submit());
    assert.match(dom.window.document.body.textContent, /Audit failed/);
    assert.match(dom.window.document.body.textContent, /request_failed/);
    assert.equal(dom.window.document.querySelector('a[href^="/studio"]'), null);
    await React.act(async () => submit());
    assert.equal(dom.window.document.querySelector('a[href^="/studio"]').getAttribute('href'), '/studio?run=live-test');
    const markdown = pageMarkdown(dom.window.document.body);
    for (const record of live.findings) {
      assert.ok(markdown.includes(plain(record.finding.summary)));
      assert.ok(markdown.includes(plain(record.finding.website.quote)));
      assert.ok(markdown.includes(plain(record.finding.paypal.planId)));
    }
    assert.match(markdown, /Live sandbox audit/);
  } finally {
    if (root) await React.act(async () => root.unmount());
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});

test('Studio handoff shares snapshots across module bundles, isolates mutation and expires at 30 minutes', () => {
  const path = resolve('lib/studio/run-store.ts');
  const first = componentModule(path);
  first.clearStudioRunStore();
  const run = { ...structuredClone(studioRuns[0]), source: 'live', id: 'store-test' };
  first.saveStudioRun(run);
  run.label = 'mutated input';
  componentCache.delete(path);
  const second = componentModule(path);
  assert.equal(second.getStudioRun(run.id).label, studioRuns[0].label);
  const loaded = second.getStudioRun(run.id);
  loaded.label = 'mutated output';
  assert.equal(first.getStudioRun(run.id).label, studioRuns[0].label);
  second.seedStudioRun(run, Date.now() - 30 * 60 * 1000);
  assert.equal(first.getStudioRun(run.id), undefined);
  second.clearStudioRunStore();
});

test('audit actions enforce the existing gate and budgets, paginate plans and read one comparison snapshot', async () => {
  const actions = componentModule('app/audit/actions.ts');
  const sandbox = componentModule('lib/paypal/sandbox.ts');
  const limits = componentModule('lib/backend/request-limits.ts');
  const originalReader = sandbox.readSandboxPlan;
  const originalClient = sandbox.sandboxClient;
  const originalLimits = { ...limits.requestLimits };
  const oldToken = process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
  const oldPreferred = process.env.PAYPAL_SANDBOX_PLAN_ID;
  let reads = 0;
  const pages = [];
  const plan = { id: 'P-DEMO123', productId: 'PROD-DEMO', name: 'Quillfox Pro', status: 'ACTIVE', retrievedAt: '2026-11-09T18:00:00.000Z', billingCycles: [
    { sequence: 1, tenure: 'REGULAR', totalCycles: 0, interval: { unit: 'MONTH', count: 1 }, fixedPrice: { value: '19.99', currencyCode: 'USD' } },
  ] };
  try {
    Object.assign(limits.requestLimits, limits.createRequestLimits());
    sandbox.readSandboxPlan = async () => { reads++; return structuredClone(plan); };
    sandbox.sandboxClient = () => ({ listPlans: async page => {
      pages.push(page);
      return { plans: [{ id: page === 1 ? 'P-FIRST123' : plan.id, name: plan.name, status: 'ACTIVE' }], nextPage: page === 1 ? 2 : null };
    } });
    process.env.PLANMIRROR_SANDBOX_READ_TOKEN = '';
    assert.equal((await actions.listSandboxPlans()).ok, false);
    assert.equal((await actions.runPlanAudit({ planId: plan.id, mode: 'labeled' })).ok, false);
    assert.deepEqual(pages, []);
    assert.equal(reads, 0);
    process.env.PLANMIRROR_SANDBOX_READ_TOKEN = 'local-test-gate-'.repeat(3);
    process.env.PAYPAL_SANDBOX_PLAN_ID = plan.id;
    const listed = await actions.listSandboxPlans();
    assert.equal(listed.ok, true);
    assert.equal(listed.defaultPlanId, plan.id);
    assert.deepEqual(pages, [1, 2]);
    assert.equal((await actions.runPlanAudit(null)).code, 'invalid_input');
    const audited = await actions.runPlanAudit({ planId: plan.id, mode: 'labeled' });
    assert.equal(audited.ok, true);
    assert.equal(reads, 1);
    assert.equal(audited.run.source, 'live');
    // The list and audit share the backend's 10-provider-runs/minute window.
    for (let i = 0; i < 8; i++) await actions.listSandboxPlans();
    const blocked = await actions.runPlanAudit({ planId: plan.id, mode: 'labeled' });
    assert.equal(blocked.code, 'rate_limited');
    assert.equal(reads, 1);
  } finally {
    sandbox.readSandboxPlan = originalReader;
    sandbox.sandboxClient = originalClient;
    Object.assign(limits.requestLimits, originalLimits);
    if (oldToken === undefined) delete process.env.PLANMIRROR_SANDBOX_READ_TOKEN;
    else process.env.PLANMIRROR_SANDBOX_READ_TOKEN = oldToken;
    if (oldPreferred === undefined) delete process.env.PAYPAL_SANDBOX_PLAN_ID;
    else process.env.PAYPAL_SANDBOX_PLAN_ID = oldPreferred;
    componentModule('lib/studio/run-store.ts').clearStudioRunStore();
  }
});
