"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "@/lib/api";
import {
  FILTER_EVENT_TYPES,
  type AuditEntry,
  type EventLogFilter,
  getAuditLog,
  groupByDate,
} from "@/lib/event-log-api";

import { EventCard } from "./EventCard";
import { EventTable } from "./EventTable";

type ViewMode = "cards" | "table";

interface EventLogPanelProps {
  workspaceId?: string;
}

interface WorkspaceSummary {
  id: string;
}

const PAGE_SIZE = 50;

const FILTER_LABELS: Record<EventLogFilter, string> = {
  all: "Все",
  deleted: "Удалённые объекты",
  attachments: "Загруженные файлы",
  comments: "Общение по задачам",
};

export default function EventLogPanel({ workspaceId }: EventLogPanelProps) {
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState<string | null>(
    workspaceId ?? null
  );
  const [activeFilter, setActiveFilter] = useState<EventLogFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [resolveAttempt, setResolveAttempt] = useState(0);

  useEffect(() => {
    if (workspaceId) {
      setResolvedWorkspaceId(workspaceId);
      return;
    }

    let cancelled = false;

    async function resolveWorkspace() {
      setLoading(true);
      setError(null);

      try {
        const workspaces = await api.get<WorkspaceSummary[]>("/api/v1/workspaces/me");
        if (cancelled) return;
        setResolvedWorkspaceId(workspaces[0]?.id ?? null);
        if (!workspaces.length) {
          setEntries([]);
          setHasMore(false);
          setError("Рабочее пространство не найдено");
        }
      } catch (err) {
        if (cancelled) return;
        setResolvedWorkspaceId(null);
        setEntries([]);
        setHasMore(false);
        setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolveWorkspace();

    return () => {
      cancelled = true;
    };
  }, [resolveAttempt, workspaceId]);

  const loadEntries = useCallback(
    async (offset: number, mode: "replace" | "append") => {
      if (!resolvedWorkspaceId) return;

      if (mode === "replace") {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const next = await getAuditLog(resolvedWorkspaceId, {
          event_type: FILTER_EVENT_TYPES[activeFilter],
          limit: PAGE_SIZE,
          offset,
        });
        setEntries((prev) => (mode === "replace" ? next : [...prev, ...next]));
        setHasMore(next.length === PAGE_SIZE);
      } catch (err) {
        setError(errorMessage(err));
        if (mode === "replace") {
          setEntries([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeFilter, resolvedWorkspaceId]
  );

  useEffect(() => {
    if (!resolvedWorkspaceId) return;
    void loadEntries(0, "replace");
  }, [loadEntries, resolvedWorkspaceId]);

  const groupedEntries = useMemo(
    () => Array.from(groupByDate(entries)),
    [entries]
  );

  const handleRetry = () => {
    if (resolvedWorkspaceId) {
      void loadEntries(0, "replace");
    } else {
      setResolveAttempt((attempt) => attempt + 1);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs activeFilter={activeFilter} onChange={setActiveFilter} />
        <Toolbar viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={handleRetry} />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : viewMode === "cards" ? (
        <div className="space-y-6">
          {groupedEntries.map(([date, items]) => (
            <section key={date} className="space-y-3">
              <h2 className="text-sm font-medium text-white/45">{date}</h2>
              <div className="space-y-3">
                {items.map((entry) => (
                  <EventCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EventTable entries={entries} />
      )}

      {!loading && !error && entries.length > 0 && hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadEntries(entries.length, "append")}
            className="inline-flex h-10 items-center rounded-md border border-white/10 bg-transparent px-4 text-sm font-medium text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Загрузка..." : "Загрузить ещё"}
          </button>
        </div>
      )}
    </section>
  );
}

function Tabs({
  activeFilter,
  onChange,
}: {
  activeFilter: EventLogFilter;
  onChange: (filter: EventLogFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(FILTER_LABELS) as EventLogFilter[]).map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`h-9 rounded-md border px-3 text-sm transition-colors ${
            activeFilter === filter
              ? "border-white/22 bg-white/[0.08] text-white"
              : "border-white/10 bg-transparent text-white/55 hover:border-white/18 hover:bg-white/[0.04] hover:text-white/82"
          }`}
        >
          {FILTER_LABELS[filter]}
        </button>
      ))}
    </div>
  );
}

function Toolbar({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-white/10">
        <ViewButton
          active={viewMode === "cards"}
          label="Карточки"
          icon="≡"
          onClick={() => onViewModeChange("cards")}
        />
        <ViewButton
          active={viewMode === "table"}
          label="Таблица"
          icon="☰"
          onClick={() => onViewModeChange("table")}
        />
      </div>
      <button
        type="button"
        className="h-9 rounded-md border border-white/10 bg-transparent px-3 text-sm text-white/55 transition-colors hover:border-white/18 hover:bg-white/[0.04] hover:text-white/82"
      >
        Фильтрация событий ▼
      </button>
    </div>
  );
}

function ViewButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 text-sm transition-colors ${
        active
          ? "bg-white/[0.08] text-white"
          : "bg-transparent text-white/50 hover:bg-white/[0.04] hover:text-white/82"
      }`}
    >
      <span aria-hidden="true" className="mr-2">
        {icon}
      </span>
      {label}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-md border border-white/10 bg-white/[0.035]"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-white/10 bg-[#111111] px-4 py-12 text-center text-sm text-white/38">
      Событий пока нет
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-md border border-red-400/20 bg-red-500/[0.06] px-4 py-5">
      <div className="text-sm font-medium text-red-100">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 h-9 rounded-md border border-red-300/20 px-3 text-sm text-red-100 transition-colors hover:bg-red-300/[0.08]"
      >
        Повторить
      </button>
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Лента событий недоступна";
    if (err.status === 401) return "Нужна авторизация";
    return err.message;
  }

  const message = err instanceof Error ? err.message : "";
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Нет соединения с сервером";
  }
  return "Не удалось загрузить события";
}
