from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

RuleTrigger = Literal["task.created", "task.moved", "task.updated", "deadline.approaching"]
"""
Событие, запускающее правило:
  task.created         — новая задача создана
  task.moved           — задача перемещена в другую колонку
  task.updated         — любое поле задачи изменено
  deadline.approaching — дедлайн задачи наступает через N часов (настраивается системно)
"""

RuleOperator = Literal["eq", "contains", "gt", "lt"]
"""
Оператор условия:
  eq       — точное совпадение (поле == значение)
  contains — вхождение (например tag содержит "urgent")
  gt / lt  — больше/меньше (для числовых полей и дат)
"""

RuleActionType = Literal[
    "move_to_column",
    "add_tag",
    "notify_members",
    "notify_all",
    "suggest_assignee_balanced",
]
"""
Действие при срабатывании правила:
  move_to_column  — переместить задачу в указанную колонку
  add_tag         — добавить тег к задаче
  notify_members  — отправить уведомление участникам workspace
  notify_all      — alias notify_members для событийного consumer-а
  suggest_assignee_balanced — предложить менеджерам исполнителя с минимальной нагрузкой
"""


class RuleCondition(BaseModel):
    """
    Условие, которое должно выполниться для срабатывания правила.
    Если condition=None — правило срабатывает на каждое событие с нужным trigger.

    Примеры:
      {"field": "tags", "operator": "contains", "value": "urgent"}
      {"field": "priority", "operator": "eq", "value": "critical"}
    """

    field: str
    """Поле задачи из payload события: title, priority, tags, column_id и т.д."""
    operator: RuleOperator
    value: Any
    """Значение для сравнения. Тип зависит от поля и оператора."""


class RuleAction(BaseModel):
    """
    Действие, выполняемое при совпадении trigger + condition.

    Примеры params:
      move_to_column:  {"column_id": "<uuid>"}
      add_tag:         {"tag": "overdue"}
      notify_members:  {"message": "Задача стала критической"}
      notify_all:      {"message": "Задача стала критической"}
      suggest_assignee_balanced: {}
    """

    type: RuleActionType
    params: dict[str, Any] = Field(default_factory=dict)


class AutomationRuleCreate(BaseModel):
    """Тело запроса создания правила автоматизации. Только для admin/owner workspace."""

    name: str
    """Человекочитаемое название правила, например «Urgent → In Progress»."""
    trigger: RuleTrigger
    condition: RuleCondition | None = None
    """Если None — правило срабатывает на любое событие с данным trigger."""
    action: RuleAction


class AutomationRulePatch(BaseModel):
    """Частичное обновление правила. Все поля опциональны."""

    name: str | None = None
    trigger: RuleTrigger | None = None
    condition: RuleCondition | None = None
    action: RuleAction | None = None
    active: bool | None = None
    """False — правило сохраняется, но не выполняется движком."""


class AutomationRuleOut(BaseModel):
    """Полное представление правила автоматизации."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    name: str
    active: bool
    trigger: RuleTrigger
    condition: RuleCondition | None
    action: RuleAction
