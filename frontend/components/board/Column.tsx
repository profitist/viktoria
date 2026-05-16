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
}

function SortableTaskCard({ task }: { task: Task }) {
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
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

export default function Column({ column, onTaskCreate }: ColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const columnClasses = [
    "w-72 flex-shrink-0 bg-gray-50 rounded-xl p-3 flex flex-col gap-2 transition-colors duration-150",
    isOver ? "border-2 border-dashed border-blue-400 bg-blue-50" : "",
  ]
    .filter(Boolean)
    .join(" ");

  async function handleTaskCreate(title: string) {
    await onTaskCreate(column.id, title);
    setIsAddingTask(false);
  }

  return (
    <div className={columnClasses}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full bg-gray-400"
            style={column.color ? { backgroundColor: column.color } : undefined}
          />
          <span className="text-sm font-semibold text-gray-700">{column.name}</span>
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5">
            {column.tasks.length}
          </span>
        </div>
        <button
          onClick={() => setIsAddingTask(true)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          +
        </button>
      </div>

      <div ref={setNodeRef} className="flex flex-col gap-2 flex-1 min-h-[80px]">
        {column.tasks.length === 0 && !isAddingTask && (
          <p className="text-xs text-gray-400 text-center py-6">Нет задач</p>
        )}

        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
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
          className="text-xs text-gray-400 hover:text-gray-600 text-left mt-1 transition-colors"
        >
          + Добавить задачу
        </button>
      )}
    </div>
  );
}
