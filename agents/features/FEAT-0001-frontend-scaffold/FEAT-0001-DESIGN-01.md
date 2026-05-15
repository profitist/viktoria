# FEAT-0001-DESIGN-01: Дизайн инфраструктурных модулей фронтенда

**Статус:** готово к реализации  
**Область:** `frontend/lib/types.ts`, `frontend/lib/api.ts`, `frontend/lib/ws.ts`, `frontend/app/providers.tsx`

---

## 1. `frontend/lib/types.ts` — TypeScript-интерфейсы

Все интерфейсы экспортируются именованно. Файл содержит только типы — никакой логики, никаких импортов из других модулей проекта.

---

### `User`
Объект пользователя, возвращаемый при логине/регистрации и хранимый в AuthContext.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор пользователя |
| `email` | `string` | Email пользователя |
| `name` | `string` | Отображаемое имя |

---

### `WorkspaceRole`
Перечисление ролей участника воркспейса.

Значения: `"owner"` / `"admin"` / `"member"`

---

### `Workspace`
Воркспейс — основная организационная единица. Один воркспейс = одна доска.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор |
| `name` | `string` | Название воркспейса |
| `slug` | `string` | URL-slug |
| `role` | `WorkspaceRole` | Роль текущего пользователя в этом воркспейсе |

---

### `WorkspaceSettings`
Настройки воркспейса, доступные через PATCH /workspaces/{id}/settings.

| Поле | Тип | Описание |
|------|-----|----------|
| `automation_enabled` | `boolean` | Включён ли движок автоматизации |

---

### `WorkspaceMember`
Участник воркспейса с полными данными (для списка членов).

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | `string` (uuid) | ID пользователя |
| `email` | `string` | Email |
| `name` | `string` | Имя |
| `role` | `WorkspaceRole` | Роль |
| `joined_at` | `string` (iso8601) | Дата вступления |

---

### `TaskPriority`
Перечисление приоритетов задачи.

Значения: `"low"` / `"medium"` / `"high"` / `"critical"`

---

### `DeadlineUrgency`
Перечисление срочности дедлайна. Вычисляется бэкендом при каждом чтении задачи.

| Значение | Условие |
|----------|---------|
| `"none"` | Дедлайн > 72 часов или отсутствует |
| `"soon"` | Дедлайн через 24–72 часа |
| `"critical"` | Дедлайн < 24 часов или просрочен |

---

### `Task`
Карточка задачи. Основной объект доски.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор |
| `title` | `string` | Заголовок задачи |
| `description` | `string` | Описание задачи |
| `column_id` | `string` (uuid) | ID колонки, в которой находится задача |
| `workspace_id` | `string` (uuid) | ID воркспейса |
| `priority` | `TaskPriority` | Приоритет |
| `tags` | `string[]` | Список тегов |
| `assignee_id` | `string \| null` (uuid) | ID исполнителя, null если не назначен |
| `created_at` | `string` (iso8601) | Дата создания |
| `deadline` | `string \| null` (iso8601) | Дедлайн, null если не задан |
| `deadline_urgency` | `DeadlineUrgency` | Срочность дедлайна (вычислено бэкендом) |

---

### `Column`
Колонка канбан-доски. Содержит упорядоченный список задач.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор |
| `name` | `string` | Название колонки |
| `position` | `number` | Порядковый номер (0-based) для сортировки |
| `color` | `string \| undefined` | HEX-цвет заголовка, опционально |
| `tasks` | `Task[]` | Список задач в этой колонке |

---

### `Board`
Доска воркспейса. Один воркспейс = одна доска.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор |
| `columns` | `Column[]` | Список колонок, отсортированных по `position` |

---

### `RuleCondition`
Условие срабатывания правила автоматизации. Может быть null (правило без условия — всегда срабатывает).

