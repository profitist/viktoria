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
    <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Название задачи..."
        disabled={isSubmitting}
        className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:border-blue-400 disabled:bg-gray-50"
      />
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
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
          className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
