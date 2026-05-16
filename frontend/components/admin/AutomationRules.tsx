"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface AdminAutomationRule {
  id: string;
  trigger_event: string;
  action_type: string;
  action_payload: Record<string, unknown>;
}

const TRIGGER_OPTIONS = [
  { value: "task.created", label: "task.created" },
  { value: "task.moved", label: "task.moved" },
  { value: "task.updated", label: "task.updated" },
  { value: "task.deleted", label: "task.deleted" },
];

const ACTION_OPTIONS = [
  { value: "notify_all", label: "notify_all" },
  { value: "add_tag", label: "add_tag" },
];

const inputStyle = {
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
} as const;

interface AutomationRulesProps {
  workspaceId: string;
}

export default function AutomationRules({ workspaceId }: AutomationRulesProps) {
  const [rules, setRules] = useState<AdminAutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [formTrigger, setFormTrigger] = useState("task.created");
  const [formAction, setFormAction] = useState("notify_all");
  const [formPayload, setFormPayload] = useState("{}");
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<AdminAutomationRule[]>(
        `/api/v1/workspaces/${workspaceId}/automation`
      );
      setRules(data);
    } catch (e) {
      setError(e instanceof ApiError ? `Ошибка ${e.status}` : "Не удалось загрузить правила");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function confirmDelete() {
    if (!deletingId) return;
    setOpLoading(true);
    setOpError(null);
    try {
      await api.delete(`/api/v1/automation/${deletingId}`);
      setDeletingId(null);
      await loadRules();
    } catch (e) {
      setOpError(e instanceof ApiError ? `Ошибка удаления: ${e.status}` : "Не удалось удалить");
      setDeletingId(null);
    } finally {
      setOpLoading(false);
    }
  }

  async function handleCreate() {
    setPayloadError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(formPayload) as Record<string, unknown>;
    } catch {
      setPayloadError("Невалидный JSON");
      return;
    }
    setCreateLoading(true);
    setOpError(null);
    try {
      await api.post(`/api/v1/workspaces/${workspaceId}/automation`, {
        trigger_event: formTrigger,
        action_type: formAction,
        action_payload: parsed,
      });
      setFormTrigger("task.created");
      setFormAction("notify_all");
      setFormPayload("{}");
      await loadRules();
    } catch (e) {
      setOpError(e instanceof ApiError ? `Ошибка создания: ${e.status}` : "Не удалось создать правило");
    } finally {
      setCreateLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
          Правила автоматизации
        </p>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-8 rounded mb-2 animate-pulse"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-sm mb-3" style={{ color: "#F87171" }}>{error}</p>
        <button
          onClick={loadRules}
          className="text-sm px-3 py-1.5 rounded-md"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
        Правила автоматизации
      </p>

      <div className="space-y-1 mb-4">
        {rules.length === 0 && (
          <p className="text-sm py-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Правил нет
          </p>
        )}

        {rules.map((rule) => {
          if (deletingId === rule.id) {
            return (
              <div key={rule.id} className="flex items-center gap-3 py-1 flex-wrap">
                <span className="text-sm flex-1 font-mono" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {rule.trigger_event} → {rule.action_type}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Удалить?
                </span>
                <button
                  onClick={confirmDelete}
                  disabled={opLoading}
                  className="text-xs px-3 py-1 rounded-md"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}
                >
                  Подтвердить
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  disabled={opLoading}
                  className="text-xs px-3 py-1 rounded-md"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
                >
                  Отмена
                </button>
              </div>
            );
          }

          return (
            <div key={rule.id} className="flex items-center gap-2 py-1 group">
              <span className="flex-1 text-sm font-mono" style={{ color: "rgba(255,255,255,0.72)" }}>
                {rule.trigger_event} → {rule.action_type}
              </span>
              <button
                onClick={() => { setDeletingId(rule.id); setOpError(null); }}
                disabled={opLoading}
                className="text-xs px-2.5 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                style={{ color: "rgba(239,68,68,0.8)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "rgb(239,68,68)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(239,68,68,0.8)"; }}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="pt-4 space-y-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          Новое правило
        </p>

        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Триггер</label>
            <select
              value={formTrigger}
              onChange={(e) => setFormTrigger(e.target.value)}
              disabled={createLoading}
              className="px-3 py-2 rounded-md text-sm outline-none"
              style={inputStyle}
            >
              {TRIGGER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Действие</label>
            <select
              value={formAction}
              onChange={(e) => setFormAction(e.target.value)}
              disabled={createLoading}
              className="px-3 py-2 rounded-md text-sm outline-none"
              style={inputStyle}
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Payload (JSON)</label>
          <textarea
            value={formPayload}
            onChange={(e) => { setFormPayload(e.target.value); setPayloadError(null); }}
            disabled={createLoading}
            placeholder='{"key": "value"}'
            rows={3}
            className="px-3 py-2 rounded-md text-xs font-mono outline-none resize-y"
            style={inputStyle}
          />
          {payloadError && (
            <p className="text-xs" style={{ color: "#F87171" }}>{payloadError}</p>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={createLoading}
          className="text-sm px-4 py-2 rounded-md transition-opacity"
          style={{
            background: "#3B82F6",
            color: "#fff",
            opacity: createLoading ? 0.5 : 1,
          }}
        >
          {createLoading ? "Создание..." : "Создать правило"}
        </button>

        {opError && (
          <p className="text-xs" style={{ color: "#F87171" }}>{opError}</p>
        )}
      </div>
    </div>
  );
}
