import "server-only";

import type { StudioRun } from "./types";

const TTL_MS = 30 * 60 * 1000;

type StoredRun = {
  run: StudioRun;
  createdAt: number;
};

// Next can compile the Server Action and page into separate module bundles.
// Share their data within this process, just like the backend request limiter.
const processState = globalThis as typeof globalThis & { __planmirrorStudioRuns?: Map<string, StoredRun> };
const store = processState.__planmirrorStudioRuns ??= new Map<string, StoredRun>();

function purge(now = Date.now()) {
  for (const [id, entry] of store) {
    if (now - entry.createdAt >= TTL_MS) store.delete(id);
  }
}

/** Persist a live Studio run under its opaque id for the Studio handoff. */
export function saveStudioRun(run: StudioRun): string {
  purge();
  store.set(run.id, { run: structuredClone(run), createdAt: Date.now() });
  return run.id;
}

/** Load a live Studio run if present and not expired. */
export function getStudioRun(id: string): StudioRun | undefined {
  purge();
  const run = store.get(id)?.run;
  return run ? structuredClone(run) : undefined;
}

/** Test helper: clear the process-local store. */
export function clearStudioRunStore() {
  store.clear();
}

/** Test helper: insert an entry with a custom createdAt timestamp. */
export function seedStudioRun(run: StudioRun, createdAt: number) {
  store.set(run.id, { run, createdAt });
}
