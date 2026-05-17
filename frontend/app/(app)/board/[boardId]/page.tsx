import { Suspense } from "react";
import BoardPageClient from "../BoardPageClient";
import BoardSkeleton from "@/components/board/BoardSkeleton";

export default async function BoardByIdPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ workspace_id?: string }>;
}) {
  const { boardId } = await params;

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardPageClient boardId={boardId} />
    </Suspense>
  );
}
