"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Workspace, WorkspaceRole } from "@/lib/types";
import MembersTab from "@/components/admin/MembersTab";
import AutomationTab from "@/components/admin/AutomationTab";
import SettingsTab from "@/components/admin/SettingsTab";

type Tab = "members" | "automation" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "members", label: "Участники" },
  { id: "automation", label: "Автоматизация" },
  { id: "settings", label: "Настройки" },
];

function ShieldOffIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default function AdminPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get("workspace_id");
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      router.replace("/board");
      return;
    }

    let cancelled = false;
    api
      .get<Workspace[]>("/api/v1/workspaces/me")
      .then((workspaces) => {
        if (cancelled) return;
        const ws = workspaces.find((w) => w.id === workspaceId);
        setRole(ws?.role ?? "member");
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
  }, [workspaceId, router]);

  if (!workspaceId) return null;

  if (roleLoading) {
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

  if (role === "member") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "8px",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        <ShieldOffIcon />
        <p style={{ fontSize: "14px" }}>Раздел доступен только администраторам</p>
      </div>
    );
  }

  const currentUserRole = role ?? "member";

  return (
    <div className="px-8 py-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-6">Admin Panel</h1>

      <div
        className="flex gap-1 mb-8 p-1 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 text-sm py-2 px-3 rounded-lg transition-all"
              style={{
                background: isActive ? "#1a1a1a" : "transparent",
                color: isActive ? "#ffffff" : "rgba(255,255,255,0.65)",
                border: isActive
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid transparent",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "members" && (
        <MembersTab workspaceId={workspaceId} currentUserRole={currentUserRole} />
      )}
      {activeTab === "automation" && <AutomationTab workspaceId={workspaceId} />}
      {activeTab === "settings" && (
        <SettingsTab workspaceId={workspaceId} currentUserRole={currentUserRole} />
      )}
    </div>
  );
}
