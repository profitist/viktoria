"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/app/providers";
import { api, boardsApi } from "@/lib/api";
import type { BoardMeta, Workspace } from "@/lib/types";
import { CreateBoardDialog } from "@/components/board/CreateBoardDialog";
import WorkspaceSwitcher from "@/components/workspace/WorkspaceSwitcher";

interface BoardRowProps {
  board: BoardMeta;
  isActive: boolean;
  isFavoriteLoading: boolean;
  onSelect: (boardId: string) => void;
  onToggleFavorite: (boardId: string) => void;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1L8.763 5.27L13.364 5.618L9.927 8.595L11.09 13.073L7 10.6L2.91 13.073L4.073 8.595L0.636 5.618L5.237 5.27L7 1Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoardRow({
  board,
  isActive,
  isFavoriteLoading,
  onSelect,
  onToggleFavorite,
}: BoardRowProps) {
  return (
    <div className="flex items-center gap-1 rounded-md">
      <button
        type="button"
        onClick={() => onSelect(board.id)}
        className="min-w-0 flex-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors"
        style={{
          background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
          color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.68)",
          borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = "#161616";
            e.currentTarget.style.color = "rgba(255,255,255,0.82)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.68)";
          }
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: isActive ? "#3B82F6" : "rgba(255,255,255,0.22)" }}
        />
        <span className="truncate text-sm font-medium">{board.name}</span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(board.id)}
        disabled={isFavoriteLoading}
        title={board.is_favorite ? "Убрать из избранного" : "В избранное"}
        aria-label={board.is_favorite ? "Убрать из избранного" : "В избранное"}
        className="h-8 w-8 flex-shrink-0 rounded-md flex items-center justify-center transition-colors disabled:cursor-wait"
        style={{
          color: board.is_favorite ? "#F59E0B" : "rgba(255,255,255,0.28)",
          background: "transparent",
          opacity: isFavoriteLoading ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <StarIcon filled={board.is_favorite} />
      </button>
    </div>
  );
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function SidebarSection({ title, action, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-2">
        <div
          className="text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "rgba(255,255,255,0.34)" }}
        >
          {title}
        </div>
        {action}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

interface NavItemProps {
  href: string;
  label: string;
}

function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname();
  const activePath = href.split("?")[0];
  const isActive = pathname === activePath;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all relative"
      style={{
        color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
        background: isActive ? "#161616" : "transparent",
        borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "#161616";
          e.currentTarget.style.color = "rgba(255,255,255,0.72)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.45)";
        }
      }}
    >
      {label}
    </Link>
  );
}

interface SidebarProps {
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
}

function getActiveBoardId(pathname: string): string | null {
  const match = pathname.match(/^\/board\/([^/]+)/);
  return match?.[1] ?? null;
}

function getInitial(value: string, fallback: string): string {
  return value.trim().charAt(0).toUpperCase() || fallback;
}

