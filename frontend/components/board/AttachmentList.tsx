"use client";

import { useEffect, useRef, useState } from "react";
import { attachmentsApi, ApiError } from "@/lib/api";
import type { Attachment } from "@/lib/types";

interface Props {
  taskId: string;
}

const COLLAPSE_LIMIT = 5;

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isImage(contentType: string | null): boolean {
  return contentType?.startsWith("image/") ?? false;
}

export default function AttachmentList({ taskId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    let cancelled = false;
    attachmentsApi.getAttachments(taskId)
      .then(data => { if (!cancelled) setAttachments(data); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  async function handleUpload(file: File) {
    const tempId = `temp-${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);
    const optimistic: Attachment = {
      id: tempId,
      task_id: taskId,
      filename: file.name,
      content_type: file.type || null,
      size: file.size,
      url: objectUrl,
      uploaded_by: null,
      created_at: new Date().toISOString(),
    };
    setAttachments(prev => [...prev, optimistic]);

    try {
      const created = await attachmentsApi.uploadAttachment(taskId, file);
      URL.revokeObjectURL(objectUrl);
      setAttachments(prev => prev.map(a => a.id === tempId ? created : a));
    } catch (e) {
      URL.revokeObjectURL(objectUrl);
      setAttachments(prev => prev.filter(a => a.id !== tempId));
      if (e instanceof ApiError) {
        if (e.status === 413) showToast("Файл слишком большой (максимум 10 МБ)");
        else if (e.status === 415) showToast("Неподдерживаемый тип файла");
        else showToast("Не удалось загрузить файл");
      } else {
        showToast("Не удалось загрузить файл");
      }
    }
  }

  async function handleDelete(attachment: Attachment) {
    setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    try {
      await attachmentsApi.deleteAttachment(attachment.id);
    } catch {
      setAttachments(prev => [...prev, attachment]);
      showToast("Не удалось удалить файл");
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
      e.target.value = "";
    }
  }

  const visible = isExpanded ? attachments : attachments.slice(0, COLLAPSE_LIMIT);
  const hiddenCount = attachments.length - COLLAPSE_LIMIT;

  const dropZone = (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `1.5px dashed ${isDragOver ? "#3B82F6" : "rgba(255,255,255,0.15)"}`,
        background: isDragOver ? "rgba(59,130,246,0.08)" : "transparent",
        borderRadius: "8px",
        padding: "14px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        cursor: "pointer",
        fontSize: "13px",
        color: "rgba(255,255,255,0.40)",
        transition: "border-color 150ms ease, background 150ms ease",
        userSelect: "none",
      }}
    >
      <span>📎</span>
      <span>Перетащите файл или нажмите для выбора</span>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[1, 2].map(i => (
          <div
            key={i}
            style={{
              height: "36px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {visible.map(attachment => (
        <div
          key={attachment.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
          }}
        >
          {isImage(attachment.content_type) ? (
            <img
              src={attachment.url}
              alt={attachment.filename ?? ""}
              onClick={() => window.open(attachment.url, "_blank")}
              style={{
                width: "80px",
                height: "80px",
                objectFit: "cover",
                borderRadius: "6px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          ) : (
            <span style={{ fontSize: "18px", flexShrink: 0 }}>📎</span>
          )}

          <div
            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
            onClick={() => window.open(attachment.url, "_blank")}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "rgba(255,255,255,0.80)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {attachment.filename ?? "файл"}
            </p>
            {attachment.size !== null && (
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                {formatSize(attachment.size)}
              </p>
            )}
          </div>

          <button
            onClick={() => handleDelete(attachment)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer",
              padding: "4px",
              fontSize: "14px",
              lineHeight: 1,
              flexShrink: 0,
              transition: "color 150ms ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.70)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; }}
          >
            ×
          </button>
        </div>
      ))}

      {!isExpanded && hiddenCount > 0 && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.50)",
            fontSize: "12px",
            fontFamily: "Space Grotesk, sans-serif",
            padding: "5px 10px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          +{hiddenCount} ещё
        </button>
      )}

      {dropZone}

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
