# Kanban

## Iteration I-17 (active) — Цель: Automation расширение + AI Grooming (backend + frontend wizard)

**DoD:**
- `POST /api/v1/ai/groom/start` → session_id + questions от LLM
- `POST /api/v1/ai/groom/complete` → task_draft (title/description/priority/tags)
- `/ai-groom` → 3-шаговый wizard: описание → вопросы → драфт → «Создать задачу»
- Automation engine выполняет actions `set_priority` и `set_assignee`
- `/automation` → standalone страница с rule builder и расширенными action types

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-095 | AI: groom.py — LLM-клиент + prompt templates | ai | — | todo | #200 | `backend/app/ai/groom.py`, `backend/app/ai/__init__.py` |
| T-096 | AI: router.py (groom/start + groom/complete) | ai | — | todo | #201 | `backend/app/ai/router.py` |
| T-097 | AI grooming frontend: api + типы | frontend | — | todo | #202 | `frontend/lib/ai-api.ts` |
| T-098 | AI grooming: wizard-страница /ai-groom | frontend | — | todo | #203 | `frontend/app/(app)/ai-groom/page.tsx`, `frontend/components/ai/GroomingWizard.tsx` |
| T-099 | Automation: action types set_priority + set_assignee в engine | automation | — | todo | #204 | `backend/app/automation/service.py` |
| T-100 | Automation: standalone страница /automation + AutomationManager | frontend | — | todo | #205 | `frontend/app/(app)/automation/page.tsx`, `frontend/components/automation/AutomationManager.tsx` |

## Iteration I-16 (closed) — Цель: «Мои задачи» — личная очередь задач в sidebar

**DoD:**
- `/my-tasks` → вкладка «Мои задачи»: группы Важные / Входящие / Выполненные с collapse и счётчиком
- Вкладка «Чужие задачи» → задачи сгруппированы по исполнителю (аватар + имя + expand)
- `GET /api/v1/workspaces/{id}/me/tasks?view=mine|others&sort=priority|deadline|assignee` работает
- «Порученные мной» и «Избранные» → empty state «Скоро»
- Sidebar-ссылка добавляется после закрытия I-14 (layout.tsx залочен)

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-089 | Workspace: GET /me/tasks (view=mine\|others + sort + search) | workspace | — | todo | #189 | `backend/app/workspace/router.py` |
| T-090 | My Tasks frontend: api + типы | frontend | — | todo | #190 | `frontend/lib/my-tasks-api.ts` |
| T-091 | My Tasks: TaskRow компонент (строка задачи) | frontend | — | todo | #191 | `frontend/components/my-tasks/TaskRow.tsx` |
| T-092 | My Tasks: TaskGroup (collapse + счётчик + иконки) | frontend | — | todo | #192 | `frontend/components/my-tasks/TaskGroup.tsx` |
| T-093 | My Tasks: страница + 4 вкладки + группировка | frontend | — | todo | #194 | `frontend/components/my-tasks/MyTasksPage.tsx`, `frontend/app/(app)/my-tasks/page.tsx` |

## Iteration I-15 (closed) — Цель: Event Log в sidebar + TaskPanel справа вместо модального окна

