# FEAT-0002-PLAN-01: Технический план реализации JWT-аутентификации

**Статус:** готов к разработке  
**Дата:** 2026-05-15  
**Фича:** FEAT-0002-auth-jwt  
**Основан на:** FEAT-0002-DESIGN-01.md, README.md  

---

## 1. Порядок реализации (с обоснованием зависимостей)

Порядок определяется графом импортов: каждый следующий файл импортирует предыдущие. Нарушение порядка вызовет `ImportError` при старте приложения.

| Шаг | Файл | Действие | Зависит от |
|-----|------|----------|------------|
| 1 | `backend/app/config.py` | Создать | Ничего — нет импортов внутри проекта |
| 2 | `backend/app/database.py` | Дополнить | `config.py` (импортирует `settings`) |
| 3 | `backend/app/auth/service.py` | Создать | `database.py` (AsyncSession), `auth/models.py`, `auth/schemas.py`, `config.py` (settings) |
| 4 | `backend/app/auth/deps.py` | Создать | `service.py` (decode_token), `database.py` (get_session), `auth/models.py` (User) |
| 5 | `backend/app/auth/router.py` | Создать | `service.py` (все auth-функции), `deps.py` (get_current_user), `auth/schemas.py` |
| 6 | `backend/app/main.py` | Дополнить | `auth/router.py` (router), `deps.py` (get_current_user) |

**Правило:** нет ни одного обратного импорта. `config.py` не знает о `database.py`, `service.py` не знает о `router.py`.

---

## 2. `backend/app/config.py` — детальный план

### Класс `Settings`

Наследует `BaseSettings` из `pydantic-settings`. Pydantic-settings автоматически читает переменные из окружения (env vars) и из `.env`-файла, если он указан в `model_config`.

| Поле | Тип | Дефолт | Env-переменная | Обязательность |
|------|-----|--------|----------------|----------------|
| `database_url` | `str` | — | `DATABASE_URL` | Обязательное |
| `jwt_secret` | `str` | — | `JWT_SECRET` | Обязательное |
| `jwt_algorithm` | `str` | `"HS256"` | `JWT_ALGORITHM` | Опциональное |
| `access_token_expire_minutes` | `int` | `15` | `ACCESS_TOKEN_EXPIRE_MINUTES` | Опциональное |
| `refresh_token_expire_days` | `int` | `30` | `REFRESH_TOKEN_EXPIRE_DAYS` | Опциональное |

### `model_config`

Объявляется как `SettingsConfigDict` с параметрами:
- `env_file = ".env"` — читает `.env` из текущей рабочей директории при локальном запуске
- `env_file_encoding = "utf-8"` — кодировка файла
- `case_sensitive = False` — `DATABASE_URL` и `database_url` считаются одинаковыми (поведение по умолчанию в pydantic-settings)

### Валидатор `jwt_secret`

Добавляется `@field_validator("jwt_secret")` с `mode="after"`: если значение равно `"changeme"` — бросает `ValueError` с сообщением `"JWT_SECRET must not be 'changeme' in production"`. Это защита от деплоя с дефолтным секретом из `.env.example`.

Срабатывает при инициализации `Settings()`, то есть при старте приложения. В dev-окружении `.env` должен содержать отличное от `"changeme"` значение.

### Синглтон

В конце файла: `settings = Settings()`. Все другие модули импортируют `settings` из `app.config`, а не создают новый экземпляр — повторная инициализация не нужна, а вызов `Settings()` при каждом импорте приводил бы к повторному чтению env-переменных.

---

## 3. `backend/app/database.py` — детальный план дополнений

### Что существует (не трогать)

- `NAMING_CONVENTION` — словарь с шаблонами имён constraints для Alembic
- `Base(DeclarativeBase)` — базовый класс всех ORM-моделей; хранит `metadata` с `naming_convention`
- `TimestampMixin` — добавляет поле `created_at: Mapped[datetime]` с `server_default=func.now()`

### Новые импорты

