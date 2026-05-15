# FEAT-0001-ISSUE-003: doRefresh() не обрабатывает не-401 ошибки сервера рефреша

## Severity
major

## Файл
`frontend/lib/api.ts` строки 42–55

## Проблема

`doRefresh()` проверяет только `res.status === 401` как сигнал к logout. Все остальные ошибочные статусы (500, 503, 502, 429 и т.д.) проходят мимо этой проверки и попадают на строку `const data = await res.json()`.

Два сценария:

**Сценарий 1: сервер рефреша вернул 500 с HTML-телом**
`await res.json()` бросает `SyntaxError`. Эта ошибка всплывает из `doRefresh()`, затем из `refreshPromise`, затем из `apiFetch` к вызывающему коду. При этом:
- `sessionStorage` не очищен (refresh_token остался)
- `onLogout?.()` не вызван
- Пользователь видит необработанную ошибку вместо перехода на /login

**Сценарий 2: сервер рефреша вернул 500 с валидным JSON, но без поля `access_token`**
`data.access_token` будет `undefined`, `setAccessToken(undefined)` установит токен в `undefined as unknown as string`. Последующий запрос отправит `Authorization: Bearer undefined` — получит новый 401, снова попытается рефрешить, снова 500 — бесконечный цикл до тех пор пока `refreshPromise` не обнулится.

## Ожидаемое поведение

`doRefresh()` должен явно проверять `res.ok` (или `res.status === 200`) и при любом неуспешном ответе вызывать logout и бросать ошибку:

```typescript
if (!res.ok) {
  sessionStorage.removeItem("refresh_token");
  onLogout?.();
  throw new Error("Session expired");
}
```

Текущая проверка `if (res.status === 401)` должна быть заменена на `if (!res.ok)`.

## Требует пересмотра архитектуры?
Нет — исправление одной строки в `doRefresh()`.
