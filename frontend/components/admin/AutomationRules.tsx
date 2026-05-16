"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AutomationRule, RuleTrigger, RuleActionType } from "@/lib/types";

interface BoardColumn {
  id: string;
  name: string;
}

const TRIGGER_OPTIONS: { value: RuleTrigger; label: string }[] = [
  { value: "task.created",         label: "task.created" },
  { value: "task.moved",           label: "task.moved" },
  { value: "task.updated",         label: "task.updated" },
  { value: "deadline.approaching", label: "deadline.approaching" },
];

const ACTION_OPTIONS: { value: RuleActionType; label: string }[] = [
  { value: "notify_members", label: "notify_members" },
  { value: "add_tag",        label: "add_tag" },
  { value: "move_to_column", label: "move_to_column" },
];

const inputStyle = {
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
} as const;

function buildParams(
  action: RuleActionType,
  message: string,
  tag: string,
  columnId: string
): Record<string, string> {
  if (action === "notify_members") return { message };
  if (action === "add_tag")        return { tag };
  if (action === "move_to_column") return { column_id: columnId };
  return {};
}

interface AutomationRulesProps {
  workspaceId: string;
}

export default function AutomationRules({ workspaceId }: AutomationRulesProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState<RuleTrigger>("task.created");
  const [formAction, setFormAction] = useState<RuleActionType>("notify_members");
  const [formMessage, setFormMessage] = useState("");
  const [formTag, setFormTag] = useState("");
  const [formColumnId, setFormColumnId] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<AutomationRule[]>(
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

  useEffect(() => {
    if (formAction !== "move_to_column") return;
    if (columns.length > 0) return;
    let cancelled = false;
    setColumnsLoading(true);
    setColumnsError(null);
    api
      .get<{ board: { id: string; columns: BoardColumn[] } }>(
        `/api/v1/workspaces/${workspaceId}/board`
      )
      .then(({ board }) => {
        if (!cancelled) {
          setColumns(board.columns);
          if (board.columns.length > 0) {
            setFormColumnId(board.columns[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setColumnsError("Не удалось загрузить колонки");
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false);
      });
    return () => { cancelled = true; };
  }, [formAction, workspaceId, columns.length]);

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
    if (!formName.trim()) return;
    if (formAction === "move_to_column" && !formColumnId) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      await api.post(`/api/v1/workspaces/${workspaceId}/automation`, {
        name: formName.trim(),
        trigger: formTrigger,
        condition: null,
        action: {
          type: formAction,
          params: buildParams(formAction, formMessage, formTag, formColumnId),
        },
      });
      setFormName("");
      setFormTrigger("task.created");
      setFormAction("notify_members");
      setFormMessage("");
      setFormTag("");
      setFormColumnId("");
      await loadRules();
    } catch (e) {
      setCreateError(e instanceof ApiError ? `Ошибка создания: ${e.status}` : "Не удалось создать правило");
    } finally {
      setCreateLoading(false);
    }
  }

  const isCreateDisabled =
    createLoading ||
    !formName.trim() ||
    (formAction === "move_to_column" && !formColumnId);

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
          Automation Rules
        </p>
        {[1, 2].map((i) => (
          <div key={i} className="h-8 rounded mb-2 animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
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
        Automation Rules
      </p>

      {/* Список правил */}
      <div className="space-y-1 mb-4">
        {rules.length === 0 && (
          <p className="text-sm py-2" style={{ color: "rgba(255,255,255,0.45)" }}>Правил нет</p>
        )}

        {rules.map((rule) => {
          if (deletingId === rule.id) {
            return (
              <div key={rule.id} className="flex items-center gap-3 py-1 flex-wrap">
                <span className="text-sm flex-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {rule.name}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Удалить?</span>
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
            <div key={rule.id} className="flex items-center gap-3 py-1.5 group">
              <span className="text-sm font-medium w-40 truncate" style={{ color: "#fff" }}>
                {rule.name}
              </span>
              <span className="text-xs font-mono flex-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                {rule.trigger} → {rule.action.type}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={
                  rule.active
                    ? { background: "rgba(34,197,94,0.15)", color: "#4ADE80" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
                }
              >
                {rule.active ? "active" : "inactive"}
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

      {opError && (
        <p className="mb-3 text-xs" style={{ color: "#F87171" }}>{opError}</p>
      )}

      {/* Форма создания */}
      <div
        className="pt-4 space-y-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Новое правило</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Название</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            disabled={createLoading}
            placeholder="Например: Urgent → Notify"
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Триггер</label>
            <select
              value={formTrigger}
              onChange={(e) => setFormTrigger(e.target.value as RuleTrigger)}
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
              onChange={(e) => setFormAction(e.target.value as RuleActionType)}
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

        {/* Динамическое поле params */}
        {formAction === "notify_members" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Сообщение</label>
            <input
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              disabled={createLoading}
              placeholder="Текст уведомления"
              className="px-3 py-2 rounded-md text-sm outline-none"
              style={inputStyle}
            />
          </div>
        )}

        {formAction === "add_tag" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Тег</label>
            <input
              value={formTag}
              onChange={(e) => setFormTag(e.target.value)}
              disabled={createLoading}
              placeholder="urgent"
              className="px-3 py-2 rounded-md text-sm outline-none"
              style={inputStyle}
            />
          </div>
        )}

        {formAction === "move_to_column" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Колонка</label>
            {columnsLoading ? (
              <div
                className="h-9 rounded-md animate-pulse"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
            ) : columnsError ? (
              <p className="text-xs" style={{ color: "#F87171" }}>{columnsError}</p>
            ) : (
              <select
                value={formColumnId}
                onChange={(e) => setFormColumnId(e.target.value)}
                disabled={createLoading || columns.length === 0}
                className="px-3 py-2 rounded-md text-sm outline-none"
                style={inputStyle}
              >
                {columns.length === 0 ? (
                  <option value="">Нет доступных колонок</option>
                ) : (
                  columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))
                )}
              </select>
            )}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={isCreateDisabled}
          className="text-sm px-4 py-2 rounded-md transition-opacity"
          style={{
            background: "#3B82F6",
            color: "#fff",
            opacity: isCreateDisabled ? 0.5 : 1,
          }}
        >
          {createLoading ? "Создание..." : "Создать правило"}
        </button>

        {createError && (
          <p className="text-xs" style={{ color: "#F87171" }}>{createError}</p>
        )}
      </div>
    </div>
  );
}
