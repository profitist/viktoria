# FEAT-0001-frontend-scaffold: Базовые утилиты фронтенда

## Постановка проблемы
Фронтенд не имеет инфраструктуры для авторизованных API-запросов и WebSocket-подписок. Без этого ни один UI-компонент I-02 не может быть реализован.

## Путь пользователя

**Контекст:** это инфраструктурная задача — конечного пользователя нет. "Пользователь" здесь — разработчик, пишущий UI-компоненты.

**Шаги:**
1. Разработчик импортирует `apiFetch` из `@/lib/api` → делает запрос с токеном автоматически
2. При 401 — `apiFetch` сам пробует refresh, повторяет запрос; при повторном 401 — выходит из системы
3. Разработчик импортирует `WsClient` из `@/lib/ws` → подписывается на JSON-RPC события через `ws.on("board.task_moved", handler)`
4. Разработчик импортирует типы из `@/lib/types` → все интерфейсы из PROJECT.md доступны

**Конечное состояние:** `npx tsc --noEmit` проходит без ошибок; любой компонент может делать авторизованные запросы и слушать WS-события.

## Граничные случаи

| Сценарий | Ожидаемое поведение |
|----------|-------------------|
| access_token истёк (401) | apiFetch берёт refresh_token из sessionStorage, вызывает `/api/v1/auth/refresh`, повторяет запрос |
| refresh_token тоже истёк (401 при рефреше) | Очистить оба токена, вызвать logout() в AuthProvider, редирект на /login |
| WS-соединение оборвалось | WsClient делает reconnect с экспоненциальной задержкой (1с, 2с, 4с, макс 30с) |
| Приходит JSON-RPC без подписчика | Метод игнорируется, не падает |
| Страница перезагружается | access_token теряется (он в памяти), AuthProvider в mount вызывает refresh по refresh_token из sessionStorage → восстанавливает сессию |
| sessionStorage пустой при загрузке | AuthProvider устанавливает user = null → редирект на /login |

## Данные и их жизненный цикл

**Какие данные используются:**
- `access_token` (JWT, 15 мин): хранится в module-level переменной в `api.ts` — JS-память, недоступна XSS из других вкладок
- `refresh_token` (JWT, 30 дней): хранится в `sessionStorage` — изолирован по вкладке, очищается при закрытии браузера
- `user` объект (`{id, email, name}`): в React state AuthProvider

**Где хранятся:**
- Токены: память + sessionStorage (компромисс безопасности для MVP без изменений бэкенда)
- User: React context

**Как изменяются:**
- `login(email, password)` → POST /auth/login → сохранить оба токена, установить user
- `logout()` → очистить memory + sessionStorage, user = null
- `refresh()` → POST /auth/refresh → обновить access_token в памяти

**Ограничения:**
- Refresh token НЕ ставится как httpOnly cookie бэкендом (контракты возвращают тело) — для полной безопасности потребуется изменение бэкенда в будущем
- Clerk удаляется из зависимостей

## Что создаём / меняем

| Файл | Действие |
|------|----------|
| `frontend/app/providers.tsx` | Создать: AuthProvider + QueryClientProvider |
| `frontend/lib/api.ts` | Заменить заглушку: apiFetch + api.get/post/patch/put/delete |
| `frontend/lib/ws.ts` | Создать: класс WsClient с JSON-RPC диспатчером |
| `frontend/lib/types.ts` | Создать: все интерфейсы по контрактам PROJECT.md |
| `frontend/app/layout.tsx` | Убрать Clerk, обернуть в Providers |
| `frontend/app/lib/api.ts` | Удалить (дубликат) |
| `frontend/package.json` | Убрать `@clerk/nextjs`, добавить `@tanstack/react-query` |

## Критерии готовности

**Обязательно:**
- [ ] `import { apiFetch } from "@/lib/api"` — TypeScript не ругается
- [ ] `import { WsClient } from "@/lib/ws"` — TypeScript не ругается
- [ ] `import { Task, DeadlineUrgency } from "@/lib/types"` — все типы доступны
- [ ] `npx tsc --noEmit` проходит без ошибок
- [ ] При 401 от API — apiFetch автоматически пробует refresh
- [ ] При повторном 401 — вызывается logout(), очищаются токены
- [ ] Clerk удалён из зависимостей и из layout.tsx

**Качество:**
- [ ] WsClient не выбрасывает исключения при дисконнекте — только тихий reconnect
- [ ] Нет циклических импортов между api.ts / ws.ts / types.ts / providers.tsx

## Визуальное описание

Инфраструктурная задача — нет визуальных изменений для конечного пользователя.
Единственное видимое изменение: Clerk-хедер с кнопками SignIn/SignUp исчезает из layout.tsx.

## Открытые вопросы

- Токены сейчас в body ответа, не в httpOnly cookie. Для полной безопасности бэкенд должен выставлять cookie — отдельная задача в I-02 или позже.

---

**Готово к технической проработке:** Да
