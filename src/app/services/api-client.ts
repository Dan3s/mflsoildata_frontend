export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiQueryParams = Record<string, ApiQueryValue>;

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return new URL("/api/backend/", window.location.origin).toString();
  }

  const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error("Missing API base URL. Set NEXT_PUBLIC_API_URL in .env.");
  }

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
};

const buildUrl = (path: string, query?: ApiQueryParams) => {
  const url = new URL(path.replace(/^\//, ""), getApiBaseUrl());

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
};

async function request<T>(path: string, init?: RequestInit, query?: ApiQueryParams): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await parseResponse<unknown>(response);
    } catch {
      payload = null;
    }

    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : `API request failed with status ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return parseResponse<T>(response);
}

export const apiClient = {
  get: <T>(path: string, query?: ApiQueryParams) => request<T>(path, { method: "GET" }, query),
  post: <T, B = unknown>(path: string, body: B) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  put: <T, B = unknown>(path: string, body: B) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  buildUrl,
};