| Поле | Тип | Описание |
|------|-----|----------|
| `field` | `string` | Поле задачи или события, по которому проверяется условие |
| `operator` | `"eq" \| "contains" \| "gt" \| "lt"` | Оператор сравнения |
| `value` | `unknown` | Значение для сравнения (тип зависит от поля) |

---

### `RuleActionType`
Перечисление типов действий правила автоматизации.

Значения: `"move_to_column"` / `"add_tag"` / `"notify_members"`

---

### `RuleActionParams`
Параметры действия, состав зависит от `RuleActionType`.

| Поле | Тип | Описание |
|------|-----|----------|
| `column_id` | `string \| undefined` (uuid) | Целевая колонка для `move_to_column` |
| `tag` | `string \| undefined` | Тег для `add_tag` |
| `message` | `string \| undefined` | Сообщение для `notify_members` |

---

### `RuleAction`
Действие правила автоматизации.

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | `RuleActionType` | Тип действия |
| `params` | `RuleActionParams` | Параметры действия |

---

### `RuleTrigger`
Перечисление событий, которые запускают правило.

Значения: `"task.created"` / `"task.moved"` / `"task.updated"` / `"deadline.approaching"`

---

### `AutomationRule`
Правило автоматизации воркспейса.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор |
| `workspace_id` | `string` (uuid) | ID воркспейса |
| `name` | `string` | Название правила |
| `active` | `boolean` | Включено ли правило |
| `trigger` | `RuleTrigger` | Триггерное событие |
| `condition` | `RuleCondition \| null` | Условие (null = правило всегда срабатывает) |
| `action` | `RuleAction` | Действие при срабатывании |

---

### `Notification`
In-app уведомление пользователя.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор |
| `type` | `string` | Тип уведомления (произвольная строка, например `"task_assigned"`) |
| `message` | `string` | Текст уведомления для отображения |
| `read` | `boolean` | Прочитано ли уведомление |
| `created_at` | `string` (iso8601) | Дата создания |

---

### `AuditChange`
Одно изменённое поле в записи аудита.

| Поле | Тип | Описание |
|------|-----|----------|
| `field` | `string` | Название изменённого поля задачи |
| `old` | `unknown` | Значение до изменения |
| `new` | `unknown` | Значение после изменения |

---

### `AuditActor`
Сокращённое представление пользователя для записей аудита.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | ID пользователя |
| `name` | `string` | Имя пользователя |

---

