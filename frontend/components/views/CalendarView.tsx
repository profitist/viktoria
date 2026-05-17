"use client";

import { useEffect, useState } from "react";
import { ApiError, tasksApi } from "@/lib/api";
import type { Task, TaskFilters, TaskPriority } from "@/lib/types";
import FilterSortBar, {
  type FilterSortMember,
  type FilterSortTag,
  type FilterSortValue,
} from "./FilterSortBar";

export interface CalendarViewProps {
  workspaceId: string;
  boardId: string;
  members: FilterSortMember[];
  tags: FilterSortTag[];
  onTaskClick?: (task: Task) => void;
}

// ── constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
] as const;

const CHIP_STYLE: Record<TaskPriority, { bg: string; border: string; color: string }> = {
  low:      { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)",  color: "rgba(255,255,255,0.55)" },
  medium:   { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)", color: "#93C5FD" },
  high:     { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)", color: "#FCD34D" },
  critical: { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",  color: "#FCA5A5" },
};

const MAX_PER_DAY = 3;

// ── helpers ───────────────────────────────────────────────────────────────────

function buildDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  // Mon-based offsets: Mon=0 … Sun=6
  const startOffset = (first.getDay() + 6) % 7;
  const endOffset   = 6 - (last.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let d = 1 - startOffset; d <= last.getDate() + endOffset; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const m  = String(month + 1).padStart(2, "0");
  const ld = String(lastDay).padStart(2, "0");
  return {
    from: `${year}-${m}-01T00:00:00`,
    to:   `${year}-${m}-${ld}T23:59:59`,
  };
}

function groupTasks(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.deadline) continue;
    const k = task.deadline.slice(0, 10);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(task);
  }
  return map;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CalendarView({
  workspaceId,
  boardId,
  members,
  tags,
  onTaskClick,
}: CalendarViewProps) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [filterValue, setFilterValue] = useState<FilterSortValue>({ sort: "-created_at" });
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { from, to } = monthRange(year, month);
      const filters: TaskFilters = {
        board_id:      boardId,
        assignee_id:   filterValue.assignee_id,
        tag:           filterValue.tag,
        deadline_from: from,
        deadline_to:   to,
      };
      try {
        const data = await tasksApi.listTasksByDeadline(workspaceId, filters);
        if (!cancelled) setTasks(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId, boardId, year, month, filterValue]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const days    = buildDays(year, month);
  const byDay   = groupTasks(tasks);
  const todayKey = dateKey(today);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FilterSortBar
        value={filterValue}
        members={members}
        tags={tags}
        onChange={setFilterValue}
      />

      {/* Month navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.72)",
            borderRadius: "8px",
            padding: "6px 14px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          ←
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF" }}>
            {MONTH_NAMES[month]} {year}
          </span>
          {loading && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>загрузка…</span>
          )}
        </div>

        <button
          onClick={nextMonth}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.72)",
            borderRadius: "8px",
            padding: "6px 14px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          →
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "16px 20px",
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "10px",
            fontSize: "14px",
            color: "#FCA5A5",
          }}
        >
          {error}
        </div>
      )}

      {!error && (
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
          {/* Weekday header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "1px",
              marginBottom: "1px",
            }}
          >
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "4px 0 8px",
                }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "1px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              overflow: "hidden",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            {days.map((day) => {
              const key      = dateKey(day);
              const inMonth  = day.getMonth() === month;
              const isToday  = key === todayKey;
              const dayTasks = byDay.get(key) ?? [];
              const visible  = dayTasks.slice(0, MAX_PER_DAY);
              const overflow = dayTasks.length - visible.length;

              return (
                <div
                  key={key}
                  style={{
                    background: inMonth ? "#111111" : "#0d0d0d",
                    minHeight: "108px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  {/* Day number */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      fontSize: "12px",
                      fontWeight: isToday ? 600 : 400,
                      color: isToday
                        ? "#FFFFFF"
                        : inMonth
                        ? "rgba(255,255,255,0.5)"
                        : "rgba(255,255,255,0.2)",
                      background: isToday ? "#3B82F6" : "transparent",
                      flexShrink: 0,
                    }}
                  >
                    {day.getDate()}
                  </span>

                  {/* Task chips */}
                  {visible.map((task) => {
                    const cs = CHIP_STYLE[task.priority];
                    return (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick?.(task)}
                        style={{
                          background: cs.bg,
                          border: `1px solid ${cs.border}`,
                          color: cs.color,
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          cursor: onTaskClick ? "pointer" : "default",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {task.title}
                      </div>
                    );
                  })}

                  {/* Overflow badge */}
                  {overflow > 0 && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.55)",
                        paddingLeft: "2px",
                        flexShrink: 0,
                      }}
                    >
                      +{overflow} ещё
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
