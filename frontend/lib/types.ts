export interface User {
  id: string;
  email: string;
  name: string;
}

export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface WorkspaceSettings {
  workspace_id: string;
  automation_enabled: boolean;
  deadline_decay_enabled: boolean;
}

export interface MemberInvite {
  email: string;
  role: "admin" | "member";
}

export interface WorkspaceMember {
  user_id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joined_at: string;
}

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type DeadlineUrgency = "none" | "soon" | "critical";

export type ViewMode = "board" | "table" | "calendar";

export type SortKey =
  | "created_at"
  | "-created_at"
  | "deadline"
  | "-deadline"
  | "priority"
  | "-priority"
  | "title"
  | "-title";

export interface Tag {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface SubtaskProgress {
  done_count: number;
  total_count: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  column_id: string;
  workspace_id: string;
  priority: TaskPriority;
  tags: Tag[];
  subtask_progress?: SubtaskProgress;
  assignee_id: string | null;
  created_at: string;
  deadline: string | null;
  deadline_days_remaining: number | null;
  deadline_urgency: DeadlineUrgency;
  done: boolean;
}

export interface TaskFilters {
  board_id: string;
  column_id?: string;
  assignee_id?: string;
  tag?: string;
  deadline_from?: string;
  deadline_to?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Column {
  id: string;
  name: string;
  position: number;
  color?: string;
  tasks: Task[];
}

export interface Board {
  id: string;
  columns: Column[];
}

export interface BoardMeta {
  id: string;
  name: string;
  description: string | null;
  project_id: string | null;
  is_favorite: boolean;
}

export interface BoardDetail extends Board {
  name: string;
  description: string | null;
  project_id: string | null;
  is_favorite: boolean;
}

export interface Project {
  id: string;
  name: string;
  board_count: number;
}

export interface RuleCondition {
  field: string;
  operator: "eq" | "contains" | "gt" | "lt";
  value: unknown;
}

export type RuleActionType = "move_to_column" | "add_tag" | "notify_members";

export interface RuleActionParams {
  column_id?: string;
  tag?: string;
  message?: string;
}

export interface RuleAction {
  type: RuleActionType;
  params: RuleActionParams;
}

export type RuleTrigger =
  | "task.created"
  | "task.moved"
  | "task.updated"
  | "deadline.approaching";

export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  active: boolean;
  trigger: RuleTrigger;
  condition: RuleCondition | null;
  action: RuleAction;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AuditChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface AuditActor {
  id: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor: AuditActor;
  task_id: string;
  task_title?: string;
  changes: AuditChange[];
  created_at: string;
}

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

export type EventLogStatus = "received" | "deduped" | "enriched" | "broadcast";

export interface EventLogEntry {
  event_id: string;    // уникальный ID события (ключ для React list)
  event_type: string;  // "task.created" | "task.moved" | ...
  status: EventLogStatus | string; // string — для forward-совместимости с неизвестными статусами
  detail: string;      // дополнительная информация (может быть "")
  ts: string;          // ISO 8601 timestamp
}

// Fail-fast парсер payload из WS. Throw если структура невалидна.
export function parseEventLogEntry(params: Record<string, unknown>): EventLogEntry {
  const { event_id, event_type, status, detail, ts } = params;

  if (
    typeof event_id !== "string" ||
    typeof event_type !== "string" ||
    typeof status !== "string" ||
    typeof detail !== "string" ||
    typeof ts !== "string"
  ) {
    throw new Error(`Invalid event_log.entry payload: ${JSON.stringify(params)}`);
  }

  return { event_id, event_type, status, detail, ts };
}

// Fail-fast парсер board.task_created WS-payload.
// enriched_event: { task_id, payload: { id, title, column_id, ... }, ... }
export function parseBoardTask(params: Record<string, unknown>): Task {
  const payload = params["payload"];

  if (typeof payload !== "object" || payload === null) {
    throw new Error(`Invalid board task payload: ${JSON.stringify(params)}`);
  }

  const t = payload as Record<string, unknown>;

  if (
    typeof t["id"] !== "string" ||
    typeof t["title"] !== "string" ||
    typeof t["description"] !== "string" ||
    typeof t["column_id"] !== "string" ||
    typeof t["workspace_id"] !== "string" ||
    typeof t["priority"] !== "string" ||
    !Array.isArray(t["tags"]) ||
    typeof t["created_at"] !== "string" ||
    (
      typeof t["deadline_days_remaining"] !== "number" &&
      t["deadline_days_remaining"] !== null
    ) ||
    typeof t["deadline_urgency"] !== "string"
  ) {
    throw new Error(`Invalid board task payload: ${JSON.stringify(params)}`);
  }

  return payload as Task;
}

// Fail-fast парсер board.task_moved WS-payload.
// enriched_event: { task_id, payload: { column_id, position, from_column_id } }
export function parseMoveParams(
  params: Record<string, unknown>
): { taskId: string; column_id: string; position: number } {
  const taskId = params["task_id"];
  const payload = params["payload"];

  if (typeof taskId !== "string" || typeof payload !== "object" || payload === null) {
    throw new Error(`Invalid board.task_moved payload: ${JSON.stringify(params)}`);
  }

  const p = payload as Record<string, unknown>;

  if (typeof p["column_id"] !== "string" || typeof p["position"] !== "number") {
    throw new Error(`Invalid board.task_moved payload: ${JSON.stringify(params)}`);
  }

  return {
    taskId,
    column_id: p["column_id"] as string,
    position: p["position"] as number,
  };
}

export interface CommentAuthor {
  id: string;
  name: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author: CommentAuthor;
  body: string;
  mentions: string[];
  created_at: string;
}

export interface AttachmentUploader {
  id: string;
  name: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  filename: string | null;
  content_type: string | null;
  size: number | null;
  url: string;
  uploaded_by: AttachmentUploader | null;
  created_at: string;
}

export interface GroomQuestion {
  id: string;
  text: string;
}

export interface GroomAnswer {
  question_id: string;
  answer: string;
}

export interface GroomSession {
  session_id: string;
  questions: GroomQuestion[];
}

export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
}