**DoD:**
- `/event-log` → лента событий workspace, сгруппированная по датам; переключатель карточки ↔ таблица
- Фильтр-вкладки: Все / Удалённые объекты / Загруженные файлы / Общение
- `GET /api/v1/workspaces/{id}/audit-log?event_type=&board_id=` фильтрует и пагинирует
- Клик по задаче на доске → правая панель slide-in с полным содержимым задачи
- Sidebar-ссылка деферрится до закрытия I-14 (layout.tsx залочен)

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-083 | Audit: фильтр event_type + board_id в audit-log endpoint | audit | — | todo | #180 | `backend/app/audit/router.py` |
| T-084 | Event Log frontend: api + типы | frontend | — | todo | #181 | `frontend/lib/event-log-api.ts` |
| T-085 | Event Log: EventCard + EventTable компоненты | frontend | — | todo | #182 | `frontend/components/event-log/EventCard.tsx`, `frontend/components/event-log/EventTable.tsx` |
| T-086 | Event Log: EventLogPanel (фильтры + вид-toggle) + страница | frontend | — | todo | #183 | `frontend/components/event-log/EventLogPanel.tsx`, `frontend/app/(app)/event-log/page.tsx` |
| T-087 | TaskPanel: компонент детали задачи справа | frontend | — | todo | #184 | `frontend/components/board/TaskPanel.tsx` |
| T-088 | TaskPanel: wiring в KanbanBoard (replace modal) | frontend | — | todo | #185 | `frontend/components/board/KanbanBoard.tsx` |

## Iteration I-14 (closed) — Цель: Board UX — управление колонками + создание досок + realtime-баги

**DoD:**
- Owner/admin: «+ Колонка», меню колонки (rename / ←→ / delete с confirm) — через API, без reload
- Sidebar: «+ Новая доска» → dialog → POST → доска в switcher'е без reload
- TaskCard: `deadline_urgency=soon` → жёлтый индикатор; `critical` → красный
- TaskModal: чекнуть/снять/добавить подзадачу → прогресс-бар меняется мгновенно

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-078 | Column management: api-методы + типы | frontend | — | todo | #168 | `frontend/lib/column-api.ts` |
| T-079 | Column management: UI в Column (rename/←→/delete + создание) | frontend | — | todo | #169 | `frontend/components/board/Column.tsx` |
| T-080 | Create Board: api + CreateBoardDialog + кнопка в sidebar | frontend | — | todo | #170 | `frontend/lib/board-api.ts`, `frontend/components/board/CreateBoardDialog.tsx`, `frontend/app/(app)/layout.tsx` |
| T-081 | TaskCard: fix deadline urgency display (soon/critical) | frontend | — | todo | #171 | `frontend/components/board/TaskCard.tsx` |
| T-082 | TaskModal: subtask progress bar real-time | frontend | — | todo | #172 | `frontend/components/board/TaskModal.tsx` |

## Iteration I-13 (closed) — Цель: Analytics frontend (3 чарта) + Notifications mark-all-read

**DoD:**
- `/board/{boardId}/analytics` рендерит три секции: Donut «по статусу», Line «прогресс + done%», Bar «нагрузка по assignee»
- Данные грузятся с `GET /api/v1/boards/{id}/analytics/overview|progress?range=week|workload`
- Loading-скелетоны и empty state на каждом чарте
- `PATCH /api/v1/notifications/read-all?workspace_id={id}` → 200, все unread записи юзера → `read=true`

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-072 | Analytics frontend: api-методы + типы | frontend | — | done | #151 | `frontend/lib/analytics-api.ts` |
| T-073 | Analytics: OverviewChart (donut по статусу) | frontend | — | done | #152 | `frontend/components/analytics/OverviewChart.tsx` |
| T-074 | Analytics: ProgressChart (line + done_pct %) | frontend | @frakin-000 | in progress | #154 | `frontend/components/analytics/ProgressChart.tsx` |
| T-075 | Analytics: WorkloadChart (bar по assignee) | frontend | — | todo | #155 | `frontend/components/analytics/WorkloadChart.tsx` |
| T-076 | Analytics: страница /board/[boardId]/analytics | frontend | — | todo | #156 | `frontend/app/(app)/board/[boardId]/analytics/page.tsx` |
| T-077 | Notifications: PATCH /notifications/read-all | notifications | @xionter | done | #157 | `backend/app/notifications/router.py` |

## Iteration I-12 (closed) — Цель: Admin panel — управление workspace для owner/admin

