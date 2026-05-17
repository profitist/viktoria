"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  tagsApi,
  workspaceApi,
  boardsApi,
  markTaskDone,
} from "@/lib/api";
import type {
  AuditLogEntry,
  Column,
  Subtask,
  Tag,
  Task,
  TaskPriority,
  WorkspaceMember,
} from "@/lib/types";
import SubtaskList from "./SubtaskList";
import AttachmentList from "./AttachmentList";
import CommentFeed from "./CommentFeed";

// ── props ──────────────────────────────────────────────────────────────────────

export interface TaskPanelProps {
  taskId: string | null;
  onClose: () => void;
  workspaceId: string;
  boardId?: string;
  onTaskUpdate?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
}

// ── constants ──────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; color: string; label: string }> = {
  low:      { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", label: "LOW" },
  medium:   { bg: "rgba(59,130,246,0.15)",  color: "#93C5FD",               label: "MED" },
  high:     { bg: "rgba(245,158,11,0.15)",  color: "#FCD34D",               label: "HIGH" },
  critical: { bg: "rgba(239,68,68,0.15)",   color: "#FCA5A5",               label: "CRIT" },
};

const PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high", "critical"];

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function fmtRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  return `${Math.floor(hrs / 24)} д. назад`;
}

function auditLabel(entry: AuditLogEntry): string {
  switch (entry.event_type) {
    case "task.created":  return `${entry.actor.name} создал задачу`;
    case "task.updated":  return `${entry.actor.name} изменил задачу`;
    case "task.moved":    return `${entry.actor.name} переместил задачу`;
    case "task.deleted":  return `${entry.actor.name} удалил задачу`;
    default:              return `${entry.actor.name} • ${entry.event_type}`;
  }
}

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9 9l6 6M15 9l-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function taskBoardId(task: Task | null): string | undefined {
  const value = (task as (Task & { board_id?: unknown }) | null)?.board_id;
  return typeof value === "string" ? value : undefined;
}

// ── shared style ───────────────────────────────────────────────────────────────

const TAG_COLORS = ["#EF4444","#F97316","#EAB308","#22C55E","#14B8A6","#3B82F6","#8B5CF6","#EC4899"];

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "rgba(255,255,255,0.35)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: "4px",
};

const DROPDOWN_WRAP: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  background: "#1C1C1C",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  padding: "4px",
  zIndex: 60,
  minWidth: "180px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
};

const DROP_ITEM: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  borderRadius: "6px",
  padding: "7px 10px",
  fontSize: "13px",
  cursor: "pointer",
  color: "rgba(255,255,255,0.75)",
  transition: "background 100ms, color 100ms",
};

// ── skeleton ───────────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {[280, 180, 140, 100, 80].map((w, i) => (
        <div
          key={i}
          style={{
            height: "18px",
            width: `${w}px`,
            maxWidth: "100%",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.06)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

// ── toast ──────────────────────────────────────────────────────────────────────

function PanelToast({ msg }: { msg: string }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        background: "rgba(239,68,68,0.15)",
        border: "1px solid rgba(239,68,68,0.3)",
        color: "#FCA5A5",
        fontSize: "13px",
        padding: "10px 16px",
        borderRadius: "10px",
        zIndex: 70,
        boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
      }}
    >
      {msg}
    </div>
  );
}

// ── field row wrapper ──────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={LABEL_STYLE}>{label}</p>
      {children}
    </div>
  );
}

// ── section header ─────────────────────────────────────────────────────────────

function SectionHead({ text }: { text: string }) {
  return (
    <p
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin: "24px 0 8px",
      }}
    >
      {text}
    </p>
  );
}

// ── priority inline dropdown ───────────────────────────────────────────────────

