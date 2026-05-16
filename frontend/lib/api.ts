import type { BoardMeta, BoardDetail, Project, WorkspaceMember, WorkspaceSettings, Tag, Subtask } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// =============================================================================
// Модульное состояние (module-level state)
// =============================================================================

let accessToken: string | null = null;
let onLogout: (() => void) | null = null;

// Mutex для параллельных 401: если refresh уже запущен — ждать его, не запускать новый
let refreshPromise: Promise<string | null> | null = null;

// =============================================================================
// Управление токеном и callback-ами
// =============================================================================

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function registerLogoutCallback(cb: () => void): void {
  onLogout = cb;
}

// =============================================================================
// Внутренняя функция refresh (прямой fetch, не через apiFetch — нет рекурсии)
// =============================================================================

async function executeRefresh(): Promise<string | null> {
  const refreshToken = sessionStorage.getItem("refresh_token");

  if (!refreshToken) {
    sessionStorage.removeItem("refresh_token");
    onLogout?.();
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // Сетевая ошибка — не разлогиниваем, просто возвращаем null
    return null;
  }

  if (!res.ok) {
    // 401, 403, 5xx и прочие ошибки — разлогиниваем и очищаем storage
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    onLogout?.();
    return null;
  }

  let data: { access_token: string };
  try {
    data = (await res.json()) as { access_token: string };
  } catch {
    // Невалидный JSON от сервера — разлогиниваем
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    onLogout?.();
    return null;
  }

  setAccessToken(data.access_token);
  return data.access_token;
}

async function doRefresh(): Promise<string | null> {
  // Все параллельные 401 берут ссылку на один промис ДО его завершения
  if (refreshPromise !== null) return refreshPromise;
  refreshPromise = executeRefresh();
  const result = await refreshPromise;
  // Обнуляем только после await — не в .finally()
  refreshPromise = null;
  return result;
}

// =============================================================================
// Основной fetch-враппер
// =============================================================================

export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${BASE_URL}${path}`;

  // Формируем заголовки с Bearer токеном
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (accessToken !== null) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, { ...options, headers });

  // Не 401 — возвращаем как есть, вызывающий код решает что делать
  if (res.status !== 401) {
    return res;
  }

  // 401: пробуем refresh через mutex (защита от параллельных запросов)
  // doRefresh() гарантирует что все параллельные 401 ждут одного промиса
  const newToken = await doRefresh();

  if (newToken === null) {
    // Refresh не удался — logout уже вызван внутри doRefresh
    return res;
  }

  // Повторяем запрос с новым токеном
  const retryHeaders: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (accessToken !== null) {
    retryHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  // Повторный запрос 401 не обрабатываем — возвращаем как есть
  return fetch(url, { ...options, headers: retryHeaders });
}

// =============================================================================
// Типизированная ошибка с HTTP-статусом
// =============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// =============================================================================
// Хелпер для обработки HTTP-ошибок (4xx, 5xx кроме 401)
// =============================================================================

async function handleError(res: Response): Promise<never> {
  let detail: string | undefined;
  try {
    const body = await res.json();
    detail = body?.detail;
  } catch {
    // Тело не распарсилось — используем статус-код
  }
  throw new ApiError(detail ?? `HTTP ${res.status}`, res.status);
}

// =============================================================================
// Объект-хелпер api
// =============================================================================

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await apiFetch(path, { method: "GET" });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await apiFetch(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await apiFetch(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async delete(path: string): Promise<void> {
    const res = await apiFetch(path, { method: "DELETE" });
    if (!res.ok) return handleError(res);
  },
};

// =============================================================================
// Хелперы для многодосочности
// =============================================================================

export const boardsApi = {
  list: (workspaceId: string): Promise<BoardMeta[]> =>
    api.get<BoardMeta[]>(`/api/v1/workspaces/${workspaceId}/boards`),

  getDetail: (boardId: string): Promise<{ board: BoardDetail }> =>
    api.get<{ board: BoardDetail }>(`/api/v1/boards/${boardId}`),

  setFavorite: (boardId: string): Promise<{ is_favorite: boolean }> =>
    api.post<{ is_favorite: boolean }>(`/api/v1/boards/${boardId}/favorite`, {}),

  unsetFavorite: (boardId: string): Promise<void> =>
    api.delete(`/api/v1/boards/${boardId}/favorite`),
};

export const projectsApi = {
  list: (workspaceId: string): Promise<Project[]> =>
    api.get<Project[]>(`/api/v1/workspaces/${workspaceId}/projects`),
};

export const workspaceApi = {
  getSettings: (workspaceId: string): Promise<{ settings: WorkspaceSettings }> =>
    api.patch<{ settings: WorkspaceSettings }>(
      `/api/v1/workspaces/${workspaceId}/settings`,
      {}
    ),

  getMembers: (workspaceId: string): Promise<WorkspaceMember[]> =>
    api.get<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`),

  addMember: (
    workspaceId: string,
    email: string,
    role: "admin" | "member"
  ): Promise<{ member: WorkspaceMember }> =>
    api.post<{ member: WorkspaceMember }>(
      `/api/v1/workspaces/${workspaceId}/members`,
      { email, role }
    ),

  removeMember: (workspaceId: string, userId: string): Promise<void> =>
    api.delete(`/api/v1/workspaces/${workspaceId}/members/${userId}`),

  updateSettings: (
    workspaceId: string,
    settings: Partial<WorkspaceSettings>
  ): Promise<{ settings: WorkspaceSettings }> =>
    api.patch<{ settings: WorkspaceSettings }>(
      `/api/v1/workspaces/${workspaceId}/settings`,
      settings
    ),
};

export const tagsApi = {
  getBoardTags: (boardId: string): Promise<Tag[]> =>
    api.get<Tag[]>(`/api/v1/boards/${boardId}/tags`),

  createTag: (boardId: string, data: { name: string; color: string }): Promise<Tag> =>
    api.post<Tag>(`/api/v1/boards/${boardId}/tags`, data),

  deleteTag: (boardId: string, tagId: string): Promise<void> =>
    api.delete(`/api/v1/boards/${boardId}/tags/${tagId}`),

  addTagToTask: (taskId: string, tagId: string): Promise<void> =>
    api.post<void>(`/api/v1/tasks/${taskId}/tags/${tagId}`, {}),

  removeTagFromTask: (taskId: string, tagId: string): Promise<void> =>
    api.delete(`/api/v1/tasks/${taskId}/tags/${tagId}`),
};

export const subtasksApi = {
  getSubtasks: (taskId: string): Promise<Subtask[]> =>
    api.get<Subtask[]>(`/api/v1/tasks/${taskId}/subtasks`),

  createSubtask: (taskId: string, title: string): Promise<Subtask> =>
    api.post<Subtask>(`/api/v1/tasks/${taskId}/subtasks`, { title }),

  updateSubtask: (
    taskId: string,
    subtaskId: string,
    data: Partial<Pick<Subtask, "title" | "is_done" | "order">>
  ): Promise<Subtask> =>
    api.patch<Subtask>(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, data),

  deleteSubtask: (taskId: string, subtaskId: string): Promise<void> =>
    api.delete(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`),
};
