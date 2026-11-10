import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
const require = createRequire(import.meta.url);

test('real Studio harness delegates to the built-in data agent and executes native queries over scoped findings', async () => {
  const dom = new JSDOM('<html><body><div id="studio"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const globals = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'MutationObserver', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'ShadowRoot', 'DocumentFragment', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLButtonElement', 'XMLSerializer', 'DOMRect', 'DOMRectReadOnly']) {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    if (dom.window[key]) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  }
  globals.set('ResizeObserver', Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver'));
  globals.set('IntersectionObserver', Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver'));
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  const originalStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.getComputedStyle = element => originalStyle(element);
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  const { createStudio, createWidgets, AgStudioAiModule } = require('ag-studio');
  const { evidenceWidgetDefinition } = require('../app/studio/evidence-widget.tsx');
  const { buildAuditor } = require('../lib/studio/agent.ts');
  const { workspaceData, workspaceState } = require('../lib/studio/workspace.ts');
  const { withScope, scopeFromState } = require('../lib/studio/workspace-controller.ts');
  const { studioRuns } = require('../lib/studio/fixtures.ts');
  const run = studioRuns[0];
  const initial = withScope(workspaceState(), { status: 'mismatch', field: 'all' });
  initial.pages[0].widgets = { promise: { type: "planmirror-evidence", dataMapping: {}, format: {} } }; initial.pages[0].widgetLayout = { promise: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 20 } };
  class WidgetProbe { init() { this.element = document.createElement('article'); this.element.textContent = 'Evidence widget probe'; } getGui() { return this.element; } }
  const widgets = createWidgets({ additionalTypes: [{ ...evidenceWidgetDefinition, comp: WidgetProbe }] });
  const oldFetch = globalThis.fetch;
  let sdk; let agent; const sdkErrors = [];
  const calls = []; const busy = []; const dataInputs = [];
  const counters = { auditor: 0, data: 0 };
  try {
    sdk = createStudio(document.getElementById('studio'), { data: workspaceData(run.findings), initialState: initial, widgets, onErrorRaised: event => sdkErrors.push(...event.errorDetails) }, { modules: [AgStudioAiModule] });
    assert.ok(sdk.getAiContext().catalogue().some(widget => widget.type === 'planmirror-evidence' || widget.id === 'planmirror-evidence'), 'registered custom widget is available in the actual SDK catalogue');
    console.log('QUERY SCHEMA', JSON.stringify(sdk.getAiTools().executeQuery().schema().parameters));
    console.log('CONFIG SIZE', JSON.stringify(sdk.getAiTools().configureWidget({ widgetType: 'bar-chart-grouped' }, { pageId: 'findings' }).schema().parameters).length);
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      if (!body.request) return Response.json({ budgetId: 'mock-server-issued-budget' });
      const id = body.agentId; calls.push(id); counters[id]++;
      let item;
      if (id === 'auditor' && counters.auditor === 1) item = { type: 'function_call', kind: 'output', id: 'fc-delegate', callId: 'c-delegate', name: 'delegate_to', arguments: JSON.stringify({ type: { id: 'data' }, instructions: 'Count the current mismatch findings by billing field using execute_query. Report scoped counts.' }), status: 'completed' };
      else if (id === 'data' && counters.data === 1) item = { type: 'function_call', kind: 'output', id: 'fc-query', callId: 'c-query', name: 'execute_query', arguments: JSON.stringify({ query: { kind: 'apiQuery', variant: 'aggregation', axes: [{ dimensions: [{ field: { id: 'auditFindings.Field' }, as: 'field' }] }], measures: [{ field: { id: 'auditFindings.Findings', aggregation: 'sum' }, as: 'count' }] } }), status: 'completed' };
      else if (id === 'data') {
        dataInputs.push(...body.request.input);
        const complete = body.request.tools.find(tool => tool.name === 'complete_task');
        assert.ok(complete, 'delegate receives the actual native completion tool');
        // The SDK advertises a summary string for returning the delegate result.
        const properties = complete.parameters.properties;
        const args = Object.fromEntries(Object.keys(properties).map(key => [key, properties[key].type === 'array' ? [] : 'Scoped finding counts queried successfully.']));
        item = { type: 'function_call', kind: 'output', id: 'fc-complete', callId: 'c-complete', name: 'complete_task', arguments: JSON.stringify(args), status: 'completed' };
      } else item = { id: 'answer', kind: 'output', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'text', text: 'The data agent counted the current mismatch findings by billing field.', annotations: [] }] };
      const events = item.type === 'function_call' ? [{ type: 'TOOL_CALL_START', toolCallId: item.callId, toolCallName: item.name }, { type: 'TOOL_CALL_ARGS', toolCallId: item.callId, delta: item.arguments }, { type: 'TOOL_CALL_END', toolCallId: item.callId }] : [{ type: 'TEXT_MESSAGE_CHUNK', messageId: item.id, delta: item.content[0].text, role: 'assistant' }];
      return new Response([...events.map(event => JSON.stringify({ event })), JSON.stringify({ complete: { id: `response-${calls.length}`, createdAt: Date.now(), status: 'completed', output: [item] } })].join('\n') + '\n');
    };
    agent = buildAuditor(sdk, { run, context: () => ({ runId: run.id, source: run.source, scope: scopeFromState(sdk.getState()) }), select() {}, scope(next) { sdk.setState(withScope(sdk.getState(), next)); } }, value => busy.push(value));
    const session = await agent.harness.createThread({ agentId: 'auditor' });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Mock harness did not finish')), 8000);
      let started = false;
      session.addEventListener('changed', () => {
        if (session.status === 'running') started = true;
        if (started && session.status !== 'running') { clearTimeout(timer); if (session.status === 'error') reject(new Error(JSON.stringify(session.messages))); else resolve(); }
      });
      session.sendMessage('Count current mismatch findings by billing field.');
    });
    assert.deepEqual(calls, ['auditor', 'data', 'data', 'auditor']);
    assert.deepEqual(busy, [true, false]);
    const queryResult = dataInputs.find(item => item.type === 'function_call_output' && item.callId === 'c-query');
    assert.ok(queryResult, 'actual native query executed and returned to delegate');
    assert.ok(!queryResult.output.includes('"success":false'), queryResult.output);
    assert.ok(queryResult.output.includes('trial'), queryResult.output);
    const queryData = JSON.parse(queryResult.output).data.result;
    assert.equal(queryData.reduce((sum, row) => sum + row.count, 0), run.findings.filter(record => record.finding.status === 'mismatch').length);
    assert.ok(session.messages.some(message => message.parts.some(part => part.type === 'text' && part.text.includes('data agent counted'))));
    assert.equal(scopeFromState(sdk.getState()).status, 'mismatch');
    assert.deepEqual(sdkErrors, []);
    const before = sdk.getState();
    const oldLayout = before.pages[0].widgetLayout.promise;
    sdk.setState({ ...before, pages: before.pages.map(page => ({ ...page, widgetLayout: { ...page.widgetLayout, promise: { ...oldLayout, ySpan: oldLayout.ySpan + 2 } } })) });
    assert.ok(sdk.getHistory().undo.length > 0);
    sdk.undo();
    assert.equal(sdk.getState().pages[0].widgetLayout.promise.ySpan, oldLayout.ySpan);
    sdk.redo();
    assert.equal(sdk.getState().pages[0].widgetLayout.promise.ySpan, oldLayout.ySpan + 2);
  } finally {
    agent?.dispose(); sdk?.destroy(); dom.window.close(); globalThis.fetch = oldFetch;
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test('evidence widget preserves hidden selection and rejects IDs from another run', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: EvidenceWidget, EvidenceContext } = require('../app/studio/evidence-widget.tsx');
  const { studioRuns } = require('../lib/studio/fixtures.ts');
  const run = studioRuns[0]; const selected = run.findings[0];
  const render = selectedId => renderToStaticMarkup(React.createElement(EvidenceContext.Provider, { value: { run, selectedId, visibleIds: [], select() {}, clearFilters() {} } }, React.createElement(EvidenceWidget, { format: {}, widgetApi: { setDisplayState() {} } })));
  const hidden = render(selected.id);
  assert.ok(hidden.includes('Selected finding is outside the current filters'));
  assert.ok(hidden.includes(selected.finding.offerLabel));
  assert.ok(hidden.includes(selected.finding.paypal.fieldPath));
  const unavailable = render('another-run-finding');
  assert.ok(unavailable.includes('Unavailable references cannot resolve against another run'));
  assert.ok(!unavailable.includes(selected.finding.paypal.fieldPath));
});
