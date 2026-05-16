import type { EventLogEntry } from "@/lib/types";

// =============================================================================
// Вспомогательные функции
// =============================================================================

function formatTime(isoTs: string): string {
  const date = new Date(isoTs);
  // ISSUE-003: явный fallback вместо "[NaN:NaN:NaN]" при невалидном timestamp
  if (isNaN(date.getTime())) {
    return "--:--:--";
  }
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "received":  return "text-gray-400";
    case "deduped":   return "text-yellow-400";
    case "enriched":  return "text-blue-400";
    case "broadcast": return "text-green-400";
    default:          return "text-gray-500";
  }
}

// =============================================================================
// Компонент
// =============================================================================

interface LogEntryProps {
  entry: EventLogEntry;
}

export default function LogEntry({ entry }: LogEntryProps) {
  return (
    <div className="px-3 py-1 font-mono text-xs leading-5 hover:bg-gray-800/50">
      <span className="text-gray-500">[{formatTime(entry.ts)}] </span>
      <span className="text-gray-300">{entry.event_type} </span>
      <span className="text-gray-500">→ </span>
      <span className={statusColor(entry.status)}>{entry.status}</span>
    </div>
  );
}
