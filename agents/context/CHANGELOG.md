## FEAT-0002 JWT Auth FastAPI Backend — CTO Review Fixes — 2026-05-15

- **ISSUE-001 (major)** `backend/app/auth/deps.py` — `uuid.UUID(user_id)` обёрнут в `try/except ValueError`; невалидный `sub` возвращает 401 вместо 500.
- **ISSUE-002 (minor)** `backend/app/auth/service.py` — Добавлен `_DUMMY_HASH` на уровне модуля; при отсутствии пользователя вызывается `verify_password("dummy", _DUMMY_HASH)` для защиты от timing-атаки / user enumeration.
- **ISSUE-003 (minor)** `backend/app/config.py` — `field_validator` для `jwt_secret` расширен: теперь проверяет `len < 32`, отклоняя пустые и короткие секреты.
- **ISSUE-004 (minor)** `backend/app/auth/service.py` — `logout` проверяет токен через `decode_token` перед добавлением в blocklist; невалидные токены игнорируются (идемпотентность).
- **ISSUE-005 (minor)** `backend/app/main.py` — Удалён незащищённый endpoint `GET /protected` (тестовая заглушка).
- **ISSUE-006 (minor)** `backend/app/auth/service.py`, `backend/app/auth/deps.py` — Все 401-ответы дополнены `headers={"WWW-Authenticate": "Bearer"}` согласно RFC 7235.

## FEAT-0002 JWT Auth FastAPI Backend — 2026-05-15

- Создан `backend/app/config.py` (pydantic-settings: DATABASE_URL, JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS; field_validator защищает от jwt_secret="changeme")
- Дополнен `backend/app/database.py` (async_engine, async_session_factory с expire_on_commit=False, get_session Depends-генератор)
- Создан `backend/app/auth/service.py` (hash_password, verify_password, create_access_token, create_refresh_token, decode_token, register, login, refresh_access_token, logout; in-memory _refresh_blocklist)
- Создан `backend/app/auth/deps.py` (oauth2_scheme, get_current_user с проверкой type=="access" и db.get по UUID)
- Создан `backend/app/auth/router.py` (POST /register, /login, /refresh, /logout; AccessTokenResponse для /refresh)
- Дополнен `backend/app/main.py` (include_router auth_router prefix=/api/v1, GET /api/v1/health с Depends(get_current_user))

## FEAT-0001 Frontend Scaffold — CTO Review Fixes — 2026-05-15

- **ISSUE-001 (critical)** `frontend/lib/api.ts` — Исправлен mutex race condition: `refreshPromise` обнуляется через `await`, а не в `.finally()`. Введена отдельная функция `executeRefresh()`, `doRefresh()` управляет mutex-ом.
- **ISSUE-002 (major)** `frontend/lib/ws.ts` — Убран `scheduleReconnect()` из `onerror`; reconnect только в `onclose`.
- **ISSUE-003 (major)** `frontend/lib/api.ts` — `executeRefresh()` проверяет `res.ok` перед `res.json()`; при 5xx/не-OK вызывает logout и очищает storage; `res.json()` обёрнут в `try/catch`.
- **ISSUE-004 (major)** `frontend/app/providers.tsx` — `useEffect` переведён на `[]`; `logout`/`refresh` доступны через ref-обёртки, что исключает перезапуск при навигации.
- **ISSUE-005 (minor)** `frontend/lib/ws.ts` — токен в URL WebSocket обёрнут в `encodeURIComponent()`.
- **ISSUE-006 (minor)** `frontend/lib/types.ts` — `field: string | undefined` заменены на `field?: string` в `Column`, `RuleActionParams`, `AuditLogEntry`.
- `npx tsc --noEmit` проходит без ошибок.

## FEAT-0001 Frontend Scaffold — 2026-05-15

- Создан `frontend/lib/types.ts` (25 типов: User, Workspace, WorkspaceRole, WorkspaceMember, WorkspaceSettings, Task, TaskPriority, DeadlineUrgency, Column, Board, RuleCondition, RuleActionType, RuleActionParams, RuleAction, RuleTrigger, AutomationRule, Notification, AuditChange, AuditActor, AuditLogEntry, JsonRpcMessage, GroomQuestion, GroomAnswer, GroomSession, TaskDraft)
- Создан `frontend/lib/ws.ts` (класс WsClient с JSON-RPC диспатчером и экспоненциальным reconnect 1s→2s→4s→...→30s)
- Заменён `frontend/lib/api.ts` (apiFetch + api.get/post/patch/put/delete + refreshPromise mutex + getAccessToken + setAccessToken + registerLogoutCallback)
- Создан `frontend/app/providers.tsx` (AuthProvider + QueryClientProvider; refresh через прямой fetch без рекурсии; восстановление сессии из sessionStorage при монтировании)
- Обновлён `frontend/app/layout.tsx` (убран Clerk, добавлен `<Providers>`, оставлен Server Component)
- Обновлён `frontend/app/page.tsx` (убраны Clerk-компоненты, использует новый `api`)
- Обновлён `frontend/proxy.ts` (убран Clerk middleware, заменён заглушкой с комментарием)
- Удалён `frontend/app/lib/api.ts` (дубликат старой заглушки)
- Обновлён `frontend/package.json` (@tanstack/react-query ^5.62.0 добавлен, @clerk/nextjs удалён)
- `npm install` выполнен успешно (361 пакет)
- `npx tsc --noEmit` проходит без ошибок
