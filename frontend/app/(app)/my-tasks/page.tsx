"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import MyTasksPage from "@/components/my-tasks/MyTasksPage";

export default function MyTasksRoute() {
  const searchParams = useSearchParams();
  const paramId = searchParams.get("workspace_id") ?? "";
  const [workspaceId, setWorkspaceId] = useState(paramId);

  useEffect(() => {
    if (paramId) {
      setWorkspaceId(paramId);
      return;
    }
    api.get<Workspace[]>("/api/v1/workspaces/me")
      .then((ws) => { if (ws.length > 0) setWorkspaceId(ws[0].id); })
      .catch(() => {});
  }, [paramId]);

  if (!workspaceId) return null;

  return <MyTasksPage workspaceId={workspaceId} />;
}
