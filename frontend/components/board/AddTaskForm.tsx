"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { ApiError } from "@/lib/api";
import type { TaskPriority } from "@/lib/types";

export interface AddTaskData {
  title: string;
  priority: TaskPriority;
  description?: string;
  deadline?: string;
}

interface AddTaskFormProps {
  onSubmit: (data: AddTaskData) => Promise<void>;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontFamily: "Space Grotesk, sans-serif",
  padding: "8px 12px",
  width: "100%",
  outline: "none",
  transition: "border-color 150ms ease",
};

function SectionLabel({ text }: { text: string }) {
  return (
    <p
      style={{
        fontSize: "11px",
        fontWeight: 500,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: "4px",
      }}
    >
      {text}
    </p>
  );
}

export default function AddTaskForm({ onSubmit, onCancel }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > 255) {
      setError("Слишком длинное название");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const data: AddTaskData = {
      title: trimmed,
      priority,
      description: description.trim() || undefined,
      deadline: deadline || undefined,
    };

    try {
      await onSubmit(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("Задача с таким названием уже есть в этой колонке");
      } else if ((e as Error).message.toLowerCase().includes("failed to fetch")) {
        setError("Нет соединения с сервером");
      } else {
        setError("Не удалось создать задачу. Попробуйте ещё раз");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onCancel();
  }

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Название задачи..."
          disabled={isSubmitting}
          style={{
            ...inputStyle,
            flex: 1,
            borderRadius: "8px",
            padding: "7px 10px",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? "Свернуть" : "Развернуть"}
          style={{
            width: "26px",
            height: "26px",
            flexShrink: 0,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.65)",
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        >
          {isExpanded ? "▴" : "▾"}
        </button>
      </div>

      {error && <p style={{ fontSize: "12px", color: "#FCA5A5", margin: "0 2px" }}>{error}</p>}

      {/* Expanded fields */}
      {isExpanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <SectionLabel text="Приоритет" />
            <div style={{ position: "relative" }}>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                disabled={isSubmitting}
                style={{ ...inputStyle, appearance: "none", paddingRight: "32px", cursor: "pointer" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="critical">CRITICAL</option>
              </select>
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.65)", pointerEvents: "none", fontSize: "11px" }}>▾</span>
            </div>
          </div>

          <div>
            <SectionLabel text="Описание (опционально)" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Добавить описание..."
              disabled={isSubmitting}
              style={{ ...inputStyle, minHeight: "72px", resize: "vertical", lineHeight: 1.5 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>

          <div>
            <SectionLabel text="Дедлайн (опционально)" />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isSubmitting}
              style={{ ...inputStyle, colorScheme: "dark" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 text-sm px-3 py-1.5 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          style={{ background: "#3B82F6" }}
          onMouseEnter={(e) => {
            if (canSubmit) e.currentTarget.style.background = "#2563EB";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#3B82F6";
          }}
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            "Добавить"
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="text-sm px-3 py-1.5 transition-colors disabled:opacity-50"
          style={{ color: "rgba(255,255,255,0.65)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.72)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
