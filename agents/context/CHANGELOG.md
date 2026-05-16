## FEAT-0013 — Attachments StorageService + service + router + composition root — 2026-05-17

Статус: DONE (CTO approved, без issues). **Завершает I-08.**

**Создано 3 файла, изменено 4.**

- Создан `backend/app/attachments/storage.py` — `StorageService` (boto3 S3/MinIO); async методы через `asyncio.to_thread`: `ensure_bucket` (head→create idempotent), `put(key,data,ct)`, `signed_url(key,ttl)→str`, `delete(key)`; модульный синглтон `storage = StorageService(settings.s3_*)` 
- Создан `backend/app/attachments/service.py` — `ALLOWED_CONTENT_TYPES` (set + image/* prefix check); `list_attachments(session,task_id,storage)` (selectinload uploader, signed_url); `upload_attachment(session,task_id,uploader,filename,ct,data,storage)` (413/415 validation, storage.put → DB → commit → re-query → signed_url); `delete_attachment` (404/403, storage.delete → DB delete)
- Создан `backend/app/attachments/router.py` — `APIRouter(tags=["attachments"])`; GET/POST/DELETE; `file: UploadFile = File(...)`; `_get_storage()` Depends-синглтон; `file.content_type or "application/octet-stream"` fallback
- Изменён `backend/requirements.txt` — добавлен `boto3>=1.34.0`
- Изменён `backend/app/config.py` — 6 новых полей Settings: s3_endpoint, s3_access_key, s3_secret_key, s3_bucket, attachment_max_size (10MB), attachment_url_ttl (3600)
- Изменён `backend/app/models.py` — добавлены импорты Attachment, Comment для ORM mapper registration
- Изменён `backend/app/main.py` — MODULE_NAMES расширен ("comments", "attachments"); lifespan: `await _storage.ensure_bucket()` перед RabbitMQ consumer

**Архитектура:** signed URL использует S3_ENDPOINT (docker-internal); для внешнего доступа нужен публичный endpoint (пост-MVP). Order: put→DB (не DB→put) предотвращает orphan DB records без файлов. boto3.delete_object idempotent для несуществующих ключей.

## FEAT-0012 — Comments service + router (бизнес-логика + @mentions) — 2026-05-17

Статус: DONE (CTO approved, без issues)

**Создано 2 файла.**

- Создан `backend/app/comments/service.py` — три функции: `list_comments(session, task_id)` (SELECT+selectinload author ORDER BY created_at ASC); `create_comment(session, task_id, author_id, body)` (404 если task не найдена, regex `@(\w+)` → set() для дедупликации, JOIN User+WorkspaceMember с `func.lower().in_()` для case-insensitive resolve, mentions хранятся как `list[str]` в JSONB, Notification для каждого mention кроме self, commit, re-query с selectinload); `delete_comment(session, comment_id, actor)` (404 если не найден, 403 если не автор и не ADMIN/OWNER)
- Создан `backend/app/comments/router.py` — `APIRouter(tags=["comments"])`, три эндпоинта: GET /tasks/{task_id}/comments (200), POST /tasks/{task_id}/comments (201), DELETE /comments/{comment_id} (204); все с Depends(get_current_user)+Depends(get_session); main.py не изменён

**Архитектура:** mentions дедуплицируются через set comprehension перед query. `create_notification` из notifications.service вызывается напрямую без изменения файлов notifications/. Роутер подключается в T-050. `CommentResponse.model_validate(comment)` работает через from_attributes + автоматическую коерсию вложенного User → CommentAuthor.

## FEAT-0011 — Scaffolding модуля attachments (models + schemas) — 2026-05-17

Статус: DONE (CTO approved, без issues)

**Создано 3 файла.**

- Создан `backend/app/attachments/__init__.py` — пустой маркер пакета
- Создан `backend/app/attachments/models.py` — SQLAlchemy 2.0 модель `Attachment`; `__tablename__ = "attachment"`; колонки: id (uuid PK), task_id (FK→tasks CASCADE, index), filename/content_type (Text nullable), size (Integer nullable), storage_key (Text NOT NULL), uploaded_by (UUID FK→users nullable, index), created_at (TIMESTAMPTZ now()); relationship `uploader = relationship("User")`; **url отсутствует** как колонка
- Создан `backend/app/attachments/schemas.py` — `AttachmentUploader{id, name}` (from_attributes), `AttachmentResponse{id, task_id, filename|None, content_type|None, size|None, url: str, uploaded_by: AttachmentUploader|None, created_at}` (from_attributes); `storage_key` не экспонируется в схеме

**Архитектура:** `url` — вычисляемое поле; T-050 вызывает `StorageService.presign(storage_key)` и собирает response вручную через `model_validate({...obj_dict, "url": signed_url})`. `storage_key` не попадает в API-ответ. Разблокирует T-050.

## FEAT-0010 — Scaffolding модуля comments (models + schemas) — 2026-05-17

Статус: DONE (CTO approved, без issues)

**Создано 3 файла.**

- Создан `backend/app/comments/__init__.py` — пустой маркер пакета
- Создан `backend/app/comments/models.py` — SQLAlchemy 2.0 модель `Comment`; `__tablename__ = "comment"`; колонки: id (uuid PK gen_random_uuid()), task_id (FK→tasks CASCADE, index), author_id (FK→users, index), body (Text NOT NULL), mentions (JSONB NOT NULL server_default '[]'::jsonb), created_at (TIMESTAMPTZ now()); relationship `author = relationship("User")` для JOIN в T-049
- Создан `backend/app/comments/schemas.py` — три Pydantic-схемы: `CommentCreate{body: str}` (input, без from_attributes), `CommentAuthor{id, name}` (from_attributes=True), `CommentResponse{id, task_id, author: CommentAuthor, body, mentions: list[UUID], created_at}` (from_attributes=True)

**Архитектура:** `mentions` хранится как JSONB-массив строк UUID в БД; Pydantic автоматически коерсирует строки → UUID при сериализации CommentResponse. `author` relationship без back_populates — T-049 управляет загрузкой (selectin/joined). Нет бизнес-логики — только декларации.

## FEAT-0009 — Инфраструктура: comment+attachment миграция + MinIO — 2026-05-17

Статус: DONE (CTO approved, без issues)

**Создано 3 файла, изменён 1.**

- Создан `backend/alembic/versions/20260517_000005_comments_attachments.py` — ручная миграция (без autogenerate), revision `20260517_000005`, down_revision `20260517_000004`; таблицы `comment` (id/task_id/author_id/body/mentions jsonb/created_at) и `attachment` (id/task_id/filename/content_type/size/storage_key/uploaded_by/created_at); FK → tasks.id с ON DELETE CASCADE; FK → users.id без cascade; индексы на task_id для обеих таблиц; downgrade: DROP attachment → DROP comment
- Изменён `docker-compose.yml` — добавлен сервис `minio` (image minio/minio, command server /data --console-address :9001, порты 9000/9001, volume minio_data, healthcheck mc ready local); backend.depends_on добавлен `minio: condition: service_healthy`; backend.environment добавлены S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET/ATTACHMENT_MAX_SIZE/ATTACHMENT_URL_TTL с дефолтами; volume minio_data добавлен
- Создан `.env.example` — полный шаблон ENV без реальных секретов; секция MinIO/S3 с 6 переменными (S3_ENDPOINT=http://minio:9000, S3_ACCESS_KEY=minioadmin, S3_SECRET_KEY=minioadmin, S3_BUCKET=victory-attachments, ATTACHMENT_MAX_SIZE=10485760, ATTACHMENT_URL_TTL=3600)

**Архитектура:** Миграция-first подход: T-046/T-047 (authors ORM-моделей) могут сверять имена колонок. ON DELETE CASCADE на task_id обеспечивает автоочистку данных при удалении задачи. StorageService (T-050) создаёт bucket при инициализации — в этой задаче не реализован.

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
