"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api, ApiError } from "@/lib/api";

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();
  const isNameValid = trimmedName.length >= 2 && trimmedName.length <= 50;
  const isSlugValid = trimmedSlug.length > 0 && isValidSlug(trimmedSlug);
  const isSubmitDisabled = isLoading || !isNameValid || !isSlugValid;

  const nameHint = useMemo(() => {
    if (trimmedName.length === 0) return "От 2 до 50 символов";
    if (trimmedName.length < 2) return "Минимум 2 символа";
    if (trimmedName.length > 50) return "Максимум 50 символов";
    return null;
  }, [trimmedName.length]);

  function handleNameChange(value: string): void {
    setName(value);
    setError(null);

    if (!isSlugEdited) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(value: string): void {
    setSlug(generateSlug(value));
    setIsSlugEdited(true);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitDisabled) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post<{ workspace: { id: string } }>("/api/v1/workspaces", {
        name: trimmedName,
        slug: trimmedSlug,
      });
      router.replace(`/board?workspace_id=${response.workspace.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Такой slug уже занят");
      } else {
        setError("Не удалось создать workspace. Попробуйте позже");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-[#050505] flex items-center justify-center px-6 py-10">
      <div
        className="w-full max-w-md rounded-2xl p-10"
        style={{
          background: "#0B0B0B",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mb-8">
          <h1 className="text-xl font-semibold uppercase tracking-[0.2em] text-white">
            Workspace
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            Создайте рабочее пространство для команды
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="workspace-name"
              className="text-xs uppercase tracking-widest font-medium"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Название
            </label>
            <input
              id="workspace-name"
              type="text"
              required
              minLength={2}
              maxLength={50}
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Product Team"
              className="rounded-lg px-3 py-3 text-sm text-white outline-none transition-all"
              style={{
                background: "#0B0B0B",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
              onFocus={(event) =>
                (event.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")
              }
              onBlur={(event) =>
                (event.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
              }
            />
            {nameHint !== null && (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {nameHint}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="workspace-slug"
              className="text-xs uppercase tracking-widest font-medium"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Slug
            </label>
            <input
              id="workspace-slug"
              type="text"
              required
              value={slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              placeholder="product-team"
              className="rounded-lg px-3 py-3 text-sm text-white outline-none transition-all"
              style={{
                background: "#0B0B0B",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
              onFocus={(event) =>
                (event.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")
              }
              onBlur={(event) =>
                (event.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
              }
            />
            {!isSlugValid && trimmedSlug.length > 0 && (
              <p className="text-xs text-red-400">
                Только латиница, цифры и дефис без дефиса в начале или конце
              </p>
            )}
          </div>

          {error !== null && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="rounded-lg px-4 py-3 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#3B82F6" }}
            onMouseEnter={(event) => {
              if (!isSubmitDisabled) {
                event.currentTarget.style.background = "#2563EB";
                event.currentTarget.style.boxShadow = "0 0 20px rgba(59,130,246,0.3)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "#3B82F6";
              event.currentTarget.style.boxShadow = "none";
            }}
          >
            {isLoading ? "Создание..." : "Создать"}
          </button>
        </form>
      </div>
    </div>
  );
}
