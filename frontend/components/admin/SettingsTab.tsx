"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, workspaceApi } from "@/lib/api";
import type { WorkspaceSettings } from "@/lib/types";
import { Switch } from "@/components/ui/switch";

interface SettingsTabProps {
  workspaceId: string;
  currentUserRole: "owner" | "admin" | "member";
}

export default function SettingsTab({ workspaceId, currentUserRole }: SettingsTabProps) {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSetting, setPendingSetting] = useState<
    "automation_enabled" | "deadline_decay_enabled" | null
  >(null);
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
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadSettings();
    });
    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  async function handleToggle(
    key: "automation_enabled" | "deadline_decay_enabled"
  ) {
    if (!settings || pendingSetting !== null || isReadOnly) return;

    const newValue = !settings[key];
    setSettings(prev => (prev ? { ...prev, [key]: newValue } : prev));
    setPendingSetting(key);

    try {
      const data = await workspaceApi.updateSettings(workspaceId, {
        [key]: newValue,
      });
      setSettings(data.settings);
      showToast("Сохранено", "success");
    } catch {
      setSettings(prev => (prev ? { ...prev, [key]: !newValue } : prev));
      showToast("Ошибка при сохранении. Попробуйте ещё раз.", "error");
    } finally {
      setPendingSetting(null);
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
          <>
            <SettingRow
              label="Automation rules"
              description="Включает/выключает выполнение всех правил автоматизации"
              enabled={settings.automation_enabled}
              pending={pendingSetting === "automation_enabled"}
              disabled={isReadOnly || pendingSetting !== null}
              activeColor="#3B82F6"
              onToggle={() => handleToggle("automation_enabled")}
            />
            <SettingRow
              label="Градиентная окраска по дедлайну"
              description="Карточки меняют цвет по мере приближения к дедлайну"
              enabled={settings.deadline_decay_enabled}
              pending={pendingSetting === "deadline_decay_enabled"}
              disabled={isReadOnly || pendingSetting !== null}
              activeColor="#22C55E"
              onToggle={() => handleToggle("deadline_decay_enabled")}
            />
          </>
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
  label,
  description,
  enabled,
  pending,
  disabled,
  activeColor,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  pending: boolean;
  disabled: boolean;
  activeColor: string;
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
          {label}
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.40)" }}>
          {description}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: enabled ? activeColor : "rgba(255,255,255,0.35)",
            transition: "color 0.2s ease",
            letterSpacing: "0.01em",
          }}
        >
          {enabled ? "Активна" : "Отключена"}
        </span>
        <Switch
          checked={enabled}
          disabled={pending || disabled}
          aria-label={label}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
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
