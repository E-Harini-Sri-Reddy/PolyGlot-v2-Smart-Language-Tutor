import type { PublicUser } from "../types";

const ACCESS_TOKEN_KEY = "polyglot_access_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

type ApiErrorBody = {
  success?: boolean;
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as ApiErrorBody & Record<string, unknown>;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as { accessToken?: string };
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return data.accessToken;
      }
      return null;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isAuthRefreshPath(path: string) {
  return path.includes("/auth/refresh");
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  // Never recursively refresh the refresh endpoint (causes double 401 noise)
  if (
    response.status === 401 &&
    retry &&
    !path.includes("/auth/login") &&
    !path.includes("/auth/register") &&
    !path.includes("/auth/google") &&
    !isAuthRefreshPath(path)
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, init, false);
    }
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.code || "REQUEST_FAILED",
      data?.message || "Request failed.",
    );
  }

  return data as T;
}

export type AuthResponse = {
  success: boolean;
  accessToken: string;
  user: PublicUser;
};
