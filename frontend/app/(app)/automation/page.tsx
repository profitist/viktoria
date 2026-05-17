import Link from "next/link";

import AutomationManager from "@/components/automation/AutomationManager";

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace_id?: string }>;
}) {
  const { workspace_id: workspaceId } = await searchParams;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Автоматизация</h1>
          <p className="mt-1 text-sm text-white/45">
            Настройте правила автоматического выполнения действий
          </p>
        </div>

        <Link
          href={`/admin${workspaceId ? `?workspace_id=${workspaceId}` : ""}`}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/65 transition hover:bg-white/[0.05] hover:text-white"
        >
          Admin
        </Link>
      </div>

      {workspaceId ? (
        <AutomationManager workspaceId={workspaceId} />
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-white/60">
            Выберите workspace, чтобы открыть правила автоматизации.
          </p>
          <Link
            href="/board"
            className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
          >
            К доскам
          </Link>
        </div>
      )}
    </div>
  );
}
