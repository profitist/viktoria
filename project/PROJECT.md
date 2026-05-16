# Проект Victory Kanban

## Vision

Event-driven канбан-система уровня Jira/Trello: real-time синхронизация изменений между всеми участниками, автоматизация по правилам (trigger → condition → action), видимый event pipeline через RabbitMQ, AI-груминг задач через LLM. Целевая аудитория — команды сотрудников и их менеджеры.

## MVP Scope

**В:**
- Регистрация / логин / JWT (access + refresh)
- Workspace с ролями owner / admin / member (один workspace = одна доска)
- Канбан-доска: стандартные колонки (To Do, In Progress, Done) + кастомные
- Карточки задач: title, description, priority, tags, assignee, created_at, deadline
- `deadline_urgency` на backend: `none` / `soon` / `critical` — фронт красит карточку
- Дедупликация при создании: 409 если задача с таким названием уже есть в колонке
- Drag-drop перемещение → событие в RabbitMQ → real-time push через WebSocket
- RabbitMQ event pipeline: dedup по `event_id` → validate schema → enrich metadata
- Automation (workspace-уровень): правила trigger + condition + action, движок
- WebSocket + JSON-RPC: real-time board updates + in-app уведомления
- **Event Log панель** в UI: каждое событие проходит через pipeline — видно в реальном времени
- Audit log: история изменений задачи, хранится в БД, доступна через API
- AI-груминг: описание проблемы → LLM задаёт уточняющие вопросы → генерирует драфт задачи
- Admin-панель: управление членами, правилами автоматизации, настройками workspace

**Не в MVP:**
- Подпроекты (один workspace = одна доска)
- Subtasks / epic cascade
- Email-уведомления
- Per-task правила автоматизации
- Аналитика / статистика
- Файловые вложения

## Стек

- **Frontend:** Next.js 16 + React 19 + TypeScript + TailwindCSS + shadcn/ui + @dnd-kit/core + @dnd-kit/sortable
- **Auth (frontend):** собственные формы логина/регистрации, JWT в `httpOnly` cookie
- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + uvicorn
- **Auth (backend):** PyJWT — access token 15 мин, refresh token 30 дней
- **БД:** PostgreSQL
- **Очередь:** RabbitMQ — exchange `kanban_events` (topic)
- **Real-time:** WebSocket (FastAPI native) + JSON-RPC 2.0 поверх WS
- **AI:** LLM через HTTP API (OpenAI-compatible endpoint, model из ENV)
- **Деплой:** Docker Compose (backend, frontend, postgres, rabbitmq)

## Модули

| Модуль | Ответственность |
|--------|-----------------|
| **auth** | Регистрация, логин, JWT (access + refresh), logout, Depends-middleware |
| **workspace** | Workspace CRUD, члены, роли, настройки (automation_enabled) |
| **board** | Одна доска на workspace, колонки (CRUD, порядок, цвет) |
| **tasks** | CRUD задач, перемещение, deadline_urgency, дедупликация, публикация событий |
| **events** | RabbitMQ publisher/consumer, типы событий, dedup, validate, enrich, fanout |
| **automation** | Правила (trigger + condition + action), движок, CRUD через API |
| **notifications** | WebSocket hub, JSON-RPC dispatcher, in-app хранение, Event Log feed |
| **audit** | Запись изменений из event pipeline, API истории по задаче |
| **ai** | AI-груминг: LLM-сессия, уточняющие вопросы, генерация драфта задачи |

## Структура каждого модуля (конвенция)

```
backend/app/<module>/
  router.py    # FastAPI router, тонкий — только HTTP-обёртка, вызывает service
  service.py   # вся бизнес-логика
  models.py    # SQLAlchemy ORM-модели
  schemas.py   # Pydantic-схемы (request / response)
```

Исключения: `events/` (publisher.py, consumer.py, types.py), `ai/` (groom.py, router.py).

## Контракты модулей

### auth → frontend

```
POST /api/v1/auth/register
  body:    { email: str, password: str, name: str }
  200:     { access_token: str, refresh_token: str, user: { id, email, name } }
  409:     { detail: "email already registered" }

POST /api/v1/auth/login
  body:    { email: str, password: str }
  200:     { access_token: str, refresh_token: str, user: { id, email, name } }
  401:     { detail: "invalid credentials" }

POST /api/v1/auth/refresh
  body:    { refresh_token: str }
  200:     { access_token: str }
  401:     { detail: "token expired or invalid" }

POST /api/v1/auth/logout
  header:  Authorization: Bearer <access_token>
  200:     {}
```

