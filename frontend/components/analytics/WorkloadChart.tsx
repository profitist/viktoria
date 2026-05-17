"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import {
  type AssigneeLoad,
  type WorkloadResponse,
  getWorkload,
} from "@/lib/analytics-api";

interface Props {
  boardId: string;
}

interface ChartRow {
  assignee_id: string | null;
  name: string;
  count: number;
  done: number;
}

export function WorkloadChart({ boardId }: Props) {
  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getWorkload(boardId)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить нагрузку");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const rows = useMemo(
    () => (data?.by_assignee ?? []).map(toChartRow),
    [data?.by_assignee]
  );
  const chartHeight = Math.max(192, rows.length * 44);

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Нагрузка по участникам
        </h2>
      </div>

      {isLoading && <WorkloadSkeleton />}

      {!isLoading && error !== null && (
        <div
          style={{
            minHeight: "192px",
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,0.48)",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {!isLoading && error === null && rows.length === 0 && <EmptyState />}

      {!isLoading && error === null && rows.length > 0 && (
        <div
          style={{
            maxHeight: "288px",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <div style={{ height: chartHeight, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 12 }}
                barGap={4}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.72)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={WorkloadTooltip}
                />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1, #3B82F6)"
                  maxBarSize={24}
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="done"
                  fill="var(--chart-2, #10B981)"
                  maxBarSize={24}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

function toChartRow(item: AssigneeLoad): ChartRow {
  return {
    assignee_id: item.assignee_id,
    name: item.name ?? "Unassigned",
    count: item.count,
    done: item.done,
  };
}

function WorkloadTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        background: "rgba(5,5,5,0.96)",
        padding: "8px 10px",
        color: "rgba(255,255,255,0.88)",
        fontSize: "12px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
      }}
    >
      {row.name}: {row.done} из {row.count} выполнено
    </div>
  );
}

function WorkloadSkeleton() {
  return (
    <div
      style={{
        height: "192px",
        borderRadius: "8px",
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
        backgroundSize: "200% 100%",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function EmptyState() {
  return (
    <div
      style={{
        minHeight: "192px",
        display: "grid",
        placeItems: "center",
        color: "rgba(255,255,255,0.42)",
        fontSize: "14px",
      }}
    >
      Задачи не назначены
    </div>
  );
}
