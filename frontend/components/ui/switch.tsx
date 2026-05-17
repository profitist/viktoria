"use client";

interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({
  checked,
  disabled = false,
  "aria-label": ariaLabel,
  onCheckedChange,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative h-6 w-[42px] shrink-0 rounded-full outline outline-1 transition-colors ${
        checked
          ? "bg-blue-500 outline-transparent"
          : "bg-white/10 outline-white/10"
      } ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition-all ${
          checked
            ? "left-[21px] bg-white"
            : "left-[3px] bg-white/55"
        }`}
      />
    </button>
  );
}
