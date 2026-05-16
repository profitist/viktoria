"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { ApiError } from "@/lib/api";

interface AddTaskFormProps {
  onSubmit: (title: string) => Promise<void>;
  onCancel: () => void;
}

export default function AddTaskForm({ onSubmit, onCancel }: AddTaskFormProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > 255) {
      setError("Слишком длинное название");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmed);
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

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onCancel();
  }

  const canSubmit = value.trim().length > 0 && !isSubmitting;

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Название задачи..."
        disabled={isSubmitting}
        className="w-full text-sm px-2 py-1.5 rounded-lg outline-none transition-all disabled:opacity-50"
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#fff",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
      />
      {error && <p className="text-xs text-red-400 mt-1 px-1">{error}</p>}
      <div className="flex gap-2 mt-2">
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
          style={{ color: "rgba(255,255,255,0.45)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.72)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
