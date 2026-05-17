"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type Status = "idle" | "loading" | "done" | "error";

export default function TaskSummary({ taskId }: { taskId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<string | null>(null);

  async function handleRequest() {
    setStatus("loading");
    try {
      const data = await api.post<{ summary: string }>(`/api/v1/tasks/${taskId}/summary`, {});
      setSummary(data.summary);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={handleRequest}
        style={{
          marginTop: "12px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(139,92,246,0.10)",
          border: "1px solid rgba(139,92,246,0.25)",
          color: "#C4B5FD",
          borderRadius: "8px",
          padding: "6px 12px",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 150ms",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.10)"; }}
      >
        ✨ Резюме
      </button>
    );
  }

  if (status === "loading") {
    return (
      <div style={{ marginTop: "12px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
        Генерирую резюме...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", color: "#FCA5A5" }}>Не удалось получить резюме</span>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "12px",
        background: "rgba(139,92,246,0.08)",
        border: "1px solid rgba(139,92,246,0.18)",
        borderRadius: "10px",
        padding: "12px 14px",
      }}
    >
      <p style={{ fontSize: "11px", color: "#A78BFA", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        ✨ AI-резюме
      </p>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", lineHeight: 1.6, margin: 0 }}>
        {summary}
      </p>
    </div>
  );
}
