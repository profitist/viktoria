"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subtasksApi } from "@/lib/api";
import type { Subtask } from "@/lib/types";

interface SubtaskListProps {
  taskId: string;
  subtasks?: Subtask[];
  onItemsChange?: (items: Subtask[]) => void;
}

export default function SubtaskList({ taskId, subtasks: initialSubtasks, onItemsChange }: SubtaskListProps) {
  const [items, setItems] = useState<Subtask[]>(initialSubtasks ?? []);
  const [isLoading, setIsLoading] = useState(initialSubtasks === undefined);
  const [newTitle, setNewTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSubtasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await subtasksApi.getSubtasks(taskId);
      setItems(data);
      onItemsChange?.(data);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, onItemsChange]);

  useEffect(() => {
    if (initialSubtasks === undefined) {
      fetchSubtasks();
    }
  }, [fetchSubtasks, initialSubtasks]);

  function updateItems(fn: (prev: Subtask[]) => Subtask[]) {
    setItems(prev => {
      const next = fn(prev);
      onItemsChange?.(next);
      return next;
    });
  }

  async function handleToggle(subtask: Subtask) {
    const next = !subtask.is_done;
    updateItems(prev => prev.map(s => (s.id === subtask.id ? { ...s, is_done: next } : s)));
    try {
      await subtasksApi.updateSubtask(taskId, subtask.id, { is_done: next });
    } catch {
      updateItems(prev => prev.map(s => (s.id === subtask.id ? { ...s, is_done: !next } : s)));
    }
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title || isAdding) return;
    setIsAdding(true);
    try {
      const created = await subtasksApi.createSubtask(taskId, title);
      updateItems(prev => [...prev, created]);
      setNewTitle("");
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(subtask: Subtask) {
    setEditingId(subtask.id);
    setEditTitle(subtask.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
  }

  async function handleSaveEdit(subtask: Subtask) {
    const title = editTitle.trim();
    if (!title) return;

    cancelEdit();

    if (title === subtask.title) {
      return;
    }

    const previousTitle = subtask.title;
    updateItems(prev => prev.map(s => (s.id === subtask.id ? { ...s, title } : s)));

    try {
      const updated = await subtasksApi.updateSubtask(taskId, subtask.id, { title });
      updateItems(prev => prev.map(s => (s.id === subtask.id ? updated : s)));
    } catch {
      updateItems(prev => prev.map(s => (s.id === subtask.id ? { ...s, title: previousTitle } : s)));
    }
  }

  async function handleDelete(subtask: Subtask) {
    if (!window.confirm("Удалить подзадачу?")) {
      return;
    }

    let snapshot: Subtask[] = [];
    updateItems(prev => {
      snapshot = prev;
      return prev.filter(s => s.id !== subtask.id);
    });

    try {
      await subtasksApi.deleteSubtask(taskId, subtask.id);
    } catch {
      updateItems(() => snapshot);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {[1, 2].map(i => (
          <div
            key={i}
            style={{
              height: "22px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {items.map(subtask => (
        <div
          key={subtask.id}
          onMouseEnter={() => setHoveredId(subtask.id)}
          onMouseLeave={() => setHoveredId(current => (current === subtask.id ? null : current))}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}
        >
          <button
            type="button"
            onClick={() => handleToggle(subtask)}
            aria-label={subtask.is_done ? "Снять отметку с подзадачи" : "Отметить подзадачу выполненной"}
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              border: subtask.is_done ? "1.5px solid #3B82F6" : "1.5px solid rgba(255,255,255,0.2)",
              background: subtask.is_done ? "#3B82F6" : "transparent",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            {subtask.is_done && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {editingId === subtask.id ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSaveEdit(subtask);
                if (e.key === "Escape") cancelEdit();
              }}
              onBlur={() => cancelEdit()}
              style={{
                flex: 1,
                minWidth: 0,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "6px",
                outline: "none",
                fontSize: "13px",
                color: "rgba(255,255,255,0.86)",
                padding: "4px 6px",
              }}
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => startEdit(subtask)}
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                padding: 0,
                textAlign: "left",
                cursor: "text",
                fontSize: "13px",
                color: subtask.is_done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.80)",
                textDecoration: subtask.is_done ? "line-through" : "none",
                lineHeight: 1.4,
                transition: "color 150ms ease",
              }}
            >
              {subtask.title}
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              opacity: hoveredId === subtask.id || editingId === subtask.id ? 1 : 0,
              pointerEvents: hoveredId === subtask.id || editingId === subtask.id ? "auto" : "none",
              transition: "opacity 120ms ease",
            }}
          >
            <button
              type="button"
              onClick={() => startEdit(subtask)}
              aria-label="Редактировать подзадачу"
              style={{
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                color: "rgba(255,255,255,0.46)",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 20H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5C20.3284 4.32843 20.3284 5.67157 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(subtask)}
              aria-label="Удалить подзадачу"
              style={{
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                color: "rgba(248,113,113,0.72)",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M14 11V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          disabled={isAdding}
          placeholder="Добавить подзадачу..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            outline: "none",
            fontSize: "13px",
            color: "rgba(255,255,255,0.72)",
            padding: "4px 0",
          }}
        />
      </div>
    </div>
  );
}
