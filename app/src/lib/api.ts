import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Default per-request timeout. Generous enough for uploads/downloads of modest files.
const DEFAULT_TIMEOUT_MS = 30_000;

/** The API reports failures as `{ "error": "<sentence>" }`; fall back to the raw body. */
async function errorMessage(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON — a proxy or gateway error page, most likely.
  }
  return body || response.statusText;
}

async function request<T>(endpoint: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Abort on timeout, while still honoring a caller-provided signal.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new ApiError(408, "Request timed out")), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  // Only default the JSON Content-Type for non-FormData bodies.
  const isFormData = options.body instanceof FormData;
  const headers = isFormData ? options.headers : { "Content-Type": "application/json", ...options.headers };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers, signal });

    if (!response.ok) {
      throw new ApiError(response.status, await errorMessage(response));
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface ProfileApi {
  get: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
  post: <T>(endpoint: string, body: unknown, options?: RequestInit) => Promise<T>;
  put: <T>(endpoint: string, body: unknown, options?: RequestInit) => Promise<T>;
  delete: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
  upload: <T>(endpoint: string, formData: FormData, options?: RequestInit) => Promise<T>;
  /** Absolute URL, for `window.open` and `<img src>` which cannot carry the profile in a header. */
  url: (endpoint: string) => string;
}

/**
 * Every request is scoped to one AWS profile; there is deliberately no unscoped client,
 * so a call site cannot silently fall through to the default account.
 */
export function createApi(profile: string): ProfileApi {
  const scoped = (endpoint: string) =>
    `/${encodeURIComponent(profile)}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  return {
    get: (endpoint, options) => request(scoped(endpoint), { ...options, method: "GET" }),
    post: (endpoint, body, options) =>
      request(scoped(endpoint), { ...options, method: "POST", body: JSON.stringify(body) }),
    put: (endpoint, body, options) =>
      request(scoped(endpoint), { ...options, method: "PUT", body: JSON.stringify(body) }),
    delete: (endpoint, options) => request(scoped(endpoint), { ...options, method: "DELETE" }),
    // Uploads can be large; give them a longer timeout and send raw FormData.
    upload: (endpoint, formData, options) =>
      request(scoped(endpoint), { ...options, method: "PUT", body: formData }, 5 * 60_000),
    url: (endpoint) => `${API_BASE_URL}${scoped(endpoint)}`,
  };
}
