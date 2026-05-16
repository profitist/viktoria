# Victory Kanban — Developer Reference

Справочник для разработчиков по инфраструктуре проекта.

---

## Backend: Ядро приложения

### Стек и зависимости
Python 3.12 · FastAPI · SQLAlchemy 2.0 async · asyncpg · PyJWT · bcrypt · aio-pika  
Пакетный менеджер: **pip + `backend/requirements.txt`** (uv не используется)  
Docker-образ: `python:3.12-slim`

### Точка входа (`backend/app/main.py`)
Текущий `main.py` минимальный: CORS + notifications routers. `config.py` отсутствует — каждый модуль читает переменные окружения напрямую через `os.environ["VAR"]` (fail-fast при старте).

```python
# Регистрация роутеров (текущий main.py)
app.include_router(notifications_router)       # WS /ws/{workspace_id}
app.include_router(notifications_rest_router)  # REST /api/v1/notifications
```

### БД (`backend/app/database.py`)
```python
from app.database import Base, TimestampMixin, get_session, _SessionFactory

# FastAPI Depends для REST
async def my_endpoint(session: AsyncSession = Depends(get_session)): ...

# Ручная сессия для WS (не держи через Depends на время жизни соединения)
async with _SessionFactory() as session:
    result = await session.execute(...)
```

- `Base` — базовый ORM-класс, передавай в alembic env.py
- `TimestampMixin` — добавляет `created_at: TIMESTAMP(timezone=True)`
- `_engine` — singleton движка; dispose при shutdown

### Auth (`backend/app/auth/deps.py`)
```python
from app.auth.deps import decode_token, get_current_user, InvalidToken

# В WS-endpoint (до accept)
try:
    user_id = decode_token(token)  # -> UUID
except InvalidToken:
    await websocket.accept()
    await websocket.close(code=4001)
    return

# В REST (через Depends)
async def endpoint(user: User = Depends(get_current_user)): ...
```

**Правило:** `decode_token` — для WS (бросает `InvalidToken`). `get_current_user` — для REST (бросает `HTTPException 401`). Никогда не смешивай.

### Обязательные ENV переменные
| Переменная | Где используется | Примечание |
|------------|-----------------|------------|
| `DATABASE_URL` | `database.py` | `postgresql+asyncpg://user:pass@host/db` |
| `JWT_SECRET` | `auth/deps.py` | Минимум 32 символа, HS256 |
| `RABBITMQ_URL` | consumer | `amqp://guest:guest@rabbitmq:5672/` |
| `S3_ENDPOINT` | `attachments/storage.py` (T-050) | `http://minio:9000` в compose |
| `S3_ACCESS_KEY` | `attachments/storage.py` (T-050) | `minioadmin` по умолчанию |
| `S3_SECRET_KEY` | `attachments/storage.py` (T-050) | `minioadmin` по умолчанию |
| `S3_BUCKET` | `attachments/storage.py` (T-050) | `victory-attachments` |
| `ATTACHMENT_MAX_SIZE` | `attachments/router.py` (T-047) | байты, default 10485760 (10MB) |
| `ATTACHMENT_URL_TTL` | `attachments/storage.py` (T-050) | секунды, default 3600 |

### Миграции Alembic

**Конвенция именования** (строго):
- `op.f("pk_{table}")` — PK constraint
- `op.f("fk_{table}_{col}_{ref_table}")` — FK constraint
- `op.f("ix_{table}_{col}")` — индекс
- `op.f("uq_{table}_{col1}_{col2}")` — unique constraint

**Цепочка миграций:**
```
20260515_000001 (initial_schema)
  → 20260516_000002 (processed_events)
  → 20260516_000003 (multiboard)
  → 20260517_000004 (tags_subtasks)
  → 20260517_000005 (comments_attachments)  ← текущий HEAD
```

**Паттерн FK с CASCADE** (для comment/attachment → tasks):
```python
sa.ForeignKeyConstraint(["task_id"], ["tasks.id"],
    name=op.f("fk_{table}_task_id_tasks"), ondelete="CASCADE")
```

**Паттерн JSONB с default:**
```python
sa.Column("mentions", postgresql.JSONB(astext_type=sa.Text()),
    server_default=sa.text("'[]'::jsonb"), nullable=False)
```

### Таблицы comment и attachment (FEAT-0009)

```
comment: id(uuid PK) task_id(uuid FK→tasks CASCADE) author_id(uuid FK→users)
         body(text NOT NULL) mentions(jsonb default '[]') created_at(timestamptz)
         INDEX: ix_comment_task_id

attachment: id(uuid PK) task_id(uuid FK→tasks CASCADE) filename(text) content_type(text)
            size(int) storage_key(text NOT NULL) uploaded_by(uuid FK→users) created_at(timestamptz)
            INDEX: ix_attachment_task_id
```