В начало файла добавить:
- `from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine`
- `from typing import AsyncGenerator`
- `from app.config import settings`

Импорт `settings` располагается после стандартных импортов и до объявления `async_engine`. Это не создаёт циклического импорта: `config.py` не импортирует `database.py`.

### `async_engine`

Создаётся на уровне модуля (не внутри функции, не в lifespan) через `create_async_engine`:
- `url = settings.database_url` — строка вида `postgresql+asyncpg://user:pass@host:5432/dbname`
- `echo = False` — SQL-запросы в stdout не выводятся; включить временно при отладке
- `pool_pre_ping = True` — перед выдачей соединения из пула проверяет, что соединение живо (SELECT 1); защищает от `OperationalError` после долгого простоя

Создание на уровне модуля оправдано: `async_engine` — stateless объект-фабрика соединений, его инициализация не требует запущенного event loop. Создание внутри lifespan лишь усложнило бы код.

### `async_session_factory`

Создаётся через `async_sessionmaker`:
- `bind = async_engine` — движок, которым пользуется фабрика
- `class_ = AsyncSession` — тип создаваемых сессий
- `expire_on_commit = False` — **критически важно для async**: см. раздел "Подводные камни" ниже
- `autoflush = False` — flush происходит явно при `commit()` или по требованию; предотвращает неожиданные запросы к БД
- `autocommit = False` — транзакции управляются явно в service-слое

### `get_session`

Асинхронный генератор-зависимость. Сигнатура: `async def get_session() -> AsyncGenerator[AsyncSession, None]`.

Поведение (строго по порядку):
1. Создаёт сессию: `session = async_session_factory()`
2. Выполняет `yield session` — FastAPI передаёт объект в Depends-параметр endpoint или service
3. Блок `finally` (выполняется всегда, независимо от исключения): `await session.close()`

**Важно:** `get_session` не вызывает `commit()` и не вызывает `rollback()`. Ответственность за commit лежит на service (`register`, `login`). При незакоммиченной транзакции SQLAlchemy откатит её автоматически при `session.close()`. Это предотвращает ситуацию, когда генератор маскирует исключение из service своим commit.

### Почему `expire_on_commit=False` обязателен для async

В синхронном SQLAlchemy после `session.commit()` все ORM-объекты помечаются как "expired" — это значит, что при следующем обращении к их атрибутам SQLAlchemy автоматически делает lazy-load из БД. В async-контексте lazy-load невозможен: он требует синхронного I/O, которого нет в asyncio. При обращении к атрибуту "expired" объекта вне контекста открытой сессии будет `MissingGreenlet` или `DetachedInstanceError`.

`expire_on_commit=False` означает: объекты после commit остаются "живыми" с уже загруженными данными, без попытки lazy-load. Именно поэтому `register` делает `await db.refresh(user)` **до** выхода из сессии — чтобы получить серверные значения (`id`, `created_at`) в рамках той же сессии, пока она открыта.

---

## 4. `backend/app/auth/service.py` — детальный план

### In-memory blocklist

На уровне модуля, **вне всех классов и функций**:

```
_refresh_blocklist: set[str] = set()
```

Это переменная уровня модуля: живёт весь срок работы процесса, сбрасывается при рестарте. MVP-допущение, зафиксировано в README. Прямой доступ к `_refresh_blocklist` разрешён только внутри `service.py`. Функции `logout` и `refresh_access_token` используют её напрямую — выносить отдельные `add_to_blocklist` / `is_blocked` публичные функции не нужно (это усложнение без пользы на данном этапе).

### CryptContext

На уровне модуля:

