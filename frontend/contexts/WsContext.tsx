"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WsClient } from "@/lib/ws";
import { getAccessToken } from "@/lib/api";

// =============================================================================
// Типы
// =============================================================================

type WsHandler = (params: Record<string, unknown>) => void;

interface WsContextValue {
  // Инициализирует соединение. Идемпотентен: тот же workspaceId — no-op.
  // Другой workspaceId — disconnect + reconnect.
  init: (workspaceId: string) => void;
  // Подписка. Безопасно вызывать до init() — handler попадает в pending.
  on: (method: string, handler: WsHandler) => void;
  // Отписка. Безопасно если handler не зарегистрирован.
  off: (method: string, handler: WsHandler) => void;
  // Текущий workspaceId (null — не инициализирован).
  workspaceId: string | null;
}

// =============================================================================
// Контекст
// =============================================================================

export const WsContext = createContext<WsContextValue | null>(null);

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (ctx === null) {
    throw new Error("useWs must be used within WsProvider");
  }
  return ctx;
}

// =============================================================================
// Провайдер
// =============================================================================

export function WsProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WsClient | null>(null);
  const currentWorkspaceId = useRef<string | null>(null);
  // ISSUE-001: реактивный workspaceId для корректного ре-рендера потребителей
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  // pendingHandlers — единственный источник истины для всех зарегистрированных хэндлеров.
  // WsClient — его проекция. Хэндлеры никогда не удаляются отсюда при reconnect.
  const pendingHandlers = useRef<Map<string, Set<WsHandler>>>(new Map());

  // ISSUE-002: on() всегда пишет в pendingHandlers И в wsClient (если уже создан).
  const on = useCallback((method: string, handler: WsHandler): void => {
    // Всегда добавляем в реестр — источник истины
    if (!pendingHandlers.current.has(method)) {
      pendingHandlers.current.set(method, new Set());
    }
    pendingHandlers.current.get(method)!.add(handler);

    // Если WsClient уже создан — проксируем немедленно
    wsRef.current?.on(method, handler);
  }, []);

  const off = useCallback((method: string, handler: WsHandler): void => {
    // Удаляем из pending (если там)
    pendingHandlers.current.get(method)?.delete(handler);
    // Удаляем из WsClient (если есть)
    wsRef.current?.off(method, handler);
  }, []);

  const init = useCallback((newWorkspaceId: string): void => {
    // Idempotent: уже подключены к этому workspaceId — no-op
    if (currentWorkspaceId.current === newWorkspaceId && wsRef.current !== null) {
      return;
    }

    // Другой workspaceId или первый вызов — сбрасываем старое соединение
    wsRef.current?.disconnect();

    const ws = new WsClient();
    wsRef.current = ws;
    currentWorkspaceId.current = newWorkspaceId;
    // ISSUE-001: обновляем реактивный state чтобы потребители узнали о смене workspaceId
    setWorkspaceId(newWorkspaceId);

    // ISSUE-002: переносим ВСЕ накопленные хэндлеры в новый WsClient.
    // pendingHandlers НЕ очищаем — они остаются источником истины при следующем reconnect.
    for (const [method, handlers] of pendingHandlers.current) {
      for (const handler of handlers) {
        ws.on(method, handler);
      }
    }

    ws.connect(newWorkspaceId, getAccessToken);
  }, []);

  // Disconnect при размонтировании layout (logout)
  useEffect(() => {
    return () => {
      wsRef.current?.disconnect();
      wsRef.current = null;
      currentWorkspaceId.current = null;
    };
  }, []);

  // ISSUE-001: value стабилизирован через useMemo — ссылка меняется только
  // когда меняется один из стабильных коллбэков или workspaceId.
  const value = useMemo<WsContextValue>(
    () => ({ init, on, off, workspaceId }),
    [init, on, off, workspaceId]
  );

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}