### workspace → frontend

```
POST /api/v1/workspaces
  body:    { name: str, slug: str }
  200:     { workspace: { id, name, slug, role: "owner" } }

GET /api/v1/workspaces/me
  200:     [{ id, name, slug, role }]

GET /api/v1/workspaces/{workspace_id}/members
  200:     [{ user_id, email, name, role, joined_at }]

POST /api/v1/workspaces/{workspace_id}/members
  body:    { email: str, role: "admin" | "member" }
  200:     { member: { user_id, email, name, role } }
  admin_only

DELETE /api/v1/workspaces/{workspace_id}/members/{user_id}
  204     admin_only

PATCH /api/v1/workspaces/{workspace_id}/settings
  body:    { automation_enabled?: bool }
  200:     { settings }
  admin_only
```

### board → frontend

```
GET /api/v1/workspaces/{workspace_id}/board
  200:  { board: { id, columns: [{ id, name, position, color, tasks: [task] }] } }

POST /api/v1/boards/{board_id}/columns
  body: { name: str, position: int, color?: str }
  200:  { column: { id, name, position, color } }
  admin_only

PATCH /api/v1/columns/{column_id}
  body: { name?: str, position?: int, color?: str }
  200:  { column }   admin_only

DELETE /api/v1/columns/{column_id}
  204   admin_only (только если нет задач)
```

### tasks → frontend

```
Task schema:
  {
    id: uuid, title: str, description: str,
    column_id: uuid, workspace_id: uuid,
    priority: "low" | "medium" | "high" | "critical",
    tags: [str], assignee_id: uuid | null,
    created_at: iso8601, deadline: iso8601 | null,
    deadline_urgency: "none" | "soon" | "critical"
      # none = >72h или нет дедлайна
      # soon = 24–72h
      # critical = <24h или просрочено
  }

GET /api/v1/workspaces/{workspace_id}/tasks?column_id=&assignee_id=&tag=
  200:  [task]

GET /api/v1/tasks/{task_id}/duplicate-check?title={str}
  200:  { exists: bool, task_id?: uuid }

POST /api/v1/tasks
  body: { title, description, column_id, priority, tags, assignee_id?, deadline? }
  200:  { task }
  409:  { detail: "task already exists", existing_task_id: uuid }
  → publishes task.created → RabbitMQ

PATCH /api/v1/tasks/{task_id}
  body: partial fields (кроме id, workspace_id, created_at)
  200:  { task }
  → publishes task.updated → RabbitMQ

PUT /api/v1/tasks/{task_id}/move
  body: { column_id: uuid, position: int }
  200:  { task }
  → publishes task.moved → RabbitMQ

DELETE /api/v1/tasks/{task_id}
  204
  → publishes task.deleted → RabbitMQ
```

### events (внутренний, RabbitMQ)

```
Exchange: kanban_events (topic)
Routing keys: task.created, task.updated, task.moved, task.deleted

EventEnvelope:
  {
    event_id:     uuid          # для дедупликации
    event_type:   str           # task.created | task.updated | task.moved | task.deleted
    workspace_id: uuid
    task_id:      uuid
    timestamp:    iso8601
    actor_id:     uuid
    payload:      dict          # diff полей задачи
  }

Consumer pipeline:
  receive
  → dedup(event_id)             # skip если event_id уже в processed_events
  → validate(EventEnvelope)     # Pydantic, raise если невалидно
  → enrich(+actor_name, +workspace_name, +task_title)
  → fanout (параллельно):
      1. AutomationEngine.process(event)
      2. NotificationHub.broadcast(workspace_id, event)
      3. AuditRecorder.record(event)
```

### automation → tasks (внутренний)

```
Rule schema:
  {
    id:           uuid
    workspace_id: uuid
    name:         str
    active:       bool
    trigger:      "task.created" | "task.moved" | "task.updated" | "deadline.approaching"
    condition:    { field: str, operator: "eq"|"contains"|"gt"|"lt", value: any } | null
    action:       {
                    type: "move_to_column" | "add_tag" | "notify_members",
                    params: { column_id?: uuid, tag?: str, message?: str }
                  }
  }

AutomationEngine.process(event: EventEnvelope) → void
  if not workspace.settings.automation_enabled: return
  rules = load active rules for workspace_id
  for rule in rules:
    if rule.trigger != event.event_type: continue
    if rule.condition and not match(rule.condition, event.payload): continue
    execute(rule.action, event)

REST:
  POST   /api/v1/workspaces/{workspace_id}/automation-rules
         body: { name, trigger, condition, action }  admin_only
  GET    /api/v1/workspaces/{workspace_id}/automation-rules
  PATCH  /api/v1/automation-rules/{rule_id}          admin_only
  DELETE /api/v1/automation-rules/{rule_id}          admin_only
```

