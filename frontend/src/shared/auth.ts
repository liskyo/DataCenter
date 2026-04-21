"use client";

import { apiUrl } from "@/shared/api";

export type AuthUser = {
  username: string;
  name: string;
  role: string;
  email: string;
  lineId: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "dcim.auth.session";
const AUTH_CHANGED_EVENT = "dcim-auth-changed";

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    notifyAuthChanged();
  } catch {
    // Ignore storage write failures so login UI stays usable.
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    notifyAuthChanged();
  } catch {
    // Ignore storage removal failures so auth redirects can continue.
  }
}

export function getStoredAuthToken(): string | null {
  return readAuthSession()?.token ?? null;
}

export function buildAuthorizedUrl(url: string, token = getStoredAuthToken()): string {
  if (!token) return url;

  const nextUrl = new URL(url, typeof window !== "undefined" ? window.location.origin : apiUrl("/"));
  nextUrl.searchParams.set("token", token);
  return nextUrl.toString();
}

export function subscribeAuthChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY) listener();
  };

  window.addEventListener(AUTH_CHANGED_EVENT, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  if (!token) {
    clearAuthSession();
    throw new Error("Authentication required");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}
