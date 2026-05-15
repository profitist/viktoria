# FEAT-0001-PLAN-01: Технический план реализации базовых утилит фронтенда

**Статус:** готово к реализации  
**На основе:** README.md + DESIGN-01.md + PROJECT.md  
**Исполнитель:** dev-агент  

---

## 0. Контекст: что сейчас в репозитории

| Файл | Текущее состояние |
|------|-------------------|
| `frontend/lib/api.ts` | Заглушка: `apiRequest(endpoint, token?)` — без refresh, без авторизации |
| `frontend/app/lib/api.ts` | Дубликат заглушки — удалить |
| `frontend/app/layout.tsx` | Использует `@clerk/nextjs` — ClerkProvider + SignInButton + SignUpButton + UserButton |
| `frontend/lib/ws.ts` | Не существует |
| `frontend/lib/types.ts` | Не существует |
| `frontend/app/providers.tsx` | Не существует |
| `frontend/package.json` | Содержит `@clerk/nextjs ^7.3.4`, нет `@tanstack/react-query` |

---

## 1. Порядок реализации

Порядок определяется направлением зависимостей: от модулей без зависимостей к модулям с зависимостями.

```
Шаг 1: frontend/lib/types.ts          — нет зависимостей, только TypeScript примитивы
Шаг 2: frontend/lib/api.ts            — зависит только от Web API (fetch, sessionStorage)
Шаг 3: frontend/lib/ws.ts             — зависит от types.ts (JsonRpcMessage)
Шаг 4: frontend/app/providers.tsx     — зависит от api.ts и types.ts (User)
Шаг 5: frontend/app/layout.tsx        — зависит от providers.tsx (Providers компонент)
Шаг 6: frontend/package.json          — обновление зависимостей (можно сделать до шага 4)
Шаг 7: frontend/app/lib/api.ts        — удалить файл
```

**Почему именно такой порядок:**  
- `types.ts` не импортирует ничего из проекта — создаётся первым, сразу доступен для всех остальных.  
- `api.ts` не импортирует React, не зависит от `providers.tsx` — создаётся вторым; его публичные функции нужны в `providers.tsx`.  
- `ws.ts` зависит только от `types.ts` (тип `JsonRpcMessage`) — создаётся третьим.  
- `providers.tsx` зависит от `api.ts` и `types.ts`, требует `@tanstack/react-query` в node_modules — поэтому `package.json` нужно обновить до или сразу при создании `providers.tsx`.  
- `layout.tsx` обновляется последним — он только заменяет импорты и добавляет `<Providers>`.

---

## 2. `frontend/lib/types.ts`

### Назначение
Единый источник истины по TypeScript-типам. Файл содержит только объявления типов — никакой логики, никаких `import` из других модулей проекта, никаких side effects.

### Структура файла

**Раздел 1 — Пользователи и аутентификация**

`User` — объект пользователя, возвращаемый при логине/регистрации и хранимый в AuthContext.  
Поля: `id: string`, `email: string`, `name: string`.

**Раздел 2 — Воркспейсы**

`WorkspaceRole` — union type: `"owner" | "admin" | "member"`.

`Workspace` — воркспейс пользователя.  
Поля: `id: string`, `name: string`, `slug: string`, `role: WorkspaceRole`.

`WorkspaceSettings` — настройки воркспейса.  
Поля: `automation_enabled: boolean`.

`WorkspaceMember` — участник воркспейса с полными данными.  
Поля: `user_id: string`, `email: string`, `name: string`, `role: WorkspaceRole`, `joined_at: string`.

**Раздел 3 — Задачи**

`TaskPriority` — union type: `"low" | "medium" | "high" | "critical"`.

`DeadlineUrgency` — union type: `"none" | "soon" | "critical"`.  
Вычисляется бэкендом при каждом чтении задачи.

`Task` — карточка задачи (основной объект доски).  
Поля: `id: string`, `title: string`, `description: string`, `column_id: string`, `workspace_id: string`, `priority: TaskPriority`, `tags: string[]`, `assignee_id: string | null`, `created_at: string`, `deadline: string | null`, `deadline_urgency: DeadlineUrgency`.

**Раздел 4 — Доска**

`Column` — колонка канбан-доски.  
Поля: `id: string`, `name: string`, `position: number`, `color: string | undefined`, `tasks: Task[]`.

