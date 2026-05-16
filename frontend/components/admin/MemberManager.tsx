"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { ApiError, workspaceApi } from "@/lib/api";
import type { WorkspaceMember } from "@/lib/types";

const inputStyle = {
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
} as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_BG: Record<string, string> = {
  owner: "rgba(251,191,36,0.15)",
  admin: "rgba(59,130,246,0.15)",
  member: "rgba(255,255,255,0.08)",
};

const ROLE_COLOR: Record<string, string> = {
  owner: "#FBBF24",
  admin: "#60A5FA",
  member: "rgba(255,255,255,0.55)",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface MemberManagerProps {
  workspaceId: string;
}

export default function MemberManager({ workspaceId }: MemberManagerProps) {
  const { user } = useAuth();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [opLoading, setOpLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workspaceApi.getMembers(workspaceId);
      setMembers(data);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Ошибка ${e.status}`
          : "Не удалось загрузить участников"
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function confirmDelete() {
    if (!deletingId) return;
    setOpLoading(true);
    setOpError(null);
    try {
      await workspaceApi.removeMember(workspaceId, deletingId);
      setMembers((prev) => prev.filter((m) => m.user_id !== deletingId));
      setDeletingId(null);
    } catch (e) {
      setOpError(
        e instanceof ApiError
          ? `Ошибка удаления: ${e.status}`
          : "Не удалось удалить участника"
      );
      setDeletingId(null);
    } finally {
      setOpLoading(false);
    }
  }

  async function handleInvite() {
    setInviteError(null);
    setOpError(null);
    setInviteLoading(true);
    try {
      const { member } = await workspaceApi.addMember(workspaceId, inviteEmail.trim(), inviteRole);
      setMembers((prev) => [...prev, member]);
      setInviteEmail("");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) setInviteError("Пользователь не зарегистрирован");
        else if (e.status === 409) setInviteError("Уже участник");
        else setInviteError(`Ошибка ${e.status}`);
      } else {
        setInviteError("Не удалось пригласить");
      }
    } finally {
      setInviteLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p
          className="text-xs uppercase tracking-widest mb-4"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Участники
        </p>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 rounded mb-2 animate-pulse"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-sm mb-3" style={{ color: "#F87171" }}>{error}</p>
        <button
          onClick={loadMembers}
          className="text-sm px-3 py-1.5 rounded-md"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Участники
      </p>

      <div className="space-y-1 mb-4">
        {members.length === 0 && (
          <p className="text-sm py-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Участников нет
          </p>
        )}

        {members.map((m) => {
          const isOwner = m.role === "owner";
          const isSelf = user?.id === m.user_id;
          const canDelete = !isOwner && !isSelf;

          if (deletingId === m.user_id) {
            return (
              <div key={m.user_id} className="flex items-center gap-3 py-2 flex-wrap">
                <span className="text-sm flex-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {m.name}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Удалить?
                </span>
                <button
                  onClick={confirmDelete}
                  disabled={opLoading}
                  className="text-xs px-3 py-1 rounded-md"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}
                >
                  Подтвердить
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  disabled={opLoading}
                  className="text-xs px-3 py-1 rounded-md"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
                >
                  Отмена
                </button>
              </div>
            );
          }

          return (
            <div key={m.user_id} className="flex items-center gap-3 py-2 group">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.87)" }}>
                  {m.name}
                </p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {m.email}
                </p>
              </div>

              <span
                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: ROLE_BG[m.role] ?? ROLE_BG.member,
                  color: ROLE_COLOR[m.role] ?? ROLE_COLOR.member,
                }}
              >
                {ROLE_LABELS[m.role] ?? m.role}
              </span>

              <span
                className="text-xs flex-shrink-0 hidden sm:block"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {formatDate(m.joined_at)}
              </span>

              <button
                onClick={() => {
                  setDeletingId(m.user_id);
                  setOpError(null);
                }}
                disabled={!canDelete || opLoading}
                className="text-xs px-2.5 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                style={{
                  color: canDelete ? "rgba(239,68,68,0.8)" : "rgba(255,255,255,0.2)",
                  cursor: canDelete ? "pointer" : "not-allowed",
                }}
              >
                Удалить
              </button>
            </div>
          );
        })}
      </div>

      {opError && (
        <p className="text-xs mb-3" style={{ color: "#F87171" }}>
          {opError}
        </p>
      )}

      <div className="pt-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          Пригласить участника
        </p>

        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setInviteError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inviteEmail.trim()) handleInvite();
            }}
            placeholder="email@example.com"
            disabled={inviteLoading}
            className="flex-1 min-w-0 px-3 py-2 rounded-md text-sm outline-none"
            style={inputStyle}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
            disabled={inviteLoading}
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={inputStyle}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="text-sm px-4 py-2 rounded-md transition-opacity flex-shrink-0"
            style={{
              background: "#3B82F6",
              color: "#fff",
              opacity: inviteLoading || !inviteEmail.trim() ? 0.5 : 1,
            }}
          >
            {inviteLoading ? "Отправка..." : "Пригласить"}
          </button>
        </div>

        {inviteError && (
          <p className="text-xs" style={{ color: "#F87171" }}>
            {inviteError}
          </p>
        )}
      </div>
    </div>
  );
}
