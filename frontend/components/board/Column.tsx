"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ApiError, columnsApi, patchTaskDone } from "@/lib/api";
import type { Column as ColumnType, Task } from "@/lib/types";
import TaskCard from "./TaskCard";
import AddTaskForm, { type AddTaskData } from "./AddTaskForm";
import { CreateTaskDialog } from "./CreateTaskDialog";

// ── props ──────────────────────────────────────────────────────────────────────

interface ColumnProps {
  column: ColumnType;
  onTaskCreate: (columnId: string, data: AddTaskData) => Promise<void>;
  onTaskCreated?: (task: Task) => void;
  onCardClick: (task: Task) => void;
  isAdmin?: boolean;
  isLast?: boolean;
  deadlineDecayEnabled?: boolean;
  boardId?: string;
  workspaceId?: string;
  onColumnUpdated?: (col: ColumnType) => void;
  onColumnDeleted?: (id: string) => void;
}

// ── sortable task card ─────────────────────────────────────────────────────────

function SortableTaskCard({
  task,
  onCardClick,
  deadlineDecayEnabled,
  showToast,
}: {
  task: Task;
  onCardClick: (task: Task) => void;
  deadlineDecayEnabled: boolean;
  showToast: (msg: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  async function handleToggleDone() {
    try {
      await patchTaskDone(task.id, !task.done);
    } catch {
      showToast("Не удалось изменить статус задачи");
      throw new Error();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        isDragging={isDragging}
        onClick={() => onCardClick(task)}
        isDone={task.done}
        deadlineDecayEnabled={deadlineDecayEnabled}
        onToggleDone={handleToggleDone}
      />
    </div>
  );
}

// ── modal overlay ──────────────────────────────────────────────────────────────

function Modal({
  onBackdropClick,
  children,
}: {
  onBackdropClick: () => void;
  children: React.ReactNode;
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
        if (e.target === e.currentTarget) onBackdropClick();
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
        {children}
      </div>
    </div>
  );
}

// ── toast ──────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: "rgba(239,68,68,0.15)",
        border: "1px solid rgba(239,68,68,0.3)",
        color: "#FCA5A5",
        fontSize: "13px",
        padding: "10px 18px",
        borderRadius: "10px",
        whiteSpace: "nowrap",
      }}
    >
      {msg}
    </div>
  );
}

// ── dropdown menu ──────────────────────────────────────────────────────────────

interface DropdownMenuProps {
  isFirst: boolean;
  isLast: boolean;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  pending: boolean;
}

