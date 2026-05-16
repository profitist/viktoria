import type { EventLogEntry } from "@/lib/types";

function formatTime(isoTs: string): string {
  const date = new Date(isoTs);
  if (isNaN(date.getTime())) {
    return "--:--:--";
  }
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const STATUS_COLORS: Record<string, string> = {
  received: "rgba(255,255,255,0.45)",
  deduped: "#FCD34D",
  enriched: "#93C5FD",
  broadcast: "#6EE7B7",
};

interface LogEntryProps {
  entry: EventLogEntry;
}

export default function LogEntry({ entry }: LogEntryProps) {
  const statusColor = STATUS_COLORS[entry.status] ?? "rgba(255,255,255,0.25)";

  return (
    <div
      className="px-3 py-1 font-mono text-xs leading-5 transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: "rgba(255,255,255,0.25)" }}>[{formatTime(entry.ts)}] </span>
      <span style={{ color: "rgba(255,255,255,0.72)" }}>{entry.event_type} </span>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>→ </span>
      <span style={{ color: statusColor }}>{entry.status}</span>
    </div>
  );
}
