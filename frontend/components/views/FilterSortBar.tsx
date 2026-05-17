"use client";

import type { SortKey, TaskPriority } from "@/lib/types";

export interface FilterSortValue {
  assignee_id?: string;
  tag?: string;
  priority?: TaskPriority;
  sort: SortKey;
}

export interface FilterSortMember {
  id: string;
  name: string;
}

export interface FilterSortTag {
  id: string;
  name: string;
  color: string;
}

interface FilterSortBarProps {
  value: FilterSortValue;
  members: FilterSortMember[];
  tags: FilterSortTag[];
  onChange: (next: FilterSortValue) => void;
}

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "deadline", label: "Deadline ascending" },
  { value: "-deadline", label: "Deadline descending" },
  { value: "priority", label: "Priority low to critical" },
  { value: "-priority", label: "Priority critical to low" },
  { value: "title", label: "Title A to Z" },
  { value: "-title", label: "Title Z to A" },
];

const selectClassName =
  "h-9 min-w-[150px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition-colors focus:border-white/20";

function withoutEmptyFilter<K extends "assignee_id" | "tag" | "priority">(
  value: FilterSortValue,
  key: K,
  nextValue: FilterSortValue[K] | ""
): FilterSortValue {
  if (nextValue === "") {
    const next = { ...value };
    delete next[key];
    return next;
  }
  return { ...value, [key]: nextValue };
}

export default function FilterSortBar({
  value,
  members,
  tags,
  onChange,
}: FilterSortBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-white/10 bg-bg-secondary px-4 py-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase text-white/45">Assignee</span>
        <select
          value={value.assignee_id ?? ""}
          onChange={(event) =>
            onChange(withoutEmptyFilter(value, "assignee_id", event.target.value))
          }
          className={selectClassName}
        >
          <option value="">Any assignee</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase text-white/45">Tag</span>
        <select
          value={value.tag ?? ""}
          onChange={(event) => onChange(withoutEmptyFilter(value, "tag", event.target.value))}
          className={selectClassName}
        >
          <option value="">Any tag</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase text-white/45">Priority</span>
        <select
          value={value.priority ?? ""}
          onChange={(event) =>
            onChange(
              withoutEmptyFilter(
                value,
                "priority",
                event.target.value as TaskPriority | ""
              )
            )
          }
          className={selectClassName}
        >
          <option value="">Any priority</option>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase text-white/45">Sort</span>
        <select
          value={value.sort}
          onChange={(event) => onChange({ ...value, sort: event.target.value as SortKey })}
          className="h-9 min-w-[190px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition-colors focus:border-white/20"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => onChange({ sort: "-created_at" })}
        className="h-9 rounded-md border border-white/10 px-3 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
      >
        Сбросить
      </button>
    </div>
  );
}
