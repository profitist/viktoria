import { api } from "./api";

export interface GroomQuestion {
  id: string;
  text: string;
}

export interface GroomStartResponse {
  session_id: string;
  questions: GroomQuestion[];
}

export interface GroomAnswer {
  question_id: string;
  answer: string;
}

export interface TaskDraft {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  tags: string[];
}

export interface GroomCompleteResponse {
  task_draft: TaskDraft;
}

export function groomStart(
  workspaceId: string,
  problemDescription: string
): Promise<GroomStartResponse> {
  return api.post<GroomStartResponse>("/api/v1/ai/groom/start", {
    workspace_id: workspaceId,
    problem_description: problemDescription,
  });
}

export function groomComplete(
  sessionId: string,
  problemDescription: string,
  answers: GroomAnswer[]
): Promise<GroomCompleteResponse> {
  return api.post<GroomCompleteResponse>("/api/v1/ai/groom/complete", {
    session_id: sessionId,
    problem_description: problemDescription,
    answers,
  });
}