`Board` — доска воркспейса (один воркспейс = одна доска).  
Поля: `id: string`, `columns: Column[]`.

**Раздел 5 — Автоматизация**

`RuleCondition` — условие правила автоматизации.  
Поля: `field: string`, `operator: "eq" | "contains" | "gt" | "lt"`, `value: unknown`.

`RuleActionType` — union type: `"move_to_column" | "add_tag" | "notify_members"`.

`RuleActionParams` — параметры действия.  
Поля: `column_id: string | undefined`, `tag: string | undefined`, `message: string | undefined`.

`RuleAction` — действие правила.  
Поля: `type: RuleActionType`, `params: RuleActionParams`.

`RuleTrigger` — union type: `"task.created" | "task.moved" | "task.updated" | "deadline.approaching"`.

`AutomationRule` — правило автоматизации.  
Поля: `id: string`, `workspace_id: string`, `name: string`, `active: boolean`, `trigger: RuleTrigger`, `condition: RuleCondition | null`, `action: RuleAction`.

**Раздел 6 — Уведомления**

`Notification` — in-app уведомление.  
Поля: `id: string`, `type: string`, `message: string`, `read: boolean`, `created_at: string`.

**Раздел 7 — Аудит**

`AuditChange` — одно изменённое поле в записи аудита.  
Поля: `field: string`, `old: unknown`, `new: unknown`.

`AuditActor` — сокращённое представление пользователя для аудита.  
Поля: `id: string`, `name: string`.

`AuditLogEntry` — запись в истории изменений.  
Поля: `id: string`, `event_type: string`, `actor: AuditActor`, `task_id: string`, `task_title: string | undefined`, `changes: AuditChange[]`, `created_at: string`.

**Раздел 8 — WebSocket / JSON-RPC**

`JsonRpcMessage` — формат JSON-RPC 2.0 сообщения (server → client, только notifications).  
Поля: `jsonrpc: "2.0"`, `method: string`, `params: Record<string, unknown>`.  
Известные значения `method`: `"board.task_created"`, `"board.task_updated"`, `"board.task_moved"`, `"board.task_deleted"`, `"notification.created"`, `"event_log.entry"`.

**Раздел 9 — AI-груминг**

`GroomQuestion` — уточняющий вопрос от LLM.  
Поля: `id: string`, `text: string`.

`GroomAnswer` — ответ пользователя на вопрос.  
Поля: `question_id: string`, `answer: string`.

`GroomSession` — сессия AI-груминга.  
Поля: `session_id: string`, `questions: GroomQuestion[]`.

`TaskDraft` — драфт задачи, сгенерированный LLM.  
Поля: `title: string`, `description: string`, `priority: TaskPriority`, `tags: string[]`.

### Экспорты
Все типы экспортируются именованно. Никаких default exports. Никаких barrel-реэкспортов из других файлов.

---

## 3. `frontend/lib/api.ts`

### Назначение
HTTP-клиент с автоматическим добавлением Bearer токена и retry-логикой при 401. Не имеет зависимостей на React. Взаимодействие с AuthProvider строго через callbacks — никаких импортов из `providers.tsx`.

### Модульные переменные (module-level state)

Два приватных (не экспортируемых) closure-переменных модуля:

`accessToken: string | null` — JWT access token в JS-памяти. Инициализируется значением `null`. Не попадает в DOM, не в storage, недоступен через XSS из других вкладок.

`onLogout: (() => void) | null` — callback для выхода пользователя. Инициализируется `null`. Регистрируется AuthProvider при монтировании.

### Экспортируемые функции управления токеном

`setAccessToken(token: string | null): void`  
Устанавливает значение `accessToken`. Принимает `null` при логауте. Вызывается AuthProvider после логина, рефреша и при логауте.

`getAccessToken(): string | null`  
Читает и возвращает текущее значение `accessToken`. Публичная функция — нужна `ws.ts` для передачи геттера в `WsClient` конструктор.

`registerLogoutCallback(cb: () => void): void`  
Сохраняет callback в `onLogout`. Вызывается AuthProvider при монтировании, передавая свою функцию `logout()`.

### Основная функция `apiFetch`

Сигнатура: `apiFetch(path: string, options?: RequestInit): Promise<Response>`

