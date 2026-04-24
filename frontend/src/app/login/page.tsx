"use client";

import { FormEvent, useMemo, useState } from "react";
import { LockKeyhole, User } from "lucide-react";
import { useAuth } from "@/shared/auth-context";
import { useLanguage } from "@/shared/i18n/language";

export default function LoginPage() {
  const { login } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const t = useMemo(() => {
    if (language === "en") {
      return {
        title: "Account Login",
        subtitle: "Enter your credentials to access the DCIM control panel.",
        username: "Username",
        password: "Password",
        submit: "Sign In",
        submitting: "Signing In...",
        language: "中(繁)",
        demoHint: "Default accounts: admin / admin123, operator / operator123",
      };
    }

    return {
      title: "帳密登入",
      subtitle: "請輸入帳號密碼以進入 DCIM 控制面板。",
      username: "帳號",
      password: "密碼",
      submit: "登入",
      submitting: "登入中...",
      language: "EN",
      demoHint: "預設帳號：admin / admin123、operator / operator123",
    };
  }, [language]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({ username, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),_transparent_35%),_#010613] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-cyan-900/60 bg-[#071221]/95 p-8 shadow-[0_0_60px_rgba(8,145,178,0.12)]">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.35em] text-cyan-500">DCIM SECURE ACCESS</p>
            <h1 className="mt-3 text-3xl font-black tracking-widest text-cyan-100">{t.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs tracking-wider text-slate-300 transition-colors hover:border-cyan-700 hover:text-white"
          >
            {t.language}
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <User size={14} className="text-cyan-500" />
              {t.username}
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-[#020b1a] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-600"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <LockKeyhole size={14} className="text-cyan-500" />
              {t.password}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-[#020b1a] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-600"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-900/70 bg-red-950/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold tracking-[0.3em] text-[#03101d] transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">{t.demoHint}</p>
      </div>
    </div>
  );
}
