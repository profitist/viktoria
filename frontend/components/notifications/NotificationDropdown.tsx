"use client";

import type { Notification } from "@/lib/types";

interface Props {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
  onMarkRead: (n: Notification) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
  unreadCount: number;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    task_assigned: "Назначение",
    task_created: "Создание задачи",
    task_updated: "Обновление задачи",
    task_moved: "Перемещение задачи",
    task_deleted: "Удаление задачи",
    comment_added: "Комментарий",
    notification: "Уведомление",
  };
  return map[type] ?? type;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];

  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= todayStart) today.push(n);
    else if (t >= yesterdayStart) yesterday.push(n);
    else earlier.push(n);
  }

  const groups = [];
  if (today.length > 0) groups.push({ label: "Сегодня", items: today });
  if (yesterday.length > 0) groups.push({ label: "Вчера", items: yesterday });
  if (earlier.length > 0) groups.push({ label: "Ранее", items: earlier });
  return groups;
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (n: Notification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onMarkRead(notification)}
      className="w-full text-left rounded-xl px-3 py-3 transition-colors"
      style={{
        background: notification.read ? "rgba(255,255,255,0.03)" : "rgba(59,130,246,0.10)",
        border: notification.read
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(59,130,246,0.25)",
        marginBottom: "6px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = notification.read
          ? "rgba(255,255,255,0.06)"
          : "rgba(59,130,246,0.16)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = notification.read
          ? "rgba(255,255,255,0.03)"
          : "rgba(59,130,246,0.10)";
      }}
    >
      <div className="flex items-start gap-2">
        {!notification.read && (
          <span
            className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ background: "#3B82F6" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            className="text-sm leading-snug"
            style={{ color: notification.read ? "rgba(255,255,255,0.6)" : "#fff" }}
          >
            {notification.message}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}
            >
              {typeLabel(notification.type)}
            </span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {formatTime(notification.created_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function NotificationDropdown({
  notifications,
  isLoading,
  error,
  onMarkRead,
  onMarkAllRead,
  onClose,
  unreadCount,
}: Props) {
  const groups = groupByDate(notifications);

  return (
    <div
      className="fixed top-0 left-[220px] h-full w-[360px] max-w-[calc(100vw-220px)] flex flex-col"
      style={{
        background: "#111111",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "16px 0 40px rgba(0,0,0,0.55)",
        zIndex: 31,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div>
          <p className="text-sm font-semibold text-white">Уведомления</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {unreadCount > 0 ? `${unreadCount} непрочитанных` : "Всё прочитано"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
              style={{
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "#93C5FD",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(59,130,246,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(59,130,246,0.15)";
              }}
            >
              Прочитать все
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-lg transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}
            aria-label="Закрыть уведомления"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && (
          <div className="flex flex-col gap-2 mt-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "64px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                }}
              />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <p className="text-sm px-2 py-3" style={{ color: "#FCA5A5" }}>
            {error}
          </p>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span style={{ fontSize: "32px", opacity: 0.25 }}>🔔</span>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              Уведомлений нет
            </p>
          </div>
        )}

        {!isLoading && !error && groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p
              className="text-[11px] uppercase px-1 mb-2"
              style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}
            >
              {group.label}
            </p>
            {group.items.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
