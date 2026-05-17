"use client";

import { useEffect, useState } from "react";
import type { Task, DeadlineUrgency } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";

function SubtaskProgressBar({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100);
  const isComplete = done === total;
  const barColor = isComplete ? "#22C55E" : "rgba(255,255,255,0.25)";
  const fillColor = isComplete ? "#22C55E" : "#3B82F6";

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.40)" }}>
          {done}/{total}
        </span>
        <span style={{ fontSize: "11px", color: isComplete ? "#22C55E" : "rgba(255,255,255,0.40)" }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: "3px", borderRadius: "2px", background: barColor, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "2px",
            background: fillColor,
            transition: "width 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3.25 1.5v1M8.75 1.5v1M2 4.25h8M2.5 2.5h7A1.5 1.5 0 0 1 11 4v5A1.5 1.5 0 0 1 9.5 10.5h-7A1.5 1.5 0 0 1 1 9V4a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  onClick?: () => void;
  isDone?: boolean;
  onToggleDone?: () => Promise<void>;
}

const URGENCY_SHADOW: Record<DeadlineUrgency, string> = {
  none: "0 2px 12px rgba(0,0,0,0.4)",
  soon: "0 2px 12px rgba(0,0,0,0.4)",
  critical: "0 2px 12px rgba(0,0,0,0.4), 0 0 12px rgba(239,68,68,0.15)",
};

const DEADLINE_CHIP_CLASS: Record<DeadlineUrgency, string> = {
  none: "bg-white/[0.04] text-white/45",
  soon: "bg-yellow-50 text-yellow-600",
  critical: "bg-red-50 text-red-600",
};

function formatDeadline(deadline: string): string {
  const [year, month, day] = deadline.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return deadline;
  }

  const date = new Date(year, month - 1, day);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const diffDays = Math.round(
    (date.getTime() - todayStart.getTime()) / 86_400_000
  );

  if (diffDays === -1) return "Вчера";
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Завтра";

  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
}

export default function TaskCard({ task, isDragging, onClick, isDone = false, onToggleDone }: TaskCardProps) {
  const [optimisticDone, setOptimisticDone] = useState(isDone);

  useEffect(() => { setOptimisticDone(isDone); }, [isDone]);

  async function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !optimisticDone;
    setOptimisticDone(next);
    try {
      await onToggleDone?.();
    } catch {
      setOptimisticDone(!next);
    }
  }

  const isCritical = task.deadline_urgency === "critical";
  const deadlineClassName = [
    "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
    DEADLINE_CHIP_CLASS[task.deadline_urgency],
  ].join(" ");

  return (
    <div
      className="w-full p-3 cursor-grab select-none group transition-all duration-150"
      onClick={() => { if (!isDragging) onClick?.(); }}
      style={{
        position: "relative",
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: isCritical
          ? "2px solid #EF4444"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "18px",
        boxShadow: URGENCY_SHADOW[task.deadline_urgency],
        opacity: isDragging ? 0.5 : optimisticDone ? 0.65 : 1,
        transform: isDragging ? "scale(1.02) rotate(1deg)" : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
          if (isCritical) {
            e.currentTarget.style.borderLeftColor = "#EF4444";
          }
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.6)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = URGENCY_SHADOW[task.deadline_urgency];
        e.currentTarget.style.transform = isDragging ? "scale(1.02) rotate(1deg)" : "";
        e.currentTarget.style.borderLeft = isCritical
          ? "2px solid #EF4444"
          : "1px solid rgba(255,255,255,0.08)";
      }}
    >
      {onToggleDone && (
        <button
          type="button"
          aria-label={optimisticDone ? "Снять отметку" : "Отметить выполненным"}
          onClick={handleCheckboxClick}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "8px",
            right: "10px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            border: optimisticDone ? "none" : "1.5px solid rgba(255,255,255,0.22)",
            background: optimisticDone ? "#22C55E" : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transition: "background 150ms, border-color 150ms",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!optimisticDone) {
              e.currentTarget.style.borderColor = "rgba(34,197,94,0.6)";
              e.currentTarget.style.background = "rgba(34,197,94,0.12)";
            }
          }}
          onMouseLeave={(e) => {
            if (!optimisticDone) {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          {optimisticDone && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      <p
        className="text-sm font-medium leading-snug"
        style={{
          color: optimisticDone ? "rgba(255,255,255,0.45)" : "#FFFFFF",
          textDecoration: optimisticDone ? "line-through" : "none",
          paddingRight: onToggleDone ? "24px" : undefined,
        }}
      >
        {task.title}
      </p>

      {task.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
          {task.tags.map(tag => (
            <span
              key={tag.id}
              style={{
                fontSize: "11px",
                fontWeight: 500,
                padding: "2px 7px",
                borderRadius: "999px",
                background: tag.color ? `${tag.color}22` : "rgba(59,130,246,0.12)",
                border: `1px solid ${tag.color ? `${tag.color}40` : "rgba(59,130,246,0.25)"}`,
                color: tag.color ?? "#93C5FD",
                whiteSpace: "nowrap",
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {task.assignee_id !== null && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="4.5" r="2" fill="rgba(255,255,255,0.45)" />
                <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {task.deadline && (
            <div className={deadlineClassName}>
              <CalendarIcon />
              {formatDeadline(task.deadline)}
            </div>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.subtask_progress && task.subtask_progress.total_count > 0 && (
        <SubtaskProgressBar
          done={task.subtask_progress.done_count}
          total={task.subtask_progress.total_count}
        />
      )}
    </div>
  );
}
