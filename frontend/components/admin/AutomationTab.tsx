"use client";

import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getRules, createRule, updateRule, deleteRule } from "@/lib/admin-api";
import type {
  AutomationRule,
  TriggerType,
  ActionType,
  ConditionOperator,
  CreateRuleInput,
} from "@/lib/admin-types";

// ── constants ─────────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: "task.created",         label: "Task Created" },
  { value: "task.moved",           label: "Task Moved" },
  { value: "task.updated",         label: "Task Updated" },
  { value: "deadline.approaching", label: "Deadline Approaching" },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "move_to_column", label: "Move to Column" },
  { value: "add_tag",        label: "Add Tag" },
  { value: "notify_members", label: "Notify Members" },
];

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: "eq",       label: "=" },
  { value: "contains", label: "contains" },
  { value: "gt",       label: ">" },
  { value: "lt",       label: "<" },
];

const TRIGGER_COLORS: Record<TriggerType, { bg: string; color: string }> = {
  "task.created":         { bg: "rgba(34,197,94,0.12)",  color: "#86EFAC" },
  "task.moved":           { bg: "rgba(59,130,246,0.12)", color: "#93C5FD" },
  "task.updated":         { bg: "rgba(245,158,11,0.12)", color: "#FCD34D" },
  "deadline.approaching": { bg: "rgba(239,68,68,0.12)",  color: "#FCA5A5" },
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  "task.created":         "Task Created",
  "task.moved":           "Task Moved",
  "task.updated":         "Task Updated",
  "deadline.approaching": "Deadline Approaching",
};

const ACTION_LABELS: Record<ActionType, string> = {
  "move_to_column": "Move to Column",
  "add_tag":        "Add Tag",
  "notify_members": "Notify Members",
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  "eq":       "=",
  "contains": "contains",
  "gt":       ">",
  "lt":       "<",
};

const ACTION_PARAM_LABEL: Record<ActionType, string> = {
  "move_to_column": "Column ID",
  "add_tag":        "Tag name",
  "notify_members": "Message",
};

const ACTION_PARAM_KEY: Record<ActionType, string> = {
  "move_to_column": "column_id",
  "add_tag":        "tag",
  "notify_members": "message",
};

// ── form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  trigger: TriggerType;
  hasCondition: boolean;
  condField: string;
  condOperator: ConditionOperator;
  condValue: string;
  actionType: ActionType;
  actionParam: string;
}

const INIT_FORM: FormState = {
  name: "",
  trigger: "task.created",
  hasCondition: false,
  condField: "",
  condOperator: "eq",
  condValue: "",
  actionType: "notify_members",
  actionParam: "",
};

// ── shared styles ─────────────────────────────────────────────────────────────

const INPUT: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#FFFFFF",
  padding: "8px 12px",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

// ── sub-components ────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: "64px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "48px 20px",
        color: "rgba(255,255,255,0.3)",
        textAlign: "center",
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="6" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 16h10M16 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: "14px" }}>Правил пока нет</p>
      <p style={{ fontSize: "12px" }}>Нажми «+ New Rule» чтобы создать первое</p>
    </div>
  );
}

