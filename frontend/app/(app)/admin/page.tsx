"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ColumnEditor from "@/components/admin/ColumnEditor";
import AutomationRules from "@/components/admin/AutomationRules";

export default function AdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get("workspace_id");

  useEffect(() => {
    if (!workspaceId) {
      router.replace("/board");
    }
  }, [workspaceId, router]);

  if (!workspaceId) return null;

  return (
    <div className="px-8 py-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-8">Admin Panel</h1>
      <ColumnEditor workspaceId={workspaceId} />
      <AutomationRules workspaceId={workspaceId} />
    </div>
  );
}