Принимает:
- `path` — путь относительно `NEXT_PUBLIC_API_URL` (например, `"/api/v1/tasks"`)
- `options` — стандартный `RequestInit` (метод, тело, дополнительные заголовки)

Поведение (детальный порядок шагов):

1. Формирует полный URL: `process.env.NEXT_PUBLIC_API_URL + path`
2. Копирует `options.headers` (если есть) и добавляет `Authorization: Bearer {accessToken}` если `accessToken !== null`
3. Выполняет `fetch(url, mergedOptions)`
4. Если статус ответа **не 401**: возвращает `Response` как есть — вызывающий код сам решает что делать (вызывать `.json()`, проверять `ok`, и т.д.)
5. Если статус ответа **401 (первый раз)**:
   a. Читает `refresh_token` из `sessionStorage.getItem("refresh_token")`
   b. Если `refresh_token` отсутствует (null) — переходит к шагу 5e
   c. Отправляет `POST /api/v1/auth/refresh` с телом `{ refresh_token }` и заголовком `Content-Type: application/json`
   d. Если refresh вернул **200** — читает `{ access_token }` из тела, вызывает `setAccessToken(access_token)`, повторяет исходный запрос с новым токеном (шаги 2–4), возвращает результат
   e. Если refresh вернул **401** или sessionStorage был пустым — вызывает `onLogout?.()`, бросает `Error("Session expired")`
6. Повторный запрос (шаг 5d) уже не обрабатывает 401 — возвращает как есть, избегая бесконечного цикла

**Важно о сетевых ошибках:** `fetch` сам бросает исключение при сетевой недоступности (нет интернета, CORS, DNS). `apiFetch` не перехватывает их — ошибка проходит выше к вызывающему коду.

### Объект-хелпер `api`

Именованный экспорт `api` — объект с методами-обёртками над `apiFetch`. Каждый метод разбирает JSON и возвращает типизированный результат. Все методы с телом запроса устанавливают `Content-Type: application/json`.

`api.get<T>(path: string): Promise<T>`  
Вызывает `apiFetch(path, { method: "GET" })`, проверяет `response.ok`, возвращает `response.json() as T`.

`api.post<T>(path: string, body: unknown): Promise<T>`  
Вызывает `apiFetch(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })`, проверяет `response.ok`, возвращает `response.json() as T`.

`api.patch<T>(path: string, body: unknown): Promise<T>`  
Аналогично post, метод `PATCH`.

`api.put<T>(path: string, body: unknown): Promise<T>`  
Аналогично post, метод `PUT`.

`api.delete(path: string): Promise<void>`  
Вызывает `apiFetch(path, { method: "DELETE" })`, проверяет `response.ok`, ничего не возвращает (тело 204 пустое).

**Обработка HTTP-ошибок в хелперах** (4xx, 5xx кроме 401 который обработан `apiFetch`):  
Если `response.ok === false`, пытается распарсить `response.json()` и взять поле `detail`. Если парсинг не удался — бросает `Error(`HTTP ${response.status}`)`. Бросает `Error(detail ?? `HTTP ${response.status}`)`.

### Управление refresh_token в sessionStorage

Ключ: `"refresh_token"`.  
`apiFetch` — только **читает** при обработке 401, и **очищает** (`sessionStorage.removeItem`) при двойном 401.  
AuthProvider — **записывает** (`sessionStorage.setItem`) после успешного логина; **очищает** при явном logout.  
`ws.ts` — не взаимодействует с sessionStorage вообще.

### Экспорты
`apiFetch`, `api`, `setAccessToken`, `getAccessToken`, `registerLogoutCallback`

---

## 4. `frontend/lib/ws.ts`

### Назначение
WebSocket-клиент с JSON-RPC 2.0 диспатчером и авторесоединением с экспоненциальной задержкой. Не зависит от React, от `api.ts`, от `providers.tsx`. Токен получает через callback-геттер.

### Класс `WsClient`

#### Конструктор

Параметры:
- `workspaceId: string` — используется для формирования URL: `{NEXT_PUBLIC_WS_URL}/ws/{workspaceId}`
- `getToken: () => string | null` — геттер токена, не само значение. При каждом reconnect вызывается заново, получая актуальный токен после рефреша

Конструктор только сохраняет параметры в поля. Соединение не устанавливается. После конструктора объект готов к вызову `connect()`.

#### Приватные поля

