"use client";

import { useState } from "react";
import type { TaskGroup as TaskGroupType } from "@/lib/my-tasks-api";
import TaskRow from "./TaskRow";

interface Props {
  group: TaskGroupType;
  boardNamesById: Record<string, string>;
  onToggleDone: (taskId: string, done: boolean) => void;
  onTaskClick: (taskId: string) => void;
  workspaceId: string;
}

const DEFAULT_EXPANDED: Record<string, boolean> = {
  important: true,
  inbox: true,
  done: false,
};

const DISABLED_ACTIONS = [
  { icon: "⚙", title: "Скоро" },
  { icon: "↕", title: "Скоро" },
  { icon: "+", title: "Скоро" },
];

export default function TaskGroup({
  group,
  boardNamesById,
  onToggleDone,
  onTaskClick,
}: Props) {
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED[group.key] ?? true);

  return (
    <div>
      {/* Header */}
      <div
        className="ui-hover"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: "8px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <path d="M4 2l4 4-4 4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.01em" }}>
          {group.label}
        </span>

        <span
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.55)",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "999px",
            padding: "1px 7px",
            fontWeight: 500,
          }}
        >
          {group.tasks.length}
        </span>

        <div style={{ flex: 1 }} />

        {DISABLED_ACTIONS.map(({ icon, title }) => (
          <button
            key={icon}
            title={title}
            disabled
            onClick={e => e.stopPropagation()}
            style={{
              width: "24px",
              height: "24px",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.12)",
              cursor: "not-allowed",
              fontSize: "13px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Task list */}
      {expanded && (
        <div style={{ paddingLeft: "4px" }}>
          {group.tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              boardName={boardNamesById[task.board_id]}
              onToggleDone={onToggleDone}
              onTaskClick={onTaskClick}
            />
          ))}
          {group.tasks.length === 0 && (
            <div style={{ padding: "4px 44px" }}>
              <button
                disabled
                title="Скоро"
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.18)",
                  cursor: "not-allowed",
                  fontSize: "13px",
                  padding: 0,
                }}
              >
                + Создать задачу
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
