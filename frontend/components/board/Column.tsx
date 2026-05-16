"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column as ColumnType, Task } from "@/lib/types";
import TaskCard from "./TaskCard";
import AddTaskForm from "./AddTaskForm";

interface ColumnProps {
  column: ColumnType;
  onTaskCreate: (columnId: string, title: string) => Promise<void>;
  onCardClick: (task: Task) => void;
}

function SortableTaskCard({ task, onCardClick }: { task: Task; onCardClick: (task: Task) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} onClick={() => onCardClick(task)} />
    </div>
  );
}

export default function Column({ column, onTaskCreate, onCardClick }: ColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  async function handleTaskCreate(title: string) {
    await onTaskCreate(column.id, title);
    setIsAddingTask(false);
  }

  return (
    <div
      className="w-72 flex-shrink-0 flex flex-col gap-2 transition-colors duration-150 rounded-xl p-2"
      style={isOver ? { background: "rgba(255,255,255,0.03)" } : undefined}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {column.name}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {column.tasks.length}
          </span>
        </div>
        <button
          onClick={() => setIsAddingTask(true)}
          className="text-lg leading-none transition-colors"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
        >
          +
        </button>
      </div>

      <div ref={setNodeRef} className="flex flex-col gap-2 flex-1 min-h-[80px]">
        {column.tasks.length === 0 && !isAddingTask && (
          <div
            className="flex items-center justify-center py-6 rounded-lg"
            style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
          >
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Нет задач
            </p>
          </div>
        )}

        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onCardClick={onCardClick} />
          ))}
        </SortableContext>

        {isAddingTask && (
          <AddTaskForm
            onSubmit={handleTaskCreate}
            onCancel={() => setIsAddingTask(false)}
          />
        )}
      </div>

      {!isAddingTask && (
        <button
          onClick={() => setIsAddingTask(true)}
          className="text-xs text-left mt-1 transition-colors px-1"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
        >
          + Добавить задачу
        </button>
      )}
    </div>
  );
}
