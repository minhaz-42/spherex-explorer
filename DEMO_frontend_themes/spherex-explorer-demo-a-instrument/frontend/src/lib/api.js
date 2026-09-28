// Client for the data service (backend/). In development Vite forwards /api
// to it; in production the backend serves this app and /api together.

export class ApiError extends Error {
  constructor(message, { status = 0, offline = false } = {}) {
    super(message);
    this.status = status;
    this.offline = offline;
  }
}

async function get(path, params, { timeoutMs = 90000, signal } = {}) {
  const url = `/api/${path}?${new URLSearchParams(params)}`;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    response = await fetch(url, { signal: combined, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err.name === 'AbortError' && signal?.aborted) throw err;
    if (err.name === 'TimeoutError') throw new ApiError('The data service took too long to answer. Try again.');
    throw new ApiError('The data service isn\u2019t running. Start it with python start.py, then search again.', { offline: true });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // A dev server with no backend behind it answers 5xx without JSON.
    if (!body && response.status >= 500) {
      throw new ApiError('The data service isn\u2019t running. Start it with python start.py, then search again.', { offline: true, status: response.status });
    }
    const detail = typeof body?.detail === 'string' ? body.detail : `The data service answered with HTTP ${response.status}.`;
    throw new ApiError(detail, { status: response.status });
  }
  return body;
}

/** Name or coordinates -> { name, ra, dec, frame, l, b } */
export const resolve = (q, opts) => get('resolve', { q }, opts);

/** Every SPHEREx image covering a position (QR2 + QR3, Wide + Deep). */
export const frames = (ra, dec, opts) => get('frames', { ra, dec }, opts);

export const health = (opts) => get('health', {}, { timeoutMs: 4000, ...opts });
