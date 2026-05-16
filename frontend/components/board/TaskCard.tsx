import type { Task, DeadlineUrgency } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";
import DeadlineChip from "./DeadlineChip";

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
}

const URGENCY_CARD_CLASSES: Record<DeadlineUrgency, string> = {
  none: "bg-white border-l-transparent",
  soon: "bg-yellow-50 border-l-yellow-400",
  critical: "bg-red-50 border-l-red-500",
};

export default function TaskCard({ task, isDragging }: TaskCardProps) {
  const cardClasses = [
    "w-full rounded-lg p-3 shadow-sm border-l-4 cursor-grab select-none",
    URGENCY_CARD_CLASSES[task.deadline_urgency],
    isDragging ? "opacity-40 border-2 border-dashed border-gray-300 shadow-none cursor-grabbing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClasses}>
      <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {task.assignee_id !== null && (
            <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600 font-medium">
              {task.assignee_id.charAt(0).toUpperCase()}
            </div>
          )}
          <DeadlineChip deadline={task.deadline} urgency={task.deadline_urgency} />
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
    </div>
  );
}
