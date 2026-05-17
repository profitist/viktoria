"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWs } from "@/contexts/WsContext";
import { OverviewChart } from "@/components/analytics/OverviewChart";
import { ProgressChart } from "@/components/analytics/ProgressChart";
import { WorkloadChart } from "@/components/analytics/WorkloadChart";

interface Props {
  boardId: string;
  workspaceQuery: string;
}

const WS_TASK_EVENTS = ["board.task_created", "board.task_updated", "board.task_moved"];

export default function AnalyticsPageClient({ boardId, workspaceQuery }: Props) {
  const { on, off } = useWs();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleTaskEvent = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setIsRefreshing(true);
        setRefreshKey((k) => k + 1);
        setTimeout(() => setIsRefreshing(false), 600);
      }, 3000);
    };

    for (const event of WS_TASK_EVENTS) on(event, handleTaskEvent);
    return () => {
      for (const event of WS_TASK_EVENTS) off(event, handleTaskEvent);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [on, off]);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">Аналитика доски</h1>
          {isRefreshing && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "#93C5FD",
              }}
            >
              Обновление...
            </span>
          )}
        </div>
        <Link
          href={`/board/${boardId}${workspaceQuery}`}
          className="inline-flex h-10 items-center rounded-md border border-white/10 bg-transparent px-4 text-sm font-medium text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          ← Назад к доске
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <OverviewChart key={`overview-${refreshKey}`} boardId={boardId} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ProgressChart key={`progress-${refreshKey}`} boardId={boardId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <WorkloadChart key={`workload-${refreshKey}`} boardId={boardId} />
        </CardContent>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0B0B0B]">
      {children}
    </section>
  );
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="pt-6">{children}</div>;
}