function DropdownMenu({
  isFirst,
  isLast,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
  pending,
}: DropdownMenuProps) {
  const itemStyle = (disabled?: boolean): React.CSSProperties => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "7px 12px",
    fontSize: "13px",
    background: "none",
    border: "none",
    borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.75)",
    transition: "background 100ms, color 100ms",
  });

  function hoverOn(e: React.MouseEvent<HTMLButtonElement>, disabled?: boolean) {
    if (!disabled) {
      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      e.currentTarget.style.color = "#FFFFFF";
    }
  }
  function hoverOff(e: React.MouseEvent<HTMLButtonElement>, disabled?: boolean) {
    if (!disabled) {
      e.currentTarget.style.background = "none";
      e.currentTarget.style.color = "rgba(255,255,255,0.75)";
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        zIndex: 40,
        marginTop: "4px",
        background: "#1C1C1C",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px",
        padding: "4px",
        minWidth: "160px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <button
        style={itemStyle(pending)}
        disabled={pending}
        onClick={onRename}
        onMouseEnter={(e) => hoverOn(e)}
        onMouseLeave={(e) => hoverOff(e)}
      >
        Переименовать
      </button>
      <button
        style={itemStyle(isFirst || pending)}
        disabled={isFirst || pending}
        onClick={onMoveLeft}
        onMouseEnter={(e) => hoverOn(e, isFirst)}
        onMouseLeave={(e) => hoverOff(e, isFirst)}
      >
        ← Влево
      </button>
      <button
        style={itemStyle(isLast || pending)}
        disabled={isLast || pending}
        onClick={onMoveRight}
        onMouseEnter={(e) => hoverOn(e, isLast)}
        onMouseLeave={(e) => hoverOff(e, isLast)}
      >
        Вправо →
      </button>
      <div
        style={{
          height: "1px",
          background: "rgba(255,255,255,0.08)",
          margin: "4px 8px",
        }}
      />
      <button
        style={{ ...itemStyle(pending), color: pending ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.8)" }}
        disabled={pending}
        onClick={onDelete}
        onMouseEnter={(e) => {
          if (!pending) {
            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
            e.currentTarget.style.color = "#EF4444";
          }
        }}
        onMouseLeave={(e) => {
          if (!pending) {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "rgba(239,68,68,0.8)";
          }
        }}
      >
        Удалить колонку
      </button>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function Column({
  column,
  onTaskCreate,
  onTaskCreated,
  onCardClick,
  isAdmin = false,
  isLast = false,
  deadlineDecayEnabled = false,
  boardId,
  workspaceId,
  onColumnUpdated,
  onColumnDeleted,
}: ColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  // menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // rename
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);
  const [isPendingRename, setIsPendingRename] = useState(false);

  // move
  const [isPendingMove, setIsPendingMove] = useState(false);

  // delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPendingDelete, setIsPendingDelete] = useState(false);

  // toast
  const [toast, setToast] = useState<string | null>(null);

  const isPending = isPendingRename || isPendingMove || isPendingDelete;

  // close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // sync rename value when column name changes externally
  useEffect(() => {
    if (!isRenaming) {
      queueMicrotask(() => setRenameValue(column.name));
    }
  }, [column.name, isRenaming]);

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleTaskCreate(data: AddTaskData) {
    await onTaskCreate(column.id, data);
    setIsAddingTask(false);
  }

  function openMenu() {
    setMenuOpen((prev) => !prev);
  }

  function startRename() {
    setRenameValue(column.name);
    setIsRenaming(true);
    setMenuOpen(false);
  }

  async function commitRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === column.name) {
      setIsRenaming(false);
      return;
    }
    setIsPendingRename(true);
    try {
      const { column: updated } = await columnsApi.update(column.id, { name: trimmed });
      onColumnUpdated?.({ ...updated, tasks: column.tasks });
    } catch {
      setToast("Не удалось переименовать колонку");
      setRenameValue(column.name);
    } finally {
      setIsPendingRename(false);
      setIsRenaming(false);
    }
  }

  async function moveColumn(dir: "left" | "right") {
    setMenuOpen(false);
    setIsPendingMove(true);
    const newPos = dir === "left" ? column.position - 1 : column.position + 1;
    try {
      const { column: updated } = await columnsApi.update(column.id, { position: newPos });
      onColumnUpdated?.({ ...updated, tasks: column.tasks });
    } catch {
      setToast("Не удалось переместить колонку");
    } finally {
      setIsPendingMove(false);
    }
  }

  async function handleDelete() {
    setIsPendingDelete(true);
    try {
      await columnsApi.delete(column.id);
      setConfirmDelete(false);
      onColumnDeleted?.(column.id);
    } catch (e) {
      setConfirmDelete(false);
      if (e instanceof ApiError && e.status === 409) {
        setToast("Сначала перенеси задачи");
      } else {
        setToast("Не удалось удалить колонку");
      }
    } finally {
      setIsPendingDelete(false);
    }
  }


  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="w-72 flex-shrink-0 flex flex-col gap-2 transition-colors duration-150 rounded-xl p-2"
        style={isOver ? { background: "rgba(255,255,255,0.03)" } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1 px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setRenameValue(column.name);
                    setIsRenaming(false);
                  }
                }}
                disabled={isPendingRename}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "6px",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  outline: "none",
                  width: "100%",
                  opacity: isPendingRename ? 0.6 : 1,
                }}
              />
            ) : (
              <>
                <span
                  className="text-xs font-semibold uppercase tracking-widest truncate"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                >
                  {column.name}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {column.tasks.length}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            {/* Add task button — admin only → opens CreateTaskDialog */}
            {isAdmin && !isRenaming && (
              <button
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                title="Создать задачу"
              >
                + Задача
              </button>
            )}

            {/* Three-dot menu (admin only) */}
            {isAdmin && !isRenaming && (
              <div ref={menuRef} style={{ position: "relative" }}>
                <button
                  onClick={openMenu}
                  disabled={isPending}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.3)",
                    cursor: isPending ? "wait" : "pointer",
                    fontSize: "16px",
                    lineHeight: 1,
                    padding: "2px 4px",
                    borderRadius: "4px",
                    transition: "color 100ms",
                    opacity: isPending ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending) e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                  }}
                  title="Управление колонкой"
                >
                  ···
                </button>

                {menuOpen && (
                  <DropdownMenu
                    isFirst={column.position === 0}
                    isLast={isLast}
                    onRename={startRename}
                    onMoveLeft={() => moveColumn("left")}
                    onMoveRight={() => moveColumn("right")}
                    onDelete={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    pending={isPending}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task list */}
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
              <SortableTaskCard
                key={task.id}
                task={task}
                onCardClick={onCardClick}
                deadlineDecayEnabled={deadlineDecayEnabled}
                showToast={setToast}
              />
            ))}
          </SortableContext>

          {isAddingTask && (
            <AddTaskForm
              onSubmit={handleTaskCreate}
              onCancel={() => setIsAddingTask(false)}
            />
          )}
        </div>

        {/* Add task link */}
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal onBackdropClick={() => !isPendingDelete && setConfirmDelete(false)}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
            Удалить колонку?
          </h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
            Задачи должны быть перенесены или удалены перед удалением колонки.
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isPendingDelete}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.72)",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              disabled={isPendingDelete}
              style={{
                background: isPendingDelete ? "rgba(239,68,68,0.5)" : "#EF4444",
                border: "none",
                color: "#FFFFFF",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: isPendingDelete ? "not-allowed" : "pointer",
              }}
            >
              {isPendingDelete ? "Удаление…" : "Удалить"}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Create task dialog (admin only) */}
      {isAdmin && boardId && workspaceId && (
        <CreateTaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={(task) => onTaskCreated?.(task)}
          boardId={boardId}
          columnId={column.id}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
}
