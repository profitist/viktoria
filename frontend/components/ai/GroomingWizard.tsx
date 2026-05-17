"use client";

import { useCallback, useEffect, useState } from "react";
import { api, boardsApi, tagsApi } from "@/lib/api";
import type { BoardMeta, Column, Task } from "@/lib/types";
import {
  groomStart,
  groomComplete,
} from "@/lib/ai-api";
import type { GroomQuestion, GroomAnswer, TaskDraft } from "@/lib/ai-api";

const TAG_COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899"];

type WizardStep = "describe" | "questions" | "draft";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

interface Props {
  workspaceId: string;
  onTaskCreated?: (task: Task) => void;
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "16px",
        height: "16px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

function StepBar({ step }: { step: WizardStep }) {
  const steps: { key: WizardStep; label: string }[] = [
    { key: "describe", label: "1 Описание" },
    { key: "questions", label: "2 Вопросы" },
    { key: "draft", label: "3 Черновик" },
  ];
  const idx = steps.findIndex((s) => s.key === step);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                padding: "4px 14px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 500,
                background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                border: done ? "1px solid rgba(34,197,94,0.35)" : active ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: done ? "#4ADE80" : active ? "#93C5FD" : "rgba(255,255,255,0.3)",
              }}
            >
              {done ? "✓ " : ""}{s.label}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: "20px", height: "1px", background: "rgba(255,255,255,0.1)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function inputStyle(focused?: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${focused ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#fff",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: "1.5",
    boxSizing: "border-box",
  };
}