| Поле | Тип | Назначение |
|------|-----|-----------|
| `workspaceId` | `string` | ID воркспейса для URL |
| `getToken` | `() => string \| null` | Геттер access token |
| `socket` | `WebSocket \| null` | Текущий WebSocket объект |
| `handlers` | `Map<string, Set<(params: Record<string, unknown>) => void>>` | Подписчики по имени метода |
| `retryDelay` | `number` | Текущая задержка reconnect в мс, начальное значение 1000 |
| `shouldReconnect` | `boolean` | Флаг: false после вызова disconnect(), предотвращает автореконнект |
| `retryTimer` | `ReturnType<typeof setTimeout> \| null` | Таймер ожидания reconnect, хранится для отмены через clearTimeout |

#### Метод `connect(): void`

1. Устанавливает `shouldReconnect = true`
2. Формирует URL: берёт `process.env.NEXT_PUBLIC_WS_URL`, добавляет `/ws/{workspaceId}`, если `getToken()` не null — добавляет `?token={token}` как query-параметр
3. Создаёт новый `WebSocket(url)`, сохраняет в `this.socket`
4. Устанавливает обработчики:
   - `socket.onopen`: сбрасывает `retryDelay = 1000`
   - `socket.onmessage`: парсит `event.data` как JSON в блоке `try/catch`; при успехе проверяет поля `jsonrpc === "2.0"` и наличие поля `method`; если валидно — вызывает `this.dispatch(message as JsonRpcMessage)`; при любой ошибке — тихо игнорирует
   - `socket.onclose`: если `this.shouldReconnect === true` — планирует reconnect (см. ниже)
   - `socket.onerror`: если `this.shouldReconnect === true` — планирует reconnect; не выбрасывает исключений

#### Приватный метод `scheduleReconnect(): void`

Вызывается из `onclose` и `onerror` обработчиков.  
Сохраняет в `this.retryTimer` результат `setTimeout(() => this.connect(), this.retryDelay)`.  
После установки таймера обновляет: `this.retryDelay = Math.min(this.retryDelay * 2, 30000)`.

Последовательность задержек: 1000 → (удваивается до переподключения) → при onopen сбрасывается обратно в 1000.

Задержки по попыткам:
- Попытка 1: ждёт 1000 мс, затем connect
- Если снова упало: ждёт 2000 мс
- Если снова: 4000 мс
- Далее: 8000, 16000, 30000, 30000... (не превышает 30 сек)

#### Метод `disconnect(): void`

1. Устанавливает `this.shouldReconnect = false` — прерывает цепочку переподключений
2. Если `this.retryTimer !== null` — вызывает `clearTimeout(this.retryTimer)`, сбрасывает в `null`
3. Если `this.socket !== null` — вызывает `this.socket.close()`, сбрасывает в `null`

После вызова объект безопасно выбрасывается. Повторный вызов `connect()` после `disconnect()` снова активирует клиент (если нужно).

#### Метод `on(method: string, handler: (params: Record<string, unknown>) => void): void`

1. Если `this.handlers.has(method)` — берёт существующий `Set`
2. Если нет — создаёт новый `Set`, добавляет в Map: `this.handlers.set(method, new Set())`
3. Добавляет `handler` в Set: `this.handlers.get(method)!.add(handler)`

Один метод может иметь несколько подписчиков. Один и тот же handler не добавляется дважды (Set гарантирует уникальность по ссылке).

#### Метод `off(method: string, handler: (params: Record<string, unknown>) => void): void`

1. Получает Set для метода из Map
2. Если Set не существует — возвращается (noop)
3. Удаляет handler из Set: `set.delete(handler)`
4. Если Set стал пустым — удаляет запись из Map: `this.handlers.delete(method)`

#### Приватный метод `dispatch(message: JsonRpcMessage): void`

1. Получает Set обработчиков: `this.handlers.get(message.method)`
2. Если Set не существует или пустой — тихо возвращается (нет подписчиков — нет ошибки)
3. Итерирует по Set, вызывает каждый `handler(message.params)`
4. Каждый вызов handler оборачивается в `try/catch` — ошибка в одном обработчике не прерывает вызов остальных

### Экспорты
`WsClient` — именованный экспорт класса.

---

## 5. `frontend/app/providers.tsx`

