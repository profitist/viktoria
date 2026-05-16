import { Suspense } from "react";
import BoardPageClient from "./BoardPageClient";
import BoardSkeleton from "@/components/board/BoardSkeleton";

export default function BoardPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardPageClient />
    </Suspense>
  );
}
