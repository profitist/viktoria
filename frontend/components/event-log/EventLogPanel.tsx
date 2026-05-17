"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useWs } from "@/contexts/WsContext";
import {
  FILTER_EVENT_TYPES,
  type AuditEntry,
  type EventType,
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
const HIGHLIGHT_MS = 2_000;

const EVENT_TYPES = new Set<string>([
  "task.created",
  "task.updated",
  "task.moved",
  "task.deleted",
  "comment.created",
  "attachment.created",
  "attachment.deleted",
  "member.added",
  "member.removed",
  "rule.fired",
]);

const FILTER_LABELS: Record<EventLogFilter, string> = {
  all: "Все",
  deleted: "Удалённые объекты",
  attachments: "Загруженные файлы",
  comments: "Общение по задачам",
};

export default function EventLogPanel({ workspaceId }: EventLogPanelProps) {
  const { init, on, off } = useWs();
  const [fallbackWorkspaceId, setFallbackWorkspaceId] = useState<string | null>(null);
  const resolvedWorkspaceId = workspaceId ?? fallbackWorkspaceId;
  const [activeFilter, setActiveFilter] = useState<EventLogFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const [highlightedEntryIds, setHighlightedEntryIds] = useState<Set<string>>(
    () => new Set()
  );
  const highlightTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (workspaceId) return;

    let cancelled = false;

    async function resolveWorkspace() {
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const workspaces = await api.get<WorkspaceSummary[]>("/api/v1/workspaces/me");
        if (cancelled) return;
        setFallbackWorkspaceId(workspaces[0]?.id ?? null);
        if (!workspaces.length) {
          setEntries([]);
          setHasMore(false);
          setError("Рабочее пространство не найдено");
        }
      } catch (err) {
        if (cancelled) return;
        setFallbackWorkspaceId(null);
        setEntries([]);
        setHasMore(false);
        setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    queueMicrotask(() => {
      void resolveWorkspace();
    });

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
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void loadEntries(0, "replace");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadEntries, resolvedWorkspaceId]);

  const queueHighlight = useCallback((entryId: string) => {
    setHighlightedEntryIds((current) => {
      const next = new Set(current);
      next.add(entryId);
      return next;
    });

    const timeoutId = setTimeout(() => {
      setHighlightedEntryIds((current) => {
        if (!current.has(entryId)) return current;
        const next = new Set(current);
        next.delete(entryId);
        return next;
      });
    }, HIGHLIGHT_MS);

    highlightTimersRef.current.push(timeoutId);
  }, []);

  const handleAuditEventCreated = useCallback(
    (params: Record<string, unknown>) => {
      const entry = auditEventCreatedToEntry(params);
      if (!entry || !matchesFilter(entry.event_type, activeFilter)) return;

      setEntries((current) => {
        if (current.some((item) => item.id === entry.id)) return current;
        return [entry, ...current];
      });
      queueHighlight(entry.id);
    },
    [activeFilter, queueHighlight]
  );

  useEffect(() => {
    if (!resolvedWorkspaceId) return;

    init(resolvedWorkspaceId);
    on("audit.event_created", handleAuditEventCreated);

    return () => {
      off("audit.event_created", handleAuditEventCreated);
    };
  }, [resolvedWorkspaceId, init, on, off, handleAuditEventCreated]);

  useEffect(() => {
    return () => {
      for (const timeoutId of highlightTimersRef.current) {
        clearTimeout(timeoutId);
      }
      highlightTimersRef.current = [];
    };
  }, []);

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
                  <div
                    key={entry.id}
                    className={`rounded-md transition-all duration-500 ${
                      highlightedEntryIds.has(entry.id)
                        ? "animate-pulse bg-sky-400/[0.08] shadow-[0_0_32px_rgba(56,189,248,0.18)] ring-1 ring-sky-300/40"
                        : "bg-transparent shadow-none ring-0"
                    }`}
                  >
                    <EventCard entry={entry} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EventTable
          entries={entries}
          highlightedEntryIds={highlightedEntryIds}
        />
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
function auditEventCreatedToEntry(
  params: Record<string, unknown>
): AuditEntry | null {
  const eventType = params["event_type"];
  const entityType = params["entity_type"];
  const entityId = params["entity_id"];
  const actorId = params["actor_id"];
  const actorName = params["actor_name"];
  const createdAt = params["created_at"];
  const boardId = params["board_id"];

  if (
    !isEventType(eventType) ||
    typeof entityId !== "string" ||
    typeof actorId !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }

  const normalizedEntityType =
    typeof entityType === "string" ? entityType : "task";
  const normalizedActorName =
    typeof actorName === "string" && actorName.trim()
      ? actorName
      : "Unknown";
  const normalizedBoardId = typeof boardId === "string" ? boardId : null;

  return {
    id: auditEntryId(params, eventType, entityId, createdAt),
    event_type: eventType,
    actor: {
      id: actorId,
      name: normalizedActorName,
    },
    task_id: normalizedEntityType === "task" ? entityId : null,
    task_title: null,
    board_id: normalizedBoardId,
    changes: [],
    created_at: createdAt,
  };
}

function auditEntryId(
  params: Record<string, unknown>,
  eventType: EventType,
  entityId: string,
  createdAt: string
): string {
  const id = params["id"];
  if (typeof id === "string" && id.length > 0) return id;
  return `ws:${createdAt}:${eventType}:${entityId}`;
}

function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && EVENT_TYPES.has(value);
}

function matchesFilter(eventType: EventType, filter: EventLogFilter): boolean {
  const allowedTypes = FILTER_EVENT_TYPES[filter];
  return allowedTypes.length === 0 || allowedTypes.includes(eventType);
}
