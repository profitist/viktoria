"use client";

import { useEffect, useState } from "react";
import { commentsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/app/providers";
import type { Comment } from "@/lib/types";

interface Props {
  taskId: string;
}

function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  return `${Math.floor(hrs / 24)} д. назад`;
}

function renderBody(body: string): React.ReactNode {
  return body.split(/(@\w+)/g).map((part, i) =>
    /^@\w+$/.test(part)
      ? <span key={i} style={{ color: "#93C5FD" }}>{part}</span>
      : part
  );
}

export default function CommentFeed({ taskId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    commentsApi.getComments(taskId)
      .then(data => { if (!cancelled) setComments(data); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || isSending || !user) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      task_id: taskId,
      author: { id: user.id, name: user.name },
      body: trimmed,
      mentions: [],
      created_at: new Date().toISOString(),
    };

    setComments(prev => [optimistic, ...prev]);
    setBody("");
    setIsSending(true);

    try {
      const created = await commentsApi.createComment(taskId, trimmed);
      setComments(prev => prev.map(c => c.id === tempId ? created : c));
    } catch (e) {
      setComments(prev => prev.filter(c => c.id !== tempId));
      void e;
      showToast("Не удалось отправить комментарий");
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: "42px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: 0 }}>
        Не удалось загрузить комментарии
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {comments.length === 0 && (
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: "0 0 12px" }}>
          Пока нет комментариев
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {comments.map(comment => (
          <div
            key={comment.id}
            style={{
              padding: "8px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.90)" }}>
                {comment.author.name}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                {formatRelativeTime(comment.created_at)}
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.80)", margin: 0, lineHeight: 1.5 }}>
              {renderBody(comment.body)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "flex-end" }}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Написать комментарий..."
          disabled={isSending}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            color: "#FFFFFF",
            fontSize: "13px",
            fontFamily: "Space Grotesk, sans-serif",
            padding: "8px 12px",
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || isSending}
          style={{
            background: body.trim() && !isSending ? "#3B82F6" : "rgba(59,130,246,0.3)",
            border: "none",
            borderRadius: "10px",
            color: "#FFFFFF",
            fontSize: "13px",
            fontFamily: "Space Grotesk, sans-serif",
            padding: "8px 14px",
            cursor: body.trim() && !isSending ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "background 150ms ease",
          }}
        >
          →
        </button>
      </div>

      {toast !== null && (
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#FCA5A5",
            fontSize: "14px",
            padding: "8px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            zIndex: 50,
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
