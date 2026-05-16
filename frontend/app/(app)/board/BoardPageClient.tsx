"use client";

import { useCallback, useEffect, useState } from "react";
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
import TaskModal from "@/components/board/TaskModal";
import type { AddTaskData } from "@/components/board/AddTaskForm";
import BoardSkeleton from "@/components/board/BoardSkeleton";
import ErrorBanner from "@/components/board/ErrorBanner";

export default function BoardPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const workspaceId = searchParams.get("workspace_id");

  const { init, on, off } = useWs();

  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "info" } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  function showToast(msg: string, type: "error" | "info" = "error") {
    setToast({ msg, type });
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
          router.replace("/workspace/create");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить рабочие пространства");
        setIsLoading(false);
      });
  }, [authLoading, isAuthenticated, workspaceId, loadBoard, router]);

  const handleTaskCreated = useCallback((params: Record<string, unknown>) => {
    const task = parseBoardTask(params);
    setBoard((prev) => {
      if (!prev) return prev;
      const col = prev.columns.find((c) => c.id === task.column_id);
      if (col?.tasks.some((t) => t.id === task.id)) return prev;
      return addTaskToColumn(prev, task);
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
      return moveTaskInBoard(prev, taskId, columnId, position);
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

  const handleCardClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleOpenTask = useCallback((taskId: string) => {
    const found = board?.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId) ?? null;
    if (found) {
      setSelectedTask(found);
    } else {
      showToast("Задача уже удалена", "info");
    }
  }, [board]);

  const handleCloseModal = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskEdit = useCallback(async (updatedTask: Task): Promise<void> => {
    let snapshot: Board | null = null;
    setBoard(prev => {
      if (!prev) return prev;
      snapshot = structuredClone(prev);
      return replaceTask(prev, updatedTask);
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
      setBoard(prev => prev ? replaceTask(prev, saved) : prev);
      setSelectedTask(null);
    } catch (e) {
      if (snapshot) setBoard(snapshot);
      showToast("Не удалось сохранить задачу");
      throw e;
    }
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string): Promise<void> => {
    let snapshot: Board | null = null;
    setBoard(prev => {
      if (!prev) return prev;
      snapshot = structuredClone(prev) as Board;
      return deleteTask(prev, taskId);
    });
    setSelectedTask(null);

    try {
      await api.delete(`/api/v1/tasks/${taskId}`);
    } catch (e) {
      const snap = snapshot as Board | null;
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

    setBoard((prev) => (prev ? addTaskToColumn(prev, tempTask) : prev));

    try {
      const { task: created } = await api.post<{ task: Task }>("/api/v1/tasks", {
        title: data.title,
        column_id: columnId,
        workspace_id: workspaceId,
        priority: data.priority,
        description: data.description,
        deadline: data.deadline,
        ...(data.force ? { force: true } : {}),
      });
      setBoard((prev) => {
        if (!prev) return prev;
        const withoutTemp = deleteTask(prev, tempTask.id);
        const col = withoutTemp.columns.find((c) => c.id === columnId);
        // WS-событие могло уже добавить реальную задачу — тогда заменяем, иначе добавляем
        if (col?.tasks.some((t) => t.id === created.id)) {
          return replaceTask(withoutTemp, created);
        }
        return addTaskToColumn(withoutTemp, created);
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
    <div className="min-h-full bg-[#050505]">
      <KanbanBoard
        board={board}
        onTaskMove={handleTaskMove}
        onTaskCreate={handleTaskCreate}
        onCardClick={handleCardClick}
        onOpenTask={handleOpenTask}
      />
      {selectedTask && workspaceId && (
        <TaskModal
          task={selectedTask}
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

