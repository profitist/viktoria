import {
  type AuditEntry,
  type EventType,
  eventTypeLabel,
} from "@/lib/event-log-api";

interface EventTableProps {
  entries: AuditEntry[];
  highlightedEntryIds?: ReadonlySet<string>;
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

export function EventTable({
  entries,
  highlightedEntryIds,
}: EventTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[#111111]">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-white/[0.035]">
          <tr>
            <th className="h-10 px-4 text-left text-xs font-medium uppercase tracking-wide text-white/35">
              Дата/время
            </th>
            <th className="h-10 px-4 text-left text-xs font-medium uppercase tracking-wide text-white/35">
              Действие
            </th>
            <th className="h-10 px-4 text-left text-xs font-medium uppercase tracking-wide text-white/35">
              Инициатор
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center text-sm text-white/35">
                Нет событий
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-white/[0.06] transition-colors last:border-b-0 hover:bg-white/[0.035] ${
                  highlightedEntryIds?.has(entry.id)
                    ? "animate-pulse bg-sky-400/[0.08] shadow-[inset_3px_0_0_rgba(56,189,248,0.75)]"
                    : ""
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-white/45">
                  {formatDateTime(entry.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <EventIcon type={entry.event_type} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white/82">
                        {eventTypeLabel(entry.event_type)}
                      </div>
                      {entry.task_title && (
                        <div className="truncate text-xs text-white/38">
                          {entry.task_title}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Actor actor={entry.actor} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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
    <div className="flex items-center gap-2">
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
      <span className="max-w-[160px] truncate text-white/62">{actor.name}</span>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