```
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

Объект создаётся один раз — создание `CryptContext` не дешёвое. `deprecated="auto"` означает: при верификации старые схемы принимаются, но при следующем логине хэш автоматически обновляется до актуального.

### Функция `hash_password`

Принимает строку plain-текст пароля. Возвращает строку bcrypt-хэша.

Шаги:
1. Вызывает `_pwd_context.hash(plain)` — возвращает строку вида `$2b$12$...`
2. Возвращает результат

Функция синхронная: bcrypt — CPU-bound операция, asyncio её не ускорит. При высокой нагрузке можно обернуть в `asyncio.get_event_loop().run_in_executor(None, hash_password, plain)`, но для MVP это излишне.

### Функция `verify_password`

Принимает plain-пароль и hashed-строку. Возвращает `bool`.

Шаги:
1. Вызывает `_pwd_context.verify(plain, hashed)`
2. Возвращает результат (True/False)

Не бросает исключений. Решение "доступ разрешён/запрещён" принимает вызывающий (`login`). Сравнение timing-safe — защита от timing attack.

### Функция `create_access_token`

Принимает `user_id: str`. Возвращает строку JWT.

Шаги:
1. Вычисляет `exp = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)`
2. Формирует payload: `{"sub": user_id, "exp": exp, "type": "access"}`
3. Вызывает `jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)` — PyJWT возвращает строку
4. Возвращает строку токена

`user_id` принимается как `str` (не `uuid.UUID`): JSON-сериализация UUID без приведения к строке может вести себя непредсказуемо в зависимости от версии PyJWT. Явное приведение на границе service/router (`str(user.id)`) — безопаснее.

### Функция `create_refresh_token`

Принимает `user_id: str`. Возвращает строку JWT.

Аналогична `create_access_token`, отличия:
- `exp = datetime.now(tz=timezone.utc) + timedelta(days=settings.refresh_token_expire_days)`
- payload: `{"sub": user_id, "exp": exp, "type": "refresh"}`

Вынесена в отдельную функцию (не параметр `token_type` в одной функции): разные поля lifetime, возможные будущие расширения payload (например, `jti` для refresh-токена).

### Функция `decode_token`

Принимает строку токена. Возвращает dict payload или бросает исключение.

Шаги:
1. Выполняет `jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])`
   - `algorithms` — **список**, не строка. Это обязательное требование PyJWT >= 2.x. Передача строки вызывает `DecodeError`
2. При `jwt.ExpiredSignatureError` — бросает `HTTPException(status_code=401, detail="token expired or invalid")`
3. При `jwt.InvalidTokenError` (базовый класс для всех JWT-ошибок, включая `InvalidSignatureError`, `DecodeError`, `InvalidAlgorithmError`) — бросает `HTTPException(status_code=401, detail="token expired or invalid")`
4. При успехе возвращает payload-dict

**Почему HTTPException в service, а не в deps:** единая точка обработки JWT-ошибок. Если `decode_token` будет вызываться из нескольких мест (сейчас deps и router/refresh), дублировать `try/except jwt.InvalidTokenError` в каждом месте — нарушение DRY. `decode_token` — это "умный" парсер с семантикой: или данные, или 401.

### Функция `register`

Принимает `db: AsyncSession`, `data: RegisterRequest`. Возвращает ORM-объект `User` или бросает исключение.

Шаги:
1. Выполняет запрос к БД: `SELECT * FROM users WHERE email = data.email LIMIT 1` через `db.execute(select(User).where(User.email == data.email))`
2. Извлекает результат через `.scalar_one_or_none()`
3. Если существующий пользователь найден — бросает `HTTPException(status_code=409, detail="email already registered")`
4. Создаёт объект: `user = User(email=data.email, hashed_password=hash_password(data.password), name=data.name)`
5. Добавляет в сессию: `db.add(user)`
6. Фиксирует транзакцию: `await db.commit()`
7. Обновляет объект из БД: `await db.refresh(user)` — загружает `id` (генерируется PostgreSQL через `gen_random_uuid()`) и `created_at` (генерируется через `func.now()` server-side). Без `refresh` эти поля остаются `None` в Python-объекте
8. Возвращает `user`

**Почему `db.refresh` обязателен:** PostgreSQL генерирует `id` и `created_at` на стороне сервера (`server_default`). После `commit()` Python-объект знает о своих полях только то, что было в нём до flush. `db.refresh(user)` делает `SELECT * FROM users WHERE id = user.id` и обновляет Python-объект серверными значениями. Без этого `user.id` будет `None`, и создание JWT из `str(user.id)` вернёт `"None"`.

### Функция `login`

Принимает `db: AsyncSession`, `data: LoginRequest`. Возвращает `tuple[User, str, str]` или бросает исключение.

Шаги:
1. Ищет пользователя: `SELECT * FROM users WHERE email = data.email`
2. Если не найден: бросает `HTTPException(status_code=401, detail="invalid credentials")`
3. Вызывает `verify_password(data.password, user.hashed_password)`
4. Если `False`: бросает `HTTPException(status_code=401, detail="invalid credentials")`
5. Шаги 2 и 4 дают **одинаковый ответ** — не раскрывает существование email (атака перечисления пользователей)
6. Создаёт токены: `access = create_access_token(str(user.id))`, `refresh = create_refresh_token(str(user.id))`
7. Возвращает `(user, access, refresh)`

**Почему tuple, а не схема:** service не знает о HTTP-ответах. Упаковка в Pydantic-схему — обязанность router. Tuple минимально достаточен и не создаёт лишних зависимостей.

### Функция `refresh_access_token`

Принимает строку `token`. Возвращает строку нового access-токена или бросает исключение.

Шаги:
1. Вызывает `decode_token(token)` — получает payload или 401
2. Проверяет `payload.get("type") == "refresh"` — если нет: бросает `HTTPException(status_code=401, detail="token expired or invalid")`
3. Проверяет `token in _refresh_blocklist` — если да: бросает `HTTPException(status_code=401, detail="token expired or invalid")`
4. Вызывает `create_access_token(payload["sub"])` — возвращает новый access-токен
5. Возвращает новый access-токен

Функция синхронная: нет I/O. `_refresh_blocklist` — in-memory set, проверка O(1).

### Функция `logout`

Принимает `access_token: str`, `refresh_token: str`. Возвращает `None`.

Шаги:
1. Добавляет `_refresh_blocklist.add(refresh_token)`
2. `access_token` принимается в сигнатуре но **не используется** в MVP: access живёт 15 мин, инвалидация in-memory — риск пропустить при горизонтальном масштабировании. В I-02+ возможно добавить access в blocklist через Redis. Параметр оставлен как явная точка расширения.
3. Не бросает исключений.

---

## 5. `backend/app/auth/deps.py` — детальный план

### `oauth2_scheme`

Объявляется на уровне модуля:

```
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
```

`OAuth2PasswordBearer` делает следующее:
- При наличии заголовка `Authorization: Bearer <token>` — извлекает `<token>` и возвращает строку
- При отсутствии заголовка — автоматически возвращает `401 Unauthorized` с `WWW-Authenticate: Bearer` ещё до вызова endpoint-функции
- `tokenUrl` используется только для Swagger UI: указывает URL кнопки "Authorize". Не влияет на логику проверки токенов

**Несовместимость Swagger с JSON-login:** endpoint `POST /api/v1/auth/login` принимает JSON-тело (`LoginRequest`), а `OAuth2PasswordBearer` ожидает `application/x-www-form-urlencoded`. Swagger UI покажет форму, но `curl` с form-data не пройдёт. Это MVP-допущение, зафиксированное в DESIGN-01. Для ручного тестирования Swagger достаточно вставить токен вручную через кнопку "Authorize".

### `get_current_user`

Сигнатура: `async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_session)) -> User`

Шаги:
1. `token` уже очищен от `Bearer ` prefix — `oauth2_scheme` возвращает строку токена
2. Вызывает `service.decode_token(token)` — получает payload dict или 401 (исключение из service)
3. Проверяет `payload.get("type") == "access"` — если нет (передан refresh-токен): бросает `HTTPException(status_code=401, detail="token expired or invalid")`
4. Извлекает `user_id = payload["sub"]`
5. Вызывает `await db.get(User, uuid.UUID(user_id))` — прямой lookup по PK, без SELECT с WHERE
6. Если пользователь не найден (`None`): бросает `HTTPException(status_code=401, detail="token expired or invalid")`
7. Возвращает ORM-объект `User`

**Почему 401, а не 404 при отсутствии пользователя:** 404 раскрыл бы информацию — "токен валидный, но пользователь удалён". 401 означает "аутентификация не прошла" без уточнения причины. Это соответствует принципу минимального раскрытия информации.

**Необходимые импорты:** `uuid` (stdlib), `AsyncSession` из `sqlalchemy.ext.asyncio`, `Depends` и `HTTPException` из `fastapi`, `OAuth2PasswordBearer` из `fastapi.security`, `User` из `app.auth.models`, `get_session` из `app.database`, `service` из `app.auth.service`.

---

## 6. `backend/app/auth/router.py` — детальный план

### Создание роутера

```
router = APIRouter(prefix="/auth", tags=["auth"])
```

Prefix `/api/v1` добавляется в `main.py` при `include_router`. Это стандартная конвенция FastAPI: роутер не знает, с каким prefix он будет смонтирован. Позволяет подключать роутер с другим prefix в тестах или при версионировании (`/api/v2`).

### Новая схема `AccessTokenResponse`

В файл `schemas.py` (или прямо в `router.py` если она нигде больше не нужна) добавляется:

```
class AccessTokenResponse(BaseModel):
    access_token: str