**DoD:**
- `/admin` как owner/admin → три вкладки (Members / Automation / Settings) работают, данные грузятся с бэкенда
- Members: список членов, invite по email с ролью, Remove для не-owner членов
- Automation: список правил с trigger/condition/action, создание + toggle active + удаление
- Settings: toggle `automation_enabled` → `PATCH /workspaces/{id}/settings` → 200
- `/admin` как member → заглушка «нет доступа»

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-067 | Admin: типы + api-методы (members, rules, settings) | frontend | — | todo | #138 | `frontend/lib/admin-types.ts`, `frontend/lib/admin-api.ts` |
| T-068 | Admin: вкладка Members (список + invite + remove) | frontend | — | todo | #139 | `frontend/components/admin/MembersTab.tsx` |
| T-069 | Admin: вкладка Automation (список + создать + toggle + удалить) | frontend | — | todo | #140 | `frontend/components/admin/AutomationTab.tsx` |
| T-070 | Admin: вкладка Settings (automation_enabled toggle) | frontend | — | todo | #141 | `frontend/components/admin/SettingsTab.tsx` |
| T-071 | Admin: страница /admin с вкладками + role-guard | frontend | — | todo | #142 | `frontend/app/(app)/admin/page.tsx` |

## Iteration I-11 (closed) — Цель: Фаза 5 — Analytics backend (live-агрегации + снапшоты)

**DoD:**
- `GET /api/v1/boards/{id}/analytics/overview` → `{ by_status: [{column_id, column_name, count}], total }`
- `GET /api/v1/boards/{id}/analytics/progress?range=week|month` → `{ done_pct, trend: [{date, done, total}] }`
- `GET /api/v1/boards/{id}/analytics/workload` → `{ by_assignee: [{assignee_id, name, count, done}] }`
- `alembic upgrade head` создаёт таблицу `board_metric_snapshot`
- Snapshot writer пишет снапшот раз в час (фоновая задача, видно в логах)
- `pytest backend/tests/analytics` — все тесты зелёные

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-062 | Alembic: миграция board_metric_snapshot | infra | — | todo | #132 | `backend/alembic/versions/20260518_000006_analytics.py` |
| T-063 | Analytics: модели + схемы | analytics | — | todo | #133 | `backend/app/analytics/models.py`, `backend/app/analytics/schemas.py`, `backend/app/analytics/__init__.py` |
| T-064 | Analytics: service — live-агрегации | analytics | — | todo | #134 | `backend/app/analytics/service.py` |
| T-065 | Analytics: snapshot writer (фоновая задача) | analytics | — | todo | #135 | `backend/app/analytics/snapshot.py` |
| T-066 | Analytics: router + регистрация в main.py | analytics | — | todo | #136 | `backend/app/analytics/router.py`, `backend/app/main.py` |

## Iteration I-10 (closed) — Цель: техдолг T-B02 — WsClient переиспользуем (параметры в connect())

**DoD:** `new WsClient()` без аргументов; `client.connect(workspaceId, getToken)` коннектит; `WsContext.init()` на новой сигнатуре; смена воркспейса по-прежнему переподключает WS; `npx tsc --noEmit` чисто

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-060 | WsClient: параметры из конструктора в connect(workspaceId, getToken) | frontend | — | todo | #126 | `frontend/lib/ws.ts` |
| T-061 | WsContext: переход на новую сигнатуру connect() | frontend | — | todo | #127 | `frontend/contexts/WsContext.tsx` |

## Iteration I-09 (closed) — Цель: Фаза 3 — представления Table + Calendar поверх задач

