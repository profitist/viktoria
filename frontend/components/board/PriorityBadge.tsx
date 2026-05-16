import type { TaskPriority } from "@/lib/types";

interface PriorityBadgeProps {
  priority: TaskPriority;
}

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  critical: "bg-red-100 text-red-600 font-semibold",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  critical: "CRIT",
};

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium uppercase ${PRIORITY_CLASSES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
