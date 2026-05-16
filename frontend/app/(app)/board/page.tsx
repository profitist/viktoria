"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { api, ApiError } from "@/lib/api";
import { useWs } from "@/contexts/WsContext";
import type { Board, Task } from "@/lib/types";
import { parseBoardTask, parseMoveParams } from "@/lib/types";
import {
  moveTaskInBoard,
  addTaskToColumn,
  replaceTask,
  deleteTask,
} from "@/lib/boardUtils";
import KanbanBoard from "@/components/board/KanbanBoard";
import BoardSkeleton from "@/components/board/BoardSkeleton";
import ErrorBanner from "@/components/board/ErrorBanner";

function BoardPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const workspaceId = searchParams.get("workspace_id");

  const { init, on, off } = useWs();

  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const loadBoard = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { board: data } = await api.get<{ board: Board }>(`/api/v1/workspaces/${workspaceId}/board`);
      setBoard(data);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        setError("Доска недоступна");
      } else if ((e as Error).message.toLowerCase().includes("failed to fetch")) {
        setError("Нет соединения с сервером");
      } else {
        setError("Не удалось загрузить доску");
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (workspaceId) {
      loadBoard();
      return;
    }

    // Авторизован, но workspace_id в URL нет — резолвим первый доступный
    api
      .get<{ id: string }[]>("/api/v1/workspaces/me")
      .then((ws) => {
        if (ws.length > 0) {
          router.replace(`/board?workspace_id=${ws[0].id}`);
        } else {
          setError("Нет доступных рабочих пространств");
          setIsLoading(false);
        }
      })
      .catch(() => {
        setError("Не удалось загрузить рабочие пространства");
        setIsLoading(false);
      });
  }, [authLoading, isAuthenticated, workspaceId, loadBoard, router]);

  const handleTaskCreated = useCallback((params: Record<string, unknown>) => {
    // ISSUE-004: fail-fast валидация вместо небезопасного as-cast
    const task = parseBoardTask(params);
    setBoard((prev) => {
      if (!prev) return prev;
      const col = prev.columns.find((c) => c.id === task.column_id);
      if (col?.tasks.some((t) => t.id === task.id)) return prev;
      return addTaskToColumn(prev, task);
    });
  }, []);

  const handleTaskUpdated = useCallback((params: Record<string, unknown>) => {
    // ISSUE-004: fail-fast валидация вместо небезопасного as-cast
    const task = parseBoardTask(params);
    setBoard((prev) => (prev ? replaceTask(prev, task) : prev));
  }, []);

  const handleTaskMoved = useCallback((params: Record<string, unknown>) => {
    // ISSUE-004: fail-fast валидация вместо небезопасных as-cast
    const { task, column_id: columnId, position } = parseMoveParams(params);
    setBoard((prev) => {
      if (!prev) return prev;
      return moveTaskInBoard(prev, task.id, columnId, position);
    });
  }, []);

  const handleTaskDeleted = useCallback((params: Record<string, unknown>) => {
    const taskId = params["task_id"] as string;
    if (typeof taskId !== "string") {
      throw new Error(`Invalid board.task_deleted payload: ${JSON.stringify(params)}`);
    }
    setBoard((prev) => (prev ? deleteTask(prev, taskId) : prev));
  }, []);

  useEffect(() => {
    if (!workspaceId || !user) return;

    // init идемпотентен: повторный вызов с тем же workspaceId — no-op
    init(workspaceId);

    on("board.task_created", handleTaskCreated);
    on("board.task_updated", handleTaskUpdated);
    on("board.task_moved", handleTaskMoved);
    on("board.task_deleted", handleTaskDeleted);

    return () => {
      // Disconnect — обязанность WsProvider при размонтировании layout
      off("board.task_created", handleTaskCreated);
      off("board.task_updated", handleTaskUpdated);
      off("board.task_moved", handleTaskMoved);
      off("board.task_deleted", handleTaskDeleted);
    };
  }, [workspaceId, user, init, on, off, handleTaskCreated, handleTaskUpdated, handleTaskMoved, handleTaskDeleted]);

  function handleTaskMove(taskId: string, targetColumnId: string, newPosition: number) {
    let snapshot: Board | null = null;
    setBoard((prev) => {
      if (!prev) return prev;
      snapshot = structuredClone(prev);
      return moveTaskInBoard(prev, taskId, targetColumnId, newPosition);
    });

    api
      .put(`/api/v1/tasks/${taskId}/move`, {
        column_id: targetColumnId,
        position: newPosition,
      })
      .catch(() => {
        if (snapshot) setBoard(snapshot);
        showToast("Не удалось переместить задачу");
      });
  }

  async function handleTaskCreate(columnId: string, title: string): Promise<void> {
    if (!workspaceId) return;

    const tempTask: Task = {
      id: `temp-${Date.now()}`,
      title,
      column_id: columnId,
      workspace_id: workspaceId,
      priority: "medium",
      tags: [],
      assignee_id: null,
      created_at: new Date().toISOString(),
      deadline: null,
      deadline_urgency: "none",
      description: "",
    };

    setBoard((prev) => (prev ? addTaskToColumn(prev, tempTask) : prev));

    try {
      const created = await api.post<Task>("/api/v1/tasks", {
        title,
        column_id: columnId,
        workspace_id: workspaceId,
      });
      setBoard((prev) => {
        if (!prev) return prev;
        return replaceTask(deleteTask(prev, tempTask.id), created);
      });
    } catch (e) {
      setBoard((prev) => (prev ? deleteTask(prev, tempTask.id) : prev));
      throw e;
    }
  }

  if (isLoading) return <BoardSkeleton />;

  if (error) {
    return (
      <ErrorBanner
        message={error}
        onRetry={error !== "Доска недоступна" ? loadBoard : undefined}
      />
    );
  }

  if (!board) return null;

  return (
    <div className="min-h-full bg-gray-100">
      <KanbanBoard
        board={board}
        onTaskMove={handleTaskMove}
        onTaskCreate={handleTaskCreate}
      />
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardPageContent />
    </Suspense>
  );
}