```

Используется в ответе `POST /auth/refresh`. Отдельная схема — явная документация контракта в Swagger, в отличие от анонимного `dict`.

Рекомендуется добавить в `schemas.py` для единообразия и возможного переиспользования.

### Endpoint `POST /auth/register`

Декоратор: `@router.post("/register", response_model=TokenResponse)`

Параметры функции:
- `data: RegisterRequest` — тело запроса, FastAPI десериализует автоматически
- `db: AsyncSession = Depends(get_session)` — сессия БД

Логика:
1. `user = await service.register(db, data)` — создаёт пользователя или 409
2. `access = service.create_access_token(str(user.id))`
3. `refresh = service.create_refresh_token(str(user.id))`
4. Возвращает `TokenResponse(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))`

`UserOut.model_validate(user)` — Pydantic v2 метод для создания схемы из ORM-объекта (заменяет устаревший `from_orm`). Работает благодаря `model_config = ConfigDict(from_attributes=True)` в `UserOut`.

HTTP-статусы: 200 (успех), 409 (email занят — из service), 422 (невалидное тело — FastAPI автоматически).

### Endpoint `POST /auth/login`

Декоратор: `@router.post("/login", response_model=TokenResponse)`

Параметры: `data: LoginRequest`, `db: AsyncSession = Depends(get_session)`

Логика:
1. `user, access, refresh = await service.login(db, data)` — tuple распаковка
2. Возвращает `TokenResponse(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))`

HTTP-статусы: 200, 401 (неверные данные — из service), 422.

### Endpoint `POST /auth/refresh`

Декоратор: `@router.post("/refresh", response_model=AccessTokenResponse)`

Параметры: `data: RefreshRequest` — тело с `refresh_token: str`

Логика:
1. `access = service.refresh_access_token(data.refresh_token)` — синхронная функция, await не нужен
2. Возвращает `AccessTokenResponse(access_token=access)`

HTTP-статусы: 200, 401 (невалидный/истёкший/заблокированный токен, или передан access вместо refresh).

### Endpoint `POST /auth/logout`

Декоратор: `@router.post("/logout")`

Параметры:
- `data: RefreshRequest` — тело с `refresh_token: str` для добавления в blocklist
- `current_user: User = Depends(get_current_user)` — проверяет access-токен, возвращает пользователя
- `token: str = Depends(oauth2_scheme)` — строка access-токена для передачи в `service.logout`

**Критический момент с получением строки access-токена:** `get_current_user` принимает token внутри своей реализации, но наружу не возвращает его — возвращает только объект `User`. Чтобы передать строку токена в `service.logout`, endpoint объявляет `token: str = Depends(oauth2_scheme)` параллельно с `current_user`. FastAPI умён: `oauth2_scheme` вызывается один раз и переиспользуется (кэш зависимостей), поэтому фактически нет двойного парсинга заголовка.

Логика:
1. Проверка access-токена происходит автоматически через `Depends(get_current_user)` — если токен невалидный, до тела функции не доходим
2. `service.logout(access_token=token, refresh_token=data.refresh_token)`
3. Возвращает пустой dict `{}`

HTTP-статусы: 200, 401 (невалидный access-токен).

---

## 7. `backend/app/main.py` — детальный план изменений

### Что НЕ трогать

- `GET /` — существующий endpoint, оставить без изменений
- `GET /protected` — существующий endpoint, оставить без изменений
- Настройки CORS (`origins`, `CORSMiddleware`) — оставить без изменений

### Новые импорты

```python
from app.auth.router import router as auth_router
from app.auth.deps import get_current_user
from app.auth.models import User
```

### Подключение роутера

```python
app.include_router(auth_router, prefix="/api/v1")
```

Это монтирует все endpoints роутера с полным путём `/api/v1/auth/...`. Одна строка управляет версионированием всех auth-endpoints.

### Endpoint `GET /api/v1/health`

Добавить **после** `include_router`:

```python
@app.get("/api/v1/health")
async def health(current_user: User = Depends(get_current_user)):
    return {"status": "ok", "user_id": str(current_user.id)}