**DoD:**
- `GET /workspaces/{id}/tasks?board_id=&page=&page_size=&sort=` → `{items,total,page,page_size}`; без `page` — массив (обратная совместимость)
- `sort` поддерживает `created_at|deadline|priority|title` с префиксом `-` (desc)
- `?deadline_from=&deadline_to=` фильтрует по `Task.deadline` включительно
- Вкладки Board / Table / Calendar на странице доски переключают представление
- Table: сортируемые колонки, пагинация; Calendar: сетка месяца, задачи в днях по deadline
- FilterSortBar: фильтр по assignee/tag/priority + выбор сортировки, общий для Table/Calendar

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-054 | Tasks: пагинация + сортировка + deadline-range в list | tasks | — | todo | #120 | `backend/app/tasks/service.py`, `backend/app/tasks/router.py` |
| T-055 | Frontend: типы представлений + api-методы | frontend | — | todo | #121 | `frontend/lib/types.ts`, `frontend/lib/api.ts` |
| T-056 | Frontend: FilterSortBar (assignee/tag/priority/sort) | frontend | — | todo | #122 | `frontend/components/views/FilterSortBar.tsx` |
| T-057 | Frontend: TableView (колонки + сортировка + пагинация) | frontend | — | todo | #123 | `frontend/components/views/TableView.tsx` |
| T-058 | Frontend: CalendarView (сетка месяца по deadline) | frontend | — | todo | #124 | `frontend/components/views/CalendarView.tsx` |
| T-059 | Frontend: ViewTabs + врезка в страницу доски | frontend | — | todo | #125 | `frontend/components/views/ViewTabs.tsx`, `frontend/app/(app)/board/BoardPageClient.tsx` |

## Iteration I-08 (closed) — Цель: завершение Фазы 2 — комментарии + вложения

**DoD:**
- `POST /api/v1/tasks/{id}/comments` создаёт комментарий; `@имя` в теле → `Notification` упомянутому
- `GET /api/v1/tasks/{id}/comments` → лента с автором и timestamp; `DELETE /api/v1/comments/{id}` → 204
- `POST /api/v1/tasks/{id}/attachments` (multipart) → файл в MinIO + signed URL; лимит 10MB + whitelist типов (413/415)
- `GET /api/v1/tasks/{id}/attachments` → список; `DELETE /api/v1/attachments/{id}` → 204
- `alembic upgrade head` на непустой БД проходит; `docker compose up` поднимает MinIO
- TaskModal: секция «Комментарии» (лента + ввод + @mention) + секция «Вложения» (drag-drop, превью, «+N»)

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-046 | Comment: модели + схемы (новый модуль) | comments | — | done | #105 | `backend/app/comments/models.py`, `backend/app/comments/schemas.py`, `backend/app/comments/__init__.py` |
| T-047 | Attachment: модели + схемы (новый модуль) | attachments | — | done | #106 | `backend/app/attachments/models.py`, `backend/app/attachments/schemas.py`, `backend/app/attachments/__init__.py` |
| T-048 | Alembic: миграция comment+attachment + MinIO в compose | infra | — | done | #107 | `backend/alembic/versions/20260517_000005_comments_attachments.py`, `docker-compose.yml`, `.env.example` |
| T-049 | Comments: service + router + @mentions→Notification | comments | — | done | #108 | `backend/app/comments/service.py`, `backend/app/comments/router.py` |
| T-050 | Attachments: service + StorageService + router + main.py | attachments | — | done | #109 | `backend/app/attachments/service.py`, `backend/app/attachments/storage.py`, `backend/app/attachments/router.py`, `backend/app/main.py` |
| T-051 | Frontend: типы + api (Comment, Attachment, multipart) | frontend | — | done | #110 | `frontend/lib/types.ts`, `frontend/lib/api.ts` |
| T-052 | Frontend: CommentFeed + AttachmentList компоненты | frontend | — | done | #111 | `frontend/components/board/CommentFeed.tsx`, `frontend/components/board/AttachmentList.tsx` |
| T-053 | Frontend: TaskModal — секции комментариев + вложений | frontend | — | done | #112 | `frontend/components/board/TaskModal.tsx` |

## Iteration I-07 (closed) — Цель: богатые задачи — теги + подзадачи

