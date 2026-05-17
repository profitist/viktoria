import { api } from "./api";

export type EventType =
  | "task.created"
  | "task.updated"
  | "task.moved"
  | "task.deleted"
  | "comment.created"
  | "attachment.created"
  | "attachment.deleted"
  | "member.added"
  | "member.removed"
  | "rule.fired";

export interface AuditActor {
  id: string;
  name: string;
  avatar_url?: string;
}

export interface AuditEntry {
  id: string;
  event_type: EventType;
  actor: AuditActor;
  task_id: string | null;
  task_title: string | null;
  board_id: string | null;
  changes: Array<{ field: string; old: unknown; new: unknown }>;
  created_at: string;
}

export type EventLogFilter = "all" | "deleted" | "attachments" | "comments";

export const FILTER_EVENT_TYPES: Record<EventLogFilter, EventType[]> = {
  all: [],
  deleted: ["task.deleted"],
  attachments: ["attachment.created", "attachment.deleted"],
  comments: ["comment.created"],
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "task.created": "Создана задача",
  "task.updated": "Обновлена задача",
  "task.moved": "Перемещена задача",
  "task.deleted": "Удалена задача",
  "comment.created": "Сообщение в задаче",
  "attachment.created": "Добавлен файл",
  "attachment.deleted": "Удалён файл",
  "member.added": "Добавлен участник",
  "member.removed": "Удалён участник",
  "rule.fired": "Сработало правило",
};

const MONTHS = [
  "Января",
  "Февраля",
  "Марта",
  "Апреля",
  "Мая",
  "Июня",
  "Июля",
  "Августа",
  "Сентября",
  "Октября",
  "Ноября",
  "Декабря",
];

interface AuditLogParams {
  event_type?: EventType[];
  board_id?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLog(
  workspaceId: string,
  params?: AuditLogParams
): Promise<AuditEntry[]> {
  const query = new URLSearchParams();

  for (const type of params?.event_type ?? []) {
    query.append("event_type", type);
  }
  if (params?.board_id) query.set("board_id", params.board_id);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<AuditEntry[]>(
    `/api/v1/workspaces/${workspaceId}/audit-log${suffix}`
  );
}

export function groupByDate(entries: AuditEntry[]): Map<string, AuditEntry[]> {
  const grouped = new Map<string, AuditEntry[]>();

  for (const entry of entries) {
    const key = dateGroupLabel(new Date(entry.created_at));
    const group = grouped.get(key);
    if (group) {
      group.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }

  return grouped;
}

export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABELS[type];
}

function dateGroupLabel(date: Date): string {
  if (Number.isNaN(date.getTime())) return "Дата неизвестна";

  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(date);
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";

  return `${target.getDate()} ${MONTHS[target.getMonth()]} ${target.getFullYear()}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
