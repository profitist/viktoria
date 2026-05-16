import type { Task, DeadlineUrgency } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";
import DeadlineChip from "./DeadlineChip";

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  onClick?: () => void;
}

const URGENCY_BORDER: Record<DeadlineUrgency, string> = {
  none: "transparent",
  soon: "rgba(245,158,11,0.7)",
  critical: "#EF4444",
};

const URGENCY_SHADOW: Record<DeadlineUrgency, string> = {
  none: "0 2px 12px rgba(0,0,0,0.4)",
  soon: "0 2px 12px rgba(0,0,0,0.4)",
  critical: "0 2px 12px rgba(0,0,0,0.4), 0 0 12px rgba(239,68,68,0.15)",
};

export default function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  return (
    <div
      className="w-full p-3 cursor-grab select-none group transition-all duration-150"
      onClick={() => { if (!isDragging) onClick?.(); }}
      style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `4px solid ${URGENCY_BORDER[task.deadline_urgency]}`,
        borderRadius: "18px",
        boxShadow: URGENCY_SHADOW[task.deadline_urgency],
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? "scale(1.02) rotate(1deg)" : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.6)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = URGENCY_SHADOW[task.deadline_urgency];
        e.currentTarget.style.transform = isDragging ? "scale(1.02) rotate(1deg)" : "";
        e.currentTarget.style.borderLeft = `4px solid ${URGENCY_BORDER[task.deadline_urgency]}`;
      }}
    >
      <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {task.assignee_id !== null && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="4.5" r="2" fill="rgba(255,255,255,0.45)" />
                <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
          )}
          <DeadlineChip deadline={task.deadline} urgency={task.deadline_urgency} />
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
    </div>
  );
}