export default function GroomingWizard({ workspaceId, onTaskCreated }: Props) {
  const [step, setStep] = useState<WizardStep>("describe");
  const [description, setDescription] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GroomQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "info" } | null>(null);

  function showToast(msg: string, type: "error" | "info" = "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Load boards list in background when starting
  const loadBoards = useCallback(async () => {
    try {
      const data = await boardsApi.list(workspaceId);
      setBoards(data);
    } catch {
      // non-critical — will show empty-state on step 3
    }
  }, [workspaceId]);

  // Load columns for selected board
  const loadColumns = useCallback(async (boardId: string) => {
    if (!boardId) return;
    try {
      const { board } = await boardsApi.getDetail(boardId);
      const sorted = [...board.columns].sort((a, b) => a.position - b.position);
      setColumns(sorted);
      setSelectedColumnId(sorted[0]?.id ?? "");
    } catch {
      setColumns([]);
      setSelectedColumnId("");
    }
  }, []);

  useEffect(() => {
    if (!selectedBoardId) return;
    void loadColumns(selectedBoardId);
  }, [selectedBoardId, loadColumns]);

  // When boards load, set default selection
  useEffect(() => {
    if (boards.length === 0) return;
    const defaultBoard = boards.find((b) => b.is_favorite) ?? boards[0];
    setSelectedBoardId(defaultBoard.id);
  }, [boards]);

  function handleReset() {
    setStep("describe");
    setDescription("");
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setDraft(null);
    setBoards([]);
    setColumns([]);
    setSelectedBoardId("");
    setSelectedColumnId("");
  }

  async function handleDescribeNext() {
    setLoading(true);
    void loadBoards(); // start loading boards in parallel
    try {
      const res = await groomStart(workspaceId, description.trim());
      setSessionId(res.session_id);
      setQuestions(res.questions);
      setStep("questions");
    } catch {
      showToast("Не удалось запустить AI-груминг. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuestionsComplete() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const answersArr: GroomAnswer[] = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] ?? "",
      }));
      const res = await groomComplete(sessionId, description, answersArr);
      setDraft({ ...res.task_draft });
      setStep("draft");
    } catch {
      showToast("Не удалось сформировать черновик. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!draft || !selectedColumnId || !selectedBoardId) return;
    setCreating(true);
    try {
      const { task: created } = await api.post<{ task: Task }>("/api/v1/tasks", {
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        column_id: selectedColumnId,
        workspace_id: workspaceId,
      });

      // Attach tags (best-effort)
      if (draft.tags.length > 0) {
        try {
          const existingTags = await tagsApi.getBoardTags(selectedBoardId);
          for (let i = 0; i < draft.tags.length; i++) {
            const tagName = draft.tags[i];
            const existing = existingTags.find((t) => t.name === tagName);
            const tagId = existing
              ? existing.id
              : (await tagsApi.createTag(selectedBoardId, { name: tagName, color: TAG_COLORS[i % TAG_COLORS.length] })).id;
            await tagsApi.addTagToTask(created.id, tagId);
          }
        } catch {
          showToast("Задача создана, но теги не добавлены", "info");
          onTaskCreated?.(created);
          handleReset();
          return;
        }
      }

      showToast("Задача успешно создана", "info");
      onTaskCreated?.(created);
      handleReset();
    } catch {
      showToast("Не удалось создать задачу. Попробуйте ещё раз.");
    } finally {
      setCreating(false);
    }
  }

  const allAnswered = questions.length > 0 && questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "28px",
        }}
      >
        <StepBar step={step} />

        {/* ── Step 1: Describe ── */}
        {step === "describe" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "8px" }}>
                Опишите проблему или задачу
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: пользователи жалуются что не могут сбросить пароль через почту..."
                rows={5}
                style={inputStyle()}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleDescribeNext}
                disabled={description.trim().length < 10 || loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  background: description.trim().length < 10 || loading ? "rgba(59,130,246,0.4)" : "#3B82F6",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#fff",
                  cursor: description.trim().length < 10 || loading ? "not-allowed" : "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => { if (!loading && description.trim().length >= 10) e.currentTarget.style.background = "#2563EB"; }}
                onMouseLeave={(e) => { if (!loading && description.trim().length >= 10) e.currentTarget.style.background = "#3B82F6"; }}
              >
                {loading && <Spinner />}
                {loading ? "AI думает..." : "Далее →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Questions ── */}
        {step === "questions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
              AI задаёт уточняющие вопросы. Ответьте, чтобы сформулировать задачу точнее.
            </p>
            {questions.map((q) => (
              <div key={q.id}>
                <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", display: "block", marginBottom: "8px" }}>
                  {q.text}
                </label>
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={2}
                  style={inputStyle()}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => setStep("describe")}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.65)",
                  cursor: "pointer",
                }}
              >
                ← Назад
              </button>
              <button
                type="button"
                onClick={handleQuestionsComplete}
                disabled={!allAnswered || loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  background: !allAnswered || loading ? "rgba(59,130,246,0.4)" : "#3B82F6",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#fff",
                  cursor: !allAnswered || loading ? "not-allowed" : "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => { if (allAnswered && !loading) e.currentTarget.style.background = "#2563EB"; }}
                onMouseLeave={(e) => { if (allAnswered && !loading) e.currentTarget.style.background = "#3B82F6"; }}
              >
                {loading && <Spinner />}
                {loading ? "AI думает..." : "Готово →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Draft ── */}
        {step === "draft" && draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                Заголовок
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => d ? { ...d, title: e.target.value } : d)}
                style={{ ...inputStyle(), resize: undefined }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                Описание
              </label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)}
                rows={5}
                style={inputStyle()}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Priority */}
            <div>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                Приоритет
              </label>
              <select
                value={draft.priority}
                onChange={(e) => setDraft((d) => d ? { ...d, priority: e.target.value as TaskDraft["priority"] } : d)}
                style={{ ...inputStyle(), resize: undefined, cursor: "pointer" }}
              >
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <option key={p} value={p} style={{ background: "#1C1C1C" }}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            {draft.tags.length > 0 && (
              <div>
                <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  Теги (предложены AI)
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {draft.tags.map((tag, i) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        padding: "3px 10px",
                        borderRadius: "999px",
                        background: `${TAG_COLORS[i % TAG_COLORS.length]}22`,
                        border: `1px solid ${TAG_COLORS[i % TAG_COLORS.length]}44`,
                        color: TAG_COLORS[i % TAG_COLORS.length],
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Board + Column */}
            {boards.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#FCA5A5",
                }}
              >
                Нет доступных досок — создайте доску сначала
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                    Доска
                  </label>
                  <select
                    value={selectedBoardId}
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    style={{ ...inputStyle(), resize: undefined, cursor: "pointer" }}
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id} style={{ background: "#1C1C1C" }}>
                        {b.name}{b.is_favorite ? " ★" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                    Колонка
                  </label>
                  <select
                    value={selectedColumnId}
                    onChange={(e) => setSelectedColumnId(e.target.value)}
                    disabled={columns.length === 0}
                    style={{ ...inputStyle(), resize: undefined, cursor: columns.length === 0 ? "not-allowed" : "pointer", opacity: columns.length === 0 ? 0.5 : 1 }}
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id} style={{ background: "#1C1C1C" }}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px" }}>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.65)",
                  cursor: "pointer",
                }}
              >
                Начать заново
              </button>
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={creating || !selectedColumnId || boards.length === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  background: creating || !selectedColumnId ? "rgba(59,130,246,0.4)" : "#3B82F6",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#fff",
                  cursor: creating || !selectedColumnId ? "not-allowed" : "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => { if (!creating && selectedColumnId) e.currentTarget.style.background = "#2563EB"; }}
                onMouseLeave={(e) => { if (!creating && selectedColumnId) e.currentTarget.style.background = "#3B82F6"; }}
              >
                {creating && <Spinner />}
                {creating ? "Создаётся..." : "Создать задачу"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 18px",
            borderRadius: "10px",
            fontSize: "14px",
            zIndex: 60,
            ...(toast.type === "error"
              ? {
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#FCA5A5",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                }
              : {
                  background: "#111111",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.72)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                }),
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}
