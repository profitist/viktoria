"use client";

import type { ViewMode } from "@/lib/types";

interface ViewTabsProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const TABS: { mode: ViewMode; label: string }[] = [
  { mode: "board",    label: "Board"    },
  { mode: "table",    label: "Table"    },
  { mode: "calendar", label: "Calendar" },
];

export default function ViewTabs({ value, onChange }: ViewTabsProps) {
  return (
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
            background: value === mode ? "rgba(255,255,255,0.1)" : "transparent",
            border: "none",
            color: value === mode ? "#FFFFFF" : "rgba(255,255,255,0.4)",
            borderRadius: "6px",
            padding: "4px 14px",
            fontSize: "13px",
            fontWeight: value === mode ? 500 : 400,
            cursor: "pointer",
            transition: "all 120ms",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