### Назначение
React-провайдеры приложения: AuthContext (аутентификация + управление сессией) + QueryClientProvider (react-query). Единая точка оборачивания для `layout.tsx`.

### `AuthContextType` — тип контекста

```
interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean        // вычисляется: !isLoading && user !== null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}
```

### Создание контекста

`AuthContext` создаётся через `createContext<AuthContextType | null>(null)`.  
Дефолтное значение `null` — намеренно, чтобы `useAuth()` выбрасывал ошибку при использовании вне провайдера.

Хук `useAuth(): AuthContextType`:  
Вызывает `useContext(AuthContext)`. Если результат `null` — выбрасывает `Error("useAuth must be used within AuthProvider")`. Это fail-fast: проблема видна сразу при разработке.

### Компонент `AuthProvider`

#### State

```
const [user, setUser] = useState<User | null>(null)
const [isLoading, setIsLoading] = useState(true)  // true при старте — ждём restore
```

`isAuthenticated` вычисляется при каждом рендере: `!isLoading && user !== null`.

#### Метод `refresh(): Promise<void>`

1. Читает `refresh_token` из `sessionStorage.getItem("refresh_token")`
2. Если `null` или пустая строка — вызывает `logout()`, возвращает
3. Вызывает `POST /api/v1/auth/refresh` с телом `{ refresh_token }` через прямой `fetch` (не через `api.post`, чтобы избежать рекурсии: `apiFetch` сам вызывает refresh при 401)
4. Если ответ 200 — читает `{ access_token }`, вызывает `setAccessToken(access_token)` из `api.ts`
5. Дополнительно: для получения объекта `User` после рефреша — читает сериализованный user из `sessionStorage.getItem("user")` и если есть — парсит JSON и вызывает `setUser(parsed)`
6. Если ответ не 200 — вызывает `logout()`

> Примечание: бэкенд при `/auth/refresh` возвращает только `{ access_token }`, не возвращает User объект. Поэтому user хранится в `sessionStorage["user"]` в сериализованном виде. Это позволяет восстановить сессию без дополнительного запроса к `/auth/me`.

#### Метод `login(email: string, password: string): Promise<void>`

1. Вызывает `api.post<{ access_token: string, refresh_token: string, user: User }>("/api/v1/auth/login", { email, password })`
2. При успехе:
   - Вызывает `setAccessToken(data.access_token)` из `api.ts`
   - Записывает `sessionStorage.setItem("refresh_token", data.refresh_token)`
   - Записывает `sessionStorage.setItem("user", JSON.stringify(data.user))`
   - Вызывает `setUser(data.user)`
3. При ошибке — пробрасывает исключение выше (форма логина обрабатывает сама)

#### Метод `logout(): void`

1. Fire-and-forget вызов `apiFetch("/api/v1/auth/logout", { method: "POST" })` в `try/catch` (ошибку игнорирует)
2. Вызывает `setAccessToken(null)` из `api.ts`
3. `sessionStorage.removeItem("refresh_token")`
4. `sessionStorage.removeItem("user")`
5. Вызывает `setUser(null)`
6. Перенаправляет на `/login` через Next.js `useRouter().push("/login")` или `router.replace("/login")`

> `logout` также регистрируется в `api.ts` через `registerLogoutCallback(logout)` — вызывается при двойном 401 в `apiFetch`.

#### `useEffect` при монтировании (восстановление сессии)

Выполняется один раз при монтировании компонента (`deps: []`).

Порядок шагов:
1. `registerLogoutCallback(logout)` — регистрирует logout в api.ts, чтобы при двойном 401 выходило из системы
2. Читает `sessionStorage.getItem("refresh_token")`
3. Если токен есть:
   - Вызывает `await refresh()`
   - `refresh()` восстанавливает `accessToken` в памяти и `user` из sessionStorage
4. Если токен отсутствует:
   - `setUser(null)` — пользователь не авторизован
5. `setIsLoading(false)` — в блоке `finally`, выполняется в любом случае

Пока `isLoading === true` — рендер дочерних компонентов откладывается (или показывается loader). Это предотвращает flash of unauthenticated content.

### QueryClient

Создаётся **вне компонента** на уровне модуля:

```
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,     // данные считаются свежими 1 минуту
      retry: 1,                  // одна повторная попытка при ошибке
    }
  }
})
```

