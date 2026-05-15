---
argument-hint: [I-XX | --all]
description: Подтянуть статусы GitHub Issues в project/KANBAN.md
---

# Синхронизация KANBAN с GitHub Issues

Твоя задача — обновить статусы и owner-ов задач в `project/KANBAN.md` на основе текущего состояния GitHub Issues.

Аргумент: $ARGUMENTS
- если `I-XX` — синхронизируй только эту итерацию
- если `--all` — все итерации с лейблом `iter:*`
- если пусто — активную итерацию (первый блок `## Iteration I-XX (active)` в `KANBAN.md`)

## Алгоритм

### Шаг 1. Проверь окружение

- Файл `project/KANBAN.md` существует? Если нет — стоп с сообщением: «KANBAN.md не найден. Сначала запусти `/new-iter`».
- `gh auth status` работает? Если нет — стоп: «gh не аутентифицирован. Запусти `gh auth login`».
- `gh repo view --json nameWithOwner` возвращает репо? Если нет — стоп: «Репозиторий не привязан к GitHub».

### Шаг 2. Определи итерации для синхронизации

Распарси `KANBAN.md`, найди заголовки `## Iteration I-XX (...)`. Выбери целевые итерации согласно аргументу.

### Шаг 3. Получи состояние issues

Для каждой итерации `I-XX`:

```bash
gh issue list \
  --state all \
  --label "iter:I-XX" \
  --limit 200 \
  --json number,state,title,assignees,labels
```

Распарси JSON. Для каждого issue:
- `number` — номер
- `state` — `OPEN` или `CLOSED`
- `assignees[].login` — первый assignee → owner
- `labels[].name` — для дополнительной информации

### Шаг 4. Сматч issues с задачами в KANBAN.md

В таблице задач итерации колонка `Issue` содержит `#N`. Найди задачу с этим номером и обнови:

- **Status:**
  - `state=CLOSED` → `done`
  - `state=OPEN` и есть assignee → `in progress`
  - `state=OPEN` без assignee → `todo`
- **Owner:**
  - первый assignee из `assignees[]` (с префиксом `@`) или `—` если нет

Если в KANBAN.md есть задача без номера issue (`—` в колонке Issue) — пропусти её, не трогай.
Если есть issue с лейблом `iter:I-XX`, который НЕ матчится ни с одной задачей в KANBAN.md — выведи предупреждение пользователю в финальном отчёте (вероятно создан вручную).

### Шаг 5. Запиши изменения в `project/KANBAN.md`

Используй `Edit` точечно по строкам таблицы. Не трогай блоки закрытых итераций, не трогай acceptance details, не трогай DoD — только ячейки `Status` и `Owner` в таблице задач.

### Шаг 6. Проверь «итерация завершена»

Если в синхронизированной активной итерации **все** задачи стали `done`:

1. Спроси через `AskUserQuestion`: «Все задачи итерации I-XX завершены. Закрыть итерацию и поставить git-тег `iter-XX-stable` для rollback?»
2. Если да:
   - В заголовке итерации замени `(active)` на `(closed, tag: iter-XX-stable)`
   - Выполни `git tag iter-XX-stable` на текущем `HEAD` (или явно на main — спроси какой коммит)
   - Сообщи пользователю: «Тег поставлен. Чтобы откатиться: `git checkout iter-XX-stable`. Запушить тег: `git push origin iter-XX-stable`»

### Шаг 7. Отчёт

Выведи компактную сводку:

```
I-XX: 8 задач → 5 done, 2 in progress, 1 todo
Изменено в KANBAN.md: 3 задачи (T-005 todo→in progress, T-007 in progress→done, T-008 todo→done)
Предупреждения: issue #19 (iter:I-02) не сматчен с задачей в KANBAN.md
```

## Запреты

- НЕ создавай новые задачи и не удаляй существующие
- НЕ трогай `PROJECT.md`
- НЕ коммить изменения KANBAN.md без явной просьбы пользователя (оставь diff в рабочем дереве)
- НЕ пуш тег без подтверждения