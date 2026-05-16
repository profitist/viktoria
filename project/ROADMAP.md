# Roadmap развития Victory Kanban (post-MVP)

> Что есть сейчас (I-01…I-04): auth, один workspace = одна доска, задачи CRUD+move,
> event pipeline (RabbitMQ), WS realtime, Event Log, audit, уведомления, admin-панель,
> automation workspace-уровня. AI-груминг — I-05.
>
> Ниже — **всё, чего у нас нет** из дизайн-макета и исходного промпта, собранное в
> большой план развития. Фазы упорядочены по зависимостям: каждая следующая опирается
> на предыдущую. Конвенция модулей — `backend/app/<module>/{router,service,models,schemas}.py`.
> Каждую фазу оформлять через `/new-iter` как одну-две итерации.

---

## Фаза 1 — Многодосочность и структура (фундамент, разблокирует всё)

**Цель:** снять архитектурное ограничение «один workspace = одна доска».

| Компонент | Бэкенд | Фронт |
|---|---|---|
| Board как независимая сущность | `Board(id, workspace_id, name, description, project_id?)`; миграция: существующая доска → запись Board; `GET/POST/PATCH/DELETE /workspaces/{id}/boards` | переключатель досок в шапке (был «заглушён») |
| Projects (группировка досок) | новый модуль `project/`: `Project(id, workspace_id, name)`, CRUD | раздел Projects в сайдбаре |
| Избранное | `BoardFavorite(user_id, board_id)`; `POST/DELETE /boards/{id}/favorite` | звезда в шапке, секция FAVORITES |
| Quick-create dropdown | роутинг на `POST /boards`, `POST /projects`, `POST /tasks` | «+ Create» с вариантами |
| Расширенный сайдбар | агрегаты `GET /overview`, `GET /tasks?assignee=me` | Overview, Boards, Projects, My Tasks |

**Риск:** миграция данных существующих workspace. Сделать первой задачей фазы со scaffolding.
**Зависимости:** нет. **Блокирует:** почти всё ниже.

---

## Фаза 2 — Богатые задачи

**Цель:** довести карточку до уровня макета (теги, подзадачи, комментарии, файлы).

| Компонент | Бэкенд | Фронт |
|---|---|---|
| Теги как сущность | `Tag(id, board_id, name, color)`, `TaskTag`; `GET/POST /boards/{id}/tags`, `POST/DELETE /tasks/{id}/tags/{tagId}`; миграция `tags:[str]` → Tag | палитра тегов доски, цветные пилюли, тег-фильтр |
| Подзадачи | `Subtask(id, task_id, title, is_done, order)`; CRUD + reorder; агрегат done/total | чеклист в модале, прогресс-бар на карточке |
| Комментарии | `Comment(id, task_id, author_id, body, mentions[])`; `POST/GET /tasks/{id}/comments`; парсинг `@mentions` → Notification | поле комментария + лента, отдельно от audit |
| Вложения | `Attachment(...)` + `StorageService` (MinIO/S3); `POST /tasks/{id}/attachments` (multipart), signed URL, лимиты типа/размера | загрузка drag-drop, превью, «+N» |

**Зависимости:** Notification (есть, I-04) для @mentions. **Параллелится** по 4 независимым модулям.

---

## Фаза 3 — Представления данных

**Цель:** вкладки Table / Calendar / Timeline / Files поверх тех же задач.

| Представление | Бэкенд | Фронт |
|---|---|---|
| Table | `GET /boards/{id}/tasks?view=table` (пагинация, сортировка) | таблица в стиле Notion/Linear |
| Calendar | выборка по `deadline` диапазону | месяц/неделя, drag по датам |
| Timeline (Gantt) | `start_date` + `deadline` на Task (миграция) | полосы по датам, зависимости задач |
| Files | агрегат всех `Attachment` доски | галерея вложений |
| Filter/Sort/Group toolbar | параметры list-эндпоинта + `BoardView(saved presets)` | панель условий, сохранённые виды |

**Зависимости:** Фаза 2 (Attachments для Files, Tag для фильтров).

---

## Фаза 4 — Поиск и клавиатурная навигация

**Цель:** мгновенный command-palette поиск (Raycast/Linear-стиль).

- **Бэкенд:** модуль `search/`; индекс PostgreSQL `pg_trgm`/`tsvector` по
  Task.title/description, User.name, Board/Project.name;
  `GET /search?q=&workspace_id=` с ранжированием; быстрые действия (create from query).
