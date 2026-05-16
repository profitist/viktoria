function SkeletonCard() {
  return <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />;
}

function SkeletonColumn({ cardCount }: { cardCount: number }) {
  return (
    <div className="w-72 flex-shrink-0 bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
      <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mb-2" />
      {Array.from({ length: cardCount }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function BoardSkeleton() {
  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      <SkeletonColumn cardCount={3} />
      <SkeletonColumn cardCount={2} />
      <SkeletonColumn cardCount={1} />
    </div>
  );
}
