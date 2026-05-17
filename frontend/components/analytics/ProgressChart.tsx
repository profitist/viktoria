"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getProgress } from "@/lib/analytics-api";
import type { ProgressResponse } from "@/lib/analytics-api";

type Range = "week" | "month";

interface Props {
  boardId: string;
  initialData?: ProgressResponse;
}

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}`;
}

function formatTooltipLabel(value: string): string {
  return formatDateLabel(value);
}

export function ProgressChart({ boardId, initialData }: Props) {
  const [range, setRange] = useState<Range>(initialData?.range ?? "week");
  const [data, setData] = useState<ProgressResponse | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(initialData === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      if (!boardId) {
        setData(initialData ?? null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await getProgress(boardId, range);
        if (!cancelled) {
          setData(response);
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить прогресс");
          if (initialData && initialData.range === range) {
            setData(initialData);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [boardId, initialData, range]);

  const trend = data?.trend ?? [];
  const donePct = data?.done_pct ?? initialData?.done_pct ?? 0;
  const maxValue = useMemo(
    () => Math.max(1, ...trend.map((point) => Math.max(point.done, point.total))),
    [trend]
  );

  return (
    <section
      className="rounded-lg p-5"
      style={{
        background: "#0B0B0B",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-white">Прогресс доски</h2>
          <div className="mt-2 text-3xl font-semibold text-white">
            Выполнено {donePct.toFixed(1)}%
          </div>
        </div>

        <div
          className="flex rounded-md p-1"
          style={{
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {(["week", "month"] as const).map((item) => {
            const active = range === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className="rounded px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: active ? "#1F2937" : "transparent",
                  color: active ? "#FFFFFF" : "rgba(255,255,255,0.52)",
                }}
              >
                {item === "week" ? "Неделя" : "Месяц"}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && data === null ? (
        <div
          className="mt-5 h-48 animate-pulse rounded-md"
          style={{ background: "#111111" }}
          aria-label="Загрузка прогресса"
        />
      ) : trend.length === 0 ? (
        <div
          className="mt-5 flex h-48 items-center justify-center rounded-md text-sm"
          style={{
            background: "#111111",
            color: "rgba(255,255,255,0.48)",
          }}
        >
          История ещё не накоплена
        </div>
      ) : (
        <div className="mt-5 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, maxValue]}
                allowDecimals={false}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={{
                  background: "#111111",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.72)" }}
              />
              <Line
                type="monotone"
                dataKey="done"
                name="done"
                stroke="#22C55E"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="total"
                stroke="#60A5FA"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {error && (
        <div className="mt-3 text-xs" style={{ color: "#FCA5A5" }}>
          {error}
        </div>
      )}
    </section>
  );
}