ON DELETE CASCADE: удаление task автоматически чистит comment + attachment.  
StorageService (T-050): storage_key format = `{task_id}/{uuid}_{filename}`.

### Attachments StorageService + service + router (FEAT-0013)

`backend/app/attachments/storage.py`:

```python
from app.attachments.storage import storage  # синглтон StorageService

# boto3 S3/MinIO клиент; все методы async через asyncio.to_thread:
# await storage.ensure_bucket()           — head→create, idempotent
# await storage.put(key, data, ct)        — put_object
# url = await storage.signed_url(key, ttl) — generate_presigned_url
# await storage.delete(key)               — delete_object (idempotent)
```

`backend/app/attachments/service.py`:

```python
from app.attachments.service import list_attachments, upload_attachment, delete_attachment

# ALLOWED_CONTENT_TYPES: set {pdf, txt, docx, xlsx, zip} + image/* prefix
# upload_attachment: 413 если len(data)>max_size; 415 если не в whitelist
#   order: storage.put → DB flush → commit → re-query → signed_url
# delete_attachment: 404/403; storage.delete (idempotent) → DB delete
# list_attachments: selectinload(Attachment.uploader), map→signed_url
```

`backend/app/attachments/router.py`:

```python
from app.attachments.router import router  # tags=["attachments"]

# GET  /tasks/{task_id}/attachments → list[AttachmentResponse] 200
# POST /tasks/{task_id}/attachments (file: UploadFile=File(...)) → 201
# DELETE /attachments/{id} → Response 204
# _get_storage() Depends возвращает module-level storage singleton
```

**config.py** — 6 новых полей: `s3_endpoint`, `s3_access_key`, `s3_secret_key`, `s3_bucket`, `attachment_max_size` (10MB), `attachment_url_ttl` (3600s).

**main.py** изменён:
- `MODULE_NAMES` расширен: добавлены `"comments"`, `"attachments"`
- lifespan: `await _storage.ensure_bucket()` перед RabbitMQ consumer
- `app/models.py`: добавлены `Comment`, `Attachment` для mapper registration

**Ограничение:** signed URL содержит `S3_ENDPOINT` (docker-internal `http://minio:9000`); браузер не резолвит `minio`. Для production нужен публичный endpoint (пост-MVP).

### ORM-модуль attachments (FEAT-0011)

`backend/app/attachments/` — пакет с `__init__.py`, `models.py`, `schemas.py`.

```python
from app.attachments.models import Attachment
# __tablename__ = "attachment"
# storage_key: Mapped[str]  — Text NOT NULL, в API не отдаётся
# НЕТ колонки url — вычисляется в T-050
# uploaded_by: nullable UUID FK→users; uploader = relationship("User")

from app.attachments.schemas import AttachmentResponse, AttachmentUploader
# AttachmentUploader: id UUID, name str
# AttachmentResponse: id, task_id, filename|None, content_type|None,
#                     size|None, url: str, uploaded_by: AttachmentUploader|None, created_at
# url — обычное поле str; T-050 собирает: model_validate({**obj.__dict__, "url": signed_url})
# storage_key НЕ в схеме (не утекает в API)
```

**Паттерн T-050:** `StorageService.presign(storage_key)` → signed URL → `AttachmentResponse`.

### Comments service + router (FEAT-0012)

`backend/app/comments/service.py`:

```python
from app.comments.service import list_comments, create_comment, delete_comment

# list_comments(session, task_id) → list[Comment]
# — selectinload(Comment.author), ORDER BY created_at ASC

# create_comment(session, task_id, author_id, body) → Comment
# — 404 если task не найдена
# — regex @(\w+), set() дедупликация
# — JOIN User+WorkspaceMember, func.lower().in_() для case-insensitive
# — mentions = [str(uid) for uid in mention_ids]  # JSONB как list[str]
# — create_notification() для каждого mention кроме author_id (self)
# — commit → re-query с selectinload(author)

# delete_comment(session, comment_id, actor: User) → None
# — 404 если не найден; 403 если не автор и не ADMIN/OWNER
```

`backend/app/comments/router.py`:

```python
from app.comments.router import router  # подключить в main.py как /api/v1

# GET  /tasks/{task_id}/comments → list[CommentResponse] 200
# POST /tasks/{task_id}/comments {body} → CommentResponse 201
# DELETE /comments/{comment_id} → Response 204
# Все эндпоинты: Depends(get_current_user) + Depends(get_session)
```