Создание вне компонента гарантирует, что один экземпляр используется во всём приложении и не пересоздаётся при рендерах.

### Компонент `Providers` (default export)

Принимает: `{ children: React.ReactNode }`

Порядок вложенности:
```
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    {children}
  </AuthProvider>
</QueryClientProvider>
```

`QueryClientProvider` снаружи — чтобы react-query хуки были доступны внутри `AuthProvider` если потребуется (например, для prefetch при монтировании).

### Экспорты
- `default export Providers` — компонент-обёртка для layout.tsx
- `export { AuthContext }` — именованный, для случаев прямого использования `useContext`
- `export { useAuth }` — именованный хук

---

## 6. `frontend/app/layout.tsx`

### Что удаляется

Все импорты из `@clerk/nextjs`:
```
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"
```

Из JSX удаляются: `<ClerkProvider>`, `<header>`, `<Show when="signed-out">`, `<SignInButton />`, `<SignUpButton />`, `<Show when="signed-in">`, `<UserButton />`.

### Что добавляется

Импорт `Providers` из `@/app/providers` (или относительный путь `./providers`).

Файл добавляет директиву `"use client"` — необходима, так как `Providers` использует React state и hooks.

> Альтернатива: оставить `layout.tsx` как server component, перенести `"use client"` в `providers.tsx`. Рекомендуется второй вариант — `providers.tsx` уже использует hooks, поэтому `"use client"` там необходима. `layout.tsx` при этом остаётся server component.

### Итоговая структура

