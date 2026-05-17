"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, subtasksApi, tagsApi } from "@/lib/api";
import CommentFeed from "./CommentFeed";
import AttachmentList from "./AttachmentList";
import type { DeadlineUrgency, Subtask, Tag, Task, TaskPriority, WorkspaceMember } from "@/lib/types";
import SubtaskList from "./SubtaskList";

interface TaskFormData {
  title: string;
  description: string;
  priority: TaskPriority;
  deadline: string;
  assignee_id: string;
}

interface TaskModalProps {
  task: Task;
  boardId: string;
  workspaceId: string;
  onSave: (updatedTask: Task) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onClose: () => void;
}

const URGENCY_BORDER: Record<DeadlineUrgency, string> = {
  none: "transparent",
  soon: "rgba(245,158,11,0.7)",
  critical: "#EF4444",
};

const URGENCY_DATE_COLOR: Record<DeadlineUrgency, string> = {
  none: "rgba(255,255,255,0.72)",
  soon: "#FCD34D",
  critical: "#FCA5A5",
};

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; color: string; label: string }> = {
  low: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", label: "LOW" },
  medium: { bg: "rgba(59,130,246,0.15)", color: "#93C5FD", label: "MED" },
  high: { bg: "rgba(245,158,11,0.15)", color: "#FCD34D", label: "HIGH" },
  critical: { bg: "rgba(239,68,68,0.15)", color: "#FCA5A5", label: "CRIT" },
};

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  const [year, month, day] = deadline.split("-");
  return `${day}.${month}.${String(year).slice(2)}`;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p
      className="uppercase"
      style={{
        fontSize: "11px",
        fontWeight: 500,
        color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.08em",
        marginBottom: "4px",
      }}
    >
      {text}
    </p>
  );
}

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel text={label} />
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontFamily: "Space Grotesk, sans-serif",
  padding: "10px 14px",
  width: "100%",
  outline: "none",
  transition: "border-color 150ms ease",
};