```

Endpoint защищён через `Depends(get_current_user)`. Цель: проверить что цепочка зависимостей `oauth2_scheme → decode_token → db.get(User)` работает end-to-end. Это основной критерий готовности из README.

HTTP-статусы: 200 с `{"status": "ok", "user_id": "<uuid>"}`, 401 без токена или с невалидным токеном.

---

## 8. Подводные камни

### 8.1 passlib + bcrypt: версии и DeprecationWarning

В `pyproject.toml` указано `passlib[bcrypt]>=1.7.4`. passlib 1.7.4 — последняя версия (пакет не обновлялся с 2020 года). Совместимость с современными версиями `bcrypt` (4.x+) нарушена: passlib вызывает `bcrypt.__about__.__version__`, которого нет в bcrypt >= 4.0.

**Симптомы:** при запуске появляется `DeprecationWarning: 'crypt' is deprecated...` или `AttributeError: module 'bcrypt' has no attribute '__about__'`.

**Решение:** зафиксировать `bcrypt==4.0.1` в `pyproject.toml` (последняя версия с совместимостью) или использовать `bcrypt<4.0`. Альтернатива — подавить предупреждение через `warnings.filterwarnings` в `main.py` (не рекомендуется — маскирует проблему). Лучшее решение: проверить при первом запуске, при необходимости добавить `bcrypt>=4.0.0` в зависимости и убедиться что passlib не падает.

### 8.2 PyJWT vs python-jose: decode требует `algorithms=[...]`

В проекте используется `pyjwt>=2.12.1` (не `python-jose`). Это важно: API у них разное.

**PyJWT >= 2.0**: `jwt.decode(token, secret, algorithms=["HS256"])` — `algorithms` обязателен как список.
**python-jose**: `jose.jwt.decode(token, secret, algorithms=["HS256"])` — похожий API, но другой пакет.

Если передать строку `algorithms="HS256"` вместо списка — PyJWT выдаст `DecodeError: It is required that you pass in a value for the "algorithms" argument when calling decode()`. Всегда `algorithms=[settings.jwt_algorithm]`.

### 8.3 expire_on_commit=False — почему обязателен

Подробно описано в разделе 3. Краткий итог: в async SQLAlchemy lazy-load после commit невозможен. `expire_on_commit=False` + явный `await db.refresh(user)` — единственно корректная стратегия для async. Без этого `register` вернёт объект с `id = None`.

### 8.4 Logout: OAuth2PasswordBearer не отдаёт строку токена наружу

`OAuth2PasswordBearer` извлекает токен из заголовка и передаёт его в функцию-зависимость как параметр. Но если endpoint получает только `current_user = Depends(get_current_user)`, строка токена недоступна — `get_current_user` её не возвращает.

**Решение (описано в разделе 6):** параллельно объявить `token: str = Depends(oauth2_scheme)`. FastAPI кэширует вызовы зависимостей в рамках одного запроса: `oauth2_scheme` будет вызван один раз, результат переиспользован и в `get_current_user`, и в переменной `token`. Нет лишних HTTP-запросов, нет двойной валидации заголовка.

**Альтернативы (хуже):**
- `HTTPBearer` из `fastapi.security`: аналогичная функциональность, но менее интегрирована со Swagger UI
- Получать токен из `request.headers` напрямую: нарушает явность зависимостей, сложнее тестировать
- Возвращать токен из `get_current_user` как tuple `(user, token)`: ломает сигнатуру deps, которую используют все другие endpoints

---

## 9. Сводная карта импортов

```
config.py
  └─ (settings) ──► database.py
                       └─ (async_engine, async_session_factory, get_session)
                            └─ auth/
                                ├─ models.py ──► (Base, TimestampMixin) ◄── database.py
                                ├─ schemas.py (нет внутренних импортов)
                                ├─ service.py ──► (settings, AsyncSession, User, schemas, jwt, passlib)
                                ├─ deps.py ──► (service.decode_token, get_session, User, oauth2_scheme)
                                └─ router.py ──► (service, deps, schemas)
                                     └─ main.py ──► (auth_router, get_current_user, User)
