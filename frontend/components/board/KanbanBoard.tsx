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
import type { Board, Column, Task } from "@/lib/types";
import ColumnComponent from "./Column";
import TaskCard from "./TaskCard";
import TaskPanel from "./TaskPanel";
import type { AddTaskData } from "./AddTaskForm";

interface KanbanBoardProps {
  board: Board;
  onTaskMove: (taskId: string, targetColumnId: string, newPosition: number) => void;
  onTaskCreate: (columnId: string, data: AddTaskData) => Promise<void>;
  onCardClick?: (task: Task) => void;
  isAdmin?: boolean;
  boardId?: string;
  onColumnUpdated?: (col: Column) => void;
  onColumnDeleted?: (id: string) => void;
  onColumnCreated?: (col: Column) => void;
}

export default function KanbanBoard({
  board,
  onTaskMove,
  onTaskCreate,
  isAdmin,
  boardId,
  onColumnUpdated,
  onColumnDeleted,
  onColumnCreated,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const lastIndex = board.columns.length - 1;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-6 px-8 py-6 overflow-x-auto min-h-screen items-start bg-[#050505] dot-texture">
          {board.columns.map((column, idx) => (
            <ColumnComponent
              key={column.id}
              column={column}
              onTaskCreate={onTaskCreate}
              onCardClick={setSelectedTask}
              isAdmin={isAdmin}
              boardId={boardId}
              isLast={idx === lastIndex}
              onColumnUpdated={onColumnUpdated}
              onColumnDeleted={onColumnDeleted}
              onColumnCreated={onColumnCreated}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 scale-105 shadow-2xl cursor-grabbing">
              <TaskCard task={activeTask} isDragging={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskPanel
        taskId={selectedTask?.id ?? null}
        workspaceId={selectedTask?.workspace_id ?? ""}
        boardId={boardId}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}