### notifications → frontend (WebSocket + JSON-RPC)

```
WebSocket endpoint: ws://{host}/ws/{workspace_id}?token={access_token}
  ConnectionManager[workspace_id] — dict of active connections

JSON-RPC методы (server → client, notification, без id):
  {"jsonrpc":"2.0","method":"board.task_created", "params": { task }}
  {"jsonrpc":"2.0","method":"board.task_updated", "params": { task }}
  {"jsonrpc":"2.0","method":"board.task_moved",   "params": { task, column_id, position }}
  {"jsonrpc":"2.0","method":"board.task_deleted", "params": { task_id }}
  {"jsonrpc":"2.0","method":"notification.created","params": { id, type, message, created_at }}
  {"jsonrpc":"2.0","method":"event_log.entry",    "params": { event_id, event_type, status, detail, ts }}
    # status: "received" | "deduped" | "validated" | "enriched" | "rule_fired" | "broadcast"
    # используется Event Log панелью в UI

REST (in-app уведомления):
  GET   /api/v1/notifications?workspace_id={id}&unread=true
  200:  [{ id, type, message, read, created_at }]

  PATCH /api/v1/notifications/{id}/read
  200:  {}
```

### audit → frontend

```
GET /api/v1/tasks/{task_id}/history
  200: [{ id, event_type, actor: {id, name}, changes: [{field, old, new}], created_at }]

GET /api/v1/workspaces/{workspace_id}/audit-log?limit=50&offset=0
  200: [{ id, event_type, actor, task_id, task_title, changes, created_at }]
  admin_only
```

### ai → frontend

```
Поток:
  1. Пользователь описывает проблему → POST /groom/start → LLM возвращает вопросы
  2. Пользователь отвечает → POST /groom/complete → LLM возвращает драфт задачи
  3. Пользователь редактирует драфт → POST /api/v1/tasks

POST /api/v1/ai/groom/start
  body: { problem_description: str, workspace_id: uuid }
  200:  { session_id: uuid, questions: [{ id: str, text: str }] }

POST /api/v1/ai/groom/complete
  body: { session_id: uuid, answers: [{ question_id: str, answer: str }] }
  200:  { task_draft: { title, description, priority, tags } }
```

## Структура проекта

```
victory/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, include_router
│   │   ├── config.py            # pydantic-settings, все env vars
│   │   ├── database.py          # async SQLAlchemy engine + get_session
│   │   ├── auth/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   ├── workspace/           # router, service, models, schemas
│   │   ├── board/               # router, service, models, schemas
│   │   ├── tasks/               # router, service, models, schemas
│   │   ├── events/
│   │   │   ├── types.py         # EventEnvelope + event type literals
│   │   │   ├── publisher.py     # publish(event) → RabbitMQ
│   │   │   └── consumer.py      # lifespan background task: consume → pipeline
│   │   ├── automation/          # router, service (engine), models, schemas
│   │   ├── notifications/
│   │   │   ├── hub.py           # ConnectionManager: connect/disconnect/broadcast
│   │   │   ├── jsonrpc.py       # build_notification(method, params) → dict
│   │   │   ├── router.py        # WS endpoint + REST /notifications
│   │   │   └── models.py
│   │   ├── audit/
│   │   │   ├── recorder.py      # record(event) → insert audit_log row
│   │   │   ├── router.py
│   │   │   └── models.py
│   │   └── ai/
│   │       ├── groom.py         # LLM-клиент, prompt templates
│   │       └── router.py
│   ├── alembic/
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── providers.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx           # workspace sidebar + event log panel
│   │       ├── board/page.tsx       # канбан-доска с drag-drop
│   │       ├── ai-groom/page.tsx    # AI-груминг интерфейс
│   │       └── admin/page.tsx       # настройки, члены, правила
│   ├── components/
│   │   ├── board/                   # KanbanBoard, Column, TaskCard
│   │   ├── event-log/               # EventLogPanel (real-time pipeline feed)
│   │   └── ui/                      # shadcn/ui компоненты
│   ├── lib/
│   │   ├── api.ts                   # fetch wrapper + auto token refresh
│   │   ├── ws.ts                    # WebSocket client + JSON-RPC dispatcher
│   │   └── types.ts                 # TypeScript-типы по всем контрактам
│   └── package.json
├── docker-compose.yml
├── .env.example
└── project/
    ├── PROJECT.md
    └── KANBAN.md
```

