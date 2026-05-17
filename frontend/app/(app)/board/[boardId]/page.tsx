import { Suspense } from "react";
import Link from "next/link";
import BoardPageClient from "../BoardPageClient";
import BoardSkeleton from "@/components/board/BoardSkeleton";

export default async function BoardByIdPage({
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

  return (
    <>
      <div className="px-8 pt-6">
        <Link
          href={`/board/${boardId}/analytics${workspaceQuery}`}
          className="inline-flex h-9 items-center rounded-md border border-white/10 px-3 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          Аналитика
        </Link>
      </div>
      <Suspense fallback={<BoardSkeleton />}>
        <BoardPageClient boardId={boardId} />
      </Suspense>
    </>
  );
}
