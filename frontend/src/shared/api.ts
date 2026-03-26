const DEFAULT_BACKEND_URL = "http://localhost:9000";

export const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") || DEFAULT_BACKEND_URL;

export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${normalized}`;
}
