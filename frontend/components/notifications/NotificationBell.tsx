"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { useWs } from "@/contexts/WsContext";
import NotificationDropdown from "./NotificationDropdown";

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

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

  const fetchUnread = useCallback(() => {
    if (!workspaceId) return;
    api
      .get<Notification[]>(
        `/api/v1/notifications?workspace_id=${encodeURIComponent(workspaceId)}&unread=true`
      )
      .then((items) => setUnreadCount(items.length))
      .catch(() => {});
  }, [workspaceId]);

  // Initial fetch + polling every 30 sec
  useEffect(() => {
    if (!workspaceId) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [workspaceId, fetchUnread]);

  // WS badge bump
  useEffect(() => {
    if (!workspaceId) return;
    const handleAnyWsEvent = () => setUnreadCount((c) => c + 1);
    for (const method of WS_BADGE_METHODS) on(method, handleAnyWsEvent);
    return () => {
      for (const method of WS_BADGE_METHODS) off(method, handleAnyWsEvent);
    };
  }, [off, on, workspaceId]);

  const loadNotifications = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const items = await api.get<Notification[]>(
        `/api/v1/notifications?workspace_id=${encodeURIComponent(workspaceId)}`
      );
      setNotifications(items.slice(0, 20));
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleMarkRead = useCallback(async (notification: Notification) => {
    if (notification.read) return;
    setNotifications((items) =>
      items.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/api/v1/notifications/${notification.id}/read`, {});
    } catch {
      setNotifications((items) =>
        items.map((item) => (item.id === notification.id ? { ...item, read: false } : item))
      );
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!workspaceId) return;
    setNotifications((items) => items.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch(`/api/v1/notifications/read-all`, { workspace_id: workspaceId });
    } catch {
      void loadNotifications();
      fetchUnread();
    }
  }, [workspaceId, loadNotifications, fetchUnread]);

  const bellRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={togglePanel}
        aria-label="Уведомления"
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
            style={{ background: "#EF4444", color: "#FFFFFF", border: "1px solid #050505" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
          onClick={() => setIsOpen(false)}
        >
          <NotificationDropdown
            notifications={notifications}
            isLoading={isLoading}
            error={error}
            unreadCount={unreadCount}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </>
  );
}
