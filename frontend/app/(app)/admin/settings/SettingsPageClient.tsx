"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Workspace, WorkspaceRole } from "@/lib/types";
import SettingsTab from "@/components/admin/SettingsTab";

export default function SettingsPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get("workspace_id");
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    api
      .get<Workspace[]>("/api/v1/workspaces/me")
      .then((workspaces) => {
        if (cancelled) return;
        const ws = workspaces.find((w) => w.id === workspaceId);
        const userRole = ws?.role ?? "member";
        if (userRole === "member") {
          router.replace("/");
          return;
        }
        setRole(userRole);
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, router]);

  if (!workspaceId || roleLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "rgba(255,255,255,0.55)",
          fontSize: "13px",
        }}
      >
        Загрузка...
      </div>
    );
  }

  if (!role) return null;

  return (
    <div className="px-8 py-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-6">Настройки workspace</h1>
      <SettingsTab workspaceId={workspaceId} currentUserRole={role} />
    </div>
  );
}
