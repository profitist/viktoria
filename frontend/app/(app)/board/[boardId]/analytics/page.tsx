import AnalyticsPageClient from "./AnalyticsPageClient";

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ workspace_id?: string }>;
}) {
  const { boardId } = await params;
  const { workspace_id: workspaceId } = await searchParams;
  const workspaceQuery = workspaceId
    ? `?workspace_id=${encodeURIComponent(workspaceId)}`
    : "";

  return <AnalyticsPageClient boardId={boardId} workspaceQuery={workspaceQuery} />;
}
