"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { api, ApiError, boardsApi } from "@/lib/api";
import { useWs } from "@/contexts/WsContext";
import type { BoardDetail, Task } from "@/lib/types";
import { parseBoardTask, parseMoveParams } from "@/lib/types";
import {
  moveTaskInBoard,
  addTaskToColumn,
  replaceTask,
  deleteTask,
} from "@/lib/boardUtils";
import KanbanBoard from "@/components/board/KanbanBoard";
import TaskModal from "@/components/board/TaskModal";
import type { AddTaskData } from "@/components/board/AddTaskForm";
import BoardSkeleton from "@/components/board/BoardSkeleton";
import ErrorBanner from "@/components/board/ErrorBanner";
import BoardSwitcher from "@/components/board/BoardSwitcher";

interface BoardPageClientProps {
  boardId: string;
}

export default function BoardPageClient({ boardId }: BoardPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const workspaceId = searchParams.get("workspace_id");

  const { init, on, off } = useWs();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "info" } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  function showToast(msg: string, type: "error" | "info" = "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { board: data } = await boardsApi.getDetail(boardId);
      setBoard(data);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        setError("Доска недоступна");
      } else if ((e as Error).message?.toLowerCase().includes("failed to fetch")) {
        setError("Нет соединения с сервером");
      } else {
        setError("Не удалось загрузить доску");
      }
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    loadBoard();
  }, [authLoading, isAuthenticated, boardId, loadBoard, router]);

  const handleTaskCreated = useCallback((params: Record<string, unknown>) => {
    const task = parseBoardTask(params);
    setBoard((prev) => {
      if (!prev) return prev;
      const col = prev.columns.find((c) => c.id === task.column_id);
      if (col?.tasks.some((t) => t.id === task.id)) return prev;
      return addTaskToColumn(prev, task) as BoardDetail;
    });
  }, []);

  const handleTaskUpdated = useCallback((params: Record<string, unknown>) => {
    const taskId = params["task_id"];
    const changes = params["payload"];
    if (typeof taskId !== "string" || typeof changes !== "object" || changes === null) return;
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => t.id === taskId ? { ...t, ...(changes as Partial<Task>) } : t),
        })),
      };
    });
  }, []);

  const handleTaskMoved = useCallback((params: Record<string, unknown>) => {
    const { taskId, column_id: columnId, position } = parseMoveParams(params);
    setBoard((prev) => {
      if (!prev) return prev;
      return moveTaskInBoard(prev, taskId, columnId, position) as BoardDetail;
    });
  }, []);

  const handleTaskDeleted = useCallback((params: Record<string, unknown>) => {
    const taskId = params["task_id"] as string;
    if (typeof taskId !== "string") {
      throw new Error(`Invalid board.task_deleted payload: ${JSON.stringify(params)}`);
    }
    setBoard((prev) => (prev ? deleteTask(prev, taskId) as BoardDetail : prev));
  }, []);

  useEffect(() => {
    if (!workspaceId || !user) return;

    init(workspaceId);

    on("board.task_created", handleTaskCreated);
    on("board.task_updated", handleTaskUpdated);
    on("board.task_moved", handleTaskMoved);
    on("board.task_deleted", handleTaskDeleted);

    return () => {
      off("board.task_created", handleTaskCreated);
      off("board.task_updated", handleTaskUpdated);
      off("board.task_moved", handleTaskMoved);
      off("board.task_deleted", handleTaskDeleted);
    };
  }, [workspaceId, user, init, on, off, handleTaskCreated, handleTaskUpdated, handleTaskMoved, handleTaskDeleted]);

  const handleCardClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskEdit = useCallback(async (updatedTask: Task): Promise<void> => {
    let snapshot: BoardDetail | null = null;
    setBoard(prev => {
      if (!prev) return prev;
      snapshot = structuredClone(prev);
      return replaceTask(prev, updatedTask) as BoardDetail;
    });

    try {
      const { task: saved } = await api.patch<{ task: Task }>(`/api/v1/tasks/${updatedTask.id}`, {
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        deadline: updatedTask.deadline,
        assignee_id: updatedTask.assignee_id,
        tags: updatedTask.tags,
      });
      setBoard(prev => prev ? replaceTask(prev, saved) as BoardDetail : prev);
      setSelectedTask(null);
    } catch (e) {
      if (snapshot) setBoard(snapshot);
      showToast("Не удалось сохранить задачу");
      throw e;
    }
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string): Promise<void> => {
    let snapshot: BoardDetail | null = null;
    setBoard(prev => {
      if (!prev) return prev;
      snapshot = structuredClone(prev) as BoardDetail;
      return deleteTask(prev, taskId) as BoardDetail;
    });
    setSelectedTask(null);

    try {
      await api.delete(`/api/v1/tasks/${taskId}`);
    } catch (e) {
      const snap = snapshot as BoardDetail | null;
      if (snap) {
        setBoard(snap);
        const restoredTask = snap.columns.flatMap(c => c.tasks).find(t => t.id === taskId) ?? null;
        setSelectedTask(restoredTask);
      }
      showToast("Не удалось удалить задачу");
      throw e;
    }
  }, []);

  function handleTaskMove(taskId: string, targetColumnId: string, newPosition: number) {
    let snapshot: BoardDetail | null = null;
    setBoard((prev) => {
      if (!prev) return prev;
      snapshot = structuredClone(prev);
      return moveTaskInBoard(prev, taskId, targetColumnId, newPosition) as BoardDetail;
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

  async function handleTaskCreate(columnId: string, data: AddTaskData): Promise<void> {
    if (!workspaceId) return;

    const tempTask: Task = {
      id: `temp-${Date.now()}`,
      title: data.title,
      column_id: columnId,
      workspace_id: workspaceId,
      priority: data.priority,
      tags: [],
      assignee_id: null,
      created_at: new Date().toISOString(),
      deadline: data.deadline ?? null,
      deadline_urgency: "none",
      description: data.description ?? "",
    };

    setBoard((prev) => (prev ? addTaskToColumn(prev, tempTask) as BoardDetail : prev));

    try {
      const { task: created } = await api.post<{ task: Task }>("/api/v1/tasks", {
        title: data.title,
        column_id: columnId,
        workspace_id: workspaceId,
        priority: data.priority,
        description: data.description,
        deadline: data.deadline,
      });
      setBoard((prev) => {
        if (!prev) return prev;
        const withoutTemp = deleteTask(prev, tempTask.id);
        const col = withoutTemp.columns.find((c) => c.id === columnId);
        if (col?.tasks.some((t) => t.id === created.id)) {
          return replaceTask(withoutTemp, created) as BoardDetail;
        }
        return addTaskToColumn(withoutTemp, created) as BoardDetail;
      });
    } catch (e) {
      setBoard((prev) => (prev ? deleteTask(prev, tempTask.id) as BoardDetail : prev));
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
    <div className="min-h-full bg-[#050505]">
      {/* Board header */}
      <div
        style={{
          height: "52px",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          background: "#080808",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <BoardSwitcher
          boardId={boardId}
          boardName={board.name}
          isFavorite={board.is_favorite}
          workspaceId={workspaceId ?? ""}
          onFavoriteChange={(isFav) =>
            setBoard(prev => prev ? { ...prev, is_favorite: isFav } : prev)
          }
        />
      </div>

      <KanbanBoard
        board={board}
        onTaskMove={handleTaskMove}
        onTaskCreate={handleTaskCreate}
        onCardClick={handleCardClick}
      />

      {selectedTask && workspaceId && (
        <TaskModal
          task={selectedTask}
          boardId={boardId}
          workspaceId={workspaceId}
          onSave={handleTaskEdit}
          onDelete={handleTaskDelete}
          onClose={handleCloseModal}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-lg z-50"
          style={toast.type === "error" ? {
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#FCA5A5",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          } : {
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.72)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
