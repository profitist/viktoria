"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ColumnEditor from "@/components/admin/ColumnEditor";
import AutomationRules from "@/components/admin/AutomationRules";
import WorkspaceSettingsPanel from "@/components/admin/WorkspaceSettings";
import MemberManager from "@/components/admin/MemberManager";

type Tab = "columns" | "automation" | "members" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "columns", label: "Колонки" },
  { id: "automation", label: "Автоматизация" },
  { id: "members", label: "Участники" },
  { id: "settings", label: "Настройки" },
];

export default function AdminPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get("workspace_id");
  const [activeTab, setActiveTab] = useState<Tab>("columns");

  useEffect(() => {
    if (!workspaceId) {
      router.replace("/board");
    }
  }, [workspaceId, router]);

  if (!workspaceId) return null;

  return (
    <div className="px-8 py-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-6">Admin Panel</h1>

      {/* Tab bar */}
      <div
        className="flex gap-1 mb-8 p-1 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 text-sm py-2 px-3 rounded-lg transition-all"
              style={{
                background: isActive ? "#1a1a1a" : "transparent",
                color: isActive ? "#ffffff" : "rgba(255,255,255,0.45)",
                border: isActive ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "columns" && <ColumnEditor workspaceId={workspaceId} />}
      {activeTab === "automation" && <AutomationRules workspaceId={workspaceId} />}
      {activeTab === "members" && <MemberManager workspaceId={workspaceId} />}
      {activeTab === "settings" && <WorkspaceSettingsPanel workspaceId={workspaceId} />}
    </div>
  );
}