export default function Sidebar({ workspaceId, workspaceName, userName }: SidebarProps) {
  const effectiveWorkspaceId = workspaceId;
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [workspaceRole, setWorkspaceRole] = useState<{
    workspaceId: string;
    isOwner: boolean;
    isAdmin: boolean;
  } | null>(null);
  const [resolvedWorkspaceName, setResolvedWorkspaceName] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const activeBoardId = useMemo(() => getActiveBoardId(pathname), [pathname]);

  useEffect(() => {
    if (!effectiveWorkspaceId) {
      setResolvedWorkspaceName(null);
      setWorkspaceRole(null);
      return;
    }

    let cancelled = false;

    api
      .get<Workspace[]>("/api/v1/workspaces/me")
      .then((workspaces) => {
        if (cancelled) return;
        const currentWorkspace = workspaces.find(
          (workspace) => workspace.id === effectiveWorkspaceId
        );
        setWorkspaceRole({
          workspaceId: effectiveWorkspaceId,
          isOwner: currentWorkspace?.role === "owner",
          isAdmin: currentWorkspace?.role === "admin",
        });
        if (!workspaceName) {
          setResolvedWorkspaceName(currentWorkspace?.name ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceRole({ workspaceId: effectiveWorkspaceId, isOwner: false, isAdmin: false });
          if (!workspaceName) {
            setResolvedWorkspaceName(null);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveWorkspaceId, workspaceName]);

  const fetchBoards = useCallback(async () => {
    if (!effectiveWorkspaceId) {
      setBoards([]);
      setBoardsError(null);
      return;
    }

    setBoardsLoading(true);
    setBoardsError(null);
    try {
      const data = await boardsApi.list(effectiveWorkspaceId);
      setBoards(data);
    } catch {
      setBoardsError("Не удалось загрузить доски");
    } finally {
      setBoardsLoading(false);
    }
  }, [effectiveWorkspaceId]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const handleSelectBoard = useCallback(
    (boardId: string) => {
      if (!effectiveWorkspaceId || boardId === activeBoardId) return;
      router.push(`/board/${boardId}?workspace_id=${encodeURIComponent(effectiveWorkspaceId)}`);
    },
    [activeBoardId, effectiveWorkspaceId, router]
  );

  const handleToggleFavorite = useCallback(
    async (boardId: string) => {
      if (favoriteLoadingId !== null) return;

      const board = boards.find((item) => item.id === boardId);
      if (!board) return;

      const nextIsFavorite = !board.is_favorite;
      setFavoriteLoadingId(boardId);
      setBoards((current) =>
        current.map((item) =>
          item.id === boardId ? { ...item, is_favorite: nextIsFavorite } : item
        )
      );

      try {
        if (nextIsFavorite) {
          await boardsApi.setFavorite(boardId);
        } else {
          await boardsApi.unsetFavorite(boardId);
        }
      } catch {
        setBoards((current) =>
          current.map((item) =>
            item.id === boardId ? { ...item, is_favorite: board.is_favorite } : item
          )
        );
      } finally {
        setFavoriteLoadingId(null);
      }
    },
    [boards, favoriteLoadingId]
  );

  const handleBoardCreated = useCallback(
    (board: BoardMeta) => {
      setBoards((current) =>
        current.some((item) => item.id === board.id) ? current : [...current, board]
      );
      setBoardsError(null);
      if (effectiveWorkspaceId) {
        router.push(`/board/${board.id}?workspace_id=${encodeURIComponent(effectiveWorkspaceId)}`);
      }
    },
    [effectiveWorkspaceId, router]
  );

  const displayWorkspaceName = workspaceName ?? resolvedWorkspaceName ?? "Workspace";
  const displayUserName = userName ?? user?.name ?? "User";
  const workspaceQuery = effectiveWorkspaceId
    ? `?workspace_id=${encodeURIComponent(effectiveWorkspaceId)}`
    : "";
  const isOwner =
    workspaceRole !== null &&
    workspaceRole.workspaceId === effectiveWorkspaceId &&
    workspaceRole.isOwner;
  const canAccessAdmin =
    workspaceRole !== null &&
    workspaceRole.workspaceId === effectiveWorkspaceId &&
    (workspaceRole.isOwner || workspaceRole.isAdmin);
  const userInitial = useMemo(() => getInitial(displayUserName, "U"), [displayUserName]);
  const favoriteBoards = useMemo(
    () => boards.filter((board) => board.is_favorite),
    [boards]
  );

  return (
    <aside
      className="w-[240px] h-full flex flex-col flex-shrink-0"
      style={{
        background: "#0B0B0B",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="px-3 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <WorkspaceSwitcher workspaceId={effectiveWorkspaceId} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <SidebarSection title="Favorites">
          {favoriteBoards.length > 0 ? (
            favoriteBoards.map((board) => (
              <BoardRow
                key={board.id}
                board={board}
                isActive={board.id === activeBoardId}
                isFavoriteLoading={favoriteLoadingId === board.id}
                onSelect={handleSelectBoard}
                onToggleFavorite={handleToggleFavorite}
              />
            ))
          ) : (
            <div className="px-2 py-2 text-xs" style={{ color: "rgba(255,255,255,0.34)" }}>
              Нет избранных досок
            </div>
          )}
        </SidebarSection>

        <SidebarSection
          title="Boards"
          action={
            canAccessAdmin && effectiveWorkspaceId ? (
              <button
                type="button"
                onClick={() => setCreateBoardOpen(true)}
                title="Новая доска"
                aria-label="Новая доска"
                className="h-6 rounded-md px-1.5 text-[10px] font-medium transition-colors hover:bg-white/[0.06]"
                style={{ color: "rgba(255,255,255,0.52)" }}
              >
                + Новая доска
              </button>
            ) : null
          }
        >
          {boardsLoading && boards.length === 0 ? (
            <div className="px-2 py-2 text-xs" style={{ color: "rgba(255,255,255,0.34)" }}>
              Загрузка...
            </div>
          ) : boardsError ? (
            <button
              type="button"
              onClick={fetchBoards}
              className="px-2 py-2 text-left text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.52)" }}
            >
              {boardsError}
            </button>
          ) : boards.length > 0 ? (
            boards.map((board) => (
              <BoardRow
                key={board.id}
                board={board}
                isActive={board.id === activeBoardId}
                isFavoriteLoading={favoriteLoadingId === board.id}
                onSelect={handleSelectBoard}
                onToggleFavorite={handleToggleFavorite}
              />
            ))
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setCreateBoardOpen(true)}
                disabled={!effectiveWorkspaceId || !canAccessAdmin}
                className="block w-full px-2 py-2 text-left text-xs rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: "rgba(255,255,255,0.52)" }}
              >
                Нет досок — создай первую
              </button>
            </div>
          )}
        </SidebarSection>

        <SidebarSection title="Tools">
          <NavItem href={`/my-tasks${workspaceQuery}`} label="Мои задачи" />
          <NavItem href={`/ai-groom${workspaceQuery}`} label="AI Groom" />
          {canAccessAdmin && (
            <NavItem href={`/admin${workspaceQuery}`} label="Admin" />
          )}
        </SidebarSection>
      </nav>

      <div
        className="px-4 py-4 flex items-center gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
          style={{ background: "#374151" }}
          aria-hidden="true"
        >
          {userInitial}
        </div>
        <div className="min-w-0 flex-1">
          <span
            className="text-xs truncate block"
            style={{ color: "rgba(255,255,255,0.72)" }}
          >
            {displayUserName}
          </span>
          <button
            type="button"
            onClick={logout}
            className="text-xs mt-1 transition-colors"
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.82)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            Logout
          </button>
        </div>
      </div>
      {effectiveWorkspaceId && (
        <CreateBoardDialog
          workspaceId={effectiveWorkspaceId}
          open={createBoardOpen}
          onOpenChange={setCreateBoardOpen}
          onCreated={handleBoardCreated}
        />
      )}
    </aside>
  );
}
