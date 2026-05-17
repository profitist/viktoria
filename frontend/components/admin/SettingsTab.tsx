"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, workspaceApi } from "@/lib/api";
import type { WorkspaceSettings } from "@/lib/types";

interface SettingsTabProps {
  workspaceId: string;
  currentUserRole: "owner" | "admin" | "member";
}

export default function SettingsTab({ workspaceId, currentUserRole }: SettingsTabProps) {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);

  const isReadOnly = currentUserRole === "member";

  function showToast(msg: string, kind: "success" | "error") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await workspaceApi.getSettings(workspaceId);
      setSettings(data.settings);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setLoadError("Нет прав для управления настройками");
      } else if ((e as Error).message?.toLowerCase().includes("failed to fetch")) {
        setLoadError("Нет соединения с сервером");
      } else {
        setLoadError("Не удалось загрузить настройки");
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleToggle() {
    if (!settings || isPending || isReadOnly) return;

    const newValue = !settings.automation_enabled;
    setSettings(prev => (prev ? { ...prev, automation_enabled: newValue } : prev));
    setIsPending(true);

    try {
      const data = await workspaceApi.updateSettings(workspaceId, {
        automation_enabled: newValue,
      });
      setSettings(data.settings);
      showToast("Сохранено", "success");
    } catch {
      setSettings(prev => (prev ? { ...prev, automation_enabled: !newValue } : prev));
      showToast("Ошибка при сохранении. Попробуйте ещё раз.", "error");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section style={{ marginBottom: "36px" }}>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.30)",
          marginBottom: "12px",
        }}
      >
        Настройки
      </p>

      <div
        style={{
          background: "#0B0B0B",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <SkeletonRow />
        ) : loadError ? (
          <ErrorRow message={loadError} onRetry={loadSettings} />
        ) : settings ? (
          <SettingRow
            enabled={settings.automation_enabled}
            pending={isPending}
            disabled={isReadOnly}
            onToggle={handleToggle}
          />
        ) : null}
      </div>

      {toast && (
        <div
          style={{
            marginTop: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            background:
              toast.kind === "success"
                ? "rgba(34,197,94,0.12)"
                : "rgba(239,68,68,0.12)",
            border: `1px solid ${
              toast.kind === "success"
                ? "rgba(34,197,94,0.25)"
                : "rgba(239,68,68,0.25)"
            }`,
            color: toast.kind === "success" ? "#86EFAC" : "#FCA5A5",
            fontSize: "13px",
          }}
        >
          {toast.msg}
        </div>
      )}
    </section>
  );
}

function SettingRow({
  enabled,
  pending,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  pending: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "16px 20px",
      }}
    >
      <div>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#FFFFFF",
            marginBottom: "3px",
          }}
        >
          Automation rules
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.40)" }}>
          Включает/выключает выполнение всех правил автоматизации
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: enabled ? "#3B82F6" : "rgba(255,255,255,0.35)",
            transition: "color 0.2s ease",
            letterSpacing: "0.01em",
          }}
        >
          {enabled ? "Активна" : "Отключена"}
        </span>
        <Toggle enabled={enabled} disabled={pending || disabled} onToggle={onToggle} />
      </div>
    </div>
  );
}

function Toggle({
  enabled,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      title={
        disabled && !enabled
          ? "Только владелец или администратор может изменить настройку"
          : enabled
          ? "Отключить автоматизацию"
          : "Включить автоматизацию"
      }
      style={{
        position: "relative",
        width: "42px",
        height: "24px",
        borderRadius: "12px",
        border: "none",
        background: enabled ? "#3B82F6" : "rgba(255,255,255,0.10)",
        outline: "1px solid",
        outlineColor: enabled ? "transparent" : "rgba(255,255,255,0.10)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.2s ease, opacity 0.15s ease, outline-color 0.2s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: enabled ? "21px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: enabled ? "#FFFFFF" : "rgba(255,255,255,0.55)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
          transition: "left 0.2s ease, background 0.2s ease",
        }}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
      }}
    >
      <div>
        <div
          style={{
            width: "130px",
            height: "14px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.06)",
            marginBottom: "6px",
          }}
          className="animate-pulse"
        />
        <div
          style={{
            width: "240px",
            height: "11px",
            borderRadius: "4px",
            background: "rgba(255,255,255,0.04)",
          }}
          className="animate-pulse"
        />
      </div>
      <div
        style={{
          width: "42px",
          height: "24px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.06)",
        }}
        className="animate-pulse"
      />
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        gap: "12px",
      }}
    >
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.40)" }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: "5px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "transparent",
          color: "rgba(255,255,255,0.60)",
          fontSize: "12px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "border-color 0.12s ease, color 0.12s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)";
          e.currentTarget.style.color = "#FFFFFF";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
          e.currentTarget.style.color = "rgba(255,255,255,0.60)";
        }}
      >
        Повторить
      </button>
    </div>
  );
}
