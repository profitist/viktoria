import Link from "next/link";

import {
  type AuditEntry,
  type EventType,
  eventTypeLabel,
} from "@/lib/event-log-api";

interface EventCardProps {
  entry: AuditEntry;
}

const ICON_COLOR: Record<EventType, string> = {
  "task.created": "#86EFAC",
  "task.updated": "#93C5FD",
  "task.moved": "#C4B5FD",
  "task.deleted": "#FCA5A5",
  "comment.created": "#FCD34D",
  "attachment.created": "#93C5FD",
  "attachment.deleted": "#FCA5A5",
  "member.added": "#86EFAC",
  "member.removed": "#FCA5A5",
  "rule.fired": "#FCD34D",
};

export function EventCard({ entry }: EventCardProps) {
  const taskHref =
    entry.board_id && entry.task_id
      ? `/board/${entry.board_id}?task_id=${entry.task_id}`
      : null;
  const taskTitle = entry.task_title ?? "Задача";
  const details = eventDetails(entry);

  return (
    <article className="rounded-md border border-white/10 bg-[#111111] px-4 py-3 transition-colors hover:bg-white/[0.035]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <time className="shrink-0 text-xs tabular-nums text-white/35">
            {formatTime(entry.created_at)}
          </time>
          <EventIcon type={entry.event_type} />
          <span className="truncate text-sm font-medium text-white/85">
            {eventTypeLabel(entry.event_type)}
          </span>
        </div>

        <Actor actor={entry.actor} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 pl-0 sm:pl-[72px]">
        {taskHref ? (
          <Link
            href={taskHref}
            className="min-w-0 truncate text-sm font-medium text-blue-300 transition-colors hover:text-blue-200"
          >
            {taskTitle}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-sm font-medium text-white/72">
            {taskTitle}
          </span>
        )}

        {taskHref && (
          <Link
            href={taskHref}
            className="text-xs text-white/38 transition-colors hover:text-white/72"
          >
            ↗ Перейти к задаче
          </Link>
        )}

        {entry.event_type === "task.deleted" && (
          <button
            type="button"
            disabled
            title="Скоро"
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/28 disabled:cursor-not-allowed"
          >
            Восстановить задачу
          </button>
        )}
      </div>

      {details && (
        <div className="mt-3 rounded-md bg-white/[0.035] px-3 py-2 text-sm text-white/55">
          {details}
        </div>
      )}
    </article>
  );
}

function EventIcon({ type }: { type: EventType }) {
  const color = ICON_COLOR[type];
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  return (
    <span className="shrink-0" style={{ color }}>
      {type === "task.moved" ? (
        <svg {...common}>
          <path d="M4 12h10" />
          <path d="M10 6l6 6-6 6" />
          <path d="M20 5v14" />
        </svg>
      ) : type === "task.deleted" || type === "attachment.deleted" ? (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      ) : type === "task.created" || type === "member.added" ? (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      ) : type === "comment.created" ? (
        <svg {...common}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
      ) : (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      )}
    </span>
  );
}

function Actor({ actor }: { actor: AuditEntry["actor"] }) {
  const initial = actor.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="flex shrink-0 items-center gap-2">
      {actor.avatar_url ? (
        <img
          src={actor.avatar_url}
          alt=""
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/72">
          {initial}
        </div>
      )}
      <span className="max-w-[120px] truncate text-xs text-white/55">
        {actor.name}
      </span>
    </div>
  );
}

function eventDetails(entry: AuditEntry): string | null {
  if (entry.event_type === "task.moved") {
    const from =
      changeValue(entry, "from_column_name") ??
      changeValue(entry, "from_column_id") ??
      changeValue(entry, "from_board_id");
    const to =
      changeValue(entry, "column_name") ??
      changeValue(entry, "column_id") ??
      changeValue(entry, "board_id");

    if (from !== null && to !== null) return `из ${from} в ${to}`;
    if (to !== null) return `перемещена в ${to}`;
    return null;
  }

  if (entry.event_type === "comment.created") {
    const text =
      changeValue(entry, "body") ??
      changeValue(entry, "comment") ??
      changeValue(entry, "text");
    return text !== null ? String(text) : "Сообщение добавлено";
  }

  return null;
}

function changeValue(entry: AuditEntry, field: string): string | null {
  const item = entry.changes.find((change) => change.field === field);
  const value = item?.new ?? item?.old;
  if (value === null || value === undefined) return null;
  return String(value);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
