"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError, tagsApi, workspaceApi } from "@/lib/api";
import type { Tag, Task, TaskPriority, WorkspaceMember } from "@/lib/types";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (task: Task) => void;
  boardId: string;
  columnId: string;
  workspaceId: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
  boardId,
  columnId,
  workspaceId,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagsOpen, setTagsOpen] = useState(false);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [boardTags, setBoardTags] = useState<Tag[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 0);
      workspaceApi.getMembers(workspaceId).then(setMembers).catch(() => {});
      tagsApi.getBoardTags(boardId).then(setBoardTags).catch(() => {});
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDeadline("");
      setAssigneeId("");
      setSelectedTagIds(new Set());
      setTagsOpen(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, workspaceId, boardId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) onOpenChange(false);
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, isSubmitting, onOpenChange]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) {
        setTagsOpen(false);
      }
    }
    if (tagsOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [tagsOpen]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !isSubmitting;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    if (trimmedTitle.length > 255) {
      setError("Слишком длинное название (макс. 255 символов)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { task: created } = await api.post<{ task: Task }>("/api/v1/tasks", {
        title: trimmedTitle,
        column_id: columnId,
        workspace_id: workspaceId,
        priority,
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        assignee_id: assigneeId || undefined,
      });

      if (selectedTagIds.size > 0) {
        await Promise.allSettled(
          [...selectedTagIds].map((tagId) => tagsApi.addTagToTask(created.id, tagId)),
        );
        created.tags = boardTags.filter((t) => selectedTagIds.has(t.id));
      }

      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Задача с таким названием уже есть в этой колонке");
      } else if ((err as Error).message?.toLowerCase().includes("failed to fetch")) {
        setError("Нет соединения с сервером");
      } else {
        setError("Не удалось создать задачу. Попробуйте ещё раз");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  const selectClass =
    "h-10 w-full appearance-none rounded-md border border-white/10 bg-white/[0.04] pl-3 pr-8 text-sm text-white outline-none transition-colors focus:border-white/25 disabled:cursor-wait disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
      role="presentation"
      onMouseDown={() => {
        if (!isSubmitting) onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-6 shadow-2xl"
        style={{ maxHeight: "90vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="Новая задача"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <h3 className="text-base font-medium text-white">Новая задача</h3>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-white/45">
              Название <span className="text-red-400/80">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              placeholder="Название задачи..."
              maxLength={255}
              className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25 disabled:cursor-wait disabled:opacity-60"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-white/45">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Добавить описание..."
              rows={3}
              className="w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25 disabled:cursor-wait disabled:opacity-60"
            />
          </div>

          {/* Priority + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                Приоритет
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  disabled={isSubmitting}
                  style={{ background: "#0f0f0f" }}
                  className={selectClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/45">
                  ▾
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                Дедлайн
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={isSubmitting}
                style={{ colorScheme: "dark" }}
                className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition-colors focus:border-white/25 disabled:cursor-wait disabled:opacity-60"
              />
            </div>
          </div>

          {/* Assignee + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                Исполнитель
              </label>
              <div className="relative">
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={isSubmitting}
                  style={{ background: "#0f0f0f" }}
                  className={selectClass}
                >
                  <option value="">Не назначен</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/45">
                  ▾
                </span>
              </div>
            </div>

            <div className="space-y-1.5" ref={tagsRef}>
              <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                Теги
              </label>
              <div className="relative">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setTagsOpen((v) => !v)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm transition-colors focus:border-white/25 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className={selectedTagIds.size === 0 ? "text-white/25" : "text-white"}>
                    {selectedTagIds.size === 0
                      ? "Выбрать теги"
                      : `${selectedTagIds.size} тег${selectedTagIds.size > 1 ? "а" : ""}`}
                  </span>
                  <span className="text-xs text-white/45">▾</span>
                </button>

                {tagsOpen && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border border-white/10 bg-[#1a1a1a] py-1 shadow-xl">
                    {boardTags.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-white/35">Нет доступных тегов</p>
                    ) : (
                      boardTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/[0.05]"
                        >
                          <span
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ background: tag.color }}
                          />
                          <span className="flex-1 text-left">{tag.name}</span>
                          {selectedTagIds.has(tag.id) && (
                            <span className="text-xs text-blue-400">✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error !== null && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 rounded-md border border-white/10 px-3 text-sm text-white/65 transition-colors hover:bg-white/[0.04] disabled:cursor-wait disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-9 rounded-md bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
