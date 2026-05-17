import { api } from "./api";
import type {
  AutomationRule,
  CreateRuleInput,
  InviteMemberInput,
  Member,
  PatchRuleInput,
  WorkspaceSettings,
} from "./admin-types";

export function getMembers(workspaceId: string): Promise<Member[]> {
  return api.get<Member[]>(`/api/v1/workspaces/${workspaceId}/members`);
}

export function inviteMember(
  workspaceId: string,
  input: InviteMemberInput
): Promise<Member> {
  return api
    .post<{ member: Member }>(`/api/v1/workspaces/${workspaceId}/members`, input)
    .then(({ member }) => member);
}

export function removeMember(
  workspaceId: string,
  userId: string
): Promise<void> {
  return api.delete(`/api/v1/workspaces/${workspaceId}/members/${userId}`);
}

export function getRules(workspaceId: string): Promise<AutomationRule[]> {
  return api.get<AutomationRule[]>(
    `/api/v1/workspaces/${workspaceId}/automation-rules`
  );
}

export function createRule(
  workspaceId: string,
  input: CreateRuleInput
): Promise<AutomationRule> {
  return api.post<AutomationRule>(
    `/api/v1/workspaces/${workspaceId}/automation-rules`,
    input
  );
}

export function updateRule(
  ruleId: string,
  input: PatchRuleInput
): Promise<AutomationRule> {
  return api.patch<AutomationRule>(`/api/v1/automation-rules/${ruleId}`, input);
}

export function deleteRule(ruleId: string): Promise<void> {
  return api.delete(`/api/v1/automation-rules/${ruleId}`);
}

export function getSettings(workspaceId: string): Promise<WorkspaceSettings> {
  return api
    .patch<{ settings: WorkspaceSettings }>(
      `/api/v1/workspaces/${workspaceId}/settings`,
      {}
    )
    .then(({ settings }) => settings);
}

export function updateSettings(
  workspaceId: string,
  input: Partial<WorkspaceSettings>
): Promise<WorkspaceSettings> {
  return api
    .patch<{ settings: WorkspaceSettings }>(
      `/api/v1/workspaces/${workspaceId}/settings`,
      input
    )
    .then(({ settings }) => settings);
}
