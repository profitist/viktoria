"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "@/contexts/WsContext";
import { parseEventLogEntry } from "@/lib/types";
import type { EventLogEntry } from "@/lib/types";
import LogEntry from "./LogEntry";

const MAX_ENTRIES = 50;
const SCROLL_THRESHOLD = 40; // px запас для определения "внизу"

// =============================================================================
// EventLogPanel
// =============================================================================

export default function EventLogPanel() {
  const { on, off } = useWs();
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleEntry = useCallback((params: Record<string, unknown>) => {
    const entry = parseEventLogEntry(params); // throw при невалидном payload
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
    });
  }, []);

  useEffect(() => {
    on("event_log.entry", handleEntry);
    return () => off("event_log.entry", handleEntry);
  }, [on, off, handleEntry]);

  // Автоскролл: только если пользователь уже внизу
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  return (
    <aside className="w-[300px] h-full bg-gray-900 border-l border-gray-700 flex flex-col flex-shrink-0 hidden min-[900px]:flex">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">Event Log</span>
        <button
          className="text-xs text-gray-500 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
          onClick={() => setEntries([])}
        >
          Очистить
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Нет событий
          </div>
        ) : (
          entries.map((entry) => <LogEntry key={entry.event_id} entry={entry} />)
        )}
      </div>
    </aside>
  );
}
