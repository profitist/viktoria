# Промпт: что НЕ готово в Victory Kanban (оставшийся функционал)

> Источник истины: `project/PROJECT.md` (контракты), `project/KANBAN.md` (статус).
> Здесь — только нереализованные функции. Готовое (I-01…I-03) исключено.
> Формат каждой функции: **Путь создания** / **Бэкенд-компоненты** / **Действия**.

---

## A. I-04 (active) — уведомления + admin-панель. Issues #44–#47

### A1. Колокол уведомлений + панель непрочитанных — T-020 #44 (todo)

- **Путь создания.** Иконка колокола в шапке (`AppShell.tsx`); badge = число непрочитанных;
  клик → выпадающая панель списка; клик по уведомлению → переход к задаче; «mark all read».
- **Бэкенд-компоненты.** `GET /api/v1/notifications?workspace_id={id}&unread=true` →
  `[{id,type,message,read,created_at}]`; `PATCH /api/v1/notifications/{id}/read` → `{}`;
  push новых через WS `notification.created`. Файлы:
  `frontend/components/notifications/NotificationBell.tsx`, `frontend/app/(app)/AppShell.tsx`.
- **Действия.** Показ непрочитанных, открытие панели, отметка прочитанным (сброс badge),
  навигация к источнику, live-обновление badge по WS без рефетча.

### A2. Consumer: запись уведомлений + automation hook — T-021 #46 (todo)

- **Путь создания.** Не UI — срабатывает в pipeline после fanout события задачи.
- **Бэкенд-компоненты.** `backend/app/notifications/service.py`,
  `backend/app/events/consumer.py`. На каждое валидное событие задачи: создать
  `Notification` в БД для каждого участника workspace; вызвать AutomationEngine.
- **Действия.** Персист in-app уведомлений (источник для A1), привязка движка
  автоматизаций к потоку событий, идемпотентность по `event_id`.

### A3. Automation: service + router (CRUD правил) — T-022 #45 (todo)

- **Путь создания.** Кнопка «Automation» / admin-панель → форма правила:
  trigger + condition + action.
- **Бэкенд-компоненты.** `backend/app/automation/service.py`,
  `backend/app/automation/router.py`. Контракт:
  `POST/GET /api/v1/workspaces/{id}/automation-rules`,
  `PATCH/DELETE /api/v1/automation-rules/{id}` (admin_only).
  Rule = trigger(`task.created|task.moved|task.updated|deadline.approaching`)
  + condition(`{field, operator: eq|contains|gt|lt, value}` | null)
  + action(`move_to_column|add_tag|notify_members`, params).
  Движок: `if not workspace.settings.automation_enabled: return`; для активных правил
  проверить `trigger == event_type` и condition, исполнить action.
- **Действия.** CRUD правил **workspace-уровня** (не per-task/per-column); исполнение
  правил из pipeline; запись результата в audit.

### A4. Admin-страница: редактор колонок + правила автоматизации — T-023 #47 (todo)

- **Путь создания.** Пункт в сайдбаре → `/admin`.
- **Бэкенд-компоненты.** Использует существующие контракты board (колонки CRUD,
  admin_only) и A3 (правила). Файлы: `frontend/app/(app)/admin/page.tsx`,
  `frontend/components/admin/ColumnEditor.tsx`,
  `frontend/components/admin/AutomationRules.tsx`,
  `frontend/components/sidebar/Sidebar.tsx`.
- **Действия.** Создание/переименование/удаление/порядок колонок (без drag, через
  position-поле API); список и редактирование правил автоматизации; запись audit.

---

## B. В MVP-scope, итерации НЕТ. Предложить как I-05

### B1. AI-груминг задач

- **Путь создания.** Страница `/ai-groom` → пользователь описывает проблему →
  LLM задаёт уточняющие вопросы → ответы → драфт задачи → правка → создание.
- **Бэкенд-компоненты.** Модуль `backend/app/ai/` (`groom.py` LLM-клиент + промпт-шаблоны,
  `router.py`). `POST /api/v1/ai/groom/start` (`{problem_description, workspace_id}` →
  `{session_id, questions:[{id,text}]}`); `POST /api/v1/ai/groom/complete`
  (`{session_id, answers:[{question_id,answer}]}` → `{task_draft:{title,description,
  priority,tags}}`); затем обычный `POST /tasks`. LLM через OpenAI-совместимый endpoint
  из ENV (`AI_API_URL`, `AI_API_KEY`, `AI_MODEL`). Хранение сессии груминга (in-memory/БД).
- **Действия.** Диалоговая декомпозиция проблемы в структурированный драфт задачи;
  без автосоздания — пользователь подтверждает.

### B2. Управление участниками workspace (invite / remove)

- **Путь создания.** Стек аватаров в шапке / admin-панель → форма приглашения по email,
  удаление участника, смена роли.
- **Бэкенд-компоненты.** `POST /api/v1/workspaces/{id}/members`
  (`{email, role:"admin"|"member"}`, admin_only) →
  `{member:{user_id,email,name,role}}`;
  `DELETE /api/v1/workspaces/{id}/members/{user_id}` (204, admin_only);
  `PATCH /api/v1/workspaces/{id}/settings` (`{automation_enabled?}`, admin_only).
  `GET /workspaces/{id}/members` уже готов (I-03 T-015).
- **Действия.** Расширение/сужение состава доски, RBAC, переключатель
  `automation_enabled` для движка из A3.

---

## C. Технический долг (KANBAN Backlog) — не функции, но «не готово»

- **T-B01.** refresh_token → httpOnly cookie. Сейчас токены в теле ответа.
  Бэкенд: `Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict`
  (`backend/app/auth/router.py`). Фронт: убрать sessionStorage, `credentials:'include'`
  (`frontend/lib/api.ts`, `frontend/app/providers.tsx`).
- **T-B02.** `WsClient`: перенести `workspaceId`/`getToken` из конструктора в
  `connect(workspaceId, getToken)` — переиспользование одного экземпляра
  (`frontend/lib/ws.ts` + все вызовы).
- **T-B03.** Удалить `frontend/proxy.ts` (заглушка Clerk, Next.js её игнорирует —
  вводит в заблуждение); при необходимости создать реальный `middleware.ts`.
- **T-B04.** Убрать комментарии-секции `// === Раздел N ===` из `frontend/lib/types.ts`
  (нарушают принципы Функциональной Ясности — структура очевидна из имён).

---

## Сводка приоритетов

1. **Сейчас:** A1–A4 (I-04, уже корректно в KANBAN.md — правок не требует).
2. **Следующая итерация I-05:** B1 (AI-груминг) + B2 (управление участниками).
3. **Параллельно/по возможности:** C (T-B01…T-B04 — техдолг, T-B01 безопасность приоритетна).