**Паттерн сериализации:** `CommentResponse.model_validate(comment)` — работает т.к. `CommentAuthor` (from_attributes=True) автоматически валидируется из loaded User relationship. `mentions: list[UUID]` ← Pydantic коерсирует JSONB list[str].

### ORM-модуль comments (FEAT-0010)

`backend/app/comments/` — пакет с `__init__.py`, `models.py`, `schemas.py`.

```python
# models.py — Comment ORM
from app.comments.models import Comment
# __tablename__ = "comment" (не "comments")
# author = relationship("User")  — для JOIN в service (T-049)
# mentions: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")

# schemas.py
from app.comments.schemas import CommentCreate, CommentAuthor, CommentResponse
# CommentCreate: body str (input, без from_attributes)
# CommentAuthor: id UUID, name str (from_attributes=True)
# CommentResponse: id, task_id, author: CommentAuthor, body, mentions: list[UUID], created_at
```

**Важно для T-049:** `mentions` в JSONB хранится как список строк; Pydantic `list[UUID]` коерсирует их автоматически. Relationship `author` без `lazy` — сервис сам настраивает стратегию загрузки.

### MinIO в docker-compose

Сервис `victory-minio`: порт 9000 (S3 API), 9001 (веб-консоль).  
Healthcheck: `mc ready local`.  
`backend` depends_on minio с `condition: service_healthy`.  
Volume: `minio_data` (персистентный).

---

## Frontend Infrastructure (FEAT-0001)

Базовые утилиты фронтенда: авторизованные HTTP-запросы, WebSocket-подписки, React-контекст аутентификации, TypeScript-типы по контрактам бэкенда.

---

### Авторизованные запросы

**Импорт:**

```ts
import { apiFetch, api } from "@/lib/api";
```

**Низкоуровневый враппер `apiFetch`:**

```ts
const res = await apiFetch("/api/v1/workspaces/me");
if (!res.ok) { /* обработать ошибку */ }
const data = await res.json();
```

`apiFetch(path, options?)` — принимает путь относительно `NEXT_PUBLIC_API_URL` и стандартный `RequestInit`. Возвращает сырой `Response`. Автоматически добавляет заголовок `Authorization: Bearer <accessToken>`.

**Хелперы `api.*` (рекомендуются для большинства случаев):**

```ts
// GET — возвращает типизированный результат
const workspaces = await api.get<Workspace[]>("/api/v1/workspaces/me");

// POST
const task = await api.post<Task>("/api/v1/tasks", { title, column_id });

// PATCH / PUT
await api.patch<Task>(`/api/v1/tasks/${id}`, { priority: "high" });
await api.put<AutomationRule>(`/api/v1/rules/${id}`, rulePayload);

// DELETE (тело 204, ничего не возвращает)
await api.delete(`/api/v1/tasks/${id}`);
```

Хелперы устанавливают `Content-Type: application/json` автоматически. При HTTP-ошибках (4xx, 5xx кроме 401) бросают `ApiError` с полями `message` (из поля `detail` ответа или `"HTTP <status>"`) и `status: number` (HTTP-код).

**Поведение при 401:**

1. `apiFetch` читает `refresh_token` из `sessionStorage`.
2. Делает `POST /api/v1/auth/refresh` и получает новый `access_token`.
3. Повторяет исходный запрос с новым токеном — прозрачно для вызывающего кода.
4. Если повторный refresh тоже вернул ошибку — вызывает `logout()` и бросает `Error("Session expired")`.
5. Защита от гонки: mutex `refreshPromise` гарантирует, что при нескольких параллельных 401 refresh выполняется ровно один раз.

**Где хранятся токены:**

| Токен | Хранилище | Жизненный цикл |
|-------|-----------|----------------|
| `access_token` | Module-level переменная в `api.ts` (JS-память) | До перезагрузки страницы |
| `refresh_token` | `sessionStorage["refresh_token"]` | До закрытия вкладки |
| `user` (сериализованный) | `sessionStorage["user"]` | До закрытия вкладки |

Access token хранится в памяти модуля — недоступен через XSS из других вкладок. При перезагрузке страницы `AuthProvider` восстанавливает сессию через refresh.

---

### WebSocket-подписки

**Импорт:**

```ts
import { WsClient } from "@/lib/ws";
import { getAccessToken } from "@/lib/api";
```

**Создание клиента и подключение:**

```ts
// getAccessToken — геттер из api.ts; при каждом reconnect вызывается заново
// (важно: не передавать строку токена напрямую — при reconnect она устареет)
const ws = new WsClient(workspaceId, getAccessToken);
ws.connect();
```

**Подписка на события:**

