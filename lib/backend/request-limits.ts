/** Single-process demo limits; shared across Next route bundles, never keyed by spoofable IP headers. */
export class RequestLimitError extends Error {
  readonly status = 429;
  constructor(readonly retryAfter: number) { super("Request limit reached. Try again later."); }
}

function createState(now: () => number) {
  return { requests: { start: now(), count: 0 }, providers: { start: now(), count: 0 }, active: 0 };
}

export function createRequestLimits(now = Date.now, state = createState(now)) {
  const windowMs = 60_000;
  const { requests, providers } = state;

  function consume(window: typeof requests, maximum: number) {
    const time = now();
    if (time - window.start >= windowMs || time < window.start) {
      window.start = time;
      window.count = 0;
    }
    if (window.count >= maximum) throw new RequestLimitError(Math.max(1, Math.ceil((window.start + windowMs - time) / 1000)));
    window.count++;
  }

  return {
    checkRequest() { consume(requests, 60); },
    async runProviderWork<T>(work: () => Promise<T>): Promise<T> {
      if (state.active >= 2) throw new RequestLimitError(1);
      consume(providers, 10);
      state.active++;
      try { return await work(); }
      finally { state.active--; }
    },
  };
}

// Share data, not functions/Error constructors, across separately compiled route bundles.
const processState = globalThis as typeof globalThis & { __planmirrorRequestLimitState?: ReturnType<typeof createState> };
export const requestLimits = createRequestLimits(Date.now, processState.__planmirrorRequestLimitState ??= createState(Date.now));
