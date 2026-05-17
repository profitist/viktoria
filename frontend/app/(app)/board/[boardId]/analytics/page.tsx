import Link from "next/link";
import { OverviewChart } from "@/components/analytics/OverviewChart";
import { ProgressChart } from "@/components/analytics/ProgressChart";
import { WorkloadChart } from "@/components/analytics/WorkloadChart";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">Аналитика доски</h1>
        <Link
          href={`/board/${boardId}`}
          className="inline-flex h-10 items-center rounded-md border border-white/10 bg-transparent px-4 text-sm font-medium text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          ← Назад к доске
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <OverviewChart boardId={boardId} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ProgressChart boardId={boardId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <WorkloadChart boardId={boardId} />
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