```ts
const handler = (params: Record<string, unknown>) => {
  const task = params.task as Task;
  // обновить состояние
};

ws.on("board.task_created", handler);
ws.on("board.task_updated", handler);
ws.on("board.task_moved", handler);
ws.on("board.task_deleted", handler);
ws.on("notification.created", handler);
ws.on("event_log.entry", handler);
```

**Отписка и отключение (в `useEffect` cleanup):**

```ts
ws.off("board.task_created", handler);
ws.disconnect();
```

**Известные JSON-RPC методы и состав `params`:**

| Метод | Состав `params` |
|-------|-----------------|
| `board.task_created` | `{ task: Task }` |
| `board.task_updated` | `{ task: Task }` |
| `board.task_moved` | `{ task: Task, column_id: string, position: number }` |
| `board.task_deleted` | `{ task_id: string }` |
| `notification.created` | `{ id, type, message, created_at }` |
| `event_log.entry` | `{ event_id, event_type, status, detail, ts }` |

Статусы `event_log.entry`: `"received"` / `"deduped"` / `"validated"` / `"enriched"` / `"rule_fired"` / `"broadcast"`

**Reconnect:** автоматический, экспоненциальная задержка 1 с → 2 с → 4 с → ... → 30 с. При успешном `onopen` задержка сбрасывается в 1 с. Исключений при дисконнекте не выбрасывается. Метод `onerror` не инициирует reconnect — он делегирует `onclose`, который браузер вызывает после `onerror`.

---

### AuthProvider и useAuth

**Импорт:**

```ts
import { useAuth } from "@/app/providers";
```

**Получение данных пользователя:**

```tsx
function MyComponent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return null; // редирект обработан AuthProvider

  return <div>Привет, {user!.name}</div>;
}
```

**Логин и логаут:**

```ts
const { login, logout } = useAuth();

// Логин — бросает исключение при неверных credentials
await login(email, password);

// Логаут — синхронный; очищает токены, редиректит на /login
logout();
```

**Восстановление сессии:** при монтировании `AuthProvider` читает `refresh_token` из `sessionStorage` и автоматически восстанавливает сессию. Пока `isLoading === true` — компоненты не должны рендерить защищённый контент.

**Подключение провайдеров в `layout.tsx`:**

```tsx
import Providers from "./providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`Providers` оборачивает приложение в `QueryClientProvider` (снаружи) и `AuthProvider` (внутри). Файл `providers.tsx` помечен `"use client"`, `layout.tsx` остаётся Server Component.

---

### TypeScript-типы

Все типы экспортируются именованно из `frontend/lib/types.ts`.

```ts
import type {
  User,
  Workspace, WorkspaceRole, WorkspaceSettings, WorkspaceMember,
  Task, TaskPriority, DeadlineUrgency,
  Column, Board,
  AutomationRule, RuleCondition, RuleAction, RuleActionType,
  RuleActionParams, RuleTrigger,
  Notification,
  AuditLogEntry, AuditChange, AuditActor,
  JsonRpcMessage,
  GroomSession, GroomQuestion, GroomAnswer, TaskDraft,
} from "@/lib/types";
```

**Ключевые типы:**

| Тип | Описание |
|-----|----------|
| `User` | `{ id, email, name }` — объект текущего пользователя |
| `Task` | Карточка задачи: `id, title, description, column_id, workspace_id, priority, tags, assignee_id, created_at, deadline, deadline_urgency` |
| `Board` | `{ id, columns: Column[] }` — одна доска на воркспейс |
| `Column` | `{ id, name, position, color?, tasks: Task[] }` |
| `Workspace` | `{ id, name, slug, role: WorkspaceRole }` |
| `AutomationRule` | Правило автоматизации с `trigger`, `condition`, `action` |
| `Notification` | In-app уведомление: `{ id, type, message, read, created_at }` |
| `AuditLogEntry` | Запись аудита: `{ id, event_type, actor, task_id, task_title?, changes[], created_at }` |
| `JsonRpcMessage` | `{ jsonrpc: "2.0", method: string, params: Record<string, unknown> }` |
| `TaskDraft` | Драфт задачи от LLM: `{ title, description, priority, tags }` |
| `DeadlineUrgency` | `"none"` / `"soon"` / `"critical"` — вычисляется бэкендом |
| `TaskPriority` | `"low"` / `"medium"` / `"high"` / `"critical"` |

Файл содержит только объявления типов — никакой логики, никаких импортов из других модулей проекта.

---

### Граф зависимостей модулей

```
providers.tsx → api.ts, types.ts
ws.ts         → types.ts
api.ts        → (нет импортов из проекта, только Web API)
types.ts      → (нет импортов)
layout.tsx    → providers.tsx
```

Циклических зависимостей нет. Взаимодействие `api.ts → providers.tsx` реализовано через callback (`registerLogoutCallback`) — `api.ts` не импортирует React.

---

## Backend: WebSocket Hub + Notifications (FEAT-0002)

Real-time уведомления через WebSocket с протоколом JSON-RPC 2.0. REST-endpoints для in-app уведомлений.

---

### Как подключиться к WebSocket

Точка подключения:

```
ws://{host}/ws/{workspace_id}?token={access_token}
```

Токен передаётся в query-параметре (браузерный WebSocket API не поддерживает произвольные заголовки).

Пример из фронтенда (класс `WsClient` уже реализует это):

```ts
const ws = new WsClient(workspaceId, getAccessToken);
ws.connect();
```

**Жизненный цикл соединения на сервере:**

1. Декодируется JWT (`decode_token(token)`) — проверяет подпись, срок действия и claim `type == "access"`. Если невалиден — `accept()` → `close(4001)`.
2. Проверяется членство пользователя в workspace (SELECT из `WorkspaceMember`). Сессия БД открывается и закрывается только на этом шаге. Если не член — `accept()` → `close(4001)`.
3. `manager.connect(workspace_id, websocket)` — принимает соединение и отправляет Greeting.
4. Бесконечный `receive_text()` loop держит соединение открытым. Сервер не ожидает входящих сообщений от клиента.
5. При `WebSocketDisconnect` или любом исключении — `finally: manager.disconnect(...)`.

**Коды закрытия WebSocket:**

| Код | Значение |
|-----|----------|
| `4001` | Токен невалиден, истёк или пользователь не является членом workspace. Не переподключаться — нужно обновить токен. |
| `1000` | Нормальное закрытие. |
| `1006` | Разрыв сети. Переподключаться с exponential backoff. |

---

### Singleton `manager` — использование в consumer

`manager` — единственный singleton уровня модуля. Создаётся при первом импорте `hub.py`. Никакого дополнительного паттерна синглтона не нужно — Python кэширует модули.

```python
from app.notifications.hub import manager
from app.notifications.jsonrpc import build, TASK_MOVED

