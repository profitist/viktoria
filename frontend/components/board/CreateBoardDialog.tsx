"use client";

import { type FormEvent, useState } from "react";

import { createBoard } from "@/lib/board-api";
import type { BoardMeta } from "@/lib/types";

interface Props {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (board: BoardMeta) => void;
}

export function CreateBoardDialog({
  workspaceId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [withDefaultColumns, setWithDefaultColumns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setWithDefaultColumns(true);
    setError(null);
    setIsSubmitting(false);
  }

  function closeDialog() {
    if (isSubmitting) return;
    resetForm();
    onOpenChange(false);
  }

  if (!open) return null;

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const board = await createBoard(workspaceId, {
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        with_default_columns: withDefaultColumns,
      });
      onCreated(board);
      resetForm();
      onOpenChange(false);
    } catch {
      setError("Не удалось создать доску");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
      role="presentation"
      onMouseDown={closeDialog}
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Новая доска"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5">
          <h3 className="text-base font-medium text-white">Новая доска</h3>
          <p className="mt-1 text-sm text-white/45">
            Создайте доску для отдельного потока работы.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white/45">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
              autoFocus
              placeholder="Sprint 1"
              className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25 disabled:cursor-wait disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white/45">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              placeholder="Optional"
              rows={3}
              className="w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25 disabled:cursor-wait disabled:opacity-60"
            />
          </div>

          <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={withDefaultColumns}
              onChange={(event) => setWithDefaultColumns(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-blue-500 disabled:cursor-wait disabled:opacity-60"
            />
            <span>Создать дефолтные колонки (To Do / In Progress / Done)</span>
          </label>

          {error !== null && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={isSubmitting}
              className="h-9 rounded-md border border-white/10 px-3 text-sm text-white/65 transition-colors hover:bg-white/[0.04] disabled:cursor-wait disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !trimmedName}
              className="h-9 rounded-md bg-blue-500 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