## ENV переменные (.env.example)

```
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/victory
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
JWT_SECRET=changeme
JWT_ALGORITHM=HS256
AI_API_URL=https://...          # OpenAI-compatible endpoint
AI_API_KEY=...
AI_MODEL=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## Frontend: Устоявшиеся паттерны

### ApiError — типизированная HTTP-ошибка (FEAT-0003)

`lib/api.ts` экспортирует класс `ApiError extends Error` с полем `status: number`. Все хелперы `api.*` бросают `ApiError` при HTTP-ошибках (4xx/5xx кроме 401).

Проверка кода ошибки — через `instanceof ApiError` и `.status`, не через строковый поиск в `.message`.

### boardUtils.ts — слой чистых функций (FEAT-0003)

`lib/boardUtils.ts` содержит иммутабельные функции-мутаторы Board state:
- `moveTaskInBoard(board, taskId, targetColumnId, position)` — переместить задачу по id
- `addTaskToColumn(board, task)` — добавить задачу в колонку по `task.column_id`
- `replaceTask(board, task)` — заменить задачу по id во всех колонках
- `deleteTask(board, taskId)` — удалить задачу по id из всех колонок

Все функции возвращают новый объект `Board` (React детектирует изменения). Никаких side-effects. Единственное место для логики мутации board state.

### Оптимистичный update + rollback (FEAT-0003)

Паттерн для операций drag-drop и создания задачи:
1. Захватить snapshot через `structuredClone` внутри функционального updater `setBoard(prev => ...)`
2. Применить мутацию в state немедленно (через функции из `boardUtils.ts`)
3. Отправить API-запрос в фоне
4. При ошибке — восстановить snapshot, показать toast-уведомление на 4 сек

Snapshot обязательно захватывается внутри функционального updater — так гарантируется что он соответствует тому состоянию, из которого выполнялась мутация (защита от stale closure).

### WS-обработчики: useCallback + functional updater (FEAT-0003)

Все WS-обработчики в `page.tsx`:
- Объявляются через `useCallback` с пустым dep-массивом — стабильные ссылки, обязательны для корректного `ws.off()` в cleanup
- Мутируют state через `setBoard(prev => ...)` — исключают race condition с устаревшим closure
- Идемпотентны: проверяют наличие задачи по id перед вставкой (`board.task_created`), `deleteTask` + вставка безопасны для повторного вызова

Cleanup в `useEffect` отписывается теми же ссылками через `ws.off()` и вызывает `ws.disconnect()`.

### Компонентная структура канбан-доски (FEAT-0003)

```
app/(app)/board/page.tsx     — единственный владелец Board state, WS-подписки, колбэки мутаций
  └── components/board/KanbanBoard.tsx   — DndContext, DragOverlay, горизонтальный layout
        └── Column.tsx       — useDroppable, SortableContext, AddTaskForm
              └── TaskCard.tsx           — display-only, принимает isDragging
```

Разделение ответственности строгое: `KanbanBoard` не знает о WS и API; `TaskCard` не знает о DnD (DnD-враппер снаружи в `Column`). Вспомогательные компоненты: `PriorityBadge`, `DeadlineChip`, `BoardSkeleton`, `ErrorBanner`.

### DnD: @dnd-kit (FEAT-0003)

`@dnd-kit/core` + `@dnd-kit/sortable` — совместимы с React 19 (не используют deprecated ReactDOM API). `PointerSensor` с `activationConstraint: { distance: 8 }` покрывает mouse и touch без конфликта со скроллом. `DragOverlay` рендерит клон карточки поверх layout.

## Соглашения

- Ветки: `T-XXX-slug`
- Коммиты: `T-XXX: краткое описание`
- PR: `Closes #N` в описании
- Python: async везде где есть I/O, type annotations обязательны, no bare `except`
- API: `/api/v1/`, ошибки `{ detail: str }` без трейсбеков
- `deadline_urgency` вычисляется в `tasks/service.py` при каждом чтении задачи