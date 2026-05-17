import EventLogPanel from "@/components/event-log/EventLogPanel";

export default async function EventLogPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace_id?: string }>;
}) {
  const { workspace_id: workspaceId } = await searchParams;

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="text-sm text-white/35">Главная / Лента событий</div>
        <h1 className="text-2xl font-semibold text-white">Лента событий</h1>
      </div>

      <EventLogPanel workspaceId={workspaceId} />
    </div>
  );
}
