"use client";

import { useEffect, useMemo, useState } from "react";
import { getOverview, type OverviewResponse } from "@/lib/analytics-api";

interface Props {
  boardId: string;
}

const CHART_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(0 84% 60%)",
];

const RADIUS = 72;
const STROKE_WIDTH = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function OverviewChart({ boardId }: Props) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const overview = await getOverview(boardId);
        if (!cancelled) setData(overview);
      } catch {
        if (!cancelled) setError("Не удалось загрузить аналитику");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    queueMicrotask(() => {
      void loadOverview();
    });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const segments = useMemo(() => {
    if (data === null || data.total === 0) return [];

    let offset = 0;
    return data.by_status
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.count > 0)
      .map(({ item, index }) => {
        const length = (item.count / data.total) * CIRCUMFERENCE;
        const segment = {
          ...item,
          color: CHART_COLORS[index % CHART_COLORS.length],
          dashArray: `${length} ${CIRCUMFERENCE - length}`,
          dashOffset: -offset,
        };
        offset += length;
        return segment;
      });
  }, [data]);

  if (isLoading) {
    return (
      <ChartCard>
        <ChartHeader total={null} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-40 w-40 rounded-full border-[28px] border-white/[0.06] animate-pulse" />
        </div>
      </ChartCard>
    );
  }

  if (error !== null) {
    return (
      <ChartCard>
        <ChartHeader total={data?.total ?? null} />
        <div className="flex h-64 items-center justify-center rounded-md border border-red-400/20 bg-red-400/10 px-4 text-sm text-red-200">
          {error}
        </div>
      </ChartCard>
    );
  }

  if (data === null || data.total === 0) {
    return (
      <ChartCard>
        <ChartHeader total={0} />
        <div className="flex h-64 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-sm text-white/45">
          Нет задач на доске
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard>
      <ChartHeader total={data.total} />

      <div className="flex h-64 items-center justify-center">
        <svg
          viewBox="0 0 220 220"
          role="img"
          aria-label={`Задачи по статусу, всего ${data.total}`}
          className="h-full max-h-56 w-full max-w-56"
        >
          <circle
            cx="110"
            cy="110"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE_WIDTH}
          />
          {segments.map((segment) => (
            <circle
              key={segment.column_id}
              cx="110"
              cy="110"
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="butt"
              transform="rotate(-90 110 110)"
            />
          ))}
          <text
            x="110"
            y="104"
            textAnchor="middle"
            fill="#ffffff"
            className="text-2xl font-semibold"
          >
            {data.total}
          </text>
          <text
            x="110"
            y="126"
            textAnchor="middle"
            fill="rgba(255,255,255,0.45)"
            className="text-xs"
          >
            задач
          </text>
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {data.by_status.map((item, index) => (
          <div
            key={item.column_id}
            className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="truncate text-sm text-white/70">
                {item.column_name}
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-white">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111111] p-5">
      {children}
    </section>
  );
}

function ChartHeader({ total }: { total: number | null }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-medium text-white">
        Задачи по статусу · всего {total ?? "..."}
      </h2>
    </div>
  );
}
