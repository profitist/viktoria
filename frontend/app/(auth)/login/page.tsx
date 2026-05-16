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
    <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-1">Victory Kanban</h2>
      <p className="text-sm text-gray-500 mb-6">Войдите в аккаунт</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="user@example.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error !== null && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Вход…" : "Войти"}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-blue-600 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