**DoD:**
- `GET /api/v1/boards/{id}/tags` → список тегов доски; `POST` создаёт тег; `DELETE` удаляет
- `POST/DELETE /api/v1/tasks/{id}/tags/{tag_id}` — привязка тега к задаче
- `GET/POST/PATCH/DELETE /api/v1/tasks/{id}/subtasks` — CRUD подзадач
- `GET /api/v1/boards/{id}` — каждая задача содержит `tags:[{id,name,color}]` + `subtask_progress:{done_count,total_count}`
- `alembic upgrade head` на непустой БД проходит; существующие теги-строки мигрируют в Tag
- Карточка задачи показывает прогресс-бар подзадач (done/total)
- TaskModal: секция «Подзадачи» (чеклист + добавление) + секция «Теги» (пилюли + dropdown)

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-038 | Tags: модели + схемы (новый модуль) | tags | — | done | #88 | `backend/app/tags/models.py`, `backend/app/tags/schemas.py`, `backend/app/tags/__init__.py` |
| T-039 | Subtask: модель + схема (в tasks модуле) | tasks | — | done | #89 | `backend/app/tasks/models.py`, `backend/app/tasks/schemas.py` |
| T-040 | Alembic: миграция tags + subtasks | infra | — | done | #90 | `backend/alembic/versions/20260517_000004_tags_subtasks.py` |
| T-041 | Tags: service + router + регистрация в main | tags | — | done | #91 | `backend/app/tags/service.py`, `backend/app/tags/router.py`, `backend/app/main.py` |
| T-042 | Tasks: subtask CRUD (service + router) | tasks | — | done | #92 | `backend/app/tasks/service.py`, `backend/app/tasks/router.py` |
| T-043 | Frontend: типы Subtask + Tag + api-методы | frontend | — | done | #93 | `frontend/lib/types.ts`, `frontend/lib/api.ts` |
| T-044 | Frontend: SubtaskList + прогресс-бар на TaskCard | frontend | — | done | #94 | `frontend/components/board/SubtaskList.tsx`, `frontend/components/board/TaskCard.tsx` |
| T-045 | Frontend: TaskModal — секция подзадач + теги | frontend | — | done | #95 | `frontend/components/board/TaskModal.tsx` |

## Iteration I-06 (closed) — Цель: управление участниками + навигация воркспейсов/досок

**DoD:**
- `POST /api/v1/workspaces/{id}/members` (`{email, role}`) → добавляет участника; 404 если email не найден, 409 если уже участник
- `DELETE /api/v1/workspaces/{id}/members/{user_id}` → 204
- `PATCH /api/v1/workspaces/{id}/settings` (`{automation_enabled}`) → обновляет настройки
- Admin-страница показывает список участников с формой приглашения и кнопками удаления
- Тоггл `automation_enabled` в admin-панели работает
- Dropdown смены воркспейса в AppShell; Sidebar показывает секции Boards + Favorites

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-032 | api.ts + types.ts — addMember, removeMember, updateSettings | frontend | — | done | #76 | `frontend/lib/api.ts`, `frontend/lib/types.ts` |
| T-033 | MemberManager — список участников + приглашение + удаление | frontend | — | done | #77 | `frontend/components/admin/MemberManager.tsx` |
| T-034 | WorkspaceSettings — тоггл automation_enabled | frontend | — | done | #78 | `frontend/components/admin/WorkspaceSettings.tsx` |
| T-035 | AdminPageClient — wire-up MemberManager + WorkspaceSettings | frontend | — | done | #79 | `frontend/app/(app)/admin/AdminPageClient.tsx` |
| T-036 | Sidebar — секции Boards + Favorites (деферировано из I-05) | frontend | — | done | #80 | `frontend/components/sidebar/Sidebar.tsx` |
| T-037 | WorkspaceSwitcher — dropdown смены воркспейса в AppShell | frontend | — | done | #81 | `frontend/components/workspace/WorkspaceSwitcher.tsx`, `frontend/app/(app)/AppShell.tsx` |

