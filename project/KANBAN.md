# Kanban

## Iteration I-05 (active) — Цель: workspace onboarding + автоматизации + дубликаты

**DoD:**
- Новый пользователь после регистрации видит форму создания workspace, после — попадает на доску
- `/` редиректит на `/board` (убрана debug-страница)
- Admin UI правил автоматизации работает с реальной бэкенд-схемой (structured поля вместо JSON-textarea)
- `POST /api/v1/tasks` с похожим названием → 409 + candidates; фронт показывает диалог выбора
- Правило `auto_assign_balanced` назначает задачу участнику с минимальным числом активных задач

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-024 | Workspace onboarding: create page + root redirect | frontend | — | todo | #52 | `frontend/app/page.tsx`, `frontend/app/(app)/workspace/create/page.tsx`, `frontend/app/(app)/board/BoardPageClient.tsx` |
| T-025 | Fix automation admin UI (schema + structured form) | frontend | — | todo | #53 | `frontend/components/admin/AutomationRules.tsx` |
| T-026 | Auto load-balancing: action type + consumer | automation | — | todo | #54 | `backend/app/automation/schemas.py`, `backend/app/events/consumer.py` |
| T-027 | Duplicate detection: backend 409 + candidates | tasks | — | todo | #55 | `backend/app/tasks/service.py`, `backend/app/tasks/router.py` |
| T-028 | Duplicate detection: frontend modal | frontend | — | todo | #56 | `frontend/components/board/DuplicateModal.tsx`, `frontend/components/board/AddTaskForm.tsx` |

## Iteration I-04 (closed, tag: iter-04-stable) — Цель: уведомления + admin-панель

**DoD:**
- Колокольчик в шапке показывает badge с непрочитанными; клик открывает панель, mark-as-read работает
- `POST /api/v1/workspaces/{id}/automation` → создаёт правило; `GET` → список правил
- После события задачи consumer записывает `Notification` в БД для каждого участника workspace
- `/admin` страница: редактор колонок + список правил автоматизации

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-020 | Notification bell + unread panel | frontend | @frakin-000 | done | #44 | `frontend/components/notifications/NotificationBell.tsx`, `frontend/app/(app)/AppShell.tsx` |
| T-021 | Consumer: persist notifications + automation hook | notifications | @xionter | done | #46 | `backend/app/notifications/service.py`, `backend/app/events/consumer.py` |
| T-022 | Automation: service + router (CRUD rules) | automation | @xionter | done | #45 | `backend/app/automation/service.py`, `backend/app/automation/router.py` |
| T-023 | Admin page: column editor + automation rules UI | frontend | @pavilk | done | #47 | `frontend/app/(app)/admin/page.tsx`, `frontend/components/admin/ColumnEditor.tsx`, `frontend/components/admin/AutomationRules.tsx`, `frontend/components/sidebar/Sidebar.tsx` |

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
