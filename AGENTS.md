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
| `RABBITMQ_URL` | consumer (не реализован) | `amqp://guest:guest@rabbitmq:5672/` |

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

Хелперы устанавливают `Content-Type: application/json` автоматически. При HTTP-ошибках (4xx, 5xx кроме 401) бросают `Error` с текстом из поля `detail` ответа или `"HTTP <status>"`.

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
| `board.task_moved` | `{ task_id: string, from_column_id: string, to_column_id: string }` |
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
