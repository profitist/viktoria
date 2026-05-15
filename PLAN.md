# План: минимальная экосистема хакатона

## Контекст

К хакатону нужно: на основе описания проекта + предыдущей итерации генерировать пул задач для новой итерации, выгружать их в `KANBAN.md` и в GitHub Issues, после закрытия issue — автоматически обновлять `KANBAN.md`. Несколько людей пилят задачи в разных ветках; главный риск — пересечения. Решение — непересекаемые `files_touched` на этапе генерации задач.

## Артефакты в репо

```
project/
  PROJECT.md      # описание проекта (vision, MVP, стек, модули, контракты)
  KANBAN.md       # единая доска: итерации + задачи + статусы
```

`PROJECT.md` — пишется один раз (вручную или через `/new-iter` при первом запуске), редко меняется. `KANBAN.md` — живой документ, обновляется командами и автоматически.

## Команды в `.claude/commands/`

Только две команды. Минимум достаточный для всего workflow.

### 1. `/new-iter` — создать новую итерацию

Главная команда. Что делает:

1. Если `project/PROJECT.md` нет — короткий установочный диалог (vision, MVP, стек, модули, контракты модулей в markdown). Создаёт `PROJECT.md`. Этот шаг — однократно.
2. Читает `PROJECT.md` и существующий `KANBAN.md` (если есть предыдущие итерации).
3. Через диалог с пользователем формирует **пул задач следующей итерации**:
   - Цель итерации (что должно работать после неё)
   - Список задач, каждая с: `id` (T-XXX), `title`, `module`, `files_touched`, `depends_on`, `acceptance`
   - Жёсткое правило: внутри итерации `files_touched` задач **не пересекаются** (иначе ловим конфликт при ревью списка)
   - Первая итерация всегда содержит scaffolding модулей + контракты как код, чтобы дальше можно было пилить параллельно
4. Дописывает блок итерации в `KANBAN.md`.
5. Если есть `gh` и подключён GitHub — создаёт Issues:
   - `gh issue create --title "T-XXX: ..." --body <содержимое задачи> --label "iter:I-XX,module:X"`
   - Номер созданного issue вписывает обратно в `KANBAN.md` рядом с задачей

### 2. `/kanban-sync` — подтянуть статусы из GitHub

Что делает:

1. `gh issue list --state all --label "iter:I-XX" --json number,state,title,labels` — получает текущее состояние всех issues последней (или указанной) итерации.
2. Перерисовывает таблицу задач в `KANBAN.md`:
   - issue `open` → `todo` или `in progress` (по наличию assignee)
   - issue `closed` → `done`
3. Если все задачи итерации `done` — предлагает поставить git-тег `iter-XX-stable` на текущий main (rollback-точка).

Запускается вручную после закрытия issue или мержа PR. Опционально — добавляется в GitHub Actions для полного автомата (см. ниже).

## Формат `KANBAN.md`

Один файл — вся жизнь проекта. Структура:

```markdown
# Kanban

## Iteration I-02 (active) — Цель: рабочая авторизация и базовый профиль
DoD: пользователь регистрируется, логинится, видит свой профиль.

| ID | Title | Module | Owner | Status | Issue | Files |
|----|-------|--------|-------|--------|-------|-------|
| T-005 | Регистрация email | auth | @paul | in progress | #12 | src/auth/register.ts |
| T-006 | Логин email | auth | — | todo | #13 | src/auth/login.ts |
| T-007 | Страница профиля | profile | @ivan | done | #14 | src/profile/page.tsx |
...

## Iteration I-01 (closed, tag: iter-01-stable) — Цель: scaffolding + контракты
...
```

Истина — этот файл. Issues — зеркало для UI команды.

## Автообновление `KANBAN.md` при закрытии issue (опционально)

Файл `.github/workflows/kanban-sync.yml`:

```yaml
on:
  issues:
    types: [closed, reopened, assigned, unassigned]
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { token: ${{ secrets.GITHUB_TOKEN }} }
      - run: bash scripts/sync-kanban.sh
      - run: |
          git config user.name "kanban-bot"
          git config user.email "bot@local"
          git add project/KANBAN.md
          git diff --staged --quiet || git commit -m "kanban: sync"
          git push
```

`scripts/sync-kanban.sh` — тот же gh-парсер, что и в `/kanban-sync`, вынесенный в shell-скрипт (10-20 строк через `gh issue list --json` и `jq`). Без него `/kanban-sync` запускается командой.

На хакатоне можно стартовать без workflow и подключить его позже, если ручной `/kanban-sync` начнёт раздражать.

## Соглашения (минимум, опишутся в `PROJECT.md`)

- `main` защищена, ветки задач: `T-XXX-slug`
- Каждый коммит начинается с `T-XXX:`
- PR закрывает issue через `Closes #N` в описании
- При мерже PR → issue закрывается → `/kanban-sync` (или workflow) обновляет KANBAN.md

## Что НЕ делаем (отказались от усложнений)

- Отдельные `iterations/I-XX/tasks/T-XXX.md` — лишний уровень, всё живёт в KANBAN.md
- `/task-claim`, `/task-do`, `/task-add`, `/iter-close`, `/kanban` — лишние команды; их роли закрываются gh + `/new-iter` + `/kanban-sync`
- `/plan-project` отдельной командой — слит в первый запуск `/new-iter`
- Скилл `iteration-decomposer` — методология декомпозиции описана прямо в `/new-iter` (3-4 правила)

## Файлы, которые будут созданы

| Путь | Источник | Назначение |
|---|---|---|
| `.claude/commands/new-iter.md` | новый | Главная команда — итерация + KANBAN + Issues |
| `.claude/commands/kanban-sync.md` | новый | Синхронизация статусов из GitHub |
| `scripts/sync-kanban.sh` | новый (опционально) | Shell-обёртка для workflow |
| `.github/workflows/kanban-sync.yml` | новый (опционально) | Автообновление при закрытии issue |
| `.claude/CLAUDE.md` | редактирование | Добавить новые команды в таблицу |

Существующие `/plan-feat`, `/plan-do`, скиллы — не трогаем. При желании их можно вызывать из задач отдельно.

## Verification

1. Запустить `/new-iter` на пустом репо → диалог → проверить, что появились `PROJECT.md` и `KANBAN.md` с первой итерацией
2. Проверить, что `gh issue list` показывает созданные issues с лейблами `iter:I-01`
3. Закрыть один issue вручную (`gh issue close N`)
4. Запустить `/kanban-sync` → проверить, что в `KANBAN.md` статус задачи поменялся на `done`
5. Запустить `/new-iter` повторно → проверить, что новая итерация ссылается на завершённые задачи I-01 и не пересекается с ними по `files_touched`
6. (Опционально) подключить workflow и убедиться, что закрытие issue в UI приводит к коммиту бота в `KANBAN.md`