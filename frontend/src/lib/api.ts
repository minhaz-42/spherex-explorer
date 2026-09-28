/** A small typed client for the SPHEREx Explorer API. */

export type DataSource = "live" | "snapshot";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly service: string | undefined;

  constructor(status: number, code: string, message: string, service?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.service = service;
  }

  /** True when the archive or an ephemeris service failed, as opposed to a bad request. */
  get isUpstream(): boolean {
    return this.code === "upstream_error" || this.code === "upstream_timeout";
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

export function buildUrl(path: string, params: Params = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/api${path}?${qs}` : `/api${path}`;
}

export async function getJson<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  return request<T>(buildUrl(path, params), { signal, headers: { Accept: "application/json" } });
}

export async function postJson<T>(path: string, body: unknown, params: Params = {}, signal?: AbortSignal): Promise<T> {
  return request<T>(buildUrl(path, params), {
    method: "POST",
    signal,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Could not reach the SPHEREx Explorer server. Check your connection.");
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON (for example a proxy error page) is handled below.
  }
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string; service?: string } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "http_error",
      error?.message ?? `The server answered with HTTP ${response.status}.`,
      error?.service,
    );
  }
  return body as T;
}
