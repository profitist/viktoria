"use client";

import { useEffect, type KeyboardEvent } from "react";
import type { DuplicateCandidate } from "@/lib/types";

interface DuplicateModalProps {
  candidates: DuplicateCandidate[];
  onSelectCandidate: (id: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

function truncateColumnName(name: string): string {
  return name.length > 15 ? name.slice(0, 15) + "…" : name;
}

export default function DuplicateModal({
  candidates,
  onSelectCandidate,
  onCreateNew,
  onCancel,
}: DuplicateModalProps) {
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(1px)",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "fixed",
          zIndex: 41,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "280px",
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          padding: "20px",
          animation: "duplicateModalIn 150ms ease-out",
        }}
      >
        <style>{`
          @keyframes duplicateModalIn {
            from { opacity: 0; transform: translate(-50%, calc(-50% + 4px)); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>

        {/* Header */}
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
          Найдены похожие задачи
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.50)", margin: "4px 0 0 0" }}>
          Возможно, такая задача уже есть.
        </p>

        {/* Separator */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />

        {/* Candidates list */}
        <div
          style={{
            maxHeight: "240px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.15) transparent",
          }}
        >
          {candidates.map((c) => {
            const isExact = c.similarity >= 1.0;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectCandidate(c.id)}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter") onSelectCandidate(c.id);
                }}
                style={{
                  background: isExact ? "rgba(252,211,77,0.04)" : "rgba(255,255,255,0.03)",
                  border: isExact
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid rgba(255,255,255,0.06)",
                  borderLeft: isExact ? "2px solid #FCD34D" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "8px",
                  transition: "background 150ms ease, border-color 150ms ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "rgba(255,255,255,0.07)";
                  // Меняем только borderTop/Right/Bottom чтобы не затронуть borderLeft у exact match
                  el.style.borderTopColor = "rgba(255,255,255,0.12)";
                  el.style.borderRightColor = "rgba(255,255,255,0.12)";
                  el.style.borderBottomColor = "rgba(255,255,255,0.12)";
                  if (!isExact) el.style.borderLeftColor = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = isExact ? "rgba(252,211,77,0.04)" : "rgba(255,255,255,0.03)";
                  el.style.borderTopColor = "rgba(255,255,255,0.06)";
                  el.style.borderRightColor = "rgba(255,255,255,0.06)";
                  el.style.borderBottomColor = "rgba(255,255,255,0.06)";
                  if (!isExact) el.style.borderLeftColor = "rgba(255,255,255,0.06)";
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: isExact ? "#FCD34D" : "#FFFFFF",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    flex: 1,
                  }}
                >
                  {c.title}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.45)",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {truncateColumnName(c.column_name)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Separator */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button
            onClick={onCreateNew}
            style={{
              flex: 1,
              background: "#3B82F6",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "10px 0",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2563EB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#3B82F6")}
          >
            Создать новую
          </button>
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.45)",
              border: "none",
              padding: "10px 14px",
              fontSize: "13px",
              cursor: "pointer",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.72)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          >
            Отмена
          </button>
        </div>
      </div>
    </>
  );
}
