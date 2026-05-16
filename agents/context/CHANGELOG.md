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