function PriorityField({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (p: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ps = PRIORITY_STYLE[value];

  useEffect(() => {
    if (!open) return;
    function out(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: ps.bg,
          color: ps.color,
          border: "none",
          borderRadius: "999px",
          padding: "4px 12px",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          letterSpacing: "0.04em",
        }}
      >
        {ps.label} ▾
      </button>
      {open && (
        <div style={DROPDOWN_WRAP}>
          {PRIORITY_ORDER.map(p => {
            const s = PRIORITY_STYLE[p];
            return (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false); }}
                style={{ ...DROP_ITEM, color: s.color }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── assignee inline dropdown ───────────────────────────────────────────────────

function AssigneeField({
  value,
  members,
  onChange,
}: {
  value: string | null;
  members: WorkspaceMember[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const assignee = members.find(m => m.user_id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function out(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          padding: "6px 10px",
          cursor: "pointer",
          color: assignee ? "#FFFFFF" : "rgba(255,255,255,0.35)",
          fontSize: "13px",
        }}
      >
        {assignee ? (
          <>
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                flexShrink: 0,
              }}
            >
              {assignee.name.charAt(0).toUpperCase()}
            </span>
            {assignee.name}
          </>
        ) : (
          "Не назначен"
        )}
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>▾</span>
      </button>

      {open && (
        <div style={DROPDOWN_WRAP}>
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            style={DROP_ITEM}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
          >
            Не назначен
          </button>
          {members.map(m => (
            <button
              key={m.user_id}
              onClick={() => { onChange(m.user_id); setOpen(false); }}
              style={{ ...DROP_ITEM, color: m.user_id === value ? "#93C5FD" : "rgba(255,255,255,0.75)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── column (status) inline dropdown ───────────────────────────────────────────

function StatusField({
  columnId,
  columns,
  onChange,
}: {
  columnId: string;
  columns: Column[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = columns.find(c => c.id === columnId);

  useEffect(() => {
    if (!open) return;
    function out(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  if (!columns.length) {
    return (
      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
        {current?.name ?? "—"}
      </span>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "999px",
          padding: "4px 12px",
          fontSize: "12px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.75)",
          cursor: "pointer",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {current?.name ?? "—"} ▾
      </button>
      {open && (
        <div style={DROPDOWN_WRAP}>
          {columns.map(col => (
            <button
              key={col.id}
              onClick={() => { onChange(col.id); setOpen(false); }}
              style={{
                ...DROP_ITEM,
                color: col.id === columnId ? "#93C5FD" : "rgba(255,255,255,0.75)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
            >
              {col.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── deadline inline date ───────────────────────────────────────────────────────

function DeadlineField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (d: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value?.slice(0, 10) ?? ""}
        onBlur={e => {
          const v = e.target.value;
          onChange(v ? `${v}T00:00:00` : null);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === "Escape") { setEditing(false); }
          if (e.key === "Enter") { e.currentTarget.blur(); }
        }}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "8px",
          color: "#FFFFFF",
          fontSize: "13px",
          padding: "4px 8px",
          outline: "none",
          colorScheme: "dark",
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: "13px",
        color: value ? "#FFFFFF" : "rgba(255,255,255,0.35)",
        textAlign: "left",
      }}
    >
      {value ? fmtDate(value) : "Задать дедлайн"}
    </button>
  );
}

// ── tags row ───────────────────────────────────────────────────────────────────

function TagsField({
  taskTags,
  boardTags,
  onAdd,
  onRemove,
  onCreate,
}: {
  taskTags: Tag[];
  boardTags: Tag[];
  onAdd: (tag: Tag) => void;
  onRemove: (tagId: string) => void;
  onCreate?: (name: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedColor, setPickedColor] = useState(TAG_COLORS[5]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = boardTags.filter(
    bt => !taskTags.find(tt => tt.id === bt.id) &&
      (query === "" || bt.name.toLowerCase().includes(query.toLowerCase()))
  );
  const canCreate = query.trim().length > 0 &&
    !boardTags.find(t => t.name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    if (!open) {
      const resetId = setTimeout(() => setQuery(""), 0);
      return () => clearTimeout(resetId);
    }
    const focusId = setTimeout(() => inputRef.current?.focus(), 50);
    function out(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", out);
    return () => {
      clearTimeout(focusId);
      document.removeEventListener("mousedown", out);
    };
  }, [open]);

  function handleCreate() {
    const name = query.trim();
    if (!name || !onCreate) return;
    onCreate(name, pickedColor);
    setOpen(false);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
      {taskTags.map(tag => (
        <span
          key={tag.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: tag.color ? `${tag.color}22` : "rgba(59,130,246,0.12)",
            border: `1px solid ${tag.color ? `${tag.color}44` : "rgba(59,130,246,0.25)"}`,
            color: tag.color ?? "#93C5FD",
            fontSize: "12px",
            fontWeight: 500,
            padding: "3px 8px 3px 10px",
            borderRadius: "999px",
          }}
        >
          {tag.name}
          <button
            onClick={() => onRemove(tag.id)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0 1px", lineHeight: 1, fontSize: "14px", opacity: 0.6 }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; }}
          >×</button>
        </span>
      ))}

      <div ref={ref} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.45)",
            borderRadius: "999px",
            padding: "3px 10px",
            fontSize: "12px",
            cursor: "pointer",
            transition: "all 150ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.72)"; }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
        >
          + Тег
        </button>

        {open && (
          <div style={{ ...DROPDOWN_WRAP, minWidth: "220px", padding: "8px" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && canCreate) handleCreate();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Поиск или создание..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "6px 8px",
                fontSize: "13px",
                color: "rgba(255,255,255,0.8)",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "6px",
              }}
            />

            <div style={{ maxHeight: "160px", overflowY: "auto" }}>
              {available.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => { onAdd(tag); setOpen(false); setQuery(""); }}
                  style={{ ...DROP_ITEM, color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: tag.color ?? "#3B82F6", marginRight: "8px", flexShrink: 0, display: "inline-block" }} />
                  {tag.name}
                </button>
              ))}
              {available.length === 0 && !canCreate && (
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", padding: "4px 8px", margin: 0 }}>Теги не найдены</p>
              )}
            </div>

            {canCreate && onCreate && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "6px", paddingTop: "8px" }}>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "8px" }}>
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setPickedColor(c)}
                      style={{
                        width: "18px", height: "18px", borderRadius: "50%",
                        background: c, padding: 0, cursor: "pointer", flexShrink: 0,
                        border: pickedColor === c ? "2px solid white" : "2px solid transparent",
                        outline: pickedColor === c ? `2px solid ${c}` : "none",
                        outlineOffset: "1px",
                        transition: "all 100ms",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleCreate}
                  style={{
                    width: "100%", background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.25)", color: "#93C5FD",
                    borderRadius: "6px", padding: "6px 8px", fontSize: "12px",
                    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "6px",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.22)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.12)"; }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: pickedColor, flexShrink: 0 }} />
                  Создать «{query.trim()}»
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {taskTags.length === 0 && !open && (
        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>Нет тегов</span>
      )}
    </div>
  );
}

// ── activity entry ─────────────────────────────────────────────────────────────

function ActivityItem({ entry }: { entry: AuditLogEntry }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          color: "rgba(255,255,255,0.5)",
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        {entry.actor.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", margin: 0 }}>
          {auditLabel(entry)}
        </p>
        {entry.changes.length > 0 && (
          <div style={{ marginTop: "3px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {entry.changes.map((ch, i) => (
              <p key={i} style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", margin: 0 }}>
                {ch.field}: {String(ch.old) || "—"} → {String(ch.new) || "—"}
              </p>
            ))}
          </div>
        )}
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", margin: "3px 0 0" }}>
          {fmtRelative(entry.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function TaskPanel({
  taskId,
  onClose,
  workspaceId,
  boardId,
  onTaskUpdate,
  onTaskDelete,
}: TaskPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [boardTags, setBoardTags] = useState<Tag[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[] | undefined>(undefined);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isTogglingDone, setIsTogglingDone] = useState(false);

  const doneCount = subtasks ? subtasks.filter(s => s.is_done).length : 0;
  const totalCount = subtasks ? subtasks.length : 0;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const resolvedBoardId = boardId ?? taskBoardId(task);
  const orderedColumns = [...columns].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id)
  );
  const firstColumn = orderedColumns[0] ?? null;
  const doneColumn = orderedColumns[orderedColumns.length - 1] ?? null;
  const isTaskDone =
    task !== null && doneColumn !== null && task.column_id === doneColumn.id;
  const canToggleDone =
    task !== null &&
    firstColumn !== null &&
    doneColumn !== null &&
    firstColumn.id !== doneColumn.id &&
    !isTogglingDone;

  // ── data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    if (!taskId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setTask(null);
        setSubtasks(undefined);
        setAuditLog([]);
        setIsTogglingDone(false);
      });
      return () => { cancelled = true; };
    }

    const id = taskId; // capture for async — TypeScript doesn't narrow across async boundaries
    async function fetchAll() {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setIsTogglingDone(false);

      try {
        const { task: loaded } = await api.get<{ task: Task }>(`/api/v1/tasks/${id}`);
        if (cancelled) return;
        setTask(loaded);

        const [membersRes, historyRes] = await Promise.allSettled([
          workspaceApi.getMembers(workspaceId),
          api.get<AuditLogEntry[]>(`/api/v1/tasks/${id}/history`),
        ]);
        if (cancelled) return;

        if (membersRes.status === "fulfilled") setMembers(membersRes.value);
        if (historyRes.status === "fulfilled") setAuditLog(historyRes.value);
      } catch {
        if (!cancelled) setError("Не удалось загрузить задачу");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    queueMicrotask(() => {
      void fetchAll();
    });
    return () => { cancelled = true; };
  }, [taskId, workspaceId]);

  // board data (columns + tags) loaded separately — boardId may change
  useEffect(() => {
    if (!resolvedBoardId) return;
    let cancelled = false;

    Promise.allSettled([
      boardsApi.getDetail(resolvedBoardId),
      tagsApi.getBoardTags(resolvedBoardId),
    ]).then(([boardRes, tagsRes]) => {
      if (cancelled) return;
      if (boardRes.status === "fulfilled") setColumns(boardRes.value.board.columns);
      if (tagsRes.status === "fulfilled") setBoardTags(tagsRes.value);
    });

    return () => { cancelled = true; };
  }, [resolvedBoardId]);

  // ── escape key ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!taskId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [taskId, onClose]);

  // ── toast ────────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // ── patch helper ─────────────────────────────────────────────────────────────

  async function patchTask(
    patch: Partial<Pick<Task, "title" | "description" | "priority" | "deadline" | "assignee_id"> & { column_id: string }>
  ) {
    if (!task) return;
    const prev = task;
    setTask(t => t ? { ...t, ...patch } : t);
    try {
      const { task: saved } = await api.patch<{ task: Task }>(`/api/v1/tasks/${task.id}`, patch);
      setTask(saved);
      onTaskUpdate?.(saved);
    } catch {
      setTask(prev);
      showToast("Не удалось обновить задачу");
    }
  }

  // ── delete ───────────────────────────────────────────────────────────────────

  async function handleToggleDone() {
    if (!task || !firstColumn || !doneColumn || !canToggleDone) return;

    const prev = task;
    const targetColumn = isTaskDone ? firstColumn : doneColumn;
    setIsTogglingDone(true);
    setTask({ ...task, column_id: targetColumn.id });

    try {
      const saved = await markTaskDone(task.id);
      setTask(saved);
      onTaskUpdate?.(saved);
    } catch {
      setTask(prev);
      showToast("Не удалось изменить статус задачи");
    } finally {
      setIsTogglingDone(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    const id = task.id;
    try {
      await api.delete(`/api/v1/tasks/${id}`);
      onTaskDelete?.(id);
      onClose();
    } catch {
      showToast("Не удалось удалить задачу");
    }
  }

  // ── tag handlers ─────────────────────────────────────────────────────────────

  async function handleAddTag(tag: Tag) {
    if (!task) return;
    const prev = task;
    const updated = { ...task, tags: [...task.tags, tag] };
    setTask(updated);
    try {
      await tagsApi.addTagToTask(task.id, tag.id);
      onTaskUpdate?.(updated);
    } catch {
      setTask(prev);
      showToast("Не удалось добавить тег");
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!task) return;
    const prev = task;
    const updated = { ...task, tags: task.tags.filter(t => t.id !== tagId) };
    setTask(updated);
    try {
      await tagsApi.removeTagFromTask(task.id, tagId);
      onTaskUpdate?.(updated);
    } catch {
      setTask(prev);
      showToast("Не удалось удалить тег");
    }
  }

  async function handleCreateTag(name: string, color: string) {
    if (!task || !resolvedBoardId) return;
    try {
      const newTag = await tagsApi.createTag(resolvedBoardId, { name, color });
      setBoardTags(prev => [...prev, newTag]);
      const updated = { ...task, tags: [...task.tags, newTag] };
      setTask(updated);
      await tagsApi.addTagToTask(task.id, newTag.id);
      onTaskUpdate?.(updated);
    } catch {
      showToast("Не удалось создать тег");
    }
  }

  // ── subtasks callback ────────────────────────────────────────────────────────

  const handleSubtasksChange = useCallback((items: Subtask[]) => {
    setSubtasks(items);
  }, []);

  // ── render ───────────────────────────────────────────────────────────────────

  const isOpen = !!taskId;

  return (
    <>
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "480px",
          maxWidth: "100vw",
          background: "#0F0F0F",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 50,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: isOpen ? "-8px 0 40px rgba(0,0,0,0.6)" : "none",
        }}
      >
        {loading && <PanelSkeleton />}

        {!loading && error && (
          <div style={{ padding: "24px" }}>
            <p style={{ fontSize: "14px", color: "#FCA5A5" }}>{error}</p>
            <button
              onClick={onClose}
              style={{
                marginTop: "12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.72)",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Закрыть
            </button>
          </div>
        )}

        {!loading && !error && task && (
          <>
            {/* ── Header ── */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              {/* Title */}
              <p
                style={{
                  flex: 1,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  lineHeight: 1.4,
                  fontFamily: "Space Grotesk, sans-serif",
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                {task.title}
              </p>

              {/* Delete */}
              <button
                onClick={handleDelete}
                title="Удалить задачу"
                style={{
                  width: "28px",
                  height: "28px",
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                  (e.currentTarget.querySelector("svg") as SVGElement | null)?.setAttribute("stroke", "#FCA5A5");
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget.querySelector("svg") as SVGElement | null)?.setAttribute("stroke", "rgba(255,255,255,0.4)");
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  width: "28px",
                  height: "28px",
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  color: "rgba(255,255,255,0.4)",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                }}
              >
                ×
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>
              <button
                type="button"
                onClick={handleToggleDone}
                disabled={!canToggleDone}
                style={{
                  width: "100%",
                  marginTop: "20px",
                  minHeight: "44px",
                  border: isTaskDone
                    ? "1px solid rgba(255,255,255,0.12)"
                    : "1px solid rgba(34,197,94,0.36)",
                  borderRadius: "10px",
                  background: isTaskDone
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(34,197,94,0.16)",
                  color: isTaskDone ? "rgba(255,255,255,0.72)" : "#86EFAC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: canToggleDone ? "pointer" : "not-allowed",
                  opacity: canToggleDone ? 1 : 0.55,
                  transition: "background 150ms, border-color 150ms, color 150ms",
                }}
              >
                {isTaskDone ? <XCircleIcon /> : <CheckCircleIcon />}
                {isTaskDone ? "Снять отметку" : "Отметить выполненным"}
              </button>

              {/* ── Fields grid ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginTop: "20px",
                }}
              >
                <FieldRow label="Приоритет">
                  <PriorityField
                    value={task.priority}
                    onChange={p => patchTask({ priority: p })}
                  />
                </FieldRow>

                <FieldRow label="Дедлайн">
                  <DeadlineField
                    value={task.deadline}
                    onChange={d => patchTask({ deadline: d })}
                  />
                </FieldRow>

                <FieldRow label="Исполнитель">
                  <AssigneeField
                    value={task.assignee_id}
                    members={members}
                    onChange={id => patchTask({ assignee_id: id })}
                  />
                </FieldRow>
              </div>

              {/* Tags — full width */}
              <div style={{ marginTop: "16px" }}>
                <FieldRow label="Теги">
                  <TagsField
                    taskTags={task.tags}
                    boardTags={boardTags}
                    onAdd={handleAddTag}
                    onRemove={handleRemoveTag}
                    onCreate={resolvedBoardId ? handleCreateTag : undefined}
                  />
                </FieldRow>
              </div>

              {/* Description */}
              {task.description && (
                <div style={{ marginTop: "16px" }}>
                  <p style={LABEL_STYLE}>Описание</p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.72)",
                      lineHeight: 1.6,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {task.description}
                  </p>
                </div>
              )}

              {/* ── Subtasks ── */}
              <SectionHead text="Подзадачи" />

              {totalCount > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {doneCount}/{totalCount}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: progressPct === 100 ? "#22C55E" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      {Math.round(progressPct)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "3px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.08)",
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
                </div>
              )}

              <SubtaskList
                taskId={task.id}
                subtasks={subtasks}
                onItemsChange={handleSubtasksChange}
              />

              {/* ── Attachments ── */}
              <SectionHead text="Вложения" />
              <AttachmentList taskId={task.id} />

              {/* ── Activity ── */}
              {auditLog.length > 0 && (
                <>
                  <SectionHead text="История" />
                  <div>
                    {auditLog.map(entry => (
                      <ActivityItem key={entry.id} entry={entry} />
                    ))}
                  </div>
                </>
              )}

              {/* ── Comments ── */}
              <SectionHead text="Комментарии" />
              <CommentFeed taskId={task.id} />
            </div>
          </>
        )}
      </div>

      {toast && <PanelToast msg={toast} />}
    </>
  );
}
