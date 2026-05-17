"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { ApiError, tasksApi } from "@/lib/api";
import type { DeadlineUrgency, Paginated, SortKey, Task, TaskFilters, TaskPriority } from "@/lib/types";
import FilterSortBar, {
  type FilterSortMember,
  type FilterSortTag,
  type FilterSortValue,
} from "./FilterSortBar";

const PAGE_SIZES = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

export interface TableViewProps {
  workspaceId: string;
  boardId: string;
  members: FilterSortMember[];
  tags: FilterSortTag[];
  onTaskClick?: (task: Task) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year.slice(2)}`;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  critical: "CRIT",
};

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; color: string }> = {
  low: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" },
  medium: { bg: "rgba(59,130,246,0.15)", color: "#93C5FD" },
  high: { bg: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  critical: { bg: "rgba(239,68,68,0.15)", color: "#FCA5A5" },
};

const DEADLINE_COLOR: Record<DeadlineUrgency, string> = {
  none: "rgba(255,255,255,0.72)",
  soon: "#FCD34D",
  critical: "#FCA5A5",
};

// ── sub-components ────────────────────────────────────────────────────────────

interface ColHeaderProps {
  label: string;
  asc: SortKey;
  desc: SortKey;
  activeSort: SortKey | undefined;
  onSort: (asc: SortKey, desc: SortKey) => void;
  width?: string;
}

function SortableColHeader({ label, asc, desc, activeSort, onSort, width }: ColHeaderProps) {
  const isActive = activeSort === asc || activeSort === desc;
  const icon = !isActive ? "↕" : activeSort === asc ? "↑" : "↓";

  return (
    <th
      onClick={() => onSort(asc, desc)}
      style={{
        width,
        padding: "10px 12px",
        textAlign: "left",
        fontSize: "11px",
        fontWeight: 500,
        color: isActive ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.35)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        transition: "color 120ms",
      }}
    >
      {label}{" "}
      <span style={{ opacity: isActive ? 1 : 0.5, fontSize: "10px" }}>{icon}</span>
    </th>
  );
}

function StaticColHeader({ label, width }: { label: string; width?: string }) {
  return (
    <th
      style={{
        width,
        padding: "10px 12px",
        textAlign: "left",
        fontSize: "11px",
        fontWeight: 500,
        color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {label}
    </th>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i}>
          {[280, 120, 80, 140, 90, 90].map((w, j) => (
            <td key={j} style={{ padding: "12px" }}>
              <div
                style={{
                  height: "14px",
                  width: `${Math.round(w * 0.75)}px`,
                  maxWidth: "100%",
                  borderRadius: "4px",
                  background: "rgba(255,255,255,0.06)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <tr>
      <td colSpan={6}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            padding: "60px 20px",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="8" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
            <rect x="4" y="14" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
            <rect x="4" y="20" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
          </svg>
          <span style={{ fontSize: "14px" }}>Нет задач</span>
        </div>
      </td>
    </tr>
  );
}

interface TaskRowProps {
  task: Task;
  members: FilterSortMember[];
  onClick: () => void;
  isOdd: boolean;
}

function TaskRow({ task, members, onClick, isOdd }: TaskRowProps) {
  const [hovered, setHovered] = useState(false);
  const assignee = members.find((m) => m.id === task.assignee_id);
  const ps = PRIORITY_STYLE[task.priority];
  const deadlineColor = DEADLINE_COLOR[task.deadline_urgency];
  const visibleTags = task.tags.slice(0, 2);
  const hiddenCount = task.tags.length - visibleTags.length;

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? "rgba(255,255,255,0.04)"
          : isOdd
          ? "rgba(255,255,255,0.015)"
          : "transparent",
        cursor: "pointer",
        transition: "background 100ms",
      }}
    >
      {/* Title */}
      <td
        style={{
          padding: "12px",
          fontSize: "14px",
          color: "#FFFFFF",
          fontWeight: 500,
          maxWidth: "280px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {task.title}
      </td>

      {/* Assignee */}
      <td
        style={{
          padding: "12px",
          fontSize: "13px",
          color: assignee ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          whiteSpace: "nowrap",
        }}
      >
        {assignee ? assignee.name : "—"}
      </td>

      {/* Priority */}
      <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span
          style={{
            display: "inline-block",
            background: ps.bg,
            color: ps.color,
            fontSize: "11px",
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: "999px",
            letterSpacing: "0.04em",
          }}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
      </td>

      {/* Tags */}
      <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "nowrap" }}>
          {task.tags.length === 0 ? (
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>—</span>
          ) : (
            <>
              {visibleTags.map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    display: "inline-block",
                    background: tag.color ? `${tag.color}22` : "rgba(59,130,246,0.12)",
                    border: `1px solid ${tag.color ? `${tag.color}55` : "rgba(59,130,246,0.25)"}`,
                    color: tag.color ?? "#93C5FD",
                    fontSize: "11px",
                    padding: "1px 7px",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                  +{hiddenCount}
                </span>
              )}
            </>
          )}
        </div>
      </td>

      {/* Deadline */}
      <td
        style={{
          padding: "12px",
          fontSize: "13px",
          color: task.deadline ? deadlineColor : "rgba(255,255,255,0.3)",
          fontWeight: task.deadline_urgency === "critical" ? 500 : 400,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(task.deadline)}
      </td>

      {/* Created */}
      <td
        style={{
          padding: "12px",
          fontSize: "13px",
          color: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(task.created_at)}
      </td>
    </tr>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: PageSize;
  onPage: (p: number) => void;
  onPageSize: (s: PageSize) => void;
}

function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }: PaginationProps) {
  const btnStyle = (disabled: boolean): CSSProperties => ({
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.72)",
    borderRadius: "8px",
    padding: "6px 14px",
    fontSize: "13px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 120ms",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          style={btnStyle(page <= 1)}
        >
          ← Назад
        </button>
        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
          Страница {page} из {totalPages || 1}
          <span style={{ marginLeft: "8px", opacity: 0.6 }}>({total} задач)</span>
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          style={btnStyle(page >= totalPages)}
        >
          Вперёд →
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Показывать
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value) as PageSize)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.72)",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "13px",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function TableView({ workspaceId, boardId, members, tags, onTaskClick }: TableViewProps) {
  const [filterValue, setFilterValue] = useState<FilterSortValue>({ sort: "-created_at" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [result, setResult] = useState<Paginated<Task> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const filters: TaskFilters = {
        board_id: boardId,
        assignee_id: filterValue.assignee_id,
        tag: filterValue.tag,
      };
      try {
        const data = await tasksApi.listTasksPaged(
          workspaceId,
          filters,
          filterValue.sort,
          page,
          pageSize
        );
        if (!cancelled) setResult(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId, boardId, filterValue, page, pageSize]);

  function handleFilterChange(next: FilterSortValue) {
    setFilterValue(next);
    setPage(1);
  }

  function handleColSort(asc: SortKey, desc: SortKey) {
    const nextSort = filterValue.sort === asc ? desc : asc;
    setFilterValue((prev) => ({ ...prev, sort: nextSort }));
    setPage(1);
  }

  function handlePageSize(size: PageSize) {
    setPageSize(size);
    setPage(1);
  }

  const totalPages = result ? Math.ceil(result.total / pageSize) : 1;
  const showSkeleton = isLoading && result === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FilterSortBar
        value={filterValue}
        members={members}
        tags={tags}
        onChange={handleFilterChange}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 0" }}>
        {error && (
          <div
            style={{
              margin: "16px 0",
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
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              opacity: isLoading && result !== null ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr>
                <SortableColHeader
                  label="Название"
                  asc="title"
                  desc="-title"
                  activeSort={filterValue.sort}
                  onSort={handleColSort}
                />
                <StaticColHeader label="Исполнитель" />
                <SortableColHeader
                  label="Приоритет"
                  asc="priority"
                  desc="-priority"
                  activeSort={filterValue.sort}
                  onSort={handleColSort}
                />
                <StaticColHeader label="Теги" />
                <SortableColHeader
                  label="Дедлайн"
                  asc="deadline"
                  desc="-deadline"
                  activeSort={filterValue.sort}
                  onSort={handleColSort}
                />
                <SortableColHeader
                  label="Создана"
                  asc="created_at"
                  desc="-created_at"
                  activeSort={filterValue.sort}
                  onSort={handleColSort}
                />
              </tr>
            </thead>
            <tbody>
              {showSkeleton && <SkeletonRows />}
              {!showSkeleton && result?.items.length === 0 && <EmptyState />}
              {!showSkeleton &&
                result?.items.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    members={members}
                    onClick={() => onTaskClick?.(task)}
                    isOdd={i % 2 === 1}
                  />
                ))}
            </tbody>
          </table>
        )}
      </div>

      {result !== null && !error && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={result.total}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={handlePageSize}
        />
      )}
    </div>
  );
}
