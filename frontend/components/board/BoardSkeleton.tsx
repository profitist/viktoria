function SkeletonCard() {
  return (
    <div
      className="h-16 rounded-[18px] animate-pulse"
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}

function SkeletonColumn({ cardCount }: { cardCount: number }) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-2 p-2">
      <div
        className="h-3 rounded w-20 animate-pulse mb-2"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
      {Array.from({ length: cardCount }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function BoardSkeleton() {
  return (
    <div className="flex gap-6 px-8 py-6 overflow-x-auto bg-[#050505] min-h-screen">
      <SkeletonColumn cardCount={3} />
      <SkeletonColumn cardCount={2} />
      <SkeletonColumn cardCount={1} />
    </div>
  );
}
