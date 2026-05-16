"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { useWs } from "@/contexts/WsContext";

interface NotificationBellProps {
  workspaceId?: string;
}

const WS_BADGE_METHODS = [
  "notification.created",
  "board.task_created",
  "board.task_updated",
  "board.task_moved",
  "board.task_deleted",
  "event_log.entry",
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 9.5a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18c0-1.5-3-1.5-3-8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 20a2.4 2.4 0 0 0 4.4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function NotificationBell({ workspaceId }: NotificationBellProps) {
  const { on, off } = useWs();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    let cancelled = false;

    api
      .get<Notification[]>(
        `/api/v1/notifications?workspace_id=${encodeURIComponent(workspaceId)}&unread=true`
      )
      .then((items) => {
        if (!cancelled) setUnreadCount(items.length);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const loadNotifications = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const items = await api.get<Notification[]>(
        `/api/v1/notifications?workspace_id=${encodeURIComponent(workspaceId)}`
      );
      setNotifications(items);
    } catch {
      setError("Не удалось загрузить уведомления");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const togglePanel = useCallback(() => {
    setIsOpen((current) => {
      const next = !current;
      if (next) void loadNotifications();
      return next;
    });
  }, [loadNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!workspaceId) return;

    const handleAnyWsEvent = () => {
      setUnreadCount((count) => count + 1);
    };

    for (const method of WS_BADGE_METHODS) {
      on(method, handleAnyWsEvent);
    }

    return () => {
      for (const method of WS_BADGE_METHODS) {
        off(method, handleAnyWsEvent);
      }
    };
  }, [off, on, workspaceId]);

  async function markAsRead(notification: Notification): Promise<void> {
    if (notification.read) return;

    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item
      )
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await api.patch(`/api/v1/notifications/${notification.id}/read`, {});
    } catch {
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, read: false } : item
        )
      );
      setUnreadCount((count) => count + 1);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Notifications"
        className="fixed top-4 left-[236px] z-40 h-10 w-10 rounded-xl flex items-center justify-center transition-colors"
        style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.08)",
          color: isOpen ? "#FFFFFF" : "rgba(255,255,255,0.72)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
        }}
        disabled={!workspaceId}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] font-semibold flex items-center justify-center"
            style={{
              background: "#EF4444",
              color: "#FFFFFF",
              border: "1px solid #050505",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={panelRef}
            className="fixed top-0 left-[220px] h-full w-[360px] max-w-[calc(100vw-220px)]"
            style={{
              background: "#111111",
              borderRight: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "16px 0 40px rgba(0,0,0,0.55)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div>
                <p className="text-sm font-semibold text-white">Notifications</p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {unreadCount} unread
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-lg text-lg"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.55)",
                }}
                aria-label="Close notifications"
              >
                ×
              </button>
            </div>

            <div className="h-[calc(100%-73px)] overflow-y-auto p-3">
              {isLoading && (
                <p className="text-sm px-2 py-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Загрузка...
                </p>
              )}

              {!isLoading && error && (
                <p className="text-sm px-2 py-3" style={{ color: "#FCA5A5" }}>
                  {error}
                </p>
              )}

              {!isLoading && !error && notifications.length === 0 && (
                <p className="text-sm px-2 py-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Уведомлений нет
                </p>
              )}

              {!isLoading && !error && notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void markAsRead(notification)}
                  className="w-full text-left rounded-xl px-3 py-3 mb-2 transition-colors"
                  style={{
                    background: notification.read
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(59,130,246,0.12)",
                    border: notification.read
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "1px solid rgba(59,130,246,0.28)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-white leading-snug">
                      {notification.message}
                    </p>
                    {!notification.read && (
                      <span
                        className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: "#3B82F6" }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span
                      className="text-[11px] uppercase"
                      style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}
                    >
                      {notification.type}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