### `AuditLogEntry`
Запись в истории изменений задачи или воркспейса.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` (uuid) | Уникальный идентификатор записи |
| `event_type` | `string` | Тип события (`task.created`, `task.moved`, и др.) |
| `actor` | `AuditActor` | Кто совершил действие |
| `task_id` | `string` (uuid) | ID задачи |
| `task_title` | `string \| undefined` | Название задачи (присутствует в workspace-level логе) |
| `changes` | `AuditChange[]` | Список изменений (пустой для `task.created`/`task.deleted`) |
| `created_at` | `string` (iso8601) | Когда произошло событие |

---

### `JsonRpcMessage`
Формат JSON-RPC 2.0 сообщения (server → client, только notifications — без поля `id`).

| Поле | Тип | Описание |
|------|-----|----------|
| `jsonrpc` | `"2.0"` | Версия протокола, всегда `"2.0"` |
| `method` | `string` | Имя метода (`board.task_moved`, `notification.created`, и др.) |
| `params` | `Record<string, unknown>` | Параметры события, состав зависит от метода |

Известные методы и состав `params`:

| Метод | Состав `params` |
|-------|-----------------|
| `board.task_created` | `{ task: Task }` |
| `board.task_updated` | `{ task: Task }` |
| `board.task_moved` | `{ task_id: string, from_column_id: string, to_column_id: string }` |
| `board.task_deleted` | `{ task_id: string }` |
| `notification.created` | `{ id, type, message, created_at }` |
| `event_log.entry` | `{ event_id, event_type, status, detail, ts }` |

Статусы `event_log.entry`: `"received"` / `"deduped"` / `"validated"` / `"enriched"` / `"rule_fired"` / `"broadcast"`

---

### `GroomQuestion`
Уточняющий вопрос LLM в процессе груминга задачи.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | Идентификатор вопроса внутри сессии |
| `text` | `string` | Текст вопроса |

---

### `GroomAnswer`
Ответ пользователя на уточняющий вопрос.

| Поле | Тип | Описание |
|------|-----|----------|
| `question_id` | `string` | ID вопроса, на который дан ответ |
| `answer` | `string` | Текст ответа |

---

### `GroomSession`
Сессия AI-груминга задачи. Создаётся на шаге `/groom/start`, используется в `/groom/complete`.

| Поле | Тип | Описание |
|------|-----|----------|
| `session_id` | `string` (uuid) | Идентификатор сессии (передаётся в /groom/complete) |
| `questions` | `GroomQuestion[]` | Уточняющие вопросы от LLM |

---

### `TaskDraft`
Драфт задачи, сгенерированный LLM после ответов на вопросы груминга.

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | `string` | Предложенный заголовок |
| `description` | `string` | Предложенное описание |
| `priority` | `TaskPriority` | Предложенный приоритет |
| `tags` | `string[]` | Предложенные теги |

---

## 2. `frontend/lib/api.ts` — HTTP-клиент

Модуль предоставляет авторизованный доступ к API с автоматическим refresh токенов. Не имеет зависимостей на React и не импортирует из `providers.tsx`. Взаимодействие с AuthProvider происходит через callback, который регистрируется при монтировании AuthProvider.

---

### Модульные переменные (module-level state)

Хранятся в замыкании модуля, недоступны снаружи:

| Переменная | Описание |
|-----------|----------|
| `accessToken: string \| null` | JWT access token в JS-памяти (не в DOM, не в storage) |
| `onLogout: (() => void) \| null` | Callback, вызываемый при повторном 401 — зарегистрирован AuthProvider |

---

### `setAccessToken(token: string | null) → void`
Сеттер для access token из AuthProvider после логина / рефреша.

Принимает: новый токен или null (при логауте).  
Сохраняет в module-level переменную.

---

### `registerLogoutCallback(cb: () => void) → void`
Регистрирует callback, который `apiFetch` вызывает при двойном 401 (рефреш тоже провалился).  
AuthProvider вызывает этот метод при монтировании, передавая свою функцию `logout()`.

---

### `apiFetch(path: string, options?: RequestInit) → Promise<Response>`

Основной fetch-враппер. Все запросы к API проходят только через него.

**Принимает:**
- `path` — путь относительно `NEXT_PUBLIC_API_URL` (например, `"/api/v1/tasks"`)
- `options` — стандартный `RequestInit` (метод, тело, дополнительные заголовки и т.д.)

**Поведение:**
1. Добавляет заголовок `Authorization: Bearer {accessToken}` если токен есть
2. Выполняет запрос
3. Если ответ — не 401: возвращает `Response` как есть (вызывающий код сам вызывает `.json()`)
4. Если ответ 401 (первый раз):
   - Читает `refresh_token` из `sessionStorage`
   - Если токен есть — делает `POST /api/v1/auth/refresh`
   - Если refresh успешен — сохраняет новый access_token через `setAccessToken`, повторяет исходный запрос
   - Если refresh вернул 401 или sessionStorage пустой — вызывает `onLogout()`, бросает ошибку

**Возвращает:** `Promise<Response>` — сырой объект ответа.  
**Не выбрасывает** исключения при HTTP-ошибках кроме случая двойного 401.

---

### Хелперы `api.*`

Тонкие обёртки над `apiFetch`, разбирающие JSON и возвращающие типизированный результат. Принимают generic-параметр `T` для типа данных ответа.

| Хелпер | Сигнатура | Описание |
|--------|-----------|----------|
| `api.get` | `<T>(path: string) → Promise<T>` | GET-запрос, возвращает распарсенный JSON |
| `api.post` | `<T>(path: string, body: unknown) → Promise<T>` | POST с JSON-телом |
| `api.patch` | `<T>(path: string, body: unknown) → Promise<T>` | PATCH с JSON-телом |
| `api.put` | `<T>(path: string, body: unknown) → Promise<T>` | PUT с JSON-телом |
| `api.delete` | `(path: string) → Promise<void>` | DELETE, ничего не возвращает (204) |

Все хелперы устанавливают `Content-Type: application/json` для методов с телом.  
При HTTP-ошибках (4xx, 5xx, кроме 401 который обрабатывает `apiFetch`) выбрасывают `Error` с текстом из `response.json().detail` или со статус-кодом.

---

### Управление refresh_token

`refresh_token` хранится в `sessionStorage` под ключом `"refresh_token"`.  
Запись в sessionStorage: AuthProvider вызывает `sessionStorage.setItem` напрямую после логина.  
Чтение: только `apiFetch` при обработке 401.  
Очистка: `apiFetch` при двойном 401, а также AuthProvider при явном logout.

---

## 3. `frontend/lib/ws.ts` — WebSocket-клиент

Модуль экспортирует единственный класс `WsClient`. Не имеет зависимостей на React. Поверх WebSocket реализует JSON-RPC 2.0 диспатчер и авторесоединение с экспоненциальной задержкой.

---

### Конструктор `WsClient`

Принимает:
- `workspaceId: string` — ID воркспейса, используется для формирования URL
- `getToken: () => string | null` — функция-геттер access token (не сам токен, а ссылка на геттер, чтобы при переподключении использовался актуальный токен)

Конструктор только сохраняет параметры. Соединение не устанавливается в конструкторе — только после явного вызова `connect()`.

---

### Внутренние поля

| Поле | Тип | Описание |
|------|-----|----------|
| `socket` | `WebSocket \| null` | Текущий WS-объект |
| `handlers` | `Map<string, Set<Function>>` | Подписчики по имени метода |
| `retryDelay` | `number` | Текущая задержка до следующего reconnect (мс) |
| `shouldReconnect` | `boolean` | Флаг: разрешено ли переподключение (false после disconnect()) |
| `retryTimer` | `ReturnType<typeof setTimeout> \| null` | Таймер ожидания reconnect |

---

### `connect() → void`

Устанавливает WebSocket-соединение.

**URL:** `{NEXT_PUBLIC_WS_URL}/ws/{workspaceId}?token={getToken()}`

**При успешном открытии (`onopen`):**
- Сбрасывает `retryDelay` до 1000 мс

**При получении сообщения (`onmessage`):**
- Парсит JSON
- Если это валидный `JsonRpcMessage` (есть `jsonrpc: "2.0"`, `method`) — вызывает `dispatch(message)`
- Невалидный JSON или неизвестный формат — тихо игнорируется, не выбрасывается исключение

**При закрытии (`onclose`) и при ошибке (`onerror`):**
- Если `shouldReconnect === true` — планирует reconnect через `retryDelay`
- Не выбрасывает исключений

---

### `disconnect() → void`

Устанавливает `shouldReconnect = false`, отменяет таймер reconnect, закрывает `socket`.  
После вызова объект можно безопасно выбросить.

---

### `on(method: string, handler: (params: Record<string, unknown>) => void) → void`

Регистрирует обработчик для JSON-RPC метода.  
Один и тот же метод может иметь несколько обработчиков (хранятся в `Set`).

---

### `off(method: string, handler: (params: Record<string, unknown>) => void) → void`

Снимает ранее зарегистрированный обработчик.  
Если обработчиков для метода не осталось — удаляет запись из Map.

---

### `dispatch(message: JsonRpcMessage) → void` (приватный)

Внутренний метод диспатча.  
Находит в `handlers` Set по `message.method`.  
Если подписчиков нет — тихо игнорирует (не падает, не логирует).  
Вызывает каждый handler с `message.params`.

---

### Логика reconnect (экспоненциальная задержка)

| Попытка | Задержка перед подключением |
|---------|----------------------------|
| 1 | 1 с |
| 2 | 2 с |
| 3 | 4 с |
| 4+ | 8 с, 16 с, ... но не более 30 с |

Алгоритм: после каждой неудачи `retryDelay = Math.min(retryDelay * 2, 30000)`.  
При успешном `onopen`: `retryDelay = 1000` (сброс).  
При переподключении используется актуальный токен через `getToken()` — важно при обновлении access token.

---

## 4. `frontend/app/providers.tsx` — React Providers

Файл экспортирует два элемента: `AuthContext` и `Providers` (корневой компонент-обёртка).

---

### `AuthContext` — поля

Контекст доступен любому компоненту через хук `useAuth()`.

| Поле | Тип | Описание |
|------|-----|----------|
| `user` | `User \| null` | Объект текущего пользователя; null если не авторизован или isLoading |
| `isLoading` | `boolean` | true пока AuthProvider выполняет начальный refresh при монтировании |
| `isAuthenticated` | `boolean` | Вычисляемое: `!isLoading && user !== null` |
| `login` | `(email: string, password: string) → Promise<void>` | Метод логина |
| `logout` | `() → void` | Метод выхода |
| `refresh` | `() → Promise<void>` | Метод обновления access token |

---

### `login(email, password) → Promise<void>`

1. Вызывает `POST /api/v1/auth/login` через `api.post`
2. Из ответа `{ access_token, refresh_token, user }`:
   - Вызывает `setAccessToken(access_token)` из `api.ts`
   - Записывает `refresh_token` в `sessionStorage["refresh_token"]`
   - Устанавливает `user` в React state
3. При ошибке (401 от бэкенда) — выбрасывает исключение, которое форма логина обрабатывает сама

---

### `logout() → void`

1. Пытается вызвать `POST /api/v1/auth/logout` (fire-and-forget, ошибку игнорирует)
2. Вызывает `setAccessToken(null)` из `api.ts`
3. Удаляет `sessionStorage["refresh_token"]`
4. Устанавливает `user = null` в React state
5. Перенаправляет на `/login` через Next.js router

Этот метод также регистрируется в `api.ts` через `registerLogoutCallback(logout)` при монтировании AuthProvider.

---

### `refresh() → Promise<void>`

1. Читает `refresh_token` из `sessionStorage`
2. Если пустой — вызывает `logout()`, возвращает
3. Вызывает `POST /api/v1/auth/refresh` с телом `{ refresh_token }`
4. Из ответа `{ access_token }` — вызывает `setAccessToken(access_token)`
5. При 401 — вызывает `logout()`

---

### Жизненный цикл AuthProvider при монтировании

При первом рендере (`useEffect` на монтирование):
1. Устанавливает `isLoading = true`
2. Регистрирует `logout` в `api.ts` через `registerLogoutCallback(logout)`
3. Читает `refresh_token` из `sessionStorage`
4. Если токен есть — вызывает `refresh()` для восстановления сессии
5. Если sessionStorage пустой — `user = null` (неавторизован)
6. В любом случае устанавливает `isLoading = false`

Таким образом при перезагрузке страницы сессия восстанавливается автоматически без показа формы логина.

---

### Компонент `Providers`

Корневой wrapper, используемый в `frontend/app/layout.tsx`.

**Оборачивает в порядке вложенности:**
1. `QueryClientProvider` (из `@tanstack/react-query`) — снаружи, чтобы react-query hooks были доступны внутри AuthProvider если потребуется
2. `AuthProvider` — внутри, чтобы компоненты имели доступ к контексту аутентификации

```
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    {children}
  </AuthProvider>
