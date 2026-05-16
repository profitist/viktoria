"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { api, ApiError, boardsApi } from "@/lib/api";
import BoardSkeleton from "@/components/board/BoardSkeleton";
import ErrorBanner from "@/components/board/ErrorBanner";

export default function BoardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    async function resolveBoard() {
      try {
        const workspaces = await api.get<{ id: string }[]>("/api/v1/workspaces/me");

        if (!workspaces.length) {
          router.replace("/workspace/create");
          return;
        }

        const workspaceId = workspaces[0].id;
        const boards = await boardsApi.list(workspaceId);

        if (!boards.length) {
          setError("В рабочем пространстве нет досок");
          return;
        }

        const target = boards.find(b => b.is_favorite) ?? boards[0];
        router.replace(`/board/${target.id}?workspace_id=${workspaceId}`);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          setError("Доски недоступны");
        } else if ((e as Error).message?.toLowerCase().includes("failed to fetch")) {
          setError("Нет соединения с сервером");
        } else {
          setError("Не удалось загрузить доски");
        }
      }
    }

    resolveBoard();
  }, [authLoading, isAuthenticated, router]);

  if (error) return <ErrorBanner message={error} />;

  return <BoardSkeleton />;
}