async def handle_task_moved(event: dict) -> None:
    message = build(TASK_MOVED, {
        "task_id": event["task_id"],
        "from_column_id": event["from_column_id"],
        "to_column_id": event["to_column_id"],
    })
    await manager.broadcast(event["workspace_id"], message)
```

**Поведение `broadcast`:**
- Если в workspace нет подключённых клиентов — ранний возврат, ошибки нет.
- Итерирует по копии списка соединений — защита от race condition при одновременном disconnect.
- Ошибка при отправке одному клиенту: логируется `WARNING`, клиент удаляется из реестра (`disconnect`), рассылка остальным продолжается.
- Сессия БД в `broadcast` не используется — только in-memory словарь.

**Метод `connection_count`:**

```python
count = manager.connection_count(workspace_id)  # int, для тестов и диагностики
```

---

### JSON-RPC методы

Все сообщения от сервера к клиенту — JSON-RPC 2.0 notifications (без поля `id`).

Структура:
```json
{ "jsonrpc": "2.0", "method": "<метод>", "params": { ... } }
```

Константы определены в `app/notifications/jsonrpc.py`. Функция `build(method, params) -> dict` собирает сообщение.

| Константа | Строка метода | Ключевые поля `params` |
|-----------|---------------|------------------------|
| `CONNECTED` | `connection.established` | `workspace_id`, `message` |
| `TASK_CREATED` | `board.task_created` | полный объект задачи: `id, title, description, column_id, workspace_id, priority, tags, assignee_id, created_at, deadline, deadline_urgency` |
| `TASK_UPDATED` | `board.task_updated` | полный объект задачи (те же поля) |
| `TASK_MOVED` | `board.task_moved` | `task_id, from_column_id, to_column_id` |
| `TASK_DELETED` | `board.task_deleted` | `task_id` |
| `NOTIFICATION_CREATED` | `notification.created` | `id, type, message, created_at` |
| `EVENT_LOG_ENTRY` | `event_log.entry` | `event_id, event_type, status, detail, ts` |

Статусы `event_log.entry`: `received` / `deduped` / `validated` / `enriched` / `rule_fired` / `broadcast`.

---

### REST endpoints для уведомлений

Оба endpoint находятся в `rest_router` с тегом `"notifications"` (видно в Swagger UI `/docs`).

#### `GET /api/v1/notifications`

**Заголовок:** `Authorization: Bearer <access_token>`  
**Query:** `workspace_id={uuid}` (обязателен), `unread=true` (опционален)

```http
GET /api/v1/notifications?workspace_id=<uuid>
GET /api/v1/notifications?workspace_id=<uuid>&unread=true
```

Ответ 200: массив объектов `{ id, type, message, read, created_at }`. Пустой массив `[]` — норма, не 404.  
Ответ 401: токен отсутствует или невалиден.

#### `PATCH /api/v1/notifications/{id}/read`

**Заголовок:** `Authorization: Bearer <access_token>`  
**Тело:** пустое.

Ответ 200: `{}`  
Ответ 401: нет авторизации.  
Ответ 404: уведомление не найдено или принадлежит другому пользователю (не различается — информационная утечка).

---

### Auth зависимости (app/auth/deps.py)

| Функция | Назначение |
|---------|-----------|
| `decode_token(token: str) -> UUID` | Декодирует JWT HS256, проверяет `type == "access"`, возвращает `user_id`. Выбрасывает `InvalidToken`. |
| `get_current_user(authorization, session) -> User` | FastAPI Depends для REST. Парсит `Bearer <token>`, декодирует, возвращает User из БД. HTTPException 401 при любой ошибке. |
| `InvalidToken` | Кастомное исключение — JWT невалиден или не является access-токеном. |

**Важно:** `decode_token` используется в WS-endpoint напрямую (не через `Depends`), потому что при ошибке нужно закрыть WS с кодом 4001, а не вернуть HTTP 401. REST-endpoints используют `get_current_user` через `Depends`.

JWT secret читается из переменной окружения `JWT_SECRET` при старте. Алгоритм: `HS256`.

---

### Структура модуля notifications

```
backend/app/
├── auth/
│   └── deps.py          — decode_token, get_current_user, InvalidToken
└── notifications/
    ├── hub.py            — ConnectionManager, manager (singleton)
    ├── jsonrpc.py        — 7 констант методов + build()
    ├── router.py         — WS endpoint, REST endpoints (два отдельных router)
    ├── service.py        — get_notifications, mark_as_read, NotificationNotFound
    ├── schemas.py        — NotificationOut, NotificationListQuery, ReadResponse
    └── models.py         — ORM модель Notification (не трогать)
