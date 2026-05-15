# FEAT-0001-ISSUE-001: Решено

## Что исправлено
Mutex race condition в `refreshPromise`. Логика вынесена в две функции: `executeRefresh()` выполняет сам запрос, `doRefresh()` управляет mutex-ом. Все параллельные 401 берут ссылку на один и тот же промис до его завершения. `refreshPromise` обнуляется через `await`, а не в `.finally()` — таким образом исключён двойной refresh/logout.

## Файл
`frontend/lib/api.ts`