## Iteration I-05 (closed) — Цель: многодосочность — N досок в workspace + проекты + избранное

**DoD:**
- `alembic upgrade head` на непустой БД проходит; старые задачи видны на доске «Main»
- `GET /workspaces/{id}/boards` → список с `is_favorite`; `POST` создаёт вторую доску
- `GET /boards/{id}` → доска с колонками+задачами; `POST/DELETE /boards/{id}/favorite` меняет флаг
- `GET/POST /workspaces/{id}/projects` → CRUD; `board.project_id` привязывается
- `POST /tasks` дедупит по `(board_id, column_id, title)`
- `/board` редиректит на избранную/первую доску; переключатель в шапке меняет boardId

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-024 | Project: модели + схемы | project | — | done | #61 | `backend/app/project/models.py`, `backend/app/project/schemas.py`, `backend/app/project/__init__.py` |
| T-025 | Board: модели (project_id, description) + BoardFavorite + схемы | board | — | done | #62 | `backend/app/board/models.py`, `backend/app/board/schemas.py` |
| T-026 | Tasks: board_id в модель + схему | tasks | — | done | #63 | `backend/app/tasks/models.py`, `backend/app/tasks/schemas.py` |
| T-027 | Alembic: миграция multiboard + backfill «Main» | infra | — | done | #64 | `backend/alembic/versions/20260516_000003_multiboard.py` |
| T-028 | Board: service + router (boards CRUD + favorite) | board | — | done | #65 | `backend/app/board/service.py`, `backend/app/board/router.py` |
| T-029 | Project: service + router + регистрация в main | project | — | done | #66 | `backend/app/project/service.py`, `backend/app/project/router.py`, `backend/app/main.py` |
| T-030 | Tasks: board_id, дедуп (board,column,title), фильтр ?board_id | tasks | — | done | #67 | `backend/app/tasks/service.py`, `backend/app/tasks/router.py` |
| T-031 | Frontend: переключатель досок + роут `/board/[boardId]` | frontend | — | done | #68 | `frontend/app/(app)/board/[boardId]/page.tsx`, `frontend/app/(app)/board/page.tsx`, `frontend/app/(app)/board/BoardPageClient.tsx`, `frontend/components/board/BoardSwitcher.tsx`, `frontend/lib/api.ts`, `frontend/lib/types.ts` |

## Iteration I-04.5 (closed) — Цель: дополнительные фичи (параллельная сессия)

> Задачи созданы в параллельной сессии /new-iter, не пересекаются с I-05 по файлам.

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-024* | Workspace onboarding: create page + root redirect | workspace | — | done | #52 | — |
| T-025* | Fix automation admin UI (schema + structured form) | automation | — | done | #53 | — |
| T-026* | Auto load-balancing: action type + consumer | events | — | done | #54 | — |
| T-027* | Duplicate detection: backend 409 + candidates | tasks | — | done | #55 | — |
| T-028* | Duplicate detection: frontend modal | frontend | — | done | #56 | — |

## Iteration I-04 (closed) — Цель: уведомления + admin-панель

**DoD:**
- Колокольчик в шапке показывает badge с непрочитанными; клик открывает панель, mark-as-read работает
- `POST /api/v1/workspaces/{id}/automation` → создаёт правило; `GET` → список правил
- После события задачи consumer записывает `Notification` в БД для каждого участника workspace
- `/admin` страница: редактор колонок + список правил автоматизации

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-020 | Notification bell + unread panel | frontend | — | done | #44 | `frontend/components/notifications/NotificationBell.tsx`, `frontend/app/(app)/AppShell.tsx` |
| T-021 | Consumer: persist notifications + automation hook | notifications | — | done | #46 | `backend/app/notifications/service.py`, `backend/app/events/consumer.py` |
| T-022 | Automation: service + router (CRUD rules) | automation | — | done | #45 | `backend/app/automation/service.py`, `backend/app/automation/router.py` |
| T-023 | Admin page: column editor + automation rules UI | frontend | — | done | #47 | `frontend/app/(app)/admin/page.tsx`, `frontend/components/admin/ColumnEditor.tsx`, `frontend/components/admin/AutomationRules.tsx`, `frontend/components/sidebar/Sidebar.tsx` |

