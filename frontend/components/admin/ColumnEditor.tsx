"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Column } from "@/lib/types";

interface ColumnEditorProps {
  workspaceId: string;
}

export default function ColumnEditor({ workspaceId }: ColumnEditorProps) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);
  const renameSubmittingRef = useRef(false);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { board } = await api.get<{ board: { id: string; columns: Column[] } }>(
        `/api/v1/workspaces/${workspaceId}/board`
      );
      setBoardId(board.id);
      setColumns([...board.columns].sort((a, b) => a.position - b.position));
    } catch (e) {
      setError(e instanceof ApiError ? `Ошибка ${e.status}` : "Не удалось загрузить доску");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  function startEdit(col: Column) {
    setEditingId(col.id);
    setEditingName(col.name);
    setOriginalName(col.name);
    setOpError(null);
  }

  function cancelEdit() {
    renameSubmittingRef.current = false;
    setEditingId(null);
    setEditingName("");
    setOriginalName("");
  }

  async function submitRename() {
    if (renameSubmittingRef.current || !boardId || !editingId) return;
    renameSubmittingRef.current = true;
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === originalName) {
      cancelEdit();
      return;
    }
    setOpLoading(true);
    setOpError(null);
    try {
      await api.patch(`/api/v1/boards/${boardId}/columns/${editingId}`, { name: trimmed });
      cancelEdit();
      await loadBoard();
    } catch (e) {
      setOpError(e instanceof ApiError ? `Ошибка переименования: ${e.status}` : "Не удалось переименовать");
    } finally {
      setOpLoading(false);
    }
  }

  async function confirmDelete() {
    if (!boardId || !deletingId) return;
    setOpLoading(true);
    setOpError(null);
    try {
      await api.delete(`/api/v1/boards/${boardId}/columns/${deletingId}`);
      setDeletingId(null);
      await loadBoard();
    } catch (e) {
      setOpError(e instanceof ApiError ? `Ошибка удаления: ${e.status}` : "Не удалось удалить");
      setDeletingId(null);
    } finally {
      setOpLoading(false);
    }
  }

  async function handleAdd() {
    if (!boardId || !addName.trim()) return;
    setAddLoading(true);
    setOpError(null);
    try {
      await api.post(`/api/v1/boards/${boardId}/columns`, { name: addName.trim() });
      setAddName("");
      await loadBoard();
    } catch (e) {
      setOpError(e instanceof ApiError ? `Ошибка создания: ${e.status}` : "Не удалось создать колонку");
    } finally {
      setAddLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
          Columns
        </p>
        {[1, 2, 3].map((i) => (
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
        className="rounded-xl p-6 mb-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-sm mb-3" style={{ color: "#F87171" }}>{error}</p>
        <button
          onClick={loadBoard}
          className="text-sm px-3 py-1.5 rounded-md transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
        Columns
      </p>

      <div className="space-y-1 mb-4">
        {columns.length === 0 && (
          <p className="text-sm py-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Колонок нет
          </p>
        )}

        {columns.map((col) => {
          if (editingId === col.id) {
            return (
              <div key={col.id} className="flex items-center gap-2 py-1">
                <input
                  ref={editInputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  onBlur={submitRename}
                  disabled={opLoading}
                  className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                  }}
                />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Enter / Esc
                </span>
              </div>
            );
          }

          if (deletingId === col.id) {
            return (
              <div key={col.id} className="flex items-center gap-3 py-1 flex-wrap">
                <span className="text-sm flex-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {col.name}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Удалить колонку?
                </span>
                <button
                  onClick={confirmDelete}
                  disabled={opLoading}
                  className="text-xs px-3 py-1 rounded-md transition-colors"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}
                >
                  Подтвердить
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  disabled={opLoading}
                  className="text-xs px-3 py-1 rounded-md transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
                >
                  Отмена
                </button>
              </div>
            );
          }

          return (
            <div key={col.id} className="flex items-center gap-2 py-1 group">
              <span className="flex-1 text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
                {col.name}
              </span>
              <button
                onClick={() => startEdit(col)}
                disabled={opLoading}
                className="text-xs px-2.5 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              >
                Rename
              </button>
              <button
                onClick={() => { setDeletingId(col.id); setOpError(null); }}
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
        className="pt-4 flex gap-2 items-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Название колонки"
          disabled={addLoading}
          className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
          }}
        />
        <button
          onClick={handleAdd}
          disabled={addLoading || !addName.trim()}
          className="text-sm px-4 py-1.5 rounded-md transition-opacity"
          style={{
            background: "#3B82F6",
            color: "#fff",
            opacity: addLoading || !addName.trim() ? 0.5 : 1,
          }}
        >
          {addLoading ? "..." : "+ Добавить"}
        </button>
      </div>

      {opError && (
        <p className="mt-3 text-xs" style={{ color: "#F87171" }}>{opError}</p>
      )}
    </div>
  );
}