```tsx
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = { title: "Victory Kanban" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

---

## 7. `frontend/package.json`

### Что удалить

`"@clerk/nextjs": "^7.3.4"` из `dependencies`.

### Что добавить

`"@tanstack/react-query": "^5.62.0"` в `dependencies`.

**Обоснование версии:** `@tanstack/react-query` v5 полностью совместим с React 19. Версии v4 и ниже могут иметь проблемы с React 19 concurrent features. Выбирается v5.x — последний стабильный минорный релиз ветки v5 (на момент разработки ~5.62.x).

### Действия после обновления

После редактирования `package.json` выполнить:
```
npm install
```

Это удалит `@clerk/nextjs` и установит `@tanstack/react-query`.

### Удаление файла-дубликата

`frontend/app/lib/api.ts` — удалить. Файл является копией старой заглушки. Все импорты, если они есть в других файлах, должны быть перенаправлены на `@/lib/api`.

---

## 8. Подводные камни и способы их обхода

### 8.1 Циклические зависимости между модулями

**Риск:** `api.ts` импортирует что-то из `providers.tsx`, `providers.tsx` импортирует из `api.ts` → циклический граф.

**Решение:** строгое правило однонаправленных зависимостей:
```
providers.tsx → api.ts    (OK: providers использует api)
api.ts        ↛ providers  (ЗАПРЕЩЕНО: api не знает о React)
```

Взаимодействие `api.ts → providers.tsx` осуществляется через callback (`registerLogoutCallback`) — `api.ts` хранит функцию `() => void`, не импортируя React и не зная о `providers.tsx`.

Итоговый граф зависимостей без циклов:
```
providers.tsx → api.ts → (нет импортов из проекта)
providers.tsx → types.ts → (нет импортов)
ws.ts         → types.ts → (нет импортов)
layout.tsx    → providers.tsx
```

### 8.2 Race condition при параллельных 401 запросах

**Сценарий:** два параллельных запроса получают 401 одновременно. Оба начинают refresh → два параллельных POST /auth/refresh → бэкенд может инвалидировать первый refresh_token после второго запроса → один из рефрешей падает → непредсказуемый выход из системы.

**Решение:** mutex (флаг-семафор) на уровне модуля `api.ts`.

Добавить модульную переменную `refreshPromise: Promise<void> | null = null`.

Логика в `apiFetch` при 401:
1. Если `refreshPromise !== null` — уже идёт refresh → `await refreshPromise` (ждём завершения)
2. Если `refreshPromise === null` — начинаем refresh → `refreshPromise = doRefresh()`
3. `await refreshPromise`
4. `refreshPromise = null` (в finally)
5. Повторяем исходный запрос с новым токеном

Таким образом все параллельные 401 ждут один refresh, а не запускают несколько.

### 8.3 WsClient: токен при reconnect

**Риск:** если передать `token: string` в конструктор напрямую, при автоматическом reconnect (после истечения токена) WebSocket откроется со старым, просроченным токеном.

**Решение (уже зафиксировано в дизайне):** конструктор принимает `getToken: () => string | null` — функцию-геттер, не значение. При каждом вызове `connect()` (включая reconnect) метод вызывает `getToken()` и получает актуальный токен из module-level переменной `api.ts`.

Использование в `BoardPage`:
```
new WsClient(workspaceId, getAccessToken)
// getAccessToken — импортированная из api.ts функция, читает актуальный module var
```

Не передавать `() => accessToken` где `accessToken` — локальная переменная компонента: она закроется на устаревшее значение. Всегда использовать `getAccessToken` из `api.ts`.

### 8.4 React 19 совместимость с @tanstack/react-query

**Риск:** `@tanstack/react-query` v4 использует `React.createContext` и устаревшие паттерны, которые могут генерировать warnings или некорректно работать с React 19 concurrent rendering.

**Решение:** использовать `@tanstack/react-query` версии **5.x**. В v5 переработан рендеринг под React 18+ и React 19:
- Поддержка `use()` hook для suspense
- Совместим с concurrent features
- Нет deprecated Context API паттернов

**Версия в package.json:** `"^5.62.0"` (или актуальная последняя v5).

Не использовать v4 (`"^4.x.x"`) с React 19.

### 8.5 Директива `"use client"` и Server Components

**Риск:** `providers.tsx` использует `useState`, `useEffect`, `createContext` — это client-side API. Если файл не помечен `"use client"`, Next.js выдаст ошибку при сборке.

**Решение:** добавить `"use client"` в первую строку `providers.tsx`. Тогда `layout.tsx` остаётся Server Component (нет директивы, нет хуков). Server Components могут рендерить Client Components как дочерние — это поддерживаемый паттерн Next.js App Router.

### 8.6 `refresh()` не должен вызывать `apiFetch`

**Риск:** если `refresh()` в `AuthProvider` использует `api.post()` → `apiFetch()` → при 401 снова вызовет refresh → рекурсия.

**Решение:** метод `refresh()` в `AuthProvider` использует прямой `fetch()` (не `apiFetch`, не `api.post`). Это единственное место в коде, где разрешено использовать `fetch` напрямую. Для ясности добавить комментарий в код.

Аналогично метод `login()` может использовать `api.post()` безопасно — при логине токена нет, 401 = неверные credentials, retry не нужен.

### 8.7 `logout` как стабильная ссылка для `registerLogoutCallback`

**Риск:** если `logout` в `AuthProvider` создаётся при каждом рендере (обычная функция), то `registerLogoutCallback` вызывается при каждом рендере, перезаписывая callback. Это не критично, но создаёт лишнюю работу.

**Решение:** обернуть `logout` в `useCallback` без зависимостей (или с минимальными зависимостями). Тогда `registerLogoutCallback` в `useEffect` при монтировании получает стабильную ссылку.

---

## 9. Критерии готовности (чеклист для dev-агента)

По завершению реализации все пункты должны быть выполнены:

- [ ] `frontend/lib/types.ts` создан, все типы экспортируются именованно
- [ ] `frontend/lib/api.ts` заменён: экспортирует `apiFetch`, `api`, `setAccessToken`, `getAccessToken`, `registerLogoutCallback`
- [ ] `frontend/lib/ws.ts` создан: экспортирует класс `WsClient`
- [ ] `frontend/app/providers.tsx` создан: экспортирует `default Providers`, `AuthContext`, `useAuth`
- [ ] `frontend/app/layout.tsx` обновлён: убраны Clerk импорты, добавлен `<Providers>`
- [ ] `frontend/app/lib/api.ts` удалён
- [ ] `frontend/package.json` обновлён: нет `@clerk/nextjs`, есть `@tanstack/react-query ^5.x`
- [ ] `npm install` выполнен без ошибок
- [ ] `npx tsc --noEmit` проходит без ошибок
- [ ] Нет импортов `@clerk/nextjs` ни в одном файле проекта (проверить `grep -r "clerk"`)
- [ ] Нет циклических импортов (`api.ts` не импортирует из `providers.tsx`)
- [ ] Mutex для refresh реализован в `api.ts`
- [ ] `WsClient` принимает `getToken: () => string | null`, не `string`
