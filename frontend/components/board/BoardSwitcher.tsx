"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boardsApi } from "@/lib/api";
import type { BoardMeta } from "@/lib/types";

interface BoardSwitcherProps {
  boardId: string;
  boardName: string;
  isFavorite: boolean;
  workspaceId: string;
  onFavoriteChange: (isFavorite: boolean) => void;
}

export default function BoardSwitcher({
  boardId,
  boardName,
  isFavorite,
  workspaceId,
  onFavoriteChange,
}: BoardSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const fetchBoards = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await boardsApi.list(workspaceId);
      setBoards(data);
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  function handleToggleDropdown() {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) fetchBoards();
  }

  function handleNavigate(targetId: string) {
    setIsOpen(false);
    if (targetId === boardId) return;
    router.push(`/board/${targetId}?workspace_id=${workspaceId}`);
  }

  async function toggleFavorite(e: React.MouseEvent, targetId: string) {
    e.stopPropagation();
    if (favoriteLoading) return;

    const isCurrentBoard = targetId === boardId;
    const currentIsFav = isCurrentBoard
      ? isFavorite
      : (boards.find(b => b.id === targetId)?.is_favorite ?? false);

    setFavoriteLoading(targetId);
    if (isCurrentBoard) onFavoriteChange(!currentIsFav);
    setBoards(prev => prev.map(b => b.id === targetId ? { ...b, is_favorite: !b.is_favorite } : b));

    try {
      if (currentIsFav) {
        await boardsApi.unsetFavorite(targetId);
      } else {
        await boardsApi.setFavorite(targetId);
      }
    } catch {
      if (isCurrentBoard) onFavoriteChange(currentIsFav);
      setBoards(prev => prev.map(b => b.id === targetId ? { ...b, is_favorite: currentIsFav } : b));
    } finally {
      setFavoriteLoading(null);
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: "4px" }}>
      {/* Trigger */}
      <button
        onClick={handleToggleDropdown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          borderRadius: "10px",
          background: isOpen ? "rgba(255,255,255,0.06)" : "transparent",
          border: `1px solid ${isOpen ? "rgba(255,255,255,0.10)" : "transparent"}`,
          color: "#FFFFFF",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.01em",
          transition: "background 0.12s ease, border-color 0.12s ease",
          maxWidth: "280px",
        }}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {boardName}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {/* Star for current board */}
      <button
        onClick={e => toggleFavorite(e, boardId)}
        title={isFavorite ? "Убрать из избранного" : "В избранное"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          background: "transparent",
          border: "1px solid transparent",
          cursor: favoriteLoading === boardId ? "wait" : "pointer",
          color: isFavorite ? "#F59E0B" : "rgba(255,255,255,0.28)",
          opacity: favoriteLoading === boardId ? 0.5 : 1,
          transition: "color 0.15s ease, background 0.12s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        <StarIcon filled={isFavorite} size={14} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: "240px",
            maxWidth: "320px",
            background: "#0B0B0B",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {loading && boards.length === 0 ? (
            <div style={{ padding: "14px 16px", color: "rgba(255,255,255,0.40)", fontSize: "12px", textAlign: "center" }}>
              Загрузка...
            </div>
          ) : boards.length === 0 ? (
            <div style={{ padding: "14px 16px", color: "rgba(255,255,255,0.40)", fontSize: "12px", textAlign: "center" }}>
              Нет доступных досок
            </div>
          ) : (
            <div style={{ padding: "6px" }}>
              {boards.map(board => (
                <BoardItem
                  key={board.id}
                  board={board}
                  isActive={board.id === boardId}
                  favoriteLoading={favoriteLoading === board.id}
                  onSelect={() => handleNavigate(board.id)}
                  onToggleFavorite={e => toggleFavorite(e, board.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s ease",
        flexShrink: 0,
        color: "rgba(255,255,255,0.40)",
      }}
    >
      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
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

interface BoardItemProps {
  board: BoardMeta;
  isActive: boolean;
  favoriteLoading: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

function BoardItem({ board, isActive, favoriteLoading, onSelect, onToggleFavorite }: BoardItemProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", borderRadius: "10px" }}>
      <button
        onClick={onSelect}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "7px 8px",
          borderRadius: "10px",
          background: isActive ? "rgba(59,130,246,0.10)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          transition: "background 0.1s ease",
          minWidth: 0,
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: isActive ? "#3B82F6" : "rgba(255,255,255,0.18)",
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: "13px",
          fontWeight: isActive ? 500 : 400,
          color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.72)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {board.name}
        </span>
      </button>

      <button
        onClick={onToggleFavorite}
        title={board.is_favorite ? "Убрать из избранного" : "В избранное"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "26px",
          height: "26px",
          flexShrink: 0,
          borderRadius: "7px",
          background: "transparent",
          border: "none",
          cursor: favoriteLoading ? "wait" : "pointer",
          color: board.is_favorite ? "#F59E0B" : "rgba(255,255,255,0.22)",
          opacity: favoriteLoading ? 0.4 : 1,
          transition: "color 0.12s ease, background 0.1s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <StarIcon filled={board.is_favorite} size={12} />
      </button>
    </div>
  );
}
