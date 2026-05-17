"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { columnsApi } from "@/lib/api";
import type { Board, Column, Task } from "@/lib/types";
import ColumnComponent from "./Column";
import TaskCard from "./TaskCard";
import TaskPanel from "./TaskPanel";
import type { AddTaskData } from "./AddTaskForm";

interface KanbanBoardProps {
  board: Board;
  onTaskMove: (taskId: string, targetColumnId: string, newPosition: number) => void;
  onTaskCreate: (columnId: string, data: AddTaskData) => Promise<void>;
  onTaskCreated?: (task: Task) => void;
  onCardClick?: (task: Task) => void;
  onTaskUpdate?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  isAdmin?: boolean;
  deadlineDecayEnabled?: boolean;
  boardId?: string;
  workspaceId?: string;
  onColumnUpdated?: (col: Column) => void;
  onColumnDeleted?: (id: string) => void;
  onColumnCreated?: (col: Column) => void;
}

export default function KanbanBoard({
  board,
  onTaskMove,
  onTaskCreate,
  onTaskCreated,
  onTaskUpdate,
  onTaskDelete,
  isAdmin,
  deadlineDecayEnabled = false,
  boardId,
  workspaceId,
  onColumnUpdated,
  onColumnDeleted,
  onColumnCreated,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isPendingCreateColumn, setIsPendingCreateColumn] = useState(false);
  const [createColumnError, setCreateColumnError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const taskId = event.active.id as string;
    for (const col of board.columns) {
      const found = col.tasks.find((t) => t.id === taskId);
      if (found) {
        setActiveTask(found);
        return;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const overIsColumn = board.columns.some((c) => c.id === overId);

    let targetColumnId: string;

    if (overIsColumn) {
      targetColumnId = overId;
    } else {
      const targetColumn = board.columns.find((c) =>
        c.tasks.some((t) => t.id === overId)
      );
      if (!targetColumn) return;
      targetColumnId = targetColumn.id;
    }

    const targetColumn = board.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    let newPosition: number;

    if (overIsColumn) {
      newPosition = targetColumn.tasks.length;
    } else {
      const idx = targetColumn.tasks.findIndex((t) => t.id === overId);
      newPosition = idx === -1 ? targetColumn.tasks.length : idx;
    }

    onTaskMove(taskId, targetColumnId, newPosition);
  }

  function handleDragCancel() {
    setActiveTask(null);
  }

  function openCreateColumn() {
    setNewColumnName("");
    setCreateColumnError(null);
    setIsCreatingColumn(true);
  }

  function closeCreateColumn() {
    if (isPendingCreateColumn) return;
    setIsCreatingColumn(false);
  }

  async function handleCreateColumn() {
    const name = newColumnName.trim();
    if (!name || !boardId) return;

    const lastColumn = board.columns[board.columns.length - 1];
    const position = lastColumn ? lastColumn.position + 1 : 0;

    setIsPendingCreateColumn(true);
    setCreateColumnError(null);
    try {
      const { column } = await columnsApi.create(boardId, { name, position });
      onColumnCreated?.({ ...column, tasks: [] });
      setIsCreatingColumn(false);
      setNewColumnName("");
    } catch {
      setCreateColumnError(
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043b\u043e\u043d\u043a\u0443"
      );
    } finally {
      setIsPendingCreateColumn(false);
    }
  }

  const lastIndex = board.columns.length - 1;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-6 px-8 py-6 overflow-x-auto min-h-screen items-start dot-texture">
          {board.columns.map((column, idx) => (
            <ColumnComponent
              key={column.id}
              column={column}
              onTaskCreate={onTaskCreate}
              onTaskCreated={onTaskCreated}
              onCardClick={setSelectedTask}
              isAdmin={isAdmin}
              isLast={idx === lastIndex}
              deadlineDecayEnabled={deadlineDecayEnabled}
              boardId={boardId}
              workspaceId={workspaceId}
              onColumnUpdated={onColumnUpdated}
              onColumnDeleted={onColumnDeleted}
            />
          ))}

          {isAdmin && boardId && (
            <button
              type="button"
              onClick={openCreateColumn}
              className="w-72 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors"
              style={{
                minHeight: "96px",
                border: "1px dashed rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.02)",
                color: "rgba(255,255,255,0.42)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                e.currentTarget.style.color = "rgba(255,255,255,0.72)";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "rgba(255,255,255,0.42)";
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              }}
            >
              {"\u002b \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043b\u043e\u043d\u043a\u0443"}
            </button>
          )}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 scale-105 shadow-2xl cursor-grabbing">
              <TaskCard
                task={activeTask}
                isDragging={false}
                deadlineDecayEnabled={deadlineDecayEnabled}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskPanel
        taskId={selectedTask?.id ?? null}
        workspaceId={selectedTask?.workspace_id ?? ""}
        boardId={boardId}
        onClose={() => setSelectedTask(null)}
        onTaskUpdate={(updated) => {
          setSelectedTask(updated);
          onTaskUpdate?.(updated);
        }}
        onTaskDelete={(id) => {
          setSelectedTask(null);
          onTaskDelete?.(id);
        }}
      />

      {isCreatingColumn && (
        <CreateColumnModal
          value={newColumnName}
          error={createColumnError}
          isPending={isPendingCreateColumn}
          onChange={setNewColumnName}
          onSubmit={handleCreateColumn}
          onClose={closeCreateColumn}
        />
      )}
    </>
  );
}

function CreateColumnModal({
  value,
  error,
  isPending,
  onChange,
  onSubmit,
  onClose,
}: {
  value: string;
  error: string | null;
  isPending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px",
          padding: "24px",
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
          {"\u041d\u043e\u0432\u0430\u044f \u043a\u043e\u043b\u043e\u043d\u043a\u0430"}
        </h2>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onClose();
          }}
          placeholder={"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u043e\u043b\u043e\u043d\u043a\u0438"}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#FFFFFF",
            padding: "8px 12px",
            fontSize: "13px",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        {error && <p style={{ fontSize: "12px", color: "#FCA5A5", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.72)",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {"\u041e\u0442\u043c\u0435\u043d\u0430"}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !value.trim()}
            style={{
              background: "#3B82F6",
              border: "none",
              color: "#FFFFFF",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isPending || !value.trim() ? "not-allowed" : "pointer",
              opacity: isPending || !value.trim() ? 0.6 : 1,
            }}
          >
            {isPending
              ? "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435..."
              : "\u0421\u043e\u0437\u0434\u0430\u0442\u044c"}
          </button>
        </div>
      </div>
    </div>
  );
}