- **Фронт:** `cmdk` overlay по `⌘K`/`⌘/`, fuzzy, навигация стрелками, quick actions.
- **Зависимости:** Фаза 1 (есть что искать — доски/проекты).

---

## Фаза 5 — Аналитика

**Цель:** mission-control дашборд (нижние виджеты макета + продвинутые метрики).

- **Бэкенд:** модуль `analytics/`; периодические снапшоты в `BoardMetricSnapshot`
  (cron/consumer), агрегации:
  - `GET /boards/{id}/analytics/overview` — распределение по статусам (донат)
  - `GET /boards/{id}/analytics/progress?range=week` — % done + тренд
  - `GET /boards/{id}/analytics/workload` — задачи по исполнителям
  - продвинутые: throughput, cycle time, blocked tasks, automation efficiency
- **Фронт:** виджеты (recharts), Reports-раздел, экспорт CSV/PDF.
- **Зависимости:** audit/event pipeline (есть) как источник истории.

---

## Фаза 6 — Продвинутая автоматизация

**Цель:** от workspace-правил к per-board/per-task + визуальный билдер.

- **Бэкенд:** расширить `automation/`: scope (`workspace|board|column|task`),
  новые триггеры (`comment.added`, `subtask.completed`, `deadline.approaching`),
  узлы Delay/Integration/Notification, исполнение цепочек.
- **Фронт:** node-editor (React Flow) — Trigger/Condition/Action/Delay/Integration,
  тонкие связи, glow по стилю макета.
- **Зависимости:** Фаза 1 (board scope), Фаза 5 (automation efficiency метрика).

---

## Фаза 7 — Команды, клиенты, агентский режим

**Цель:** превратить в «agency operating system» (по Vision макета).

- **Бэкенд:** модули `team/` (`Team`, `TeamMember`), `client/`
  (`Client`, привязка к проектам, гостевой портал-доступ); расширение RBAC.
- **Фронт:** разделы Teams, Clients в сайдбаре; клиентский ограниченный вид.
- **Зависимости:** Фаза 1 (Projects), Фаза 5 (workload по командам).

---

## Фаза 8 — Каналы уведомлений и присутствие

- **Email-уведомления:** `notifications/` + транспорт (SMTP/провайдер), дайджесты,
  напоминания о дедлайнах; `NotificationPreference` per-user.
- **Presence:** `PATCH /me/presence` (online/away/dnd), broadcast через WS,
  индикатор в аватарах.
- **DeadlineWatcher:** планировщик (`deadline.approaching` события → automation/notify).
- **Зависимости:** уведомления (есть, I-04), automation (Фаза 6 для напоминаний).

---

## Фаза 9 — AI-ассистент (сверх груминга)

**Цель:** встроенный copilot, не чатбот.

- **Бэкенд:** расширить `ai/`: `summarize_blockers`, `auto_assign` (по workload из
  Фазы 5), `generate_sprint_plan`, `create_workflow` (генерит правила Фазы 6);
  контекст из задач/аналитики.
- **Фронт:** плавающая боковая панель, glow, command-oriented.
- **Зависимости:** Фаза 5 (данные), Фаза 6 (создание workflow), AI-груминг (I-05).

---

## Фаза 10 — Мобайл, респонсив, полировка

- Mobile: статусы, комментарии, аппрувы, уведомления (не полное редактирование).
- Tablet: сворачиваемый сайдбар, упрощённая доска.
- Empty states (монохром), моушн-полировка по дизайн-гайду
  (`viktoria_kanban_ui_design_system_spec.md`).
- **Зависимости:** стабилизация Фаз 1–3.

---

## Граф зависимостей (порядок реализации)

```
Фаза 1 (фундамент) ──┬─► Фаза 2 ─► Фаза 3 ─► Фаза 10
                     ├─► Фаза 4
                     ├─► Фаза 7
                     └─► Фаза 5 ─► Фаза 6 ─► Фаза 9
                                   Фаза 8 (после уведомлений I-04 + Фаза 6)
```

**Критический путь:** 1 → 5 → 6 → 9 (автоматизация + AI — главный дифференциатор по Vision).
**Быстрая ценность:** 1 → 2 → 3 (видимый прирост UX по макету).

## Как пускать в работу

1. Каждая фаза = 1–2 итерации через `/new-iter` (непересекающиеся `files_touched`).
2. Первая задача каждой фазы — scaffolding модуля + контракты как код.
3. Фаза 1 первой обязательно (миграция «один workspace = одна доска» → many boards).
4. Не начинать Фазу N+1 пока DoD Фазы N не закрыт (`/kanban-sync` → тег `iter-XX-stable`).
