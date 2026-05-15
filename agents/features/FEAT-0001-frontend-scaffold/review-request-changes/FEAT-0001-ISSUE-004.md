# FEAT-0001-ISSUE-004: useEffect в AuthProvider перезапускается при каждой навигации

## Severity
major

## Файл
`frontend/app/providers.tsx` строки 150–169

## Проблема

`useEffect` имеет зависимости `[logout, refresh]`:

```typescript
useEffect(() => {
  registerLogoutCallback(logout);
  // ...
  restoreSession().catch(() => { setIsLoading(false); });
}, [logout, refresh]); // ← проблема здесь
```

Цепочка зависимостей:
- `logout` зависит от `router` (useCallback с `[router]`)
- `useRouter()` в Next.js App Router возвращает новый объект при каждой навигации (смене маршрута)
- При навигации: новый `router` → новый `logout` → новый `refresh` (зависит от `logout`) → `useEffect` перезапускается

При перезапуске эффекта происходит:
1. `registerLogoutCallback(logout)` — перерегистрируется (безвредно)
2. `restoreSession()` запускается снова: читает `refresh_token` из sessionStorage, вызывает `refresh()`, делает POST `/api/v1/auth/refresh` — лишний сетевой запрос при каждом переходе между страницами

Это особенно болезненно в SPA: каждый переход на новую страницу триггерит refresh access token, даже если он ещё не истёк.

## Ожидаемое поведение

Эффект восстановления сессии должен запускаться **только один раз** при монтировании компонента. Для этого:

1. Убрать `logout` и `refresh` из deps массива эффекта (использовать `[]`).
2. Чтобы eslint-exhaustive-deps не ругался — использовать `useRef` для хранения стабильных ссылок на `logout` и `refresh`, либо вынести `restoreSession` внутрь эффекта с прямыми ref-ами.

Альтернатива: использовать `useRef` для `logout`:
```typescript
const logoutRef = useRef(logout);
useEffect(() => { logoutRef.current = logout; }, [logout]);

useEffect(() => {
  registerLogoutCallback(() => logoutRef.current());
  // restoreSession...
}, []); // deps: пустой массив
```

Регистрация logout через ref гарантирует, что `api.ts` всегда вызывает актуальную версию logout, без перезапуска эффекта.

## Требует пересмотра архитектуры?
Нет — изменение только в `providers.tsx`, паттерн ref-стабилизации стандартен для React.
