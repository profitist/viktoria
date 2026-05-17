export interface Member {
  user_id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export type TriggerType =
  | "task.created"
  | "task.moved"
  | "task.updated"
  | "deadline.approaching";

export type ConditionOperator = "eq" | "contains" | "gt" | "lt";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ActionType = "move_to_column" | "add_tag" | "notify_members";

export interface RuleAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  active: boolean;
  trigger: TriggerType;
  condition: RuleCondition | null;
  action: RuleAction;
}

export interface WorkspaceSettings {
  automation_enabled: boolean;
  deadline_decay_enabled: boolean;
}

export interface InviteMemberInput {
  email: string;
  role: "admin" | "member";
}

export interface CreateRuleInput {
  name: string;
  trigger: TriggerType;
  condition?: RuleCondition;
  action: RuleAction;
}

export interface PatchRuleInput {
  name?: string;
  active?: boolean;
  condition?: RuleCondition | null;
  action?: RuleAction;
}