interface RuleCardProps {
  rule: AutomationRule;
  toggling: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function RuleCard({ rule, toggling, onToggle, onDelete }: RuleCardProps) {
  const tc = TRIGGER_COLORS[rule.trigger];
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "10px",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      {/* Name */}
      <span style={{ flex: 1, minWidth: "100px", fontSize: "14px", fontWeight: 500, color: "#FFFFFF" }}>
        {rule.name}
      </span>

      {/* Trigger badge */}
      <span
        style={{
          background: tc.bg,
          color: tc.color,
          fontSize: "11px",
          fontWeight: 500,
          padding: "3px 8px",
          borderRadius: "999px",
          whiteSpace: "nowrap",
        }}
      >
        {TRIGGER_LABELS[rule.trigger]}
      </span>

      {/* Condition (if present) */}
      {rule.condition && (
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
          if {rule.condition.field} {OPERATOR_LABELS[rule.condition.operator]} {String(rule.condition.value)}
        </span>
      )}

      {/* Action badge */}
      <span
        style={{
          background: "rgba(139,92,246,0.12)",
          color: "#C4B5FD",
          fontSize: "11px",
          fontWeight: 500,
          padding: "3px 8px",
          borderRadius: "999px",
          whiteSpace: "nowrap",
        }}
      >
        {ACTION_LABELS[rule.action.type]}
      </span>

      {/* Active toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        title={rule.active ? "Деактивировать" : "Активировать"}
        style={{
          position: "relative",
          width: "36px",
          height: "20px",
          borderRadius: "999px",
          border: "none",
          background: rule.active ? "#3B82F6" : "rgba(255,255,255,0.12)",
          cursor: toggling ? "not-allowed" : "pointer",
          transition: "background 150ms",
          flexShrink: 0,
          opacity: toggling ? 0.6 : 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: rule.active ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#FFFFFF",
            transition: "left 150ms",
          }}
        />
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        style={{
          background: "none",
          border: "none",
          color: "rgba(239,68,68,0.6)",
          fontSize: "12px",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: "6px",
          flexShrink: 0,
          transition: "color 120ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(239,68,68,0.6)"; }}
      >
        Delete
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface DialogProps {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

function RuleDialog({ form, onChange, onClose, onSubmit, submitting, error }: DialogProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px",
          padding: "24px",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Dialog header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
            New Automation Rule
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Name */}
        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Notify on task create"
            style={INPUT}
          />
        </Field>

        {/* Trigger */}
        <Field label="Trigger">
          <select
            value={form.trigger}
            onChange={(e) => onChange({ trigger: e.target.value as TriggerType })}
            style={INPUT}
          >
            {TRIGGER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {/* Condition toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            fontSize: "13px",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <input
            type="checkbox"
            checked={form.hasCondition}
            onChange={(e) => onChange({ hasCondition: e.target.checked })}
          />
          Add condition (optional)
        </label>

        {/* Condition fields */}
        {form.hasCondition && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 120px" }}>
              <input
                type="text"
                value={form.condField}
                onChange={(e) => onChange({ condField: e.target.value })}
                placeholder="Field (e.g. priority)"
                style={INPUT}
              />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <select
                value={form.condOperator}
                onChange={(e) => onChange({ condOperator: e.target.value as ConditionOperator })}
                style={{ ...INPUT, width: "auto" }}
              >
                {OPERATOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "2 1 100px" }}>
              <input
                type="text"
                value={form.condValue}
                onChange={(e) => onChange({ condValue: e.target.value })}
                placeholder="Value"
                style={INPUT}
              />
            </div>
          </div>
        )}

        {/* Action type */}
        <Field label="Action">
          <select
            value={form.actionType}
            onChange={(e) =>
              onChange({ actionType: e.target.value as ActionType, actionParam: "" })
            }
            style={INPUT}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {/* Action param */}
        <Field label={ACTION_PARAM_LABEL[form.actionType]}>
          <input
            type="text"
            value={form.actionParam}
            onChange={(e) => onChange({ actionParam: e.target.value })}
            placeholder={ACTION_PARAM_LABEL[form.actionType]}
            style={INPUT}
          />
        </Field>

        {/* Form error */}
        {error && (
          <p style={{ fontSize: "12px", color: "#FCA5A5", margin: 0 }}>{error}</p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.72)",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{
              background: "#3B82F6",
              border: "none",
              color: "#FFFFFF",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Creating…" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export interface AutomationTabProps {
  workspaceId: string;
}

export default function AutomationTab({ workspaceId }: AutomationTabProps) {
  const [rules, setRules]       = useState<AutomationRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]         = useState<FormState>(INIT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRules(workspaceId)
      .then((data) => { if (!cancelled) setRules(data); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  function openDialog() {
    setForm(INIT_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function handleFormChange(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleToggle(rule: AutomationRule) {
    if (togglingId === rule.id) return;
    const next = !rule.active;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: next } : r)));
    setTogglingId(rule.id);
    try {
      const updated = await updateRule(rule.id, { active: next });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: rule.active } : r)));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(ruleId: string) {
    const snapshot = rules;
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    try {
      await deleteRule(ruleId);
    } catch {
      setRules(snapshot);
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setFormError("Название обязательно"); return; }
    if (!form.actionParam.trim()) { setFormError("Параметр действия обязателен"); return; }
    if (form.hasCondition && !form.condField.trim()) { setFormError("Поле условия обязательно"); return; }

    const input: CreateRuleInput = {
      name: form.name.trim(),
      trigger: form.trigger,
      action: {
        type: form.actionType,
        params: { [ACTION_PARAM_KEY[form.actionType]]: form.actionParam.trim() },
      },
    };

    if (form.hasCondition && form.condField.trim()) {
      input.condition = {
        field:    form.condField.trim(),
        operator: form.condOperator,
        value:    form.condValue,
      };
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createRule(workspaceId, input);
      setRules((prev) => [...prev, created]);
      setDialogOpen(false);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Не удалось создать правило");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF", margin: 0 }}>
          Правила автоматизации
        </h2>
        <button
          onClick={openDialog}
          style={{
            background: "#3B82F6",
            border: "none",
            color: "#FFFFFF",
            borderRadius: "8px",
            padding: "7px 14px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + New Rule
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "10px",
            fontSize: "13px",
            color: "#FCA5A5",
          }}
        >
          {error}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              toggling={togglingId === rule.id}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule.id)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {dialogOpen && (
        <RuleDialog
          form={form}
          onChange={handleFormChange}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={formError}
        />
      )}
    </div>
  );
}
