"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import type { Workspace, WorkspaceRole } from "@/lib/types";

function isAdminRole(role: WorkspaceRole | null): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

        const workspace = workspaces.find((item) => item.id === workspaceId);
        const nextRole = workspace?.role ?? "member";

        if (isAdminRole(nextRole)) {
          router.replace(
            `/admin/members?workspace_id=${encodeURIComponent(workspaceId)}`
          );
          return;
        }

        setRole(nextRole);
      })
      .catch(() => {
        if (!cancelled) setRole("member");
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, workspaceId]);

  if (!workspaceId || roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/35">
        Загрузка...
      </div>
    );
  }

  if (!isAdminRole(role)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/45">
        Нет доступа
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-white/35">
      Загрузка...
    </div>
  );
}