```

**Два router в main.py:**
- `notifications_router` — WS endpoint `/ws/{workspace_id}`, регистрируется без prefix.
- `notifications_rest_router` — REST endpoints, тег `"notifications"` в OpenAPI.

**Зависимости модуля:**
- `hub.py` используется: consumer (`app.events.consumer`) вызывает `manager.broadcast(...)`.
- `router.py` зависит от: `hub.py`, `jsonrpc.py`, `service.py`, `schemas.py`, `auth/deps.py`.
- `models.py` (`Notification`) создаётся consumer-ом при обработке событий из RabbitMQ.

---

## Frontend: Kanban Board (FEAT-0003)

Главный экран продукта — канбан-доска с drag-drop, оптимистичными обновлениями и real-time синхронизацией через WebSocket.

### ApiError

`lib/api.ts` экспортирует `ApiError extends Error` с полем `readonly status: number`. Все хелперы `api.*` бросают `ApiError` при HTTP-ошибках.

```ts
import { api, ApiError } from "@/lib/api";

try {
  await api.post("/api/v1/tasks", payload);
} catch (e) {
  if (e instanceof ApiError && e.status === 409) {
    // специфичная ошибка
  }
}
```

Никогда не детектировать HTTP-статус через `message.includes("409")` — только через `instanceof ApiError` и `.status`.

### boardUtils.ts — иммутабельные мутаторы Board state

```ts
import { moveTaskInBoard, addTaskToColumn, replaceTask, deleteTask } from "@/lib/boardUtils";
```

Все функции принимают `board: Board` и возвращают новый `Board`. Без side-effects. Единственное место для логики изменения board state. При добавлении новых операций над Board — расширять этот модуль, не дублировать инлайново.

### Оптимистичный update + rollback

```ts
// 1. Snapshot захватывается внутри functional updater
let snapshot: Board | null = null;
setBoard((prev) => {
  if (!prev) return prev;
  snapshot = structuredClone(prev);
  return moveTaskInBoard(prev, taskId, targetColumnId, newPosition);
});

