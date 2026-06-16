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
      const errorText = await response.text();
      throw new ApiError(response.status, errorText || response.statusText);
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

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "POST", body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: "DELETE" }),
  // Uploads can be large; give them a longer timeout and send raw FormData.
  upload: <T>(endpoint: string, formData: FormData, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "PUT", body: formData }, 5 * 60_000),
};
