import assert from 'node:assert/strict';
import test from 'node:test';
import { createDataEngine } from 'ag-studio';
import { studioRuns } from '../lib/studio/fixtures.ts';
import { workspaceData, workspaceState, workspaceBreakpoints } from '../lib/studio/workspace.ts';

test('native Studio engine counts recorded verdicts and applies a verdict filter without changing source evidence', async () => {
  const records = structuredClone(studioRuns[0].findings);
  const before = structuredClone(records);
  const engine = createDataEngine(workspaceData(records));
  const field = (name, extra = {}) => ({ key: `auditFindings.${name}`, sourceId: 'auditFindings', fieldId: `auditFindings.${name}`, ...extra });
  const query = {
    axes: [{ dimensions: [{ field: field('Status'), as: 'status' }] }],
    measures: [{ field: field('Findings', { aggregation: 'sum' }), as: 'count' }],
  };
  try {
    await engine.init?.();
    engine.finalize?.();
    const [all, filtered] = await engine.execute(
      { query, options: { shape: 'rows', strict: true } },
      { query: { ...query, filter: { field: field('Status'), operator: 'equals', value: 'Mismatch' } }, options: { shape: 'rows', strict: true } },
    );
    assert.equal(all.metadata?.error, undefined);
    assert.equal(filtered.metadata?.error, undefined);
    assert.equal(all.rows.reduce((sum, row) => sum + row.count, 0), records.length);
    assert.deepEqual(filtered.rows, [{ status: 'Mismatch', count: records.filter(record => record.finding.status === 'mismatch').length }]);
    assert.deepEqual(records, before);
  } finally { engine.dispose?.(); }
});

test('missing values remain unavailable and the responsive native dashboard keeps widgets separate', () => {
  const record = structuredClone(studioRuns[0].findings[0]);
  delete record.advertisedDisplay;
  delete record.configuredDisplay;
  const row = workspaceData([record]).sources[0].data[0];
  assert.equal(row.Advertised, 'Advertised value unavailable');
  assert.equal(row.Configured, 'Configured value unavailable');
  const page = workspaceState().pages[0];
  const layouts = Object.values(page.widgetLayout).map(layout => ({ layout }));
  const narrow = workspaceBreakpoints[0].layout(layouts, { columns: 24 });
  assert.equal(narrow[0].yTrack, 0);
  for (let i = 1; i < narrow.length; i++) assert.ok(narrow[i].yTrack >= narrow[i - 1].yTrack + narrow[i - 1].ySpan);
  assert.equal(page.widgets.evidence.format.triggerCrossFilter, false, 'Inspect does not also filter other widgets');
});
