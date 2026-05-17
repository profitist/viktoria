import { api } from "./api";
import type { BoardMeta } from "./types";

export interface CreateBoardInput {
  name: string;
  description?: string;
  project_id?: string;
}

interface CreateBoardResponse {
  board: {
    id: string;
    name: string;
    description: string | null;
    project_id: string | null;
  };
}

export async function createBoard(
  workspaceId: string,
  input: CreateBoardInput
): Promise<BoardMeta> {
  const response = await api.post<CreateBoardResponse>(
    `/api/v1/workspaces/${workspaceId}/boards`,
    input
  );

  return {
    ...response.board,
    is_favorite: false,
  };
}