## Iteration I-03 (closed, tag: iter-03-stable) — Цель: трекер задач — полное управление задачами

**DoD:**
- `GET /api/v1/workspaces/{id}/members` → список участников (для выбора assignee)
- Кнопка «+ Добавить задачу» → форма с title, description, priority, deadline → задача создаётся в колонке
- Клик на карточку → модальное окно: полные поля, кнопки Edit / Delete
- Редактирование → PATCH → оптимистичный update; остальные клиенты получают WS board.task_updated
- Удаление → DELETE → оптимистичное удаление из доски
- Sidebar: имя workspace, имя пользователя, кнопка Logout

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-015 | Backend: GET /workspaces/{id}/members | workspace | @xionter | done | #32 | `backend/app/workspace/service.py`, `backend/app/workspace/router.py` |
| T-016 | TaskModal: просмотр + редактирование + удаление | frontend | — | done | #33 | `frontend/components/board/TaskModal.tsx` |
| T-017 | Board: TaskCard click + modal wiring + delete handler | frontend | @pavilk | done | #34 | `frontend/components/board/TaskCard.tsx`, `frontend/app/(app)/board/page.tsx` |
| T-018 | AddTaskForm: полные поля + обновить create callback | frontend | — | done | #35 | `frontend/components/board/AddTaskForm.tsx`, `frontend/app/(app)/board/page.tsx` |
| T-019 | Sidebar: workspace name, user info, logout | frontend | @frakin-000 | done | #36 | `frontend/components/sidebar/Sidebar.tsx` |

## Iteration I-02 (closed, tag: iter-02-stable) — Цель: рабочая канбан-доска end-to-end

**DoD:**
- `POST /api/v1/workspaces` → `{workspace: {id, name, slug, role: "owner"}}`
- `GET /api/v1/workspaces/{id}/board` → `{board: {id, columns: [{id, name, tasks:[...]}]}}`
- `POST /api/v1/tasks` → 200, событие уходит в RabbitMQ
- `PUT /api/v1/tasks/{id}/move` → 200, через WS клиент получает `board.task_moved`
- `localhost:3000/login` → форма → вход → редирект на доску
- `localhost:3000/board` → drag-drop карточек работает, Event Log обновляется в реальном времени

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-009 | Workspace: service + router | workspace | @xionter | done | #18 | `backend/app/workspace/service.py`, `backend/app/workspace/router.py` |
| T-010 | Board: service + router (board + columns CRUD) | board | @xionter | done | #19 | `backend/app/board/service.py`, `backend/app/board/router.py` |
| T-011 | Tasks: service + router (CRUD + move + deadline_urgency + dedup + publish) | tasks | @xionter | done | #20 | `backend/app/tasks/service.py`, `backend/app/tasks/router.py` |
| T-012 | Frontend: auth pages (login + register) | frontend | @pavilk | done | #21 | `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/register/page.tsx`, `frontend/app/(auth)/layout.tsx` |
| T-013 | Frontend: board page + kanban components | frontend | @profitist | done | #22 | `frontend/app/(app)/board/page.tsx`, `frontend/components/board/KanbanBoard.tsx`, `frontend/components/board/Column.tsx`, `frontend/components/board/TaskCard.tsx` |
| T-014 | Frontend: app layout + EventLogPanel | frontend | @pavilk | done | #23 | `frontend/app/(app)/layout.tsx`, `frontend/components/event-log/EventLogPanel.tsx` |

## Iteration I-01 (closed, tag: iter-01-stable) — Цель: scaffolding всех модулей + Docker Compose + контракты как код

