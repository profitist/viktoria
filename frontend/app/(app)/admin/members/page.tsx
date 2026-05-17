"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import MembersTab from "@/components/admin/MembersTab";
import { api } from "@/lib/api";
import type { Workspace, WorkspaceRole } from "@/lib/types";

function isAdminRole(role: WorkspaceRole | null): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export default function AdminMembersPage() {
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

        if (!isAdminRole(nextRole)) {
          router.replace("/");
          return;
        }

        setRole(nextRole);
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
  }, [router, workspaceId]);

  if (!workspaceId || roleLoading || !isAdminRole(role)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/35">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="max-w-4xl px-8 py-8">
      <h1 className="mb-6 text-xl font-semibold text-white">
        Участники workspace
      </h1>
      <MembersTab workspaceId={workspaceId} currentUserRole={role} />
    </div>
  );
}
