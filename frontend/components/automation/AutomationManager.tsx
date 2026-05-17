"use client";

import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createRule,
  deleteRule,
  getMembers,
  getRules,
  updateRule,
} from "@/lib/admin-api";
import type { AutomationRule, Member, TriggerType } from "@/lib/admin-types";
import { boardsApi } from "@/lib/api";

const ACTION_TYPES = [
  { value: "move_to_column", label: "Переместить в колонку" },
  { value: "add_tag", label: "Добавить тег" },
  { value: "notify_members", label: "Уведомить участников" },
  { value: "set_priority", label: "Установить приоритет" },
  { value: "set_assignee", label: "Назначить исполнителя" },
] as const;

const TRIGGER_TYPES: Array<{ value: TriggerType; label: string }> = [
  { value: "task.created", label: "Создание задачи" },
  { value: "task.moved", label: "Перемещение задачи" },
  { value: "task.updated", label: "Обновление задачи" },
  { value: "deadline.approaching", label: "Приближение дедлайна" },
];

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "contains", label: "contains" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const UNASSIGNED = "__unassigned__";

type ExtendedActionType = (typeof ACTION_TYPES)[number]["value"];
type ConditionOperator = (typeof OPERATORS)[number]["value"];
type Priority = (typeof PRIORITIES)[number]["value"];

type RuleView = Omit<AutomationRule, "action"> & {
  action: {
    type: ExtendedActionType | string;
    params: Record<string, unknown>;
  };
};

interface ColumnOption {
  id: string;
  name: string;
  boardName: string;
}

interface FormState {
  name: string;
  trigger: TriggerType;
  hasCondition: boolean;
  conditionField: string;
  conditionOperator: ConditionOperator;
  conditionValue: string;
  actionType: ExtendedActionType;
  columnId: string;
  tag: string;
  message: string;
  priority: Priority;
  assigneeId: string;
}

interface AutomationManagerProps {
  workspaceId: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  trigger: "task.created",
  hasCondition: false,
  conditionField: "",
  conditionOperator: "eq",
  conditionValue: "",
  actionType: "notify_members",
  columnId: "",
  tag: "",
  message: "",
  priority: "medium",
  assigneeId: UNASSIGNED,
};

const ACTION_LABELS: Record<ExtendedActionType, string> = Object.fromEntries(
  ACTION_TYPES.map((item) => [item.value, item.label])
) as Record<ExtendedActionType, string>;

const TRIGGER_LABELS: Record<TriggerType, string> = Object.fromEntries(
  TRIGGER_TYPES.map((item) => [item.value, item.label])
) as Record<TriggerType, string>;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function toRuleView(rule: AutomationRule): RuleView {
  return rule as RuleView;
}

function isExtendedActionType(value: string): value is ExtendedActionType {
  return ACTION_TYPES.some((item) => item.value === value);
}

function isConditionOperator(value: unknown): value is ConditionOperator {
  return OPERATORS.some((item) => item.value === value);
}

function parseConditionValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function stringifyParam(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function memberLabel(member: Member): string {
  const name = member.name?.trim();
  return name ? `${name} · ${member.email}` : member.email;
}

function triggerIcon(trigger: TriggerType): ReactNode {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (trigger === "task.created") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }
  if (trigger === "task.moved") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }
  if (trigger === "task.updated") {
    return (
      <svg {...common}>
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
        <path d="m13.5 8.5 2 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function buildActionParams(form: FormState): Record<string, unknown> {
  if (form.actionType === "move_to_column") {
    return { column_id: form.columnId };
  }
  if (form.actionType === "add_tag") {
    return { tag: form.tag.trim() };
  }
  if (form.actionType === "notify_members") {
    return { message: form.message.trim() };
  }
  if (form.actionType === "set_priority") {
    return { priority: form.priority };
  }
  return {
    assignee_id: form.assigneeId === UNASSIGNED ? null : form.assigneeId,
  };
}

function validateForm(form: FormState): string | null {
  if (!form.name.trim()) return "Укажите название правила";
  if (form.hasCondition && !form.conditionField.trim()) {
    return "Укажите поле условия";
  }
  if (form.actionType === "move_to_column" && !form.columnId) {
    return "Выберите колонку";
  }
  if (form.actionType === "add_tag" && !form.tag.trim()) {
    return "Укажите тег";
  }
  if (form.actionType === "notify_members" && !form.message.trim()) {
    return "Укажите сообщение";
  }
  return null;
}

function formFromRule(rule: RuleView): FormState {
  const actionType = isExtendedActionType(rule.action.type)
    ? rule.action.type
    : "notify_members";
  const params = rule.action.params ?? {};
  const operator = isConditionOperator(rule.condition?.operator)
    ? rule.condition.operator
    : "eq";

  return {
    ...INITIAL_FORM,
    name: rule.name,
    trigger: rule.trigger,
    hasCondition: rule.condition !== null,
    conditionField: rule.condition?.field ?? "",
    conditionOperator: operator,
    conditionValue:
      rule.condition?.value === undefined ? "" : stringifyParam(rule.condition.value),
    actionType,
    columnId: stringifyParam(params["column_id"]),
    tag: stringifyParam(params["tag"]),
    message: stringifyParam(params["message"]),
    priority: PRIORITIES.some((item) => item.value === params["priority"])
      ? (params["priority"] as Priority)
      : "medium",
    assigneeId:
      params["assignee_id"] === null || params["assignee_id"] === undefined
        ? UNASSIGNED
        : stringifyParam(params["assignee_id"]),
  };
}

function buildPayload(form: FormState) {
  return {
    name: form.name.trim(),
    trigger: form.trigger,
    condition: form.hasCondition
      ? {
          field: form.conditionField.trim(),
          operator: form.conditionOperator,
          value: parseConditionValue(form.conditionValue),
        }
      : null,
    action: {
      type: form.actionType,
      params: buildActionParams(form),
    },
  };
}

function describeAction(
  rule: RuleView,
  columns: ColumnOption[],
  members: Member[]
): string {
  const type = rule.action.type;
  const params = rule.action.params ?? {};

  if (type === "move_to_column") {
    const columnId = stringifyParam(params["column_id"]);
    const column = columns.find((item) => item.id === columnId);
    return column
      ? `Переместить в ${column.name} · ${column.boardName}`
      : `Переместить в колонку ${columnId || "не выбрана"}`;
  }
  if (type === "add_tag") {
    return `Добавить тег ${stringifyParam(params["tag"]) || "без имени"}`;
  }
  if (type === "notify_members") {
    return `Уведомить: ${stringifyParam(params["message"]) || "сообщение не задано"}`;
  }
  if (type === "set_priority") {
    return `Установить приоритет ${stringifyParam(params["priority"]) || "medium"}`;
  }
  if (type === "set_assignee") {
    if (params["assignee_id"] === null) return "Снять исполнителя";
    const assigneeId = stringifyParam(params["assignee_id"]);
    const member = members.find((item) => item.user_id === assigneeId);
    return member
      ? `Назначить ${memberLabel(member)}`
      : `Назначить ${assigneeId || "исполнитель не выбран"}`;
  }
  return `Неизвестное действие: ${type}`;
}

export function AutomationManager({ workspaceId }: AutomationManagerProps) {
  const [rules, setRules] = useState<RuleView[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => rules.filter((rule) => rule.active).length,
    [rules]
  );

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        memberLabel(a).localeCompare(memberLabel(b), "ru")
      ),
    [members]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [rulesResult, membersResult, boardsResult] = await Promise.allSettled([
      getRules(workspaceId),
      getMembers(workspaceId),
      boardsApi.list(workspaceId),
    ]);

    if (rulesResult.status === "fulfilled") {
      setRules(rulesResult.value.map(toRuleView));
    } else {
      setLoadError("Не удалось загрузить правила автоматизации");
    }

    if (membersResult.status === "fulfilled") {
      setMembers(membersResult.value);
    } else {
      setToast("Не удалось загрузить участников для выбора исполнителя");
    }

    if (boardsResult.status === "fulfilled") {
      const detailResults = await Promise.allSettled(
        boardsResult.value.map(async (board) => {
          const { board: detail } = await boardsApi.getDetail(board.id);
          return detail;
        })
      );
      setColumns(
        detailResults.flatMap((result) => {
          if (result.status !== "fulfilled") return [];
          return [...result.value.columns]
            .sort((a, b) => a.position - b.position)
            .map((column) => ({
              id: column.id,
              name: column.name,
              boardName: result.value.name,
            }));
        })
      );
    } else {
      setToast("Не удалось загрузить колонки для action move_to_column");
    }

    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    if (toast === null) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function openCreateForm(): void {
    setEditingRuleId(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
  }

  function openEditForm(rule: RuleView): void {
    setEditingRuleId(rule.id);
    setForm(formFromRule(rule));
    setFormOpen(true);
  }

  async function handleToggle(rule: RuleView): Promise<void> {
    if (togglingId !== null) return;

    const nextActive = !rule.active;
    const previousRules = rules;
    setTogglingId(rule.id);
    setRules((current) =>
      current.map((item) =>
        item.id === rule.id ? { ...item, active: nextActive } : item
      )
    );

    try {
      const updated = await updateRule(rule.id, { active: nextActive });
      setRules((current) =>
        current.map((item) =>
          item.id === rule.id ? toRuleView(updated) : item
        )
      );
    } catch {
      setRules(previousRules);
      setToast("Не удалось изменить статус правила");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(rule: RuleView): Promise<void> {
    if (deletingId !== null) return;
    const confirmed = window.confirm(`Удалить правило "${rule.name}"?`);
    if (!confirmed) return;

    const previousRules = rules;
    setDeletingId(rule.id);
    setRules((current) => current.filter((item) => item.id !== rule.id));

    try {
      await deleteRule(rule.id);
    } catch {
      setRules(previousRules);
      setToast("Не удалось удалить правило");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError !== null) {
      setToast(validationError);
      return;
    }

    const payload = buildPayload(form);
    setSubmitting(true);

    try {
      if (editingRuleId === null) {
        const created = await createRule(
          workspaceId,
          payload as unknown as Parameters<typeof createRule>[1]
        );
        setRules((current) => [...current, toRuleView(created)]);
      } else {
        const updated = await updateRule(
          editingRuleId,
          payload as unknown as Parameters<typeof updateRule>[1]
        );
        setRules((current) =>
          current.map((rule) =>
            rule.id === editingRuleId ? toRuleView(updated) : rule
          )
        );
      }

      setForm(INITIAL_FORM);
      setEditingRuleId(null);
      setFormOpen(false);
    } catch {
      setToast(
        editingRuleId === null
          ? "Не удалось создать правило"
          : "Не удалось обновить правило"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm text-white/45">Активных правил</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {activeCount} / {rules.length}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white text-sm font-medium text-black transition hover:bg-white/90"
        >
          + Новое правило
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-white/10 bg-[#111111] p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingRuleId === null ? "Новое правило" : "Редактирование правила"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingRuleId(null);
                setForm(INITIAL_FORM);
              }}
              className="rounded-md px-2 py-1 text-sm text-white/45 hover:bg-white/[0.06] hover:text-white"
            >
              Закрыть
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="field-input"
                placeholder="Например: Critical task owner alert"
              />
            </Field>

            <Field label="Trigger">
              <select
                value={form.trigger}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    trigger: event.target.value as TriggerType,
                  }))
                }
                className="field-input"
              >
                {TRIGGER_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={form.hasCondition}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hasCondition: event.target.checked,
                  }))
                }
              />
              Condition
            </label>

            {form.hasCondition && (
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_1fr]">
                <Field label="Field">
                  <input
                    value={form.conditionField}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        conditionField: event.target.value,
                      }))
                    }
                    className="field-input"
                    placeholder="priority"
                  />
                </Field>
                <Field label="Operator">
                  <select
                    value={form.conditionOperator}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        conditionOperator: event.target.value as ConditionOperator,
                      }))
                    }
                    className="field-input"
                  >
                    {OPERATORS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Value">
                  <input
                    value={form.conditionValue}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        conditionValue: event.target.value,
                      }))
                    }
                    className="field-input"
                    placeholder="critical"
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Action">
              <select
                value={form.actionType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    actionType: event.target.value as ExtendedActionType,
                  }))
                }
                className="field-input"
              >
                {ACTION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <ActionParamsField
              form={form}
              columns={columns}
              members={sortedMembers}
              onChange={setForm}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingRuleId(null);
                setForm(INITIAL_FORM);
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Сохранение..."
                : editingRuleId === null
                  ? "Создать правило"
                  : "Сохранить"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading ? (
          <RulesSkeleton />
        ) : loadError ? (
          <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-4">
            <p className="text-sm text-red-200">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="mt-3 rounded-md border border-red-200/20 px-3 py-1.5 text-sm text-red-100"
            >
              Повторить
            </button>
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm font-medium text-white">Правил пока нет</p>
            <p className="mt-1 text-sm text-white/45">
              Создайте первое правило, чтобы автоматизировать рутинные действия
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              columns={columns}
              members={members}
              toggling={togglingId === rule.id}
              deleting={deletingId === rule.id}
              onToggle={() => void handleToggle(rule)}
              onEdit={() => openEditForm(rule)}
              onDelete={() => void handleDelete(rule)}
            />
          ))
        )}
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 14px;
          outline: none;
          padding: 9px 11px;
        }

        .field-input:focus {
          border-color: rgba(96, 165, 250, 0.75);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
        }

        .field-input::placeholder {
          color: rgba(255, 255, 255, 0.28);
        }

        .field-input option {
          background: #111111;
          color: white;
        }
      `}</style>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}

function ActionParamsField({
  form,
  columns,
  members,
  onChange,
}: {
  form: FormState;
  columns: ColumnOption[];
  members: Member[];
  onChange: Dispatch<SetStateAction<FormState>>;
}) {
  if (form.actionType === "move_to_column") {
    return (
      <Field label="Column">
        <select
          value={form.columnId}
          onChange={(event) =>
            onChange((current) => ({ ...current, columnId: event.target.value }))
          }
          className="field-input"
        >
          <option value="">Выберите колонку</option>
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.boardName} · {column.name}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (form.actionType === "add_tag") {
    return (
      <Field label="Tag">
        <input
          value={form.tag}
          onChange={(event) =>
            onChange((current) => ({ ...current, tag: event.target.value }))
          }
          className="field-input"
          placeholder="urgent"
        />
      </Field>
    );
  }

  if (form.actionType === "notify_members") {
    return (
      <Field label="Message">
        <textarea
          value={form.message}
          onChange={(event) =>
            onChange((current) => ({ ...current, message: event.target.value }))
          }
          className="field-input min-h-24 resize-y"
          placeholder="Задача требует внимания"
        />
      </Field>
    );
  }

  if (form.actionType === "set_priority") {
    return (
      <Field label="Priority">
        <select
          value={form.priority}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              priority: event.target.value as Priority,
            }))
          }
          className="field-input"
        >
          {PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <Field label="Assignee">
      <select
        value={form.assigneeId}
        onChange={(event) =>
          onChange((current) => ({ ...current, assigneeId: event.target.value }))
        }
        className="field-input"
      >
        <option value={UNASSIGNED}>Снять исполнителя</option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {memberLabel(member)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function RuleCard({
  rule,
  columns,
  members,
  toggling,
  deleting,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: RuleView;
  columns: ColumnOption[];
  members: Member[];
  toggling: boolean;
  deleting: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const actionType = isExtendedActionType(rule.action.type)
    ? rule.action.type
    : null;

  return (
    <article
      className={cx(
        "rounded-lg border bg-[#111111] p-4 transition",
        rule.active ? "border-white/10" : "border-white/[0.06] opacity-70"
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
          {triggerIcon(rule.trigger)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white">
              {rule.name}
            </h3>
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-xs",
                rule.active
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-white/[0.06] text-white/40"
              )}
            >
              {rule.active ? "Active" : "Paused"}
            </span>
          </div>

          <p className="mt-2 text-sm text-white/55">
            {TRIGGER_LABELS[rule.trigger]} →{" "}
            {actionType ? ACTION_LABELS[actionType] : rule.action.type}
          </p>
          <p className="mt-1 text-sm text-white/40">
            {describeAction(rule, columns, members)}
          </p>

          {rule.condition && (
            <p className="mt-2 inline-flex rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-white/45">
              if {rule.condition.field} {rule.condition.operator}{" "}
              {String(rule.condition.value)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            className={cx(
              "relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
              rule.active ? "bg-blue-500" : "bg-white/15"
            )}
            aria-label={rule.active ? "Поставить правило на паузу" : "Активировать правило"}
          >
            <span
              className={cx(
                "absolute top-1 h-4 w-4 rounded-full bg-white transition",
                rule.active ? "left-6" : "left-1"
              )}
            />
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md border border-red-400/20 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting" : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}

function RulesSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.04]"
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded px-2 py-1 text-red-100/70 hover:bg-red-400/10 hover:text-red-50"
      >
        Закрыть
      </button>
    </div>
  );
}

export default AutomationManager;