</QueryClientProvider>
```

`queryClient` создаётся один раз вне компонента (модульная переменная) чтобы избежать пересоздания при рендере.

---

## 5. Взаимодействия между модулями

### Граф зависимостей

```
providers.tsx
  → api.ts (setAccessToken, registerLogoutCallback, api.post)
  → types.ts (User)

api.ts
  → types.ts (нет прямого импорта, generic T)
  (sessionStorage — напрямую, Web API)

ws.ts
  → types.ts (JsonRpcMessage)
  (нет зависимости от api.ts или providers.tsx)

types.ts
  → нет импортов
```

Циклических зависимостей нет. `ws.ts` полностью независим от `api.ts` — токен передаётся через `getToken` callback в конструкторе.

---

### Поток: логин пользователя

```
LoginForm
  → AuthContext.login(email, password)
    → api.post("/api/v1/auth/login", {email, password})
      → apiFetch (без токена, первый запрос)
      ← {access_token, refresh_token, user}
    → setAccessToken(access_token)          // api.ts module var
    → sessionStorage.setItem(refresh_token) // browser API
    → setState({user})                       // React state
  ← Promise resolves
LoginForm → redirect to /board
```

---

### Поток: авторизованный запрос с протухшим токеном

```
Component
  → api.get("/api/v1/workspaces/me")
    → apiFetch("/api/v1/workspaces/me")
      → fetch с заголовком Authorization: Bearer {expired_token}
      ← 401
    → refresh_token из sessionStorage
    → POST /api/v1/auth/refresh
      ← {access_token: new_token}
    → setAccessToken(new_token)
    → повторный fetch с новым токеном
    ← 200, данные
  ← Promise<Workspace[]>
