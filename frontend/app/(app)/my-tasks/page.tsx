"use client";

import { useSearchParams } from "next/navigation";
import MyTasksPage from "@/components/my-tasks/MyTasksPage";

export default function MyTasksRoute() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") ?? "";

  return <MyTasksPage workspaceId={workspaceId} />;
}
