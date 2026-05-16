"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subtasksApi } from "@/lib/api";
import type { Subtask } from "@/lib/types";

interface SubtaskListProps {
  taskId: string;
  subtasks?: Subtask[];
}

export default function SubtaskList({ taskId, subtasks: initialSubtasks }: SubtaskListProps) {
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
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (initialSubtasks === undefined) {
      fetchSubtasks();
    }
  }, [fetchSubtasks, initialSubtasks]);

  async function handleToggle(subtask: Subtask) {
    const next = !subtask.is_done;
    setItems(prev =>
      prev.map(s => (s.id === subtask.id ? { ...s, is_done: next } : s))
    );
    try {
      await subtasksApi.updateSubtask(taskId, subtask.id, { is_done: next });
    } catch {
      await fetchSubtasks();
    }
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title || isAdding) return;
    setIsAdding(true);
    try {
      const created = await subtasksApi.createSubtask(taskId, title);
      setItems(prev => [...prev, created]);
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
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            padding: "3px 0",
          }}
        >
          <input
            type="checkbox"
            checked={subtask.is_done}
            onChange={() => handleToggle(subtask)}
            style={{ accentColor: "#3B82F6", width: "14px", height: "14px", flexShrink: 0, cursor: "pointer" }}
          />
          <span
            style={{
              fontSize: "13px",
              color: subtask.is_done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.80)",
              textDecoration: subtask.is_done ? "line-through" : "none",
              lineHeight: 1.4,
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
