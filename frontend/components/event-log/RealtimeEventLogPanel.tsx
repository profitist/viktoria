"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "@/contexts/WsContext";
import { parseEventLogEntry } from "@/lib/types";
import type { EventLogEntry } from "@/lib/types";
import LogEntry from "./LogEntry";

const MAX_ENTRIES = 50;
const SCROLL_THRESHOLD = 40;

export default function RealtimeEventLogPanel() {
  const { on, off } = useWs();
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleEntry = useCallback((params: Record<string, unknown>) => {
    const entry = parseEventLogEntry(params);
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
    });
  }, []);

  useEffect(() => {
    on("event_log.entry", handleEntry);
    return () => off("event_log.entry", handleEntry);
  }, [on, off, handleEntry]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  return (
    <aside
      className="w-[300px] h-full flex flex-col flex-shrink-0 hidden min-[900px]:flex"
      style={{
        background: "#0B0B0B",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          Event Log
        </span>
        <button
          className="text-xs px-2 py-1 rounded ui-hover"
          style={{ color: "rgba(255,255,255,0.65)" }}
          onClick={() => setEntries([])}
        >
          Очистить
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Нет событий
          </div>
        ) : (
          entries.map((entry) => <LogEntry key={entry.event_id} entry={entry} />)
        )}
      </div>
    </aside>
  );
}
