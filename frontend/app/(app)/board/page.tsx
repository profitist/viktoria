import { Suspense } from "react";

import BoardSkeleton from "@/components/board/BoardSkeleton";
import BoardPageClient from "./BoardPageClient";

export default function BoardPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardPageClient />
    </Suspense>
  );
}
