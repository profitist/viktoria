"use client";

import { useSearchParams } from "next/navigation";

import { WsProvider } from "@/contexts/WsContext";
import Sidebar from "@/components/sidebar/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") ?? undefined;

  return (
    <WsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar workspaceId={workspaceId} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </WsProvider>
  );
}