**DoD:**
- `docker compose up` поднимает backend, frontend, postgres, rabbitmq без ошибок
- `GET /api/v1/health` → `{"status": "ok"}`
- `POST /api/v1/auth/register` с невалидным телом → 422 (Pydantic работает)
- `localhost:3000` открывается в браузере
- Все SQLAlchemy-модели описаны, `alembic upgrade head` проходит без ошибок
- RabbitMQ consumer запускается в lifespan без падения

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-001 | Docker Compose: все сервисы + .env.example | infra | — | done | #1 | `docker-compose.yml`, `.env.example` |
| T-002 | Backend: main.py + config + async DB | backend | @xionter | done | #2 | `backend/app/main.py`, `backend/app/config.py`, `backend/app/database.py` |
| T-003 | SQLAlchemy-модели всех модулей + Alembic init | backend | @xionter | done | #3 | `backend/app/auth/models.py`, `backend/app/workspace/models.py`, `backend/app/board/models.py`, `backend/app/tasks/models.py`, `backend/app/automation/models.py`, `backend/app/notifications/models.py`, `backend/app/audit/models.py`, `backend/alembic/` |
| T-004 | Pydantic-схемы всех модулей | backend | @profitist | done | #4 | `backend/app/auth/schemas.py`, `backend/app/workspace/schemas.py`, `backend/app/board/schemas.py`, `backend/app/tasks/schemas.py`, `backend/app/automation/schemas.py`, `backend/app/notifications/schemas.py`, `backend/app/audit/schemas.py` |
| T-005 | Auth: JWT utils + register/login/refresh/logout | auth | @pavilk | done | #5 | `backend/app/auth/service.py`, `backend/app/auth/router.py` |
| T-006 | RabbitMQ: EventEnvelope + publisher + consumer skeleton | events | @frakin-000 | done | #6 | `backend/app/events/types.py`, `backend/app/events/publisher.py`, `backend/app/events/consumer.py` |
| T-007 | WebSocket hub + JSON-RPC builder + WS endpoint | notifications | — | done | #7 | `backend/app/notifications/hub.py`, `backend/app/notifications/jsonrpc.py`, `backend/app/notifications/router.py` |
| T-008 | Frontend: providers + api.ts + ws.ts + types.ts | frontend | @pavilk | done | #8 | `frontend/app/providers.tsx`, `frontend/lib/api.ts`, `frontend/lib/ws.ts`, `frontend/lib/types.ts` |

## Backlog (I-02+)

| ID | Title | Module | Причина откладывания |
|----|-------|--------|----------------------|
| T-B01 | Auth: перевести refresh_token на httpOnly cookie | auth + frontend | Бэкенд сейчас возвращает токены в теле ответа. Нужно: бэкенд ставит `Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict`, фронт убирает sessionStorage и переходит на `credentials: 'include'`. Затрагивает `backend/app/auth/router.py` + `frontend/lib/api.ts` + `frontend/app/providers.tsx` |
| T-B02 | WsClient: перенести параметры в connect() | frontend | Сейчас `workspaceId` и `getToken` передаются в конструктор — нельзя переиспользовать один экземпляр для разных workspace. По DESIGN-01 сигнатура должна быть `connect(workspaceId, getToken)`. Затрагивает `frontend/lib/ws.ts` и все места использования. |
| T-B03 | Удалить frontend/proxy.ts | frontend | Файл — заглушка от Clerk, называется `proxy.ts` вместо `middleware.ts` поэтому Next.js его игнорирует. Вводит в заблуждение. Удалить; при необходимости создать реальный `middleware.ts`. |
| T-B04 | Убрать комментарии-секции из types.ts | frontend | `// === Раздел N ===` в `frontend/lib/types.ts` не несут смысловой нагрузки — структура очевидна из названий интерфейсов. Убрать согласно принципам Функциональной Ясности. |
