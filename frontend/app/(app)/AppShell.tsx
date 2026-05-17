"use client";

import { useSearchParams } from "next/navigation";

import { WsProvider } from "@/contexts/WsContext";
import Sidebar from "@/components/sidebar/Sidebar";
import RealtimeEventLogPanel from "@/components/event-log/RealtimeEventLogPanel";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") ?? undefined;

  return (
    <WsProvider>
      <div className="flex h-screen overflow-hidden bg-[#050505]">
        <Sidebar workspaceId={workspaceId} />
        <NotificationBell workspaceId={workspaceId} />
        <main className="flex-1 overflow-y-auto bg-[#050505]">
          {children}
        </main>
        <RealtimeEventLogPanel />
      </div>
    </WsProvider>
  );
}
