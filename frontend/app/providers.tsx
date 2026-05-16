"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  api,
  registerLogoutCallback,
  setAccessToken,
} from "@/lib/api";
import type { User } from "@/lib/types";

// =============================================================================
// Тип контекста
// =============================================================================

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

// =============================================================================
// Создание контекста
// =============================================================================

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

// =============================================================================
// QueryClient — создаётся один раз вне компонента
// =============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // данные свежи 1 минуту
      retry: 1, // одна повторная попытка при ошибке
    },
  },
});

// =============================================================================
// AuthProvider
// =============================================================================

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !isLoading && user !== null;

  // ---------------------------------------------------------------------------
  // logout — стабильная ссылка через useCallback для registerLogoutCallback
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    // Fire-and-forget: прямой fetch чтобы не триггерить логику refresh в apiFetch
    fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});

    setAccessToken(null);
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    setUser(null);
    router.replace("/login");
  }, [router]);

  // ---------------------------------------------------------------------------
  // refresh — прямой fetch, НЕ через api.post/apiFetch (нет рекурсии)
  // ---------------------------------------------------------------------------
  const refresh = useCallback(async (): Promise<void> => {
    const refreshToken = sessionStorage.getItem("refresh_token");

    if (!refreshToken) {
      logout();
      return;
    }

    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      logout();
      return;
    }

    const data = (await res.json()) as { access_token: string };
    setAccessToken(data.access_token);

    // Восстанавливаем user из sessionStorage (бэкенд при refresh не возвращает User)
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User;
        setUser(parsed);
      } catch {
        // Повреждённые данные — выходим
        logout();
      }
    }
  }, [logout]);

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const data = await api.post<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>("/api/v1/auth/login", { email, password });

      setAccessToken(data.access_token);
      sessionStorage.setItem("refresh_token", data.refresh_token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Восстановление сессии при монтировании
  // Пустой массив зависимостей: эффект запускается только один раз при монтировании.
  // logout и refresh стабильны (useCallback), но мы используем ref-обёртки
  // чтобы избежать перезапуска при навигации.
  // ---------------------------------------------------------------------------
  const logoutRef = useRef(logout);
  const refreshRef = useRef(refresh);
  logoutRef.current = logout;
  refreshRef.current = refresh;

  useEffect(() => {
    // Регистрируем logout как callback в api.ts для обработки двойного 401
    registerLogoutCallback(() => logoutRef.current());

    const restoreSession = async () => {
      const refreshToken = sessionStorage.getItem("refresh_token");

      if (refreshToken) {
        await refreshRef.current();
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    restoreSession().catch(() => {
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Providers — корневой wrapper для layout.tsx
// =============================================================================

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
