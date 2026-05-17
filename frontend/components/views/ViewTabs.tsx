"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ViewMode } from "@/lib/types";

interface ViewTabsProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  boardId?: string;
}

const TABS: { mode: ViewMode; label: string }[] = [
  { mode: "board",    label: "Доска"    },
  { mode: "table",    label: "Таблица"  },
  { mode: "calendar", label: "Календарь" },
];

export default function ViewTabs({ value, onChange, boardId }: ViewTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id");
  const workspaceQuery = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : "";

  const isAnalytics = pathname.endsWith("/analytics");
  const analyticsHref = boardId ? `/board/${boardId}/analytics${workspaceQuery}` : "#";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      <div
        style={{
          display: "flex",
          gap: "2px",
          background: "rgba(255,255,255,0.04)",
          borderRadius: "8px",
          padding: "3px",
        }}
      >
        {TABS.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            style={{
              background: value === mode && !isAnalytics ? "rgba(255,255,255,0.10)" : "transparent",
              border: "none",
              color: value === mode && !isAnalytics ? "#FFFFFF" : "rgba(255,255,255,0.4)",
              borderRadius: "6px",
              padding: "4px 14px",
              fontSize: "13px",
              fontWeight: value === mode && !isAnalytics ? 500 : 400,
              cursor: "pointer",
              transition: "all 120ms",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {boardId && (
        <>
          <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.10)", margin: "0 4px" }} />
          <Link
            href={analyticsHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: isAnalytics ? 500 : 400,
              color: isAnalytics ? "#FFFFFF" : "rgba(255,255,255,0.4)",
              background: isAnalytics ? "rgba(255,255,255,0.10)" : "transparent",
              textDecoration: "none",
              transition: "all 120ms",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isAnalytics) e.currentTarget.style.color = "rgba(255,255,255,0.72)";
            }}
            onMouseLeave={(e) => {
              if (!isAnalytics) e.currentTarget.style.color = "rgba(255,255,255,0.4)";
            }}
          >
            Аналитика
          </Link>
        </>
      )}
    </div>
  );
}