// 2. API-запрос в фоне
api.put(...).catch(() => {
  if (snapshot) setBoard(snapshot);
  showToast("Не удалось переместить задачу");
});
```

Snapshot обязательно внутри updater-функции — защита от stale closure при параллельных WS-событиях.

### WS-обработчики в page.tsx

```ts
// Стабильные ссылки — обязательны для корректного ws.off() в cleanup
const handleTaskCreated = useCallback((params: Record<string, unknown>) => {
  const task = params["task"] as Task;
  setBoard((prev) => {        // functional updater — не stale closure
    if (!prev) return prev;
    if (prev.columns.find(c => c.id === task.column_id)?.tasks.some(t => t.id === task.id)) return prev; // идемпотентность
    return addTaskToColumn(prev, task);
  });
}, []); // пустой dep-массив = стабильная ссылка
```

Cleanup в `useEffect`:

```ts
return () => {
  ws.off("board.task_created", handleTaskCreated);
  ws.disconnect();
};
```

### Компонентная структура

```
app/(app)/board/page.tsx       — владелец Board state, WS-подписки, onTaskMove/onTaskCreate
  KanbanBoard.tsx              — DndContext, DragOverlay, горизонтальный layout колонок
    Column.tsx                 — useDroppable, SortableContext, AddTaskForm, isAddingTask state
      TaskCard.tsx             — display-only (title, priority, deadline, assignee)
      AddTaskForm.tsx          — контролируемый input title, локальный submitting/error state
  BoardSkeleton.tsx            — статичный animate-pulse, нет props
  ErrorBanner.tsx              — message + опциональный onRetry
  PriorityBadge.tsx            — TaskPriority → цветной бейдж
  DeadlineChip.tsx             — deadline + DeadlineUrgency → форматированная дата с цветом
```

`page.tsx` — единственный источник правды для `board: Board | null`. Все мутации — только через колбэки, передаваемые вниз как props.

### DnD (@dnd-kit/core + @dnd-kit/sortable)

- `DndContext` в `KanbanBoard`, `PointerSensor` с `activationConstraint: { distance: 8 }` — предотвращает случайный drag при клике, работает для mouse и touch
- `useDroppable({ id: column.id })` в `Column` — droppable-зона
- `useSortable({ id: task.id })` во внутреннем `SortableTaskCard`-враппере в `Column`
- `DragOverlay` рендерит клон карточки (передаёт `isDragging={false}` чтобы клон не был полупрозрачным)
- В `onDragEnd`: если `over.id` — это `task.id`, ищем колонку задачи; если `column.id` — вставляем в конец

---

## Frontend: App Layout + EventLogPanel (FEAT-0003 / T-014)

Авторизованные страницы оборачиваются в общий layout с sidebar-навигацией и панелью реального времени EventLogPanel. WsClient управляется через React Context, а не создаётся на уровне страницы.

---

### WsContext — провайдер WebSocket-соединения

**Файл:** `frontend/contexts/WsContext.tsx`

```ts
import { useWs } from "@/contexts/WsContext";

function MyComponent() {
  const { init, on, off, workspaceId } = useWs();
}
```

**Интерфейс контекста:**

```ts
interface WsContextValue {
  // Инициализирует WS-соединение. Идемпотентен: повторный вызов с тем же
  // workspaceId — no-op. Повторный вызов с другим workspaceId — disconnect + reconnect.
  init: (workspaceId: string) => void;

  // Подписка на JSON-RPC метод. Безопасно вызывать до init().
  on: (method: string, handler: WsHandler) => void;

  // Отписка. Безопасно вызывать если handler не зарегистрирован.
  off: (method: string, handler: WsHandler) => void;

  // Текущий workspaceId (null — соединение не инициализировано).
  // Реактивен: изменение вызывает ре-рендер потребителей.
  workspaceId: string | null;
}

type WsHandler = (params: Record<string, unknown>) => void;
```

**Как работает провайдер `WsProvider`:**

- Держит `WsClient | null` в `useRef`.
- `workspaceId` — `useState<string | null>(null)`: реактивен, обновляется при каждом `init()`.
- `value`-объект стабилизирован через `useMemo([init, on, off, workspaceId])` — потребители не ре-рендерятся без причины.
- При `init(wsId)` с существующим клиентом с тем же `wsId` — no-op.
- При `init(wsId)` с другим `wsId` — старый клиент дисконнектится, создаётся и подключается новый.

**Ключевой инвариант `on()`:** `on()` всегда пишет хэндлер в `pendingHandlers` (Map<string, Set<WsHandler>>) — единственный источник истины. Если `WsClient` уже создан, хэндлер немедленно проксируется в него. При следующем `init()` все `pendingHandlers` переносятся в новый `WsClient` — хэндлеры не теряются при смене workspace. `init()` никогда не делает `pendingHandlers.clear()`.

**`useWs()` — fail-fast:** если компонент вызывает `useWs()` вне `WsProvider`, бросается `Error("useWs must be used within WsProvider")`. Не `return undefined`, не `return null`.

**Lifecycle:** `WsProvider` размонтируется только при логауте. `disconnect()` вызывается только в cleanup `useEffect` провайдера — страницы не должны вызывать `disconnect()`.

**Кто инициализирует соединение:** только `BoardPage` — она единственная знает `workspaceId` из `useSearchParams()`. Layout и `EventLogPanel` не знают `workspaceId` напрямую.

---

### App Layout (`(app)/layout.tsx`)

**Файл:** `frontend/app/(app)/layout.tsx`

Обёртывает все авторизованные страницы. Структура:

```
WsProvider
  └── div.flex.h-screen.overflow-hidden
        ├── Sidebar          (w-56, bg-gray-900, flex-shrink-0)
        ├── main.flex-1.overflow-y-auto
        │     └── {children}   ← Board / Admin / AI Groom
        └── EventLogPanel    (w-[300px], bg-gray-900, flex-shrink-0)
