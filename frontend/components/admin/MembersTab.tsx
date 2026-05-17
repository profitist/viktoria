"use client";

import {
  type ButtonHTMLAttributes,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMembers,
  inviteMember,
  removeMember,
} from "@/lib/admin-api";
import type { InviteMemberInput, Member } from "@/lib/admin-types";

type WorkspaceRole = "owner" | "admin" | "member";

interface MembersTabProps {
  workspaceId: string;
  currentUserRole: WorkspaceRole;
  members?: Member[];
}

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_BADGE_CLASS: Record<WorkspaceRole, string> = {
  owner: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  admin: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  member: "border-white/10 bg-white/[0.06] text-white/60",
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatJoinedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInviteErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Не удалось пригласить участника";
  if (error.message.includes("404")) return "Пользователь не зарегистрирован";
  if (error.message.includes("409")) return "Пользователь уже участник";
  return "Не удалось пригласить участника";
}

export default function MembersTab({
  workspaceId,
  currentUserRole,
  members: initialMembers,
}: MembersTabProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);
  const [isLoading, setIsLoading] = useState(initialMembers === undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<InviteMemberInput["role"]>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const canManageMembers =
    currentUserRole === "owner" || currentUserRole === "admin";

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role === "owner" && b.role !== "owner") return -1;
        if (a.role !== "owner" && b.role === "owner") return 1;
        return a.name.localeCompare(b.name);
      }),
    [members]
  );

  useEffect(() => {
    if (initialMembers !== undefined) return;

    let cancelled = false;

    async function loadMembers(): Promise<void> {
      setIsLoading(true);
      try {
        const data = await getMembers(workspaceId);
        if (!cancelled) setMembers(data);
      } catch {
        if (!cancelled) setToast("Не удалось загрузить участников");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    queueMicrotask(() => {
      void loadMembers();
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, initialMembers]);

  useEffect(() => {
    if (toast === null) return;

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function handleInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const email = inviteEmail.trim();
    if (!email || isInviting || !canManageMembers) return;

    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const optimisticMember: Member = {
      user_id: optimisticId,
      email,
      name: email.split("@")[0] || email,
      role: inviteRole,
      joined_at: new Date().toISOString(),
    };

    setIsInviting(true);
    setMembers((prev) => [...prev, optimisticMember]);

    try {
      const createdMember = await inviteMember(workspaceId, {
        email,
        role: inviteRole,
      });
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === optimisticId ? createdMember : member
        )
      );
      setInviteEmail("");
      setInviteRole("member");
      setIsInviteOpen(false);
    } catch (error) {
      setMembers((prev) =>
        prev.filter((member) => member.user_id !== optimisticId)
      );
      setToast(getInviteErrorMessage(error));
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemove(): Promise<void> {
    if (memberToRemove === null || isRemoving || memberToRemove.role === "owner") {
      return;
    }

    setIsRemoving(true);
    try {
      await removeMember(workspaceId, memberToRemove.user_id);
      setMembers((prev) =>
        prev.filter((member) => member.user_id !== memberToRemove.user_id)
      );
      setMemberToRemove(null);
    } catch {
      setToast("Не удалось удалить участника");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-white">Участники</h2>
          <p className="mt-1 text-sm text-white/45">
            Управление доступом к workspace
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsInviteOpen(true)}
          disabled={!canManageMembers}
          title={!canManageMembers ? "Недостаточно прав" : undefined}
        >
          Invite
        </Button>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {isLoading ? (
        <MembersSkeleton />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Дата вступления</TableHead>
              <TableHead className="w-[96px] text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="py-8 text-center text-sm text-white/45">
                    Пока только вы
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedMembers.map((member) => {
                const isOwner = member.role === "owner";
                const canRemove = canManageMembers && !isOwner;

                return (
                  <TableRow key={member.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.07] text-xs font-medium text-white/70">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-white/85">
                          {member.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/55">{member.email}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_BADGE_CLASS[member.role]}>
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/45">
                      {formatJoinedAt(member.joined_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canRemove}
                        title={
                          isOwner
                            ? "Нельзя удалить владельца"
                            : !canManageMembers
                              ? "Недостаточно прав"
                              : undefined
                        }
                        onClick={() => setMemberToRemove(member)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      {!isLoading && sortedMembers.length === 1 && (
        <p className="text-sm text-white/40">Пока только вы</p>
      )}

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent
          title="Invite member"
          description="Добавьте зарегистрированного пользователя по email."
        >
          <form className="space-y-4" onSubmit={handleInvite}>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                Email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={isInviting}
                required
                placeholder="name@example.com"
                className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                Роль
              </label>
              <Select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as InviteMemberInput["role"])
                }
                disabled={isInviting}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsInviteOpen(false)}
                disabled={isInviting}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? "Inviting..." : "Invite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open && !isRemoving) setMemberToRemove(null);
        }}
      >
        <DialogContent
          title="Remove member"
          description={
            memberToRemove
              ? `Удалить ${memberToRemove.name} из workspace?`
              : undefined
          }
        >
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MembersSkeleton() {
  return (
    <div className="rounded-md border border-white/10 bg-[#111111] p-4">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="mb-3 h-10 animate-pulse rounded-md bg-white/[0.06] last:mb-0"
        />
      ))}
    </div>
  );
}

function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-200/70 transition-colors hover:text-red-100"
        aria-label="Закрыть"
      >
        x
      </button>
    </div>
  );
}

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-8 px-2.5" : "h-10 px-4",
        variant === "primary" && "bg-white text-black hover:bg-white/85",
        variant === "secondary" &&
          "border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
        variant === "ghost" &&
          "bg-transparent text-red-300/80 hover:bg-red-400/10 hover:text-red-200",
        variant === "danger" &&
          "bg-red-500 text-white hover:bg-red-500/85",
        className
      )}
      {...props}
    />
  );
}

function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-md border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none transition-colors focus:border-white/25",
        className
      )}
      {...props}
    />
  );
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[#111111]">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="bg-white/[0.035]">{children}</thead>;
}

function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

function TableRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-white/[0.06] last:border-b-0">{children}</tr>;
}

function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        "h-10 px-4 text-left text-xs font-medium uppercase tracking-wide text-white/35",
        className
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("px-4 py-3 align-middle", className)} {...props} />;
}

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
      role="presentation"
      onMouseDown={() => onOpenChange(false)}
    >
      <div onMouseDown={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}

function DialogContent({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-5 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mb-5">
        <h3 className="text-base font-medium text-white">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-white/45">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