```

Нет циклических импортов. Каждый файл импортирует только то, что объявлено в файлах, расположенных "выше" по стеку.

---

## 10. Контрольные точки готовности

| # | Сценарий | Ожидаемый результат |
|---|----------|---------------------|
| 1 | `POST /api/v1/auth/register` с `{email, password, name}` | 200, `{access_token, refresh_token, user: {id, email, name}}` |
| 2 | Повторный `POST /api/v1/auth/register` с тем же email | 409, `{"detail": "email already registered"}` |
| 3 | `POST /api/v1/auth/login` с верными данными | 200, `{access_token, refresh_token, user}` |
| 4 | `POST /api/v1/auth/login` с неверным паролем | 401, `{"detail": "invalid credentials"}` |
| 5 | `POST /api/v1/auth/login` с несуществующим email | 401, `{"detail": "invalid credentials"}` — не 404 |
| 6 | `POST /api/v1/auth/refresh` с валидным refresh_token | 200, `{"access_token": "<новый токен>"}` |
| 7 | `POST /api/v1/auth/refresh` с access_token вместо refresh_token | 401, `{"detail": "token expired or invalid"}` |
| 8 | `POST /api/v1/auth/refresh` с токеном из blocklist (после logout) | 401 |
| 9 | `GET /api/v1/health` с `Authorization: Bearer <valid_access>` | 200, `{"status": "ok", "user_id": "<uuid>"}` |
| 10 | `GET /api/v1/health` без заголовка Authorization | 401 |
| 11 | `GET /api/v1/health` с истёкшим/невалидным токеном | 401 |
| 12 | `POST /api/v1/auth/logout` с валидным access, body `{refresh_token}` | 200, `{}` |
| 13 | Логи приложения — отсутствие паролей и hashed_password | Паролей нет в stdout |

---

## 11. MVP-допущения (зафиксированы)

| # | Допущение | Последствие | Когда пересматривать |
|---|-----------|-------------|----------------------|
| 1 | `_refresh_blocklist` in-memory | Сбрасывается при рестарте; не работает при нескольких инстансах | I-02+, перенос в Redis (задача T-B01) |
| 2 | access_token не инвалидируется при logout | Украденный access живёт до истечения 15 мин | I-02+ при необходимости строгого logout |
| 3 | `POST /login` принимает JSON, не form-data | Swagger UI кнопка Authorize не работает автоматически | Приемлемо для MVP; решение — форм-логин или ручной ввод токена |
| 4 | Нет ротации refresh-токенов | При краже refresh-токена он работает до истечения 30 дней | I-02+ |