```

`Sidebar` и `EventLogPanel` монтируются один раз и **не размонтируются** при навигации между страницами — App Router сохраняет layout-компоненты. Список событий в `EventLogPanel` сохраняется при переходе `Board → Admin → AI Groom`.

---

### Sidebar

**Файл:** `frontend/components/sidebar/Sidebar.tsx`

Отображает название workspace (заглушка или из sessionStorage) и три пункта навигации. Активный пункт определяется через `usePathname()`.

| Пункт | Путь |
|-------|------|
| Board | `/board` |
| Admin | `/admin` |
| AI Groom | `/ai-groom` |

**Состояния NavItem:**
- Обычный: `text-gray-400 hover:bg-gray-800 hover:text-white`
- Активный: `bg-gray-800 text-white`

`Sidebar` не использует `WsContext`.

---

### EventLogPanel

**Файл:** `frontend/components/event-log/EventLogPanel.tsx`

Отображает поток событий event pipeline в реальном времени. Подписывается на WS через `useWs()`.

**Подписка:**

```ts
const { on, off } = useWs();

const handler = useCallback((params: Record<string, unknown>) => {
  const entry = parseEventLogEntry(params); // fail-fast
  setEntries((prev) => {
    const next = [...prev, entry];
    return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
  });
}, []);

useEffect(() => {
  on("event_log.entry", handler);
  return () => off("event_log.entry", handler);
}, [on, off, handler]);
```

**FIFO-50:** максимум 50 записей. При превышении — удаляется самая старая (slice с начала). Логика внутри `setState`-колбэка — гарантия консистентности при React 18 batched updates.

**Автоскролл:** отдельный `useEffect([entries])`. Прокрутка срабатывает только если пользователь находится внизу (`scrollTop + clientHeight >= scrollHeight - 40px`). Если пользователь прокрутил вверх — автоскролл не прерывает чтение.

**Кнопка «Очистить»:** сбрасывает `entries` в `[]`. Всегда активна (нет disabled-состояния).

**Пустой список:** отображает `«Нет событий»` по центру панели.

**Цвета статусов (текст статуса в `LogEntry`):**

| Статус | Tailwind |
|--------|----------|
| `received` | `text-gray-400` |
| `deduped` | `text-yellow-400` |
| `enriched` | `text-blue-400` |
| `broadcast` | `text-green-400` |
| неизвестный | `text-gray-500` |

**Формат строки:** `[HH:MM:SS] event_type → status` (monospace, `text-xs`).

**Адаптивность:** `hidden min-[900px]:flex` — скрывается при viewport < 900px.

---

### Парсеры WS-payload (`lib/types.ts`)

Все парсеры используют паттерн fail-fast: бросают `Error` при невалидном payload. Ошибка перехватывается в `WsClient.dispatch`, не крашит UI, следующие события продолжают обрабатываться.

**`parseEventLogEntry(params)`** — парсит payload метода `event_log.entry`:

```ts
import { parseEventLogEntry, EventLogEntry } from "@/lib/types";

// Бросает Error если любое поле не является string
const entry: EventLogEntry = parseEventLogEntry(params);
```

Поля `EventLogEntry`: `event_id`, `event_type`, `status` (`EventLogStatus | string`), `detail`, `ts` (ISO 8601).

**`parseBoardTask(params)`** — парсит `{ task: Task }` из board.* событий. Проверяет обязательные поля объекта task (`id`, `title` и др.). Бросает `Error` при невалидном payload.

**`parseMoveParams(params)`** — парсит `{ task: Task, column_id: string, position: number }` из `board.task_moved`. Бросает `Error` при невалидном payload.

**Правило:** никаких `as`-кастов в WS-обработчиках. Все `Record<string, unknown>` payload проходят через соответствующий парсер.