```

---

### Поток: перезагрузка страницы

```
Browser reload
  → AuthProvider mounts
  → isLoading = true
  → registerLogoutCallback(logout)
  → sessionStorage.getItem("refresh_token") → token
  → refresh()
    → POST /api/v1/auth/refresh
    ← {access_token}
    → setAccessToken(access_token)
    → GET /api/v1/auth/me (опционально, чтобы получить User объект)
    ← {user}
    → setState({user})
  → isLoading = false
Router: страница доступна, пользователь авторизован
```

> Примечание: чтобы получить объект `User` после refresh (бэкенд возвращает только `access_token`), потребуется либо хранить user в sessionStorage рядом с refresh_token, либо вызвать дополнительный GET-эндпоинт `/api/v1/auth/me`. Выбор остаётся за разработчиком при реализации; рекомендуется хранить сериализованный User в sessionStorage для минимизации запросов.

---

### Поток: WS-подписка

```
BoardPage mounts
  → new WsClient(workspaceId, () => getAccessToken())
     // getAccessToken — публичная функция из api.ts, читает module var
  → ws.connect()
  → ws.on("board.task_moved", handler)
  → ws.on("board.task_created", handler)

WS message arrives
  → WsClient.onmessage
  → JSON.parse
  → dispatch(message)
  → handler(params) вызывается
  → React state обновляется (через QueryClient.invalidateQueries или setState)

BoardPage unmounts
  → ws.off(...)
  → ws.disconnect()
```

---

## 6. Экспортируемый публичный API каждого модуля

### `types.ts`
Именованные экспорты всех интерфейсов и type aliases:
`User`, `WorkspaceRole`, `Workspace`, `WorkspaceSettings`, `WorkspaceMember`, `TaskPriority`, `DeadlineUrgency`, `Task`, `Column`, `Board`, `RuleCondition`, `RuleActionType`, `RuleActionParams`, `RuleAction`, `RuleTrigger`, `AutomationRule`, `Notification`, `AuditChange`, `AuditActor`, `AuditLogEntry`, `JsonRpcMessage`, `GroomQuestion`, `GroomAnswer`, `GroomSession`, `TaskDraft`

### `api.ts`
Именованные экспорты: `apiFetch`, `api`, `setAccessToken`, `getAccessToken`, `registerLogoutCallback`

### `ws.ts`
Именованный экспорт: `WsClient`

### `providers.tsx`
Именованные экспорты: `Providers` (default export), `AuthContext`, `useAuth`
