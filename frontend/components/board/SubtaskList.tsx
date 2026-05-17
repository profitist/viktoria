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
        <label
          key={subtask.id}
          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "4px 0" }}
        >
          <input
            type="checkbox"
            checked={subtask.is_done}
            onChange={() => handleToggle(subtask)}
            style={{ display: "none" }}
          />
          <div
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
              transition: "all 150ms ease",
            }}
          >
            {subtask.is_done && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: "13px",
              color: subtask.is_done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.80)",
              textDecoration: subtask.is_done ? "line-through" : "none",
              lineHeight: 1.4,
              transition: "color 150ms ease",
            }}
          >
            {subtask.title}
          </span>
        </label>
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
