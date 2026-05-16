## FEAT-0008 — AutomationRules: исправление схемы + структурированная форма — 2026-05-16

Статус: DONE (`npm run build` — чисто, `npx tsc --noEmit` — 0 ошибок)

**Изменён 1 файл: `frontend/components/admin/AutomationRules.tsx`**

- Локальный тип `AdminAutomationRule { trigger_event, action_type, action_payload }` → заменён на `AutomationRule` из `frontend/lib/types.ts`
- POST-тело исправлено: `{ name, trigger, condition: null, action: { type, params } }` — соответствует `AutomationRuleCreate` бэкенда
- Триггеры: `task.deleted` → `deadline.approaching`; типы из `RuleTrigger`
- Действия: `notify_all` → `notify_members`; типы из `RuleActionType`; добавлен `move_to_column`
- Убрана JSON-textarea → структурированные поля: `notify_members` → input «Сообщение»; `add_tag` → input «Тег»; `move_to_column` → select колонок
- Колонки: lazy-загрузка при выборе `move_to_column`, кэш на время жизни компонента, `cancelled`-флаг от race condition
- Список правил: `rule.name` + `rule.trigger → rule.action.type` + badge `active`/`inactive`
- `buildParams()` — чистая функция без side-эффектов

## FEAT-0007 — Admin Page (ColumnEditor + AutomationRules) — 2026-05-16

Статус: DONE (`npm run build` — чисто, `/admin` в роутах; `npx tsc --noEmit` — 0 ошибок)

**Создано 3 файла, изменён 1.**

- Создан `frontend/app/(app)/admin/page.tsx` — `"use client"`, читает `workspace_id` из `useSearchParams()`, guard-redirect на `/board` при отсутствии, рендерит `<ColumnEditor>` и `<AutomationRules>` в контейнере `px-8 py-8 max-w-2xl`
- Создан `frontend/components/admin/ColumnEditor.tsx` — загрузка доски (`GET /api/v1/workspaces/{id}/board`), список колонок с inline Rename (Enter/Escape/blur) и inline Delete (confirm), форма «+ Добавить колонку» (POST); рефетч после каждой мутации; skeleton при загрузке; inline error при CRUD-ошибках
- Создан `frontend/components/admin/AutomationRules.tsx` — загрузка правил (`GET /api/v1/workspaces/{id}/automation`), список с inline Delete confirm, форма создания (select trigger_event/action_type + textarea JSON payload с live валидацией); локальный тип `AdminAutomationRule` (до реализации T-022)
- Изменён `frontend/components/sidebar/Sidebar.tsx` — добавлен `isOwner: boolean` state; `GET /api/v1/workspaces/me` теперь также читает `role` из найденного workspace; Admin NavItem рендерится только если `role === "owner"`

**CTO issue (major → solved):** Double-submit при Enter + blur в rename-инпуте — исправлено через `renameSubmittingRef = useRef(false)` (see FEAT-0007-ISSUE-001_solved.md)

**Архитектура:** Automation API использует поля `trigger_event`/`action_type`/`action_payload` (spec T-022), которые отличаются от существующего `AutomationRule` в types.ts (`trigger`/`action.type`/`action.params`). После реализации T-022 нужно унифицировать типы.

## FEAT-0006 — AddTaskForm расширенные поля — 2026-05-16

Статус: DONE (`npx tsc --noEmit` — 0 новых ошибок, pre-existing @dnd-kit типы не изменились)

**Изменено 4 файла.**

- Изменён `frontend/components/board/AddTaskForm.tsx` — экспортирован тип `AddTaskData { title, priority, description?, deadline? }`; prop `onSubmit` изменён с `(title: string)` на `(data: AddTaskData)`; добавлены state `priority` (default medium), `description`, `deadline`, `isExpanded`; кнопка `▾/▴` разворачивает доп. поля (priority select, description textarea, deadline date); Enter работает только в title-инпуте; стиль полей совпадает с TaskModal.
- Изменён `frontend/components/board/Column.tsx` — импорт `AddTaskData`; сигнатура `onTaskCreate` обновлена с `(columnId, title)` на `(columnId, data: AddTaskData)`; внутренний `handleTaskCreate` прокидывает объект данных.
- Изменён `frontend/components/board/KanbanBoard.tsx` — импорт `AddTaskData`; сигнатура `onTaskCreate` обновлена аналогично.
- Изменён `frontend/app/(app)/board/page.tsx` — импорт `AddTaskData`; `handleTaskCreate(columnId, data)` использует `data.priority/description/deadline` в tempTask и в POST `/api/v1/tasks`.

