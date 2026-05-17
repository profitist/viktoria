"use client";

import type { MyTask } from "@/lib/my-tasks-api";

interface Props {
  task: MyTask;
  onToggleDone?: (taskId: string, done: boolean) => void;
  onTaskClick?: (taskId: string) => void;
}

const PRIORITY_DOT: Record<MyTask["priority"], string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#3B82F6",
  low: "#6B7280",
};

const URGENCY_COLOR: Record<MyTask["deadline_urgency"], string> = {
  none: "rgba(255,255,255,0.3)",
  soon: "#FCD34D",
  critical: "#FCA5A5",
};

const deadlineFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export default function TaskRow({ task, onToggleDone, onTaskClick }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 12px",
        borderRadius: "8px",
        transition: "background 150ms",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleDone?.(task.id, !task.is_done)}
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: task.is_done ? "none" : "1.5px solid rgba(255,255,255,0.22)",
          background: task.is_done ? "#22C55E" : "transparent",
          flexShrink: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 150ms",
          padding: 0,
        }}
        onMouseEnter={e => { if (!task.is_done) e.currentTarget.style.borderColor = "#22C55E"; }}
        onMouseLeave={e => { if (!task.is_done) e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
      >
        {task.is_done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Priority dot */}
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: PRIORITY_DOT[task.priority],
          flexShrink: 0,
        }}
      />

      {/* Title */}
      <span
        onClick={() => onTaskClick?.(task.id)}
        style={{
          flex: 1,
          fontSize: "14px",
          color: task.is_done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)",
          textDecoration: task.is_done ? "line-through" : "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          transition: "color 150ms",
        }}
        onMouseEnter={e => { if (!task.is_done) e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.color = task.is_done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)"; }}
      >
        {task.title}
      </span>

      {/* Board path */}
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap", flexShrink: 0 }}>
        {truncate(task.board_name, 14)}
      </span>

      {/* Deadline */}
      {task.deadline && (
        <span
          style={{
            fontSize: "12px",
            color: URGENCY_COLOR[task.deadline_urgency],
            whiteSpace: "nowrap",
            flexShrink: 0,
            fontWeight: task.deadline_urgency === "critical" ? 500 : undefined,
          }}
        >
          📅 {deadlineFormatter.format(new Date(task.deadline))}
        </span>
      )}
    </div>
  );
}
