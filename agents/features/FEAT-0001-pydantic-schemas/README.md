# FEAT-0001: Pydantic-схемы всех модулей (T-004)

## Постановка проблемы

Без явных схем каждый модуль трактует входящие/исходящие данные по-своему. Фронтенд не знает какие поля ожидать, backend не валидирует входные данные. Нужен единый контракт: что приходит, что уходит, какие типы.

## Путь пользователя (разработчик)

**Начальное состояние:**
Разработчик хочет вызвать `POST /api/v1/tasks` или прочитать ответ `GET /api/v1/workspaces/{id}/board`.

**Шаги:**
1. Открывает `backend/app/tasks/schemas.py` — видит `TaskCreate` с полями и типами
2. Пишет запрос с нужными полями
3. FastAPI автоматически валидирует тело запроса через схему
4. При ошибке — получает 422 с читаемым описанием какое поле неверно
5. В ответе — типизированный `TaskOut` с `deadline_urgency`

**Конечное состояние:**
Все 7 модулей имеют `schemas.py`. `from app.tasks.schemas import TaskOut` работает. TypeScript-типы в `frontend/lib/types.ts` пишутся вручную по этим схемам.

## Схемы по модулям

### auth/schemas.py
| Класс | Поля |
|-------|------|
| `RegisterRequest` | email: EmailStr, password: str, name: str |
| `LoginRequest` | email: EmailStr, password: str |
| `RefreshRequest` | refresh_token: str |
| `UserOut` | id: UUID, email: str, name: str |
| `TokenResponse` | access_token: str, refresh_token: str, user: UserOut |

### workspace/schemas.py
| Класс | Поля |
|-------|------|
| `WorkspaceCreate` | name: str, slug: str |
| `WorkspaceOut` | id: UUID, name: str, slug: str, role: str |
| `MemberInvite` | email: EmailStr, role: Literal["admin","member"] |
| `MemberOut` | user_id: UUID, email: str, name: str, role: str, joined_at: datetime |
| `WorkspaceSettingsPatch` | automation_enabled: bool \| None |

### board/schemas.py
| Класс | Поля |
|-------|------|
| `ColumnCreate` | name: str, position: int, color: str \| None |
| `ColumnPatch` | name: str \| None, position: int \| None, color: str \| None |
| `ColumnOut` | id: UUID, name: str, position: int, color: str \| None |
| `BoardOut` | id: UUID, columns: list[ColumnOut] |

### tasks/schemas.py
| Класс | Поля |
|-------|------|
| `TaskCreate` | title: str, description: str \| None, column_id: UUID, priority: TaskPriority, tags: list[str], assignee_id: UUID \| None, deadline: datetime \| None |
| `TaskPatch` | все поля TaskCreate опциональны |
| `TaskMoveRequest` | column_id: UUID, position: int |
| `TaskOut` | id: UUID, title, description, column_id, workspace_id, priority, tags, assignee_id, created_at, deadline, **deadline_urgency: Literal["none","soon","critical"]** |
| `DuplicateCheckOut` | exists: bool, task_id: UUID \| None |

`TaskPriority` = `Literal["low","medium","high","critical"]`

### automation/schemas.py
| Класс | Поля |
|-------|------|
| `RuleCondition` | field: str, operator: Literal["eq","contains","gt","lt"], value: Any |
| `RuleAction` | type: Literal["move_to_column","add_tag","notify_members"], params: dict |
| `AutomationRuleCreate` | name: str, trigger: str, condition: RuleCondition \| None, action: RuleAction |
| `AutomationRulePatch` | все поля опциональны + active: bool \| None |
| `AutomationRuleOut` | id: UUID, workspace_id: UUID, name, active, trigger, condition, action |

### notifications/schemas.py
| Класс | Поля |
|-------|------|
| `NotificationOut` | id: UUID, type: str, message: str, read: bool, created_at: datetime |

### audit/schemas.py
| Класс | Поля |
|-------|------|
| `AuditChangeItem` | field: str, old: Any, new: Any |
| `AuditLogOut` | id: UUID, event_type: str, actor: UserOut, changes: list[AuditChangeItem], created_at: datetime |

## Данные и их жизненный цикл

**Схемы не хранят данные** — они только описывают форму данных при передаче по HTTP.

`deadline_urgency` в `TaskOut` — вычисляемое поле (не хранится в БД):
- `none` = дедлайна нет или > 72 часов
- `soon` = от 24 до 72 часов
- `critical` = менее 24 часов или просрочено

Вычисляется в `tasks/service.py` при каждом чтении задачи.

## Граничные случаи

| Сценарий | Ожидаемое поведение |
|----------|-------------------|
| `TaskCreate(column_id="not-uuid")` | ValidationError — Pydantic не принимает строку вместо UUID |
| `TaskCreate(title="")` | Принимается (пустая строка валидна если не добавлен min_length) |
| `AutomationRulePatch({})` | Принимается — все поля опциональны, это частичное обновление |
| `TaskOut` из ORM-объекта | Работает через `model_config = ConfigDict(from_attributes=True)` |

## Критерии готовности

- [ ] `from app.tasks.schemas import TaskOut` — без ошибок импорта
- [ ] `TaskOut.model_json_schema()` содержит `deadline_urgency` с `enum: ["none","soon","critical"]`
- [ ] `TaskCreate(title="x", column_id="not-uuid")` поднимает `ValidationError`
- [ ] `from app.auth.schemas import TokenResponse` — без ошибок
- [ ] Все UUID-поля типизированы как `uuid.UUID`, не `str`
- [ ] Все datetime-поля типизированы как `datetime`, не `str`
- [ ] `model_config = ConfigDict(from_attributes=True)` во всех Output-схемах
- [ ] `uv run python -m pytest` или ручная проверка: все импорты работают

## Зависимости

- `auth/schemas.py` уже создан (RegisterRequest, LoginRequest, RefreshRequest, TokenResponse, UserOut)
- Нужно создать 6 оставшихся файлов
- `pydantic[email]` уже добавлен в зависимости

---

**Готово к технической проработке:** Да