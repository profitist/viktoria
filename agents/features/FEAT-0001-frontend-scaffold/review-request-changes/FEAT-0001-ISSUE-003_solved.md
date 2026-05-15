# FEAT-0001-ISSUE-003: Решено

## Что исправлено
В `executeRefresh()` добавлена проверка `res.ok` перед `res.json()`. При любом не-OK статусе (включая 5xx) — вызывается logout, очищается sessionStorage, возвращается `null`. Вызов `res.json()` обёрнут в `try/catch` на случай невалидного JSON. Сетевые ошибки (fetch reject) также перехватываются и возвращают `null` без logout.

## Файл
`frontend/lib/api.ts`