**Архитектура:** `AddTaskData` экспортируется из `AddTaskForm.tsx` и импортируется в Column, KanbanBoard, board/page — единственный источник типа. Быстрый сценарий (Enter с только title) работает без изменений.

## FEAT-0005 — Task Modal (view / edit / delete) — 2026-05-16

Статус: DONE (`npm run build` без ошибок)

**Изменено 5 файлов, создан 1 новый файл.**

- Создан `frontend/components/board/TaskModal.tsx` — модальное окно задачи с тремя режимами: view (просмотр), edit (редактирование), confirm (подтверждение удаления). Overlay rgba(0,0,0,0.65) + blur(2px), контейнер #111111 с urgency-accent линией слева, анимированный spinner, загрузка members при монтировании с cancelled-флагом. Все null-состояния (описание, дедлайн, исполнитель, теги) обработаны согласно дизайну.
- Изменён `frontend/components/board/TaskCard.tsx` — добавлен prop `onClick?: () => void`, вызывается при `!isDragging`.
- Изменён `frontend/components/board/KanbanBoard.tsx` — добавлен prop `onCardClick: (task: Task) => void`, пробрасывается в Column.
- Изменён `frontend/components/board/Column.tsx` — добавлен prop `onCardClick: (task: Task) => void`, пробрасывается в SortableTaskCard → TaskCard.
- Изменён `frontend/app/(app)/board/page.tsx` — добавлены `selectedTask` state, `handleCardClick`, `handleCloseModal`, `handleTaskEdit` (optimistic PATCH + rollback), `handleTaskDelete` (optimistic DELETE + rollback); TaskModal рендерится при `selectedTask !== null && workspaceId`.

**Архитектура:** Modal только вызывает колбэки, не трогает board state напрямую. Все API-операции через board/page.tsx с оптимистичными обновлениями, snapshot-rollback и toast при ошибке. Fail-fast: исключения пробрасываются в Modal для разблокировки кнопок.

## FEAT-0005 — Workspace Members List Endpoint — 2026-05-16

- Добавлен `list_members()` в `backend/app/workspace/service.py`: любой участник workspace может получить список участников; не-участник получает `403`.
- Добавлен `GET /api/v1/workspaces/{workspace_id}/members` в `backend/app/workspace/router.py`, response model `list[MemberOut]`.
- Проверено: `py_compile`, `compileall backend/app/workspace`, импорт router через backend `.venv` с dummy env — маршрут зарегистрирован.
## FEAT-0004 — Dark UI Redesign «Agency OS» — 2026-05-16

Статус: APPROVED (CTO review passed, 0 open issues; 2 extra files fixed during CTO review)

**Изменено 15 файлов — только визуальные правки, API и маршрутизация не тронуты.**

