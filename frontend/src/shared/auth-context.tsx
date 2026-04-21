"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiUrl } from "@/shared/api";
import {
  AuthSession,
  AuthUser,
  authFetch,
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  subscribeAuthChanges,
} from "@/shared/auth";

type LoginPayload = {
  username: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated } = useAuth();
  const isPublicRoute = pathname === "/login";

  useEffect(() => {
    if (isPublicRoute) {
      if (!loading && isAuthenticated) {
        router.replace("/");
      }
      return;
    }

    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isPublicRoute, loading, router]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading || !isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center bg-[#010613] text-cyan-300">
        <div className="rounded-xl border border-cyan-900/60 bg-[#071221] px-6 py-4 text-sm tracking-widest">
          AUTHENTICATING...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(() => readAuthSession());
  const [loading, setLoading] = useState(true);

  const syncFromStorage = useCallback(() => {
    setSession(readAuthSession());
  }, []);

  useEffect(() => {
    return subscribeAuthChanges(syncFromStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const stored = readAuthSession();
      if (!stored) {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      setSession(stored);

      try {
        const res = await authFetch(apiUrl("/api/auth/me"), { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Session expired");
        }
        const me = await res.json();
        const nextSession = {
          token: stored.token,
          user: {
            username: me.username,
            name: me.name,
            role: me.role,
            email: me.email ?? "",
            lineId: me.line_id ?? "",
          } satisfies AuthUser,
        };
        saveAuthSession(nextSession);
        if (!cancelled) setSession(nextSession);
      } catch {
        clearAuthSession();
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ username, password }: LoginPayload) => {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error?.detail || "Login failed");
    }

    const data = await res.json();
    const nextSession: AuthSession = {
      token: data.token,
      user: {
        username: data.username,
        name: data.name,
        role: data.role,
        email: data.email ?? "",
        lineId: data.line_id ?? "",
      },
    };

    saveAuthSession(nextSession);
    setSession(nextSession);
    router.replace("/");
  }, [router]);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    token: session?.token ?? null,
    loading,
    isAuthenticated: Boolean(session?.token),
    login,
    logout,
  }), [loading, login, logout, session]);

  return (
    <AuthContext.Provider value={value}>
      <AuthGuard>{children}</AuthGuard>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
