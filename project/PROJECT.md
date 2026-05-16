# Проект Victory Kanban

## Vision

Event-driven канбан-система уровня Jira/Trello: real-time синхронизация изменений между всеми участниками, автоматизация по правилам (trigger → condition → action), видимый event pipeline через RabbitMQ, AI-груминг задач через LLM. Workspace содержит несколько досок, сгруппированных в проекты. Целевая аудитория — команды сотрудников и их менеджеры.

## MVP Scope

**В:**
- Регистрация / логин / JWT (access + refresh)
- Workspace с ролями owner / admin / member
- Множество досок в одном workspace + переключатель досок
- Проекты: группировка досок (Project — опциональный контейнер для Board)
- Избранные доски (per-user закладки, секция FAVORITES)
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

**Не в MVP (реализуется пост-MVP по ROADMAP):**
- Email-уведомления
- Per-task правила автоматизации
- Аналитика / статистика

**Пост-MVP (ROADMAP Фаза 2, реализовано/в работе):**
- Теги как сущность + Подзадачи (I-07, done)
- Комментарии с `@mentions` + Файловые вложения (I-08)

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
| **project** | Проекты (группировка досок), CRUD, привязка Board → Project |
| **board** | Множество досок в workspace: CRUD досок, избранное, колонки (CRUD, порядок, цвет) |
| **tasks** | CRUD задач, перемещение, deadline_urgency, дедупликация, публикация событий |
| **events** | RabbitMQ publisher/consumer, типы событий, dedup, validate, enrich, fanout |
| **automation** | Правила (trigger + condition + action), движок, CRUD через API |
| **notifications** | WebSocket hub, JSON-RPC dispatcher, in-app хранение, Event Log feed |
| **audit** | Запись изменений из event pipeline, API истории по задаче |
| **comments** | Комментарии к задаче, парсинг `@mentions` → Notification |
| **attachments** | Файловые вложения задачи, StorageService (MinIO/S3), signed URL |
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

### project → frontend

```
GET /api/v1/workspaces/{workspace_id}/projects
  200:  [{ id, name, board_count }]

POST /api/v1/workspaces/{workspace_id}/projects
  body: { name: str }
  200:  { project: { id, name } }   admin_only

PATCH /api/v1/projects/{project_id}
  body: { name?: str }
  200:  { project }   admin_only

DELETE /api/v1/projects/{project_id}
  204   admin_only (доски проекта переводятся в project_id=null, не удаляются)
```

### board → frontend

```
GET /api/v1/workspaces/{workspace_id}/boards
  200:  [{ id, name, description, project_id, is_favorite }]
  # источник переключателя досок + секции FAVORITES (is_favorite=true)

POST /api/v1/workspaces/{workspace_id}/boards
  body: { name: str, description?: str, project_id?: uuid }
  200:  { board: { id, name, description, project_id } }   admin_only

GET /api/v1/boards/{board_id}
  200:  { board: { id, name, description, project_id, is_favorite,
                    columns: [{ id, name, position, color, tasks: [task] }] } }

PATCH /api/v1/boards/{board_id}
  body: { name?: str, description?: str, project_id?: uuid | null }
  200:  { board }   admin_only

DELETE /api/v1/boards/{board_id}
  204   admin_only (нельзя удалить последнюю доску workspace)

POST   /api/v1/boards/{board_id}/favorite
  200:  { is_favorite: true }    # per-user закладка
DELETE /api/v1/boards/{board_id}/favorite
  204                            # снять закладку

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
    column_id: uuid, board_id: uuid, workspace_id: uuid,
    priority: "low" | "medium" | "high" | "critical",
    tags: [str], assignee_id: uuid | null,
    created_at: iso8601, deadline: iso8601 | null,
    deadline_urgency: "none" | "soon" | "critical"
      # none = >72h или нет дедлайна
      # soon = 24–72h
      # critical = <24h или просрочено
  }

GET /api/v1/workspaces/{workspace_id}/tasks?board_id=&column_id=&assignee_id=&tag=
  200:  [task]
  # board_id обязателен для доски; дедуп title проверяется в пределах (board_id, column_id)

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

### comments → frontend

```
GET /api/v1/tasks/{task_id}/comments
  200: [{ id, task_id, author: { id, name }, body,
          mentions: [user_id], created_at }]
  # лента в хронологическом порядке, отдельно от audit-истории

POST /api/v1/tasks/{task_id}/comments
  body: { body: str }
  200:  { comment: { id, task_id, author, body, mentions, created_at } }
  # парсит @<name> в body → resolve в user_id участника workspace
  # для каждого mention создаёт Notification (type="mention") через notifications.service

DELETE /api/v1/comments/{comment_id}
  204   # автор комментария или admin workspace
