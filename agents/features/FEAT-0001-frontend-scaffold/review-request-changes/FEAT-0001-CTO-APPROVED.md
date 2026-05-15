# FEAT-0001 CTO Approved

## Проверено

- [ISSUE-001 CRITICAL] Mutex race condition в api.ts — **исправлено корректно**
  - `doRefresh()` проверяет `refreshPromise !== null` и возвращает существующий промис ДО своего завершения (строки 79-84)
  - Все параллельные 401 получают одну ссылку на промис через `return refreshPromise`
  - `refreshPromise` обнуляется через `await` (строка 83), не в `.finally()` — двойной refresh/logout исключён
  - JavaScript single-threaded event loop гарантирует атомарность проверки и присваивания

- [ISSUE-002 MAJOR] Двойной reconnect в ws.ts — **исправлено корректно**
  - `onerror` оставлен пустым (строки 60-62), reconnect только в `onclose`
  - Комментарий поясняет поведение браузера: onclose всегда следует за onerror

- [ISSUE-003 MAJOR] 5xx без logout в api.ts — **исправлено корректно**
  - `executeRefresh()`: сетевые ошибки пойманы в try/catch (строки 49-52), `res.ok` проверяется до `res.json()` (строки 54-70)
  - `api` объект: `if (!res.ok) return handleError(res)` во всех методах (get/post/patch/put/delete) перед `res.json()`
  - Три ветки ошибок: сетевая (null без logout), HTTP-ошибка (logout + null), невалидный JSON (logout + null)

- [ISSUE-004 MAJOR] useEffect при навигации в providers.tsx — **исправлено корректно**
  - `useEffect` с пустым массивом `[]` — запускается только при монтировании (строка 179)
  - `logoutRef` и `refreshRef` обновляются при каждом рендере (строки 156-157) — актуальные функции доступны без перезапуска эффекта
  - Бесконечный цикл отсутствует: refs не входят в deps и не вызывают перерендер

- [ISSUE-005 MINOR] encodeURIComponent в ws.ts — **исправлено корректно**
  - Строка 26: `` `?token=${encodeURIComponent(token)}` `` — токен кодируется перед вставкой в URL

- [ISSUE-006 MINOR] Optional fields в types.ts — **исправлено корректно**
  - `Column.color?: string`, `RuleActionParams.column_id/tag/message?: string`, `AuditLogEntry.task_title?: string`
  - Идиоматический TypeScript, семантика сохранена

## Новые проблемы

Новых issues не обнаружено. При исправлениях не введено деградаций или побочных эффектов.

## Решение

Одобрено к merge. Все критические и мажорные issues исправлены. Минорные issues также закрыты. Код соответствует принципам Функциональной Ясности: fail-fast, явная обработка ошибок, отсутствие Error Hiding.