export default function TaskModal({ task, boardId, workspaceId, onSave, onDelete, onClose }: TaskModalProps) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [formData, setFormData] = useState<TaskFormData>({
    title: task.title,
    description: task.description,
    priority: task.priority,
    deadline: task.deadline ?? "",
    assignee_id: task.assignee_id ?? "",
  });
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [taskTags, setTaskTags] = useState<Tag[]>(task.tags);
  const [boardTags, setBoardTags] = useState<Tag[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[] | undefined>(undefined);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const doneCount = subtasks ? subtasks.filter(s => s.is_done).length : 0;
  const totalCount = subtasks ? subtasks.length : 0;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const handleSubtasksChange = useCallback((items: Subtask[]) => {
    setSubtasks(items);
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      setLoadingMembers(true);
      try {
        const data = await api.get<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`);
        if (!cancelled) setMembers(data);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    }

    fetchMembers();
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [tagsResult, subtasksResult] = await Promise.allSettled([
        tagsApi.getBoardTags(boardId),
        subtasksApi.getSubtasks(task.id),
      ]);
      if (cancelled) return;
      if (tagsResult.status === "fulfilled") setBoardTags(tagsResult.value);
      if (subtasksResult.status === "fulfilled") setSubtasks(subtasksResult.value);
      else setSubtasks([]);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [boardId, task.id]);

  const trimmedTitle = formData.title.trim();
  const isTitleValid = trimmedTitle.length > 0 && trimmedTitle.length <= 500;
  const isSaveDisabled = !isTitleValid || isSaving;

  function handleFieldChange<K extends keyof TaskFormData>(field: K, value: TaskFormData[K]): void {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === "title") setTitleError(null);
  }

  function handleSwitchToEdit(): void {
    setMode("edit");
  }

  function handleCancelEdit(): void {
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      deadline: task.deadline ?? "",
      assignee_id: task.assignee_id ?? "",
    });
    setTitleError(null);
    setMode("view");
  }

  function handleDelete(): void {
    setMode("confirm");
  }

  function handleCancelConfirm(): void {
    setMode("view");
  }

  async function handleSave(): Promise<void> {
    if (!isTitleValid) {
      setTitleError(
        trimmedTitle.length === 0 ? "Название не может быть пустым" : "Максимум 500 символов"
      );
      return;
    }

    const updatedTask: Task = {
      ...task,
      title: trimmedTitle,
      description: formData.description,
      priority: formData.priority,
      deadline: formData.deadline || null,
      assignee_id: formData.assignee_id || null,
      tags: taskTags,
    };

    setIsSaving(true);
    try {
      await onSave(updatedTask);
    } catch {
      // toast already shown by parent
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddTag(tag: Tag): Promise<void> {
    setTaskTags(prev => [...prev, tag]);
    setShowTagDropdown(false);
    try {
      await tagsApi.addTagToTask(task.id, tag.id);
    } catch {
      setTaskTags(prev => prev.filter(t => t.id !== tag.id));
    }
  }

  async function handleRemoveTag(tagId: string): Promise<void> {
    setTaskTags(prev => prev.filter(t => t.id !== tagId));
    try {
      await tagsApi.removeTagFromTask(task.id, tagId);
    } catch {
      const removed = boardTags.find(t => t.id === tagId);
      if (removed) setTaskTags(prev => [...prev, removed]);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    setIsDeleting(true);
    try {
      await onDelete(task.id);
    } catch {
      // toast already shown by parent
    } finally {
      setIsDeleting(false);
    }
  }

  const accentColor = URGENCY_BORDER[task.deadline_urgency];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(2px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#111111",
          border: `1px solid rgba(255,255,255,0.08)`,
          borderLeft: `3px solid ${accentColor}`,
          borderRadius: "24px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 12px rgba(0,0,0,0.5)",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "28px 28px 24px 28px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            paddingBottom: "20px",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "20px",
              fontWeight: 600,
              color: "#FFFFFF",
              lineHeight: 1.3,
            }}
          >
            {task.title}
          </p>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              flexShrink: 0,
              background: "rgba(255,255,255,0.06)",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              color: "rgba(255,255,255,0.45)",
              transition: "all 150ms ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.color = "rgba(255,255,255,0.72)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            ×
          </button>
        </div>

        {/* Body / Confirm */}
        {mode === "confirm" ? (
          <ConfirmDeleteBlock
            isDeleting={isDeleting}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelConfirm}
          />
        ) : (
          <>
            {mode === "view" ? (
              <ViewBody task={task} members={members} />
            ) : (
              <EditBody
                formData={formData}
                members={members}
                loadingMembers={loadingMembers}
                titleError={titleError}
                titleLength={formData.title.length}
                onChange={handleFieldChange}
              />
            )}

            {/* Теги — интерактивная секция, всегда видима */}
            <div style={{ marginTop: "20px" }}>
              <SectionLabel text="Теги" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", position: "relative" }}>
                {taskTags.map(tag => (
                  <span
                    key={tag.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: tag.color ? `${tag.color}22` : "rgba(59,130,246,0.12)",
                      border: `1px solid ${tag.color ? `${tag.color}55` : "rgba(59,130,246,0.25)"}`,
                      color: tag.color ?? "#93C5FD",
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "3px 8px 3px 10px",
                      borderRadius: "999px",
                    }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: "0 1px",
                        lineHeight: 1,
                        fontSize: "14px",
                        opacity: 0.6,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; }}
                    >
                      ×
                    </button>
                  </span>
                ))}

                {boardTags.some(bt => !taskTags.find(tt => tt.id === bt.id)) && (
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowTagDropdown(v => !v)}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px dashed rgba(255,255,255,0.2)",
                        color: "rgba(255,255,255,0.45)",
                        borderRadius: "999px",
                        padding: "3px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.72)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                      }}
                    >
                      + Добавить
                    </button>
                    {showTagDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          background: "#1a1a1a",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          padding: "6px",
                          zIndex: 10,
                          minWidth: "160px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        {boardTags
                          .filter(bt => !taskTags.find(tt => tt.id === bt.id))
                          .map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => handleAddTag(tag)}
                              style={{
                                background: "none",
                                border: "none",
                                color: tag.color ?? "rgba(255,255,255,0.72)",
                                fontSize: "13px",
                                textAlign: "left",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "background 100ms",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                            >
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  background: tag.color ?? "#3B82F6",
                                  flexShrink: 0,
                                }}
                              />
                              {tag.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {taskTags.length === 0 && boardTags.length === 0 && (
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>Нет тегов</p>
                )}
              </div>
            </div>

            {/* Подзадачи — всегда видимы; subtasks=undefined пока идёт загрузка → SubtaskList покажет skeleton */}
            <div style={{ marginTop: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <p
                  className="uppercase"
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: "0.08em",
                    margin: 0,
                  }}
                >
                  Подзадачи
                </p>
                {subtasks !== undefined && totalCount > 0 && (
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                    {doneCount}/{totalCount}
                  </span>
                )}
              </div>
              {subtasks !== undefined && totalCount > 0 && (
                <div
                  style={{
                    height: "3px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.08)",
                    marginBottom: "10px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      borderRadius: "999px",
                      background: progressPct === 100 ? "#22C55E" : "#3B82F6",
                      transition: "width 200ms ease, background 200ms ease",
                    }}
                  />
                </div>
              )}
              {subtasks !== undefined ? (
                <SubtaskList taskId={task.id} subtasks={subtasks} onItemsChange={handleSubtasksChange} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        height: "22px",
                        borderRadius: "6px",
                        background: "rgba(255,255,255,0.06)",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Вложения */}
            <div style={{ marginTop: "20px" }}>
              <SectionLabel text="Вложения" />
              <AttachmentList taskId={task.id} />
            </div>

            {/* Комментарии */}
            <div style={{ marginTop: "20px" }}>
              <SectionLabel text="Комментарии" />
              <CommentFeed taskId={task.id} />
            </div>

            {mode === "view" ? (
              <ViewFooter
                onEdit={handleSwitchToEdit}
                onDelete={handleDelete}
                onClose={onClose}
              />
            ) : (
              <EditFooter
                isSaving={isSaving}
                isSaveDisabled={isSaveDisabled}
                onDelete={handleDelete}
                onCancel={handleCancelEdit}
                onSave={handleSave}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ViewBody({ task, members }: { task: Task; members: WorkspaceMember[] }) {
  const assignee = members.find(m => m.user_id === task.assignee_id) ?? null;
  const ps = PRIORITY_STYLE[task.priority];
  const dateColor = URGENCY_DATE_COLOR[task.deadline_urgency];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <FieldWrapper label="Описание">
        {task.description ? (
          <p style={{ fontSize: "14px", color: "#FFFFFF", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
            {task.description}
          </p>
        ) : (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
            Описание не добавлено
          </p>
        )}
      </FieldWrapper>

      <FieldWrapper label="Приоритет">
        <span
          style={{
            display: "inline-block",
            background: ps.bg,
            color: ps.color,
            fontSize: "12px",
            fontWeight: 500,
            padding: "4px 10px",
            borderRadius: "999px",
          }}
        >
          {ps.label}
        </span>
      </FieldWrapper>

      <FieldWrapper label="Дедлайн">
        {task.deadline ? (
          <p style={{ fontSize: "14px", color: dateColor, fontWeight: task.deadline_urgency === "critical" ? 500 : 400 }}>
            {formatDeadline(task.deadline)}
          </p>
        ) : (
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.35)" }}>—</p>
        )}
      </FieldWrapper>

      <FieldWrapper label="Исполнитель">
        {assignee ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                color: "rgba(255,255,255,0.72)",
                flexShrink: 0,
              }}
            >
              {assignee.name.charAt(0).toUpperCase()}
            </div>
            <p style={{ fontSize: "14px", color: "#FFFFFF" }}>{assignee.name}</p>
          </div>
        ) : (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>Не назначен</p>
        )}
      </FieldWrapper>

    </div>
  );
}

function ViewFooter({ onEdit, onDelete, onClose }: { onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        marginTop: "20px",
      }}
    >
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onEdit}
          style={{
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.25)",
            color: "#93C5FD",
            borderRadius: "10px",
            padding: "8px 18px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(59,130,246,0.2)";
            e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(59,130,246,0.12)";
            e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)";
          }}
        >
          Редактировать
        </button>
        <button
          onClick={onDelete}
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "rgba(239,68,68,0.7)",
            borderRadius: "10px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(239,68,68,0.15)";
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
            e.currentTarget.style.color = "#FCA5A5";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
            e.currentTarget.style.color = "rgba(239,68,68,0.7)";
          }}
        >
          Удалить
        </button>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.45)",
          padding: "8px 16px",
          borderRadius: "10px",
          fontSize: "14px",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = "rgba(255,255,255,0.72)";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = "rgba(255,255,255,0.45)";
          e.currentTarget.style.background = "none";
        }}
      >
        Закрыть
      </button>
    </div>
  );
}

interface EditBodyProps {
  formData: TaskFormData;
  members: WorkspaceMember[];
  loadingMembers: boolean;
  titleError: string | null;
  titleLength: number;
  onChange: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
}

function EditBody({ formData, members, loadingMembers, titleError, titleLength, onChange }: EditBodyProps) {
  const counterColor =
    titleLength > 500 ? "#FCA5A5" : titleLength > 450 ? "#FCD34D" : "rgba(255,255,255,0.35)";

  const titleBorderColor = titleError
    ? "rgba(239,68,68,0.6)"
    : "rgba(255,255,255,0.08)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <FieldWrapper label="Название">
        <input
          type="text"
          value={formData.title}
          onChange={e => onChange("title", e.target.value)}
          style={{ ...inputStyle, fontSize: "16px", fontWeight: 500, borderColor: titleBorderColor }}
          onFocus={e => { e.currentTarget.style.borderColor = titleError ? "#EF4444" : "rgba(255,255,255,0.18)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = titleError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.08)"; }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          {titleError ? (
            <p style={{ fontSize: "12px", color: "#FCA5A5" }}>{titleError}</p>
          ) : (
            <span />
          )}
          <p style={{ fontSize: "11px", color: counterColor, marginLeft: "auto" }}>
            {titleLength}/500
          </p>
        </div>
      </FieldWrapper>

      <FieldWrapper label="Описание">
        <textarea
          value={formData.description}
          onChange={e => onChange("description", e.target.value)}
          style={{ ...inputStyle, minHeight: "100px", maxHeight: "300px", resize: "vertical", lineHeight: 1.6 }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        />
      </FieldWrapper>

      <FieldWrapper label="Приоритет">
        <div style={{ position: "relative" }}>
          <select
            value={formData.priority}
            onChange={e => onChange("priority", e.target.value as TaskPriority)}
            style={{ ...inputStyle, appearance: "none", paddingRight: "36px", cursor: "pointer" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <option value="low">LOW</option>
            <option value="medium">MEDIUM</option>
            <option value="high">HIGH</option>
            <option value="critical">CRITICAL</option>
          </select>
          <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.45)", pointerEvents: "none", fontSize: "12px" }}>▾</span>
        </div>
      </FieldWrapper>

      <FieldWrapper label="Дедлайн">
        <input
          type="date"
          value={formData.deadline}
          onChange={e => onChange("deadline", e.target.value)}
          style={{ ...inputStyle, colorScheme: "dark" }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        />
      </FieldWrapper>

      <FieldWrapper label="Исполнитель">
        <div style={{ position: "relative" }}>
          <select
            value={formData.assignee_id}
            onChange={e => onChange("assignee_id", e.target.value)}
            disabled={loadingMembers}
            style={{
              ...inputStyle,
              appearance: "none",
              paddingRight: "36px",
              cursor: loadingMembers ? "not-allowed" : "pointer",
              opacity: loadingMembers ? 0.5 : 1,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <option value="">{loadingMembers ? "Загрузка..." : "Не назначен"}</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name}</option>
            ))}
          </select>
          <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.45)", pointerEvents: "none", fontSize: "12px" }}>▾</span>
        </div>
      </FieldWrapper>

    </div>
  );
}

interface EditFooterProps {
  isSaving: boolean;
  isSaveDisabled: boolean;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function EditFooter({ isSaving, isSaveDisabled, onDelete, onCancel, onSave }: EditFooterProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        marginTop: "20px",
      }}
    >
      <button
        onClick={onDelete}
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "rgba(239,68,68,0.7)",
          borderRadius: "10px",
          padding: "8px 16px",
          fontSize: "14px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(239,68,68,0.15)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
          e.currentTarget.style.color = "#FCA5A5";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(239,68,68,0.08)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
          e.currentTarget.style.color = "rgba(239,68,68,0.7)";
        }}
      >
        Удалить
      </button>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onCancel}
          disabled={isSaving}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.45)",
            padding: "8px 16px",
            borderRadius: "10px",
            fontSize: "14px",
            cursor: isSaving ? "not-allowed" : "pointer",
            transition: "all 150ms ease",
          }}
          onMouseEnter={e => {
            if (!isSaving) {
              e.currentTarget.style.color = "rgba(255,255,255,0.72)";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            e.currentTarget.style.background = "none";
          }}
        >
          Отмена
        </button>
        <button
          onClick={onSave}
          disabled={isSaveDisabled}
          style={{
            background: isSaveDisabled ? "rgba(59,130,246,0.3)" : "#3B82F6",
            color: isSaveDisabled ? "rgba(255,255,255,0.4)" : "#FFFFFF",
            border: "none",
            borderRadius: "10px",
            padding: "8px 20px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: isSaveDisabled ? "not-allowed" : "pointer",
            transition: "background 150ms ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "80px",
            justifyContent: "center",
          }}
          onMouseEnter={e => {
            if (!isSaveDisabled) e.currentTarget.style.background = "#2563EB";
          }}
          onMouseLeave={e => {
            if (!isSaveDisabled) e.currentTarget.style.background = "#3B82F6";
          }}
        >
          {isSaving ? <Spinner /> : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function ConfirmDeleteBlock({
  isDeleting,
  onConfirm,
  onCancel,
}: {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: "16px",
        padding: "20px",
        marginTop: "20px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "24px", color: "#EF4444" }}>⚠</p>
      <p style={{ fontSize: "16px", fontWeight: 600, color: "#FFFFFF", marginTop: "12px" }}>
        Удалить задачу?
      </p>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>
        Это действие нельзя отменить
      </p>
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center" }}>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          style={{
            background: "#EF4444",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "10px",
            padding: "9px 24px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: isDeleting ? "not-allowed" : "pointer",
            transition: "background 150ms ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "120px",
            justifyContent: "center",
          }}
          onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.background = "#DC2626"; }}
          onMouseLeave={e => { if (!isDeleting) e.currentTarget.style.background = "#EF4444"; }}
        >
          {isDeleting ? <Spinner /> : "Да, удалить"}
        </button>
        <button
          onClick={onCancel}
          disabled={isDeleting}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.72)",
            borderRadius: "10px",
            padding: "9px 24px",
            fontSize: "14px",
            cursor: isDeleting ? "not-allowed" : "pointer",
            transition: "all 150ms ease",
          }}
          onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { if (!isDeleting) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}
