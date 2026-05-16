"use client";

import { useSearchParams } from "next/navigation";
import { WsProvider } from "@/contexts/WsContext";
import Sidebar from "@/components/sidebar/Sidebar";
import EventLogPanel from "@/components/event-log/EventLogPanel";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") ?? undefined;

  return (
    <WsProvider>
      <div className="flex h-screen overflow-hidden bg-[#050505]">
        <Sidebar workspaceId={workspaceId} />
        <main className="flex-1 overflow-y-auto bg-[#050505]">
          {children}
        </main>
        <EventLogPanel />
      </div>
    </WsProvider>
  );
}
