"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMyTasks,
  groupMyTasks,
  groupByAssignee,
} from "@/lib/my-tasks-api";
import type { MyTask, MyTasksSort, AssigneeGroup } from "@/lib/my-tasks-api";
import { useWs } from "@/contexts/WsContext";
import TaskGroup from "./TaskGroup";
import TaskRow from "./TaskRow";
import TaskPanel from "@/components/board/TaskPanel";

interface Props {
  workspaceId: string;
}

type Tab = "mine" | "delegated" | "favorites" | "others";

const TABS: { key: Tab; label: string }[] = [
  { key: "mine", label: "🗒 Мои задачи" },
  { key: "delegated", label: "↗ Порученные мной" },
  { key: "favorites", label: "★ Избранные" },
  { key: "others", label: "☰ Чужие задачи" },
];

const SORT_OPTIONS: { value: MyTasksSort; label: string }[] = [
  { value: "priority", label: "Приоритет ↓" },
  { value: "-priority", label: "Приоритет ↑" },
  { value: "deadline", label: "Дедлайн ↑" },
  { value: "-deadline", label: "Дедлайн ↓" },
  { value: "assignee", label: "Исполнитель" },
];

function AssigneeGroupRow({
  group,
  onToggleDone,
  onTaskClick,
}: {
  group: AssigneeGroup;
  onToggleDone: (id: string, done: boolean) => void;
  onTaskClick: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "background 150ms",
          userSelect: "none",
        }}
        className="ui-hover"
        onClick={() => setExpanded(v => !v)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <path d="M4 2l4 4-4 4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

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
            color: "rgba(255,255,255,0.5)",
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {group.assignee_name.slice(0, 1).toUpperCase()}
        </div>

        <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
          {group.assignee_name}
        </span>

        <span
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.55)",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "999px",
            padding: "1px 7px",
          }}
        >
          {group.tasks.length}
        </span>
      </div>

      {expanded && (
        <div style={{ paddingLeft: "4px" }}>
          {group.tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleDone={onToggleDone}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "40px", opacity: 0.3 }}>📭</div>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", margin: 0, textAlign: "center" }}>
        {label}
      </p>
    </div>
  );
}

const WS_TASK_EVENTS = ["board.task_created", "board.task_updated", "board.task_moved"];

export default function MyTasksPage({ workspaceId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("mine");
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [sort, setSort] = useState<MyTasksSort>("priority");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { on, off } = useWs();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTasks = useCallback(async () => {
    if (activeTab === "delegated" || activeTab === "favorites") return;
    setLoading(true);
    try {
      const view = activeTab === "others" ? "others" : "mine";
      const data = await getMyTasks(workspaceId, { view, sort });
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, activeTab, sort]);

  useEffect(() => {
    setTasks([]);
    fetchTasks();
  }, [fetchTasks]);

  // Re-fetch on WS task events (debounced 500ms)
  useEffect(() => {
    const handleTaskEvent = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { void fetchTasks(); }, 500);
    };
    for (const event of WS_TASK_EVENTS) on(event, handleTaskEvent);
    return () => {
      for (const event of WS_TASK_EVENTS) off(event, handleTaskEvent);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [on, off, fetchTasks]);

  function handleToggleDone(taskId: string, done: boolean) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_done: done } : t));
  }

  const filtered = search.trim()
    ? tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : tasks;

  const groups = activeTab === "mine" ? groupMyTasks(filtered) : [];
  const assigneeGroups = activeTab === "others" ? groupByAssignee(filtered) : [];

  return (
    <div style={{ minHeight: "100vh", color: "#fff" }}>
      {/* Header */}
      <div
        style={{
          height: "52px",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: "16px",
          background: "#080808",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <h1 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "#fff" }}>
          Мои задачи
        </h1>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск задач..."
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "6px 12px 6px 32px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.8)",
              outline: "none",
              width: "240px",
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "12px 24px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: "none",
              border: "none",
              padding: "8px 14px",
              fontSize: "13px",
              cursor: "pointer",
              color: activeTab === tab.key ? "#fff" : "rgba(255,255,255,0.6)",
              fontWeight: activeTab === tab.key ? 500 : 400,
              borderBottom: activeTab === tab.key ? "2px solid #3B82F6" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "color 150ms",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
          >
            {tab.label}
          </button>
        ))}

        {/* Sort selector for "others" tab */}
        {activeTab === "others" && (
          <div style={{ marginLeft: "auto", paddingBottom: "4px" }}>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as MyTasksSort)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value} style={{ background: "#1C1C1C" }}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 24px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                style={{
                  height: "36px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        )}

        {!loading && (activeTab === "delegated" || activeTab === "favorites") && (
          <EmptyState label="Функция будет доступна в следующей версии" />
        )}

        {!loading && activeTab === "mine" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {groups.map(group => (
              <TaskGroup
                key={group.key}
                group={group}
                onToggleDone={handleToggleDone}
                onTaskClick={setSelectedTaskId}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}

        {!loading && activeTab === "others" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {assigneeGroups.length === 0 && (
              <EmptyState label="Нет задач других участников" />
            )}
            {assigneeGroups.map(group => (
              <AssigneeGroupRow
                key={group.assignee_id ?? "__none__"}
                group={group}
                onToggleDone={handleToggleDone}
                onTaskClick={setSelectedTaskId}
              />
            ))}
          </div>
        )}
      </div>

      {/* TaskPanel */}
      <TaskPanel
        taskId={selectedTaskId}
        workspaceId={workspaceId}
        onClose={() => setSelectedTaskId(null)}
        onTaskDelete={(taskId) => {
          setTasks(prev => prev.filter(t => t.id !== taskId));
          setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
