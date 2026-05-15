# FEAT-0002-auth-jwt: JWT аутентификация (register / login / refresh / logout)

## Постановка проблемы
Первый рабочий endpoint системы. Без `get_current_user` из Depends нельзя реализовать ни один другой модуль — все роуты зависят от текущего пользователя.

## Iteration / Module
I-01 | auth | Depends on: T-003 ✅, T-004 ✅

## Что уже существует (не трогать)

| Файл | Что есть |
|------|----------|
| `backend/app/auth/models.py` | User: id (UUID), email, hashed_password, name, created_at |
| `backend/app/auth/schemas.py` | RegisterRequest, LoginRequest, RefreshRequest, UserOut, TokenResponse |
| `backend/app/database.py` | Base, TimestampMixin — **нет engine и get_session** |
| `backend/app/main.py` | FastAPI app с CORS, без роутеров и без /api/v1/health |
| `backend/pyproject.toml` | passlib[bcrypt], pyjwt уже добавлены |

## Что создать / изменить

| Файл | Действие |
|------|----------|
| `backend/app/config.py` | Создать — pydantic-settings: DATABASE_URL, JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS |
| `backend/app/database.py` | Дополнить — добавить async engine, async_session_factory, `get_session` Depends |
| `backend/app/auth/service.py` | Создать |
| `backend/app/auth/deps.py` | Создать |
| `backend/app/auth/router.py` | Создать |
| `backend/app/main.py` | Дополнить — подключить auth router, добавить `GET /api/v1/health` |

## Функции `auth/service.py`

- `hash_password(plain: str) → str` — bcrypt через passlib
- `verify_password(plain: str, hashed: str) → bool`
- `create_access_token(user_id: str) → str` — PyJWT, exp из config
- `create_refresh_token(user_id: str) → str` — PyJWT, exp из config
- `decode_token(token: str) → dict` — raise `HTTPException(401)` если невалидный/истёкший
- `register(db, data: RegisterRequest) → User` — raise `HTTPException(409)` если email занят
- `login(db, data: LoginRequest) → tuple[User, str, str]` — raise `HTTPException(401)` если неверные данные

## `auth/deps.py`

- `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")`
- `get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_session)) → User`

## Эндпоинты `auth/router.py`

```
POST /api/v1/auth/register
  body: { email, password, name }
  200:  { access_token, refresh_token, user: { id, email, name } }
  409:  { detail: "email already registered" }

POST /api/v1/auth/login
  body: { email, password }
  200:  { access_token, refresh_token, user }
  401:  { detail: "invalid credentials" }

POST /api/v1/auth/refresh
  body: { refresh_token }
  200:  { access_token }  ← только access_token, не TokenResponse
  401:  { detail: "token expired or invalid" }

POST /api/v1/auth/logout
  header: Authorization: Bearer <access_token>
  body:   { refresh_token }  ← нужен чтобы добавить в blocklist
  200:  {}
```

## Данные и их жизненный цикл

- `User`: хранится в PostgreSQL, hashed_password никогда не возвращается в ответах и не логируется
- `access_token`: JWT, exp 15 мин, payload `{ sub: user_id, exp, type: "access" }`
- `refresh_token`: JWT, exp 30 дней, payload `{ sub: user_id, exp, type: "refresh" }`
- `_refresh_blocklist`: `set[str]` на уровне модуля в `service.py` — in-memory, сбрасывается при рестарте (MVP-допущение, зафиксировано)
- Поле `type` в payload позволяет отклонять access_token на эндпоинте refresh и наоборот

## Граничные случаи

| Сценарий | Ожидаемое поведение |
|----------|-------------------|
| Регистрация с уже занятым email | 409 `{ detail: "email already registered" }` |
| Логин с неверным паролем | 401 `{ detail: "invalid credentials" }` (не раскрывать существует ли email) |
| Refresh с access_token вместо refresh_token | 401 `{ detail: "token expired or invalid" }` |
| Refresh с токеном из blocklist | 401 |
| Запрос к защищённому endpoint без токена | 401 (FastAPI автоматически из OAuth2PasswordBearer) |
| Запрос с невалидным/истёкшим токеном | 401 |

## Критерии готовности

- [ ] `POST /api/v1/auth/register` с валидными данными → 200, access_token + refresh_token
- [ ] Повторная регистрация с тем же email → 409
- [ ] `POST /api/v1/auth/login` с верными данными → 200 с токенами
- [ ] `POST /api/v1/auth/login` с неверным паролем → 401
- [ ] `POST /api/v1/auth/refresh` с валидным refresh_token → 200, новый access_token
- [ ] `GET /api/v1/health` с `Authorization: Bearer <invalid>` → 401 (Depends работает)
- [ ] `GET /api/v1/health` без токена → 401
- [ ] Пароли не попадают в логи, ответы, трейсбеки

## Открытые вопросы

- Blocklist сбрасывается при рестарте — MVP-допущение. В I-02+ перенести в Redis или таблицу БД (T-B01 смежная задача).

---
**Готово к технической проработке:** Да
