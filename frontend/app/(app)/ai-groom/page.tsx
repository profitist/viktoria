"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import GroomingWizard from "@/components/ai/GroomingWizard";

export default function AiGroomPage() {
  const searchParams = useSearchParams();
  const paramId = searchParams.get("workspace_id") ?? "";
  const [workspaceId, setWorkspaceId] = useState(paramId);

  useEffect(() => {
    if (paramId) {
      setWorkspaceId(paramId);
      return;
    }
    api
      .get<Workspace[]>("/api/v1/workspaces/me")
      .then((ws) => { if (ws.length > 0) setWorkspaceId(ws[0].id); })
      .catch(() => {});
  }, [paramId]);

  if (!workspaceId) return null;

  return (
    <div className="min-h-full" style={{ background: "#050505", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
          AI Груминг задач
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", marginBottom: "28px" }}>
          Опишите проблему — AI поможет сформулировать задачу
        </p>
        <GroomingWizard workspaceId={workspaceId} />
      </div>
    </div>
  );
}
