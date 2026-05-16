"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, boardsApi } from "@/lib/api";
import type { Workspace } from "@/lib/types";

interface WorkspaceSwitcherProps {
  workspaceId?: string;
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "W";
}

function getRoleLabel(role: Workspace["role"]): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export default function WorkspaceSwitcher({ workspaceId }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const currentWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    return workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0];
  }, [workspaceId, workspaces]);

  const dropdownWorkspaces = useMemo(
    () => (workspaces.length > 1 ? workspaces : []),
    [workspaces]
  );

  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const items = await api.get<Workspace[]>("/api/v1/workspaces/me");
      setWorkspaces(items);
    } catch {
      setWorkspaces([]);
      setError("Не удалось загрузить workspace");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadWorkspaces();
    });
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function selectWorkspace(targetWorkspaceId: string): Promise<void> {
    if (targetWorkspaceId === currentWorkspace?.id || navigatingId !== null) {
      setIsOpen(false);
      return;
    }

    setNavigatingId(targetWorkspaceId);

    try {
      const boards = await boardsApi.list(targetWorkspaceId);
      const targetBoard = boards.find((board) => board.is_favorite) ?? boards[0];
      const query = `workspace_id=${encodeURIComponent(targetWorkspaceId)}`;

      if (targetBoard) {
        router.replace(`/board/${targetBoard.id}?${query}`);
      } else {
        router.replace(`/board?${query}`);
      }
      setIsOpen(false);
    } catch {
      router.replace(`/board?workspace_id=${encodeURIComponent(targetWorkspaceId)}`);
      setIsOpen(false);
    } finally {
      setNavigatingId(null);
    }
  }

  const displayName = currentWorkspace?.name ?? (isLoading ? "Загрузка..." : "Workspace");
  const roleLabel = currentWorkspace ? getRoleLabel(currentWorkspace.role) : "Workspace";
  const initial = getInitial(displayName);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
        style={{
          background: isOpen ? "rgba(255,255,255,0.05)" : "transparent",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="h-9 w-9 rounded-md flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
          style={{ background: "#1E3A8A" }}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="text-[10px] uppercase tracking-[0.18em] block truncate"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {displayName}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">Workspace</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]"
              style={{
                color: "rgba(255,255,255,0.72)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {roleLabel}
            </span>
          </span>
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[260px] rounded-xl overflow-hidden"
          style={{
            background: "#0B0B0B",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.65)",
          }}
        >
          {isLoading ? (
            <div className="px-4 py-4 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              Загрузка...
            </div>
          ) : error ? (
            <button
              type="button"
              onClick={() => void loadWorkspaces()}
              className="w-full px-4 py-4 text-left text-xs transition-colors"
              style={{ color: "#FCA5A5" }}
            >
              {error}
            </button>
          ) : (
            <div className="p-1.5">
              {dropdownWorkspaces.map((workspace) => (
                <WorkspaceItem
                  key={workspace.id}
                  workspace={workspace}
                  isActive={workspace.id === currentWorkspace?.id}
                  isNavigating={navigatingId === workspace.id}
                  onSelect={() => void selectWorkspace(workspace.id)}
                />
              ))}

              <Link
                href="/workspace/create"
                onClick={() => setIsOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{
                  color: "#FFFFFF",
                  borderTop: dropdownWorkspaces.length ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <span style={{ color: "#3B82F6" }}>+</span>
                Создать workspace
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkspaceItem({
  workspace,
  isActive,
  isNavigating,
  onSelect,
}: {
  workspace: Workspace;
  isActive: boolean;
  isNavigating: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isActive || isNavigating}
      onClick={onSelect}
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-60"
      style={{
        color: "rgba(255,255,255,0.72)",
        background: isActive ? "rgba(59,130,246,0.10)" : "transparent",
        cursor: isNavigating ? "wait" : isActive ? "default" : "pointer",
      }}
    >
      <span
        className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
        style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)" }}
        aria-hidden="true"
      >
        {getInitial(workspace.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{workspace.name}</span>
        <span
          className="block text-[10px] uppercase tracking-[0.14em]"
          style={{ color: "rgba(255,255,255,0.38)" }}
        >
          {isActive ? "Current" : getRoleLabel(workspace.role)}
        </span>
      </span>
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s ease",
        color: "rgba(255,255,255,0.40)",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <path
        d="M3 5L7 9L11 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
