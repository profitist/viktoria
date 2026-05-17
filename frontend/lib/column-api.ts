import { ApiError, apiFetch } from "./api";

export interface Column {
  id: string;
  name: string;
  position: number;
  color: string | null;
  board_id: string;
}

export interface CreateColumnInput {
  name: string;
  position: number;
  color?: string;
}

export interface UpdateColumnInput {
  name?: string;
  position?: number;
  color?: string;
}

interface ColumnResponse {
  column: Column;
}

interface ErrorResponse {
  detail?: string;
}

async function parseError(res: Response): Promise<never> {
  let detail: string | undefined;

  try {
    const body = (await res.json()) as ErrorResponse;
    detail = body.detail;
  } catch {
    // Use HTTP status below when the response body is empty or not JSON.
  }

  throw new ApiError(detail ?? `HTTP ${res.status}`, res.status);
}

async function parseColumn(res: Response): Promise<Column> {
  if (!res.ok) {
    return parseError(res);
  }

  const data = (await res.json()) as ColumnResponse;
  return data.column;
}

export async function createColumn(
  boardId: string,
  input: CreateColumnInput
): Promise<Column> {
  const res = await apiFetch(`/api/v1/boards/${boardId}/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseColumn(res);
}

export async function updateColumn(
  columnId: string,
  input: UpdateColumnInput
): Promise<Column> {
  const res = await apiFetch(`/api/v1/columns/${columnId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseColumn(res);
}

export async function deleteColumn(columnId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/columns/${columnId}`, {
    method: "DELETE",
  });

  if (res.status === 204) {
    return;
  }

  if (res.status === 409) {
    throw new ApiError("Колонка содержит задачи", 409);
  }

  if (!res.ok) {
    return parseError(res);
  }
}
