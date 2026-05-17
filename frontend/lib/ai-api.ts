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

const MOCK_ENABLED = process.env.NEXT_PUBLIC_AI_MOCK === "true";

function mockDelay<T>(value: T, ms = 800): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function groomStart(
  workspaceId: string,
  problemDescription: string
): Promise<GroomStartResponse> {
  if (MOCK_ENABLED) {
    return mockDelay({
      session_id: `mock-session-${Date.now()}`,
      questions: [
        { id: "q1", text: "Кто будет работать над этой задачей и каков её приоритет?" },
        { id: "q2", text: "Какой конкретный результат должен быть достигнут?" },
        { id: "q3", text: "Есть ли ограничения по срокам или зависимости от других задач?" },
      ],
    });
  }
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
  if (MOCK_ENABLED) {
    const answersText = answers.map((a) => `- ${a.answer}`).join("\n");
    return mockDelay({
      task_draft: {
        title: problemDescription.slice(0, 60).trim(),
        description: `${problemDescription}\n\n**Уточнения:**\n${answersText}`,
        priority: "medium",
        tags: ["ai-generated"],
      },
    });
  }
  return api.post<GroomCompleteResponse>("/api/v1/ai/groom/complete", {
    session_id: sessionId,
    problem_description: problemDescription,
    answers,
  });
}
