import { api } from "./api";

export interface StatusCount {
  column_id: string;
  column_name: string;
  count: number;
}

export interface OverviewResponse {
  by_status: StatusCount[];
  total: number;
}

export interface TrendPoint {
  date: string;
  done: number;
  total: number;
}

export interface ProgressResponse {
  range: "week" | "month";
  done_pct: number;
  trend: TrendPoint[];
}

export interface AssigneeLoad {
  assignee_id: string | null;
  name: string | null;
  count: number;
  done: number;
}

export interface WorkloadResponse {
  by_assignee: AssigneeLoad[];
}

export function getOverview(boardId: string): Promise<OverviewResponse> {
  return api.get<OverviewResponse>(
    `/api/v1/boards/${boardId}/analytics/overview`
  );
}

export function getProgress(
  boardId: string,
  range: "week" | "month" = "week"
): Promise<ProgressResponse> {
  const params = new URLSearchParams({ range });
  return api.get<ProgressResponse>(
    `/api/v1/boards/${boardId}/analytics/progress?${params.toString()}`
  );
}

export function getWorkload(boardId: string): Promise<WorkloadResponse> {
  return api.get<WorkloadResponse>(
    `/api/v1/boards/${boardId}/analytics/workload`
  );
}
