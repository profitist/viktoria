"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/board");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      const workspaces = await api.get<{ id: string }[]>("/api/v1/workspaces/me");
      if (workspaces.length > 0) {
        router.push(`/board?workspace_id=${workspaces[0].id}`);
      } else {
        router.push("/board");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Неверный email или пароль");
      } else {
        setError("Что-то пошло не так. Попробуйте позже");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <div
        className="rounded-2xl p-10"
        style={{
          background: "#0B0B0B",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mb-8">
          <h1
            className="text-xl font-semibold uppercase tracking-[0.2em] text-white"
          >
            VIKTORIA
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            Войдите в аккаунт
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs uppercase tracking-widest font-medium"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="rounded-lg px-3 py-3 text-sm text-white outline-none transition-all"
              style={{
                background: "#0B0B0B",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs uppercase tracking-widest font-medium"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg px-3 py-3 text-sm text-white outline-none transition-all"
              style={{
                background: "#0B0B0B",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
              }
            />
          </div>

          {error !== null && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="rounded-lg px-4 py-3 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#3B82F6" }}
            onMouseEnter={(e) => {
              if (!isLoading && email && password) {
                e.currentTarget.style.background = "#2563EB";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(59,130,246,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#3B82F6";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {isLoading ? "Вход…" : "Войти"}
          </button>
        </form>

        <p className="text-sm mt-6 text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
