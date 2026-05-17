export function useDeadlineColor(
  deadlineDaysRemaining: number | null,
  decayEnabled: boolean
): string | null {
  if (!decayEnabled || deadlineDaysRemaining === null) return null;

  if (deadlineDaysRemaining <= 0) return "#ef4444";
  if (deadlineDaysRemaining === 1) return "#f97316";
  if (deadlineDaysRemaining <= 3) return "#fb923c";
  if (deadlineDaysRemaining <= 7) return "#facc15";
  if (deadlineDaysRemaining <= 14) return "#a3e635";
  return null;
}
