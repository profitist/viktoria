"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useAuth } from "@/app/providers";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";

import { useAuth } from "@/app/providers";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";

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

function getInitial(value: string, fallback: string): string {
  return value.trim().charAt(0).toUpperCase() || fallback;
}

export default function Sidebar({ workspaceId, workspaceName, userName }: SidebarProps) {
  const effectiveWorkspaceId = workspaceId;
  const { user, logout } = useAuth();
  const [resolvedWorkspaceName, setResolvedWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceName || !effectiveWorkspaceId) {
      setResolvedWorkspaceName(null);
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
        setResolvedWorkspaceName(currentWorkspace?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedWorkspaceName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveWorkspaceId, workspaceName]);

  const displayWorkspaceName = workspaceName ?? resolvedWorkspaceName ?? "Workspace";
  const displayUserName = userName ?? user?.name ?? "User";
  const workspaceQuery = effectiveWorkspaceId
    ? `?workspace_id=${encodeURIComponent(effectiveWorkspaceId)}`
    : "";
  const workspaceInitial = useMemo(
    () => getInitial(displayWorkspaceName, "W"),
    [displayWorkspaceName]
  );
  const userInitial = useMemo(() => getInitial(displayUserName, "U"), [displayUserName]);

  return (
    <aside
      className="w-[220px] h-full flex flex-col flex-shrink-0"
      style={{
        background: "#0B0B0B",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="px-4 py-5 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-9 w-9 rounded-md flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
          style={{ background: "#1E3A8A" }}
          aria-hidden="true"
        >
          {workspaceInitial}
        </div>
        <div className="min-w-0">
          <span
            className="text-[10px] uppercase tracking-[0.18em] block truncate"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {displayWorkspaceName}
          </span>
          <span className="text-sm font-medium text-white truncate block mt-1">
            Workspace
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <NavItem href={`/board${workspaceQuery}`} label="Board" />
        <NavItem href={`/ai-groom${workspaceQuery}`} label="AI Groom" />
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
    </aside>
  );
}
