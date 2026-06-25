export type ApiQueryValue = string | number | boolean | null | undefined | Array<string | number | boolean>;

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

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== "") {
            url.searchParams.append(key, String(item));
          }
        });
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

// ── Server-to-server auth (SSR) ─────────────────────────────────────────────
// Browser calls go through the Next proxy (/api/backend), which injects the
// signed-in user's bearer token. Server-side calls (SSR in page.tsx) hit the API
// directly, so they authenticate with a cached Keycloak service-account token
// (client_credentials). This file is shared with client components, so we only
// use fetch + env here — never a server-only import.
let cachedServiceToken: { value: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return null;
  }

  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  const clientId = process.env.AUTH_KEYCLOAK_ID;
  const clientSecret = process.env.AUTH_KEYCLOAK_SECRET;
  if (!issuer || !clientId || !clientSecret) {
    return null;
  }

  if (cachedServiceToken && Date.now() < cachedServiceToken.expiresAt - 30_000) {
    return cachedServiceToken.value;
  }

  try {
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { access_token: string; expires_in?: number };
    cachedServiceToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 60) * 1000,
    };
    return cachedServiceToken.value;
  } catch {
    return null;
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
};

async function request<T>(path: string, init?: RequestInit, query?: ApiQueryParams): Promise<T> {
  // On the server, attach the service-account bearer (the browser path is
  // authenticated by the Next proxy instead).
  const serviceToken = await getServiceToken();

  // Only set a JSON Content-Type for string bodies. For FormData we must let the
  // browser set "multipart/form-data" together with its boundary.
  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
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
  postForm: <T>(path: string, form: FormData, query?: ApiQueryParams) =>
    request<T>(path, { method: "POST", body: form }, query),
  put: <T, B = unknown>(path: string, body: B) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  buildUrl,
};
