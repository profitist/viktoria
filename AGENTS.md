# Victory Kanban — Developer Reference

Справочник для разработчиков по инфраструктуре проекта.

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
