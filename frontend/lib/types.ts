// =============================================================================
// Раздел 1 — Пользователи и аутентификация
// =============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
}

// =============================================================================
// Раздел 2 — Воркспейсы
// =============================================================================

export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface WorkspaceSettings {
  automation_enabled: boolean;
}

export interface WorkspaceMember {
  user_id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joined_at: string;
}

// =============================================================================
// Раздел 3 — Задачи
// =============================================================================

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type DeadlineUrgency = "none" | "soon" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string;
  column_id: string;
  workspace_id: string;
  priority: TaskPriority;
  tags: string[];
  assignee_id: string | null;
  created_at: string;
  deadline: string | null;
  deadline_urgency: DeadlineUrgency;
}

// =============================================================================
// Раздел 4 — Доска
// =============================================================================

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

// =============================================================================
// Раздел 5 — Автоматизация
// =============================================================================

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

// =============================================================================
// Раздел 6 — Уведомления
// =============================================================================

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

// =============================================================================
// Раздел 7 — Аудит
// =============================================================================

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

// =============================================================================
// Раздел 8 — WebSocket / JSON-RPC
// =============================================================================

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

// =============================================================================
// Раздел 9 — AI-груминг
// =============================================================================

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
