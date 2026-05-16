import type { DeadlineUrgency } from "@/lib/types";

interface DeadlineChipProps {
  deadline: string | null;
  urgency: DeadlineUrgency;
}

const URGENCY_TEXT_CLASSES: Record<DeadlineUrgency, string> = {
  none: "text-gray-400",
  soon: "text-yellow-600",
  critical: "text-red-600 font-medium",
};

const formatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

export default function DeadlineChip({ deadline, urgency }: DeadlineChipProps) {
  if (deadline === null) return null;

  const formatted = formatter.format(new Date(deadline));

  return (
    <span className={`text-xs ${URGENCY_TEXT_CLASSES[urgency]}`}>
      {formatted}
    </span>
  );
}
