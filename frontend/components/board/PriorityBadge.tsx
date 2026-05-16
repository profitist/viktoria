import type { TaskPriority } from "@/lib/types";

interface PriorityBadgeProps {
  priority: TaskPriority;
}

const PRIORITY_STYLES: Record<TaskPriority, { background: string; color: string }> = {
  low: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" },
  medium: { background: "rgba(59,130,246,0.15)", color: "#93C5FD" },
  high: { background: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  critical: { background: "rgba(239,68,68,0.15)", color: "#FCA5A5" },
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  critical: "CRIT",
};

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority];
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide"
      style={style}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
