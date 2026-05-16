import type { DeadlineUrgency } from "@/lib/types";

interface DeadlineChipProps {
  deadline: string | null;
  urgency: DeadlineUrgency;
}

const URGENCY_COLORS: Record<DeadlineUrgency, string> = {
  none: "rgba(255,255,255,0.25)",
  soon: "#FCD34D",
  critical: "#FCA5A5",
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
    <span
      className="text-xs"
      style={{
        color: URGENCY_COLORS[urgency],
        fontWeight: urgency === "critical" ? 500 : undefined,
      }}
    >
      {formatted}
    </span>
  );
}
