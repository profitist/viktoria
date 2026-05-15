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