```

### attachments → frontend

```
GET /api/v1/tasks/{task_id}/attachments
  200: [{ id, task_id, filename, content_type, size,
          url, uploaded_by: { id, name }, created_at }]
  # url — signed URL (TTL из ENV, по умолчанию 3600s)

POST /api/v1/tasks/{task_id}/attachments
  multipart: file=<binary>
  200:  { attachment: { id, task_id, filename, content_type,
                         size, url, uploaded_by, created_at } }
  413:  { detail: "file too large" }       # лимит ATTACHMENT_MAX_SIZE (10MB)
  415:  { detail: "unsupported file type" } # whitelist: image/*, pdf, txt,
                                            # docx, xlsx, zip
  # StorageService.put(bucket, key, bytes) → MinIO/S3; key = {task_id}/{uuid}_{filename}

DELETE /api/v1/attachments/{attachment_id}
  204   # uploader или admin; удаляет объект из стораджа + запись в БД
```

StorageService (внутренний, `attachments/storage.py`):
```
StorageService(endpoint, access_key, secret_key, bucket)  # из ENV
  ensure_bucket()                          # idempotent, в lifespan/при первом put
  put(key: str, data: bytes, content_type) → None
  signed_url(key: str, ttl: int) → str
  delete(key: str) → None
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
│   │   ├── project/             # router, service, models, schemas (группировка досок)
│   │   ├── board/               # router, service, models, schemas (N досок, favorite)
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
│   │       ├── layout.tsx           # sidebar (boards switcher, projects, favorites) + event log
│   │       ├── board/[boardId]/page.tsx  # канбан-доска с drag-drop (по boardId)
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
S3_ENDPOINT=http://minio:9000   # MinIO/S3 для вложений
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=victory-attachments
ATTACHMENT_MAX_SIZE=10485760    # 10MB
ATTACHMENT_URL_TTL=3600         # signed URL TTL, сек

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

### TaskModal — модальное окно задачи (FEAT-0005)

`components/board/TaskModal.tsx` — просмотр, редактирование и удаление задачи. Открывается из `board/page.tsx` по клику на карточку.

- **Optimistic close только после успеха:** `setSelectedTask(null)` вызывается только после успешного PATCH/DELETE. При ошибке модал остаётся открытым — `throw e` прилетает в `TaskModal.handleSave`, который в `finally` делает `setIsSaving(false)`.
- **Типизированный toast:** `{ msg: string; type: "error" | "info" }` — ошибки красные (`rgba(239,68,68,0.15)`), нейтральные события серые. `showToast(msg, type = "error")`.
- **TaskCard не знает имён:** assignee — нейтральный SVG-аватар. Имя показывает только TaskModal через `GET /workspaces/{id}/members`.
- **Загрузка members:** `useEffect` с `cancelled`-флагом. При ошибке — тихая деградация (пустой select).
- **Prop drilling onCardClick:** `board/page.tsx → KanbanBoard → Column → TaskCard`. `TaskCard.onClick` вызывается при `!isDragging`.

## Миграция: «один workspace = одна доска» → N досок

Изменение архитектурное, выполняется первой задачей итерации (scaffolding + миграция данных):

1. **Модели:** `Board` получает `workspace_id`, `name`, `description`, `project_id` (nullable,
   FK на новый `Project`). `Column` и `Task` получают `board_id` (NOT NULL).
   Новые таблицы: `project`, `board_favorite(user_id, board_id, UNIQUE)`.
2. **Backfill (Alembic data migration):** для каждого существующего workspace создать одну
   запись `Board(name="Main", workspace_id=...)`; проставить `board_id` всем существующим
   `Column`/`Task` этого workspace. Без потери данных.
3. **Совместимость API:** старый `GET /workspaces/{id}/board` удаляется. Фронт переходит на
   `GET /workspaces/{id}/boards` (список) + `GET /boards/{id}` (конкретная доска).
   Роут фронта: `/board` → `/board/[boardId]`; при входе редирект на первую/избранную доску.
4. **WS-подписка** остаётся по `workspace_id` (broadcast всем доскам workspace); клиент
   фильтрует события по `board_id` из payload.
5. **DoD миграции:** `alembic upgrade head` проходит на непустой БД; существующие задачи
   видны на доске «Main»; создание второй доски в workspace работает.

## Соглашения

- Ветки: `T-XXX-slug`
- Коммиты: `T-XXX: краткое описание`
- PR: `Closes #N` в описании
- Python: async везде где есть I/O, type annotations обязательны, no bare `except`
- API: `/api/v1/`, ошибки `{ detail: str }` без трейсбеков
- `deadline_urgency` вычисляется в `tasks/service.py` при каждом чтении задачи
- Дедупликация задачи по `(board_id, column_id, title)`, не по workspace
- Избранное (`board_favorite`) — per-user, не влияет на доступ (RBAC отдельно)