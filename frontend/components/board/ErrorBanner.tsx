interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
      <div
        className="px-4 py-3 rounded-lg text-sm"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#FCA5A5",
        }}
      >
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm text-white rounded-lg transition-colors"
          style={{ background: "#3B82F6" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2563EB")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#3B82F6")}
        >
          Повторить
        </button>
      )}
    </div>
  );
}