- `frontend/app/globals.css` — удалены light theme vars, добавлен `@theme` с design tokens, dark body, кастомный scrollbar, `.dot-texture` utility
- `frontend/app/layout.tsx` — Space Grotesk via `next/font/google`, тёмный body
- `frontend/app/(auth)/layout.tsx` — `bg-[#050505]` + radial glow вместо `bg-gray-50`
- `frontend/app/(auth)/login/page.tsx` — dark glass card (bg #0B0B0B, border rgba(255,255,255,0.08)), uppercase VIKTORIA header, dark inputs с focus border, blue CTA с glow hover
- `frontend/app/(auth)/register/page.tsx` — аналогично login
- `frontend/app/(app)/layout.tsx` — `bg-[#050505]` на root и main
- `frontend/app/(app)/board/page.tsx` — `bg-[#050505]` вместо `bg-gray-100`; toast в dark стиле
- `frontend/components/sidebar/Sidebar.tsx` — w-[220px], bg #0B0B0B, border rgba(.06), NavItem с active left-border #3B82F6
- `frontend/components/board/KanbanBoard.tsx` — `gap-6 px-8 py-6 bg-[#050505] dot-texture`
- `frontend/components/board/Column.tsx` — прозрачный контейнер, uppercase muted header, dark isOver, dotted empty state
- `frontend/components/board/TaskCard.tsx` — bg #111111, rounded-[18px], urgency left-border accent, CSS hover elevation
- `frontend/components/board/PriorityBadge.tsx` — dark low-saturation pills (rgba backgrounds)
- `frontend/components/board/AddTaskForm.tsx` — dark surface rgba(255,255,255,0.04), dark input, blue button
- `frontend/components/board/BoardSkeleton.tsx` — dark skeleton rgba(255,255,255,0.06), transparent columns
- `frontend/components/board/ErrorBanner.tsx` — dark error banner rgba(239,68,68,0.08)
- `frontend/components/board/DeadlineChip.tsx` — urgency colors: amber/rose вместо yellow/red
- `frontend/components/event-log/EventLogPanel.tsx` — bg #0B0B0B, matching design system
- `frontend/components/event-log/LogEntry.tsx` — dark inline colors вместо Tailwind gray

**Решения:** Framer Motion не установлен → CSS transitions. Tailwind v4 → `@theme` в CSS. Inline styles для rgba значений вместо Tailwind arbitrary values.

## FEAT-0004 — Auth Pages (Login + Register) — 2026-05-16

Статус: APPROVED (CTO review passed, 0 issues)

- Создан `frontend/app/(auth)/layout.tsx` — Server Component, центрирует карточку формы (`min-h-screen flex items-center justify-center bg-gray-50`), изолирован от app-layout (нет Sidebar/EventLogPanel/WsProvider)
- Создан `frontend/app/(auth)/login/page.tsx` — Client Component: форма email+password, `useAuth().login()`, redirect-guard (`useEffect` на `isAuthenticated`), маппинг ApiError(401) → «Неверный email или пароль», кнопка disabled во время запроса
- Создан `frontend/app/(auth)/register/page.tsx` — Client Component: форма name+email+password, `api.post('/api/v1/auth/register')` → `useAuth().login()` (нет дублирования логики хранения токенов), маппинг ApiError(409) → «Email уже занят»
- shadcn/ui не установлен — использован чистый Tailwind (как во всём проекте)
- `npx tsc --noEmit` без ошибок в auth-файлах

## T-014 — CTO Review Fixes для FEAT-0003 — 2026-05-16

### 4 issue resolved

- **ISSUE-001 (major)**: `WsContext.tsx` — добавлен `useState<string | null>` для реактивного `workspaceId`; `value`-объект стабилизирован через `useMemo([init, on, off, workspaceId])` — устранены лишние ре-рендеры всех потребителей
- **ISSUE-002 (major)**: `WsContext.tsx` — `on()` теперь всегда пишет в `pendingHandlers` (источник истины) И проксирует в `wsRef.current` если WsClient уже создан; `init()` при reconnect не делает `pendingHandlers.clear()` — все хэндлеры переносятся в новый WsClient
- **ISSUE-003 (minor)**: `LogEntry.tsx` — `formatTime()` проверяет `isNaN(date.getTime())` и возвращает `"--:--:--"` вместо `"[NaN:NaN:NaN]"`
- **ISSUE-004 (major)**: `lib/types.ts` — добавлены fail-fast парсеры `parseBoardTask()` и `parseMoveParams()`; `board/page.tsx` — все небезопасные `as`-касты в WS-обработчиках заменены на вызовы этих парсеров

## FEAT-0003 — Kanban Board UI — 2026-05-16

- Установлены `@dnd-kit/core ^6.3.1` и `@dnd-kit/sortable ^10.0.0`
- Создан `frontend/lib/boardUtils.ts` — чистые функции мутации state: `moveTaskInBoard`, `addTaskToColumn`, `replaceTask`, `deleteTask`
- Создан `frontend/components/board/PriorityBadge.tsx` — цветной бейдж TaskPriority (low/medium/high/critical)
- Создан `frontend/components/board/DeadlineChip.tsx` — форматирование дедлайна через `Intl.DateTimeFormat("ru-RU")` + цвет по DeadlineUrgency
- Создан `frontend/components/board/BoardSkeleton.tsx` — скелетон загрузки (3 колонки, animate-pulse)
- Создан `frontend/components/board/ErrorBanner.tsx` — полоса ошибки с опциональной кнопкой "Повторить"
- Создан `frontend/components/board/TaskCard.tsx` — display-компонент карточки: urgency-цвета (border-l-4), PriorityBadge, DeadlineChip, аватар assignee
- Создан `frontend/components/board/AddTaskForm.tsx` — инлайн-форма создания задачи: autofocus, Enter/Escape, submit спиннер, локальный error state
- Создан `frontend/components/board/Column.tsx` — useDroppable, SortableContext, внутренний SortableTaskCard-враппер (useSortable + CSS.Transform), drag-over стили, isAddingTask state
- Создан `frontend/components/board/KanbanBoard.tsx` — DndContext с PointerSensor (distance:8), DragOverlay, handleDragStart/End/Cancel, вычисление targetColumnId и newPosition
- Создан `frontend/app/board/page.tsx` — владелец Board state: loadBoard(), WS-подписки (handleTaskCreated/Updated/Moved/Deleted через useCallback), оптимистичный move с snapshot/rollback, оптимистичное создание с tempTask/rollback, toast
- `npx tsc --noEmit` проходит без ошибок

## FEAT-0002 — WebSocket Hub + JSON-RPC + Notifications REST
Дата: 2026-05-16
Статус: APPROVED (CTO review passed, 6 issues resolved)
Файлы: backend/app/notifications/hub.py, jsonrpc.py, router.py, service.py; backend/app/auth/deps.py

### CTO Review — 6 issues resolved
- ISSUE-001 (critical): Error Hiding в broadcast — добавлен _logger.warning с exc перед disconnect; bare except заменён на except Exception as exc
- ISSUE-002 (critical): close(4001) вызывался до accept() — исправлен порядок: accept() → close(4001) → return во всех путях отказа
- ISSUE-003 (major): AsyncSession удерживалась на весь lifetime WS — сессия создаётся через async with _SessionFactory() только для шага проверки членства, закрывается сразу после
- ISSUE-004 (major): JWT не проверял claim type — добавлена проверка payload.get("type") == "access" с InvalidToken при несовпадении
- ISSUE-005 (minor): mark_as_read не делал refresh после commit — добавлен await session.refresh(notification) для консистентности с БД
- ISSUE-006 (minor): REST router без tags — создан отдельный rest_router = APIRouter(tags=["notifications"]), WS-router остался без тега; оба зарегистрированы в main.py явно

### Изменения реализации
- Создан `backend/app/auth/deps.py` — `decode_token(token) -> UUID` + `get_current_user` dependency (Bearer-заголовок → User из БД, HTTPException 401 при ошибке)
- Создан `backend/app/notifications/jsonrpc.py` — 7 констант методов JSON-RPC 2.0 + чистая функция `build(method, params) -> dict`
- Создан `backend/app/notifications/hub.py` — класс `ConnectionManager` с методами `connect/disconnect/broadcast/connection_count` + singleton `manager`; broadcast итерирует по копии списка, ошибки одного клиента не прерывают рассылку
- Создан `backend/app/notifications/service.py` — `get_notifications()`, `mark_as_read()`, `NotificationNotFound`
- Обновлён `backend/app/notifications/schemas.py` — добавлены `NotificationListQuery` и `ReadResponse`
- Создан `backend/app/notifications/router.py` — WS endpoint `/ws/{workspace_id}` (JWT валидация до accept, код 4001 при ошибке), REST `GET /api/v1/notifications`, REST `PATCH /api/v1/notifications/{id}/read`
- Обновлён `backend/app/database.py` — добавлены `get_session` dependency, async engine и sessionmaker
- Обновлён `backend/app/main.py` — подключён `notifications_router` без prefix (WS и REST endpoints объявлены с полными путями)

## FEAT-0002 WebSocket Hub + In-App Notifications — 2026-05-16 (pre-review)

- Создан `backend/app/auth/deps.py` — `decode_token(token) -> UUID` + `get_current_user` dependency (Bearer-заголовок → User из БД, HTTPException 401 при ошибке)
- Создан `backend/app/notifications/jsonrpc.py` — 7 констант методов JSON-RPC 2.0 + чистая функция `build(method, params) -> dict`
- Создан `backend/app/notifications/hub.py` — класс `ConnectionManager` с методами `connect/disconnect/broadcast/connection_count` + singleton `manager`; broadcast итерирует по копии списка, ошибки одного клиента не прерывают рассылку
- Создан `backend/app/notifications/service.py` — `get_notifications()`, `mark_as_read()`, `NotificationNotFound`
- Обновлён `backend/app/notifications/schemas.py` — добавлены `NotificationListQuery` и `ReadResponse`
- Создан `backend/app/notifications/router.py` — WS endpoint `/ws/{workspace_id}` (JWT валидация до accept, код 4001 при ошибке), REST `GET /api/v1/notifications`, REST `PATCH /api/v1/notifications/{id}/read`
- Обновлён `backend/app/database.py` — добавлены `get_session` dependency, async engine и sessionmaker
- Обновлён `backend/app/main.py` — подключён `notifications_router` без prefix (WS и REST endpoints объявлены с полными путями)

## FEAT-0001 Frontend Scaffold — CTO Review Fixes — 2026-05-15

- **ISSUE-001 (critical)** `frontend/lib/api.ts` — Исправлен mutex race condition: `refreshPromise` обнуляется через `await`, а не в `.finally()`. Введена отдельная функция `executeRefresh()`, `doRefresh()` управляет mutex-ом.
- **ISSUE-002 (major)** `frontend/lib/ws.ts` — Убран `scheduleReconnect()` из `onerror`; reconnect только в `onclose`.
- **ISSUE-003 (major)** `frontend/lib/api.ts` — `executeRefresh()` проверяет `res.ok` перед `res.json()`; при 5xx/не-OK вызывает logout и очищает storage; `res.json()` обёрнут в `try/catch`.
- **ISSUE-004 (major)** `frontend/app/providers.tsx` — `useEffect` переведён на `[]`; `logout`/`refresh` доступны через ref-обёртки, что исключает перезапуск при навигации.
- **ISSUE-005 (minor)** `frontend/lib/ws.ts` — токен в URL WebSocket обёрнут в `encodeURIComponent()`.
- **ISSUE-006 (minor)** `frontend/lib/types.ts` — `field: string | undefined` заменены на `field?: string` в `Column`, `RuleActionParams`, `AuditLogEntry`.
- `npx tsc --noEmit` проходит без ошибок.

## FEAT-0001 Frontend Scaffold — 2026-05-15

- Создан `frontend/lib/types.ts` (25 типов: User, Workspace, WorkspaceRole, WorkspaceMember, WorkspaceSettings, Task, TaskPriority, DeadlineUrgency, Column, Board, RuleCondition, RuleActionType, RuleActionParams, RuleAction, RuleTrigger, AutomationRule, Notification, AuditChange, AuditActor, AuditLogEntry, JsonRpcMessage, GroomQuestion, GroomAnswer, GroomSession, TaskDraft)
- Создан `frontend/lib/ws.ts` (класс WsClient с JSON-RPC диспатчером и экспоненциальным reconnect 1s→2s→4s→...→30s)
- Заменён `frontend/lib/api.ts` (apiFetch + api.get/post/patch/put/delete + refreshPromise mutex + getAccessToken + setAccessToken + registerLogoutCallback)
- Создан `frontend/app/providers.tsx` (AuthProvider + QueryClientProvider; refresh через прямой fetch без рекурсии; восстановление сессии из sessionStorage при монтировании)
- Обновлён `frontend/app/layout.tsx` (убран Clerk, добавлен `<Providers>`, оставлен Server Component)
- Обновлён `frontend/app/page.tsx` (убраны Clerk-компоненты, использует новый `api`)
- Обновлён `frontend/proxy.ts` (убран Clerk middleware, заменён заглушкой с комментарием)
- Удалён `frontend/app/lib/api.ts` (дубликат старой заглушки)
- Обновлён `frontend/package.json` (@tanstack/react-query ^5.62.0 добавлен, @clerk/nextjs удалён)
- `npm install` выполнен успешно (361 пакет)
- `npx tsc --noEmit` проходит без ошибок
