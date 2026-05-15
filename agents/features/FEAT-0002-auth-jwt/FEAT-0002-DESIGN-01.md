# FEAT-0002-DESIGN-01: Интерфейсы JWT-аутентификации

**Статус:** готово к реализации  
**Дата:** 2026-05-15  
**Фича:** FEAT-0002-auth-jwt  

---

## 1. `backend/app/config.py`

### Класс `Settings` (pydantic-settings, `BaseSettings`)

| Поле | Тип | Дефолт | Env-переменная | Примечание |
|------|-----|--------|----------------|------------|
| `database_url` | `str` | — (обязательно) | `DATABASE_URL` | Формат: `postgresql+asyncpg://user:pass@host:5432/dbname` |
| `jwt_secret` | `str` | — (обязательно) | `JWT_SECRET` | В продакшене — случайная строка ≥32 байт, задаётся через Docker secret или secrets manager |
| `jwt_algorithm` | `str` | `"HS256"` | `JWT_ALGORITHM` | Поддерживается только HMAC-семейство (HS256/HS384/HS512) |
| `access_token_expire_minutes` | `int` | `15` | `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни access-токена в минутах |
| `refresh_token_expire_days` | `int` | `30` | `REFRESH_TOKEN_EXPIRE_DAYS` | Время жизни refresh-токена в днях |

**Инициализация:** в конце модуля создаётся синглтон `settings = Settings()` — все модули импортируют его, не создают новый экземпляр.

**Откуда берётся `JWT_SECRET` в продакшене:**  
В Docker Compose — через `environment:` из файла `.env` (не коммитится в git). В CI/CD и облачных окружениях — через secrets manager (Vault, AWS Secrets Manager и т.п.) с инъекцией в env-переменную. Значение `"changeme"` из `.env.example` недопустимо вне dev-окружения — Settings должен поднять `ValueError` при `jwt_secret == "changeme"` через `@field_validator` (опционально, но рекомендуется).

---

## 2. `backend/app/database.py` — дополнение

### Что существует (не трогать)
- `Base(DeclarativeBase)` — с `metadata` и `NAMING_CONVENTION`
- `TimestampMixin` — добавляет поле `created_at: Mapped[datetime]`

### Что добавить

**`async_engine`** — асинхронный движок SQLAlchemy:
```
create_async_engine(
    settings.database_url,
    echo=False,          # True только в dev при необходимости
    pool_pre_ping=True,  # проверяет живость соединения перед использованием
)
```
Импортирует `settings` из `app.config`. Создаётся один раз при импорте модуля (не в lifespan — модели используют Base, которая не зависит от момента создания engine).

**`async_session_factory`** — фабрика сессий:
```
async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,   # важно: объекты остаются доступны после commit
    autoflush=False,
    autocommit=False,
)
```

**`get_session`** — генератор-зависимость для FastAPI `Depends`:

Сигнатура:
```python
async def get_session() -> AsyncGenerator[AsyncSession, None]
```

Поведение:
1. Создаёт сессию через `async_session_factory()`
2. Выполняет `yield session` — FastAPI передаёт сессию в endpoint/service
3. В блоке `finally` закрывает сессию (`await session.close()`)
4. Не делает `commit` — ответственность за транзакцию лежит на вызывающем коде (service)
5. При исключении сессия закрывается без `rollback` в самом `get_session` — `rollback` вызывает service или он происходит автоматически при `close()` незакоммиченной транзакции

**Соотношение с `Base` и `TimestampMixin`:**  
`Base` и `TimestampMixin` остаются без изменений. `async_engine` использует тот же `Base.metadata` при `create_all` (в тестах) или через Alembic (в продакшене). Нет циклических импортов: `database.py` импортирует только `settings`, а `models.py` импортирует `Base` и `TimestampMixin` из `database.py`.

---

## 3. `backend/app/auth/service.py`

### In-memory blocklist

На уровне модуля объявляется:
```python
_refresh_blocklist: set[str] = set()
```

Это MVP-допущение: при рестарте процесса все заблокированные токены «разблокируются». Зафиксировано в README. Замена на Redis — задача I-02+.

Функции для работы с blocklist не выносятся в публичный API сервиса — они используются только внутри `logout` и `refresh`. Прямая работа с `_refresh_blocklist` допустима только внутри этого модуля.

---

### Сигнатуры функций

#### `hash_password`
```python
def hash_password(plain: str) -> str
```
- Хэширует пароль через `passlib.context.CryptContext(schemes=["bcrypt"])`
- Не бросает исключений при нормальном вводе
- Причина синхронности: bcrypt — CPU-bound операция, asyncio её не ускорит; при необходимости вызов можно обернуть в `run_in_executor`

#### `verify_password`
```python
def verify_password(plain: str, hashed: str) -> bool
```
- Сравнивает через `CryptContext.verify` (timing-safe)
- Возвращает `False` при несовпадении, не бросает исключений
- Причина `bool` вместо исключения: решение «доступ запрещён» принимает вызывающий (`login`), а не эта утилита

#### `create_access_token`
```python
def create_access_token(user_id: str) -> str
```
- Формирует payload: `{ "sub": user_id, "exp": <now + ACCESS_TOKEN_EXPIRE_MINUTES>, "type": "access" }`
- Подписывает через `jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)`
- Возвращает строку-токен
- Причина `user_id: str` (не `uuid.UUID`): PyJWT сериализует payload в JSON, UUID нужно приводить к строке — лучше сделать это явно на границе

#### `create_refresh_token`
```python
def create_refresh_token(user_id: str) -> str
```
- Аналогично `create_access_token`, но `"type": "refresh"` и `exp = now + REFRESH_TOKEN_EXPIRE_DAYS * 86400`
- Отдельная функция (не параметр `token_type`) — разные поля и время жизни, объединение усложнило бы сигнатуру

#### `decode_token`
```python
def decode_token(token: str) -> dict
```
- Декодирует и верифицирует JWT через `jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])`
- **Бросает** `HTTPException(status_code=401, detail="token expired or invalid")` при:
  - `jwt.ExpiredSignatureError` — токен истёк
  - `jwt.InvalidTokenError` — любая другая невалидность (подпись, формат)
- Возвращает payload-словарь (включает `sub`, `exp`, `type`)
- Причина `HTTPException` здесь, а не в deps: единая точка обработки JWT-ошибок; deps и router не дублируют try/except

#### `register`
```python
async def register(db: AsyncSession, data: RegisterRequest) -> User
```
- Проверяет уникальность email: `SELECT ... WHERE email = data.email`
- **Бросает** `HTTPException(status_code=409, detail="email already registered")` если пользователь найден
- Создаёт `User(email=data.email, hashed_password=hash_password(data.password), name=data.name)`
- Делает `db.add(user)`, `await db.commit()`, `await db.refresh(user)` — refresh нужен чтобы получить `id` и `created_at`, проставленные на стороне БД
- Возвращает ORM-объект `User`
- Причина `AsyncSession` в сигнатуре: явная зависимость, тестируется через mock-сессию

#### `login`
```python
async def login(db: AsyncSession, data: LoginRequest) -> tuple[User, str, str]
```
- Ищет пользователя по `data.email`
- Если не найден или `verify_password` вернул `False` — **бросает** `HTTPException(status_code=401, detail="invalid credentials")`
- Оба случая дают одинаковый ответ — не раскрывает факт существования email
- При успехе возвращает `(user, access_token, refresh_token)`
- Причина `tuple` вместо схемы: service не знает о форматировании HTTP-ответа — это работа router; tuple — минимально достаточно

#### `refresh_access_token`
```python
def refresh_access_token(token: str) -> str
```
- Вызывает `decode_token(token)` — бросит 401 если невалидный/истёкший
- Проверяет `payload["type"] == "refresh"` — если нет, **бросает** `HTTPException(401, "token expired or invalid")`
- Проверяет `token in _refresh_blocklist` — если да, **бросает** `HTTPException(401, "token expired or invalid")`
- Возвращает новый `create_access_token(payload["sub"])`
- Причина синхронности: нет I/O (blocklist in-memory)

#### `logout`
```python
def logout(access_token: str, refresh_token: str) -> None
```
- Добавляет `refresh_token` в `_refresh_blocklist`
- `access_token` принимается в сигнатуре для будущей возможности добавить его тоже в blocklist (сейчас не используется — access живёт 15 мин, MVP-допущение)
- Не бросает исключений
- Причина синхронности: нет I/O

---

## 4. `backend/app/auth/deps.py`

### `oauth2_scheme`
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
```
Объявляется на уровне модуля. `tokenUrl` используется только для Swagger UI — указывает где получать токен. Схема автоматически извлекает токен из заголовка `Authorization: Bearer <token>` и возвращает 401 если заголовок отсутствует.

### `get_current_user`
```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
) -> User
```

Поведение:
1. `token` приходит из `oauth2_scheme` — строка без префикса `Bearer`
2. Вызывает `service.decode_token(token)` — получает payload или 401
3. Извлекает `user_id = payload["sub"]`
4. Проверяет `payload["type"] == "access"` — если нет (передан refresh-токен), **бросает** `HTTPException(401, "token expired or invalid")`
5. Делает `await db.get(User, uuid.UUID(user_id))`
6. Если пользователь не найден — **бросает** `HTTPException(401, "token expired or invalid")` (не 404, чтобы не раскрывать факт существования)
7. Возвращает ORM-объект `User`

Причина двух Depends (token + db): явные зависимости — легко мокировать в тестах. Альтернатива с `Request` была бы менее явной.

---

## 5. `backend/app/auth/router.py`

### Создание роутера
```python
router = APIRouter(prefix="/auth", tags=["auth"])
```

Prefix `/api/v1` добавляется в `main.py` при `include_router`, не здесь — это стандартная конвенция FastAPI, позволяющая переиспользовать роутер с другим prefix в тестах или версионировании.

---

### Endpoint: `POST /api/v1/auth/register`

**Полный путь после mount:** `POST /api/v1/auth/register`  
**Параметры:**
- Body: `RegisterRequest` — `{ email: EmailStr, password: str, name: str }`
- Depends: `db: AsyncSession = Depends(get_session)`

**Поведение:**
1. Вызывает `await service.register(db, data)`
2. Формирует токены: `access = service.create_access_token(str(user.id))`, `refresh = service.create_refresh_token(str(user.id))`
3. Возвращает `TokenResponse(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))`

**HTTP-коды:**
- `200 OK` — `TokenResponse`
- `409 Conflict` — `{ "detail": "email already registered" }` (бросает service)
- `422 Unprocessable Entity` — невалидное тело (FastAPI автоматически)

---

### Endpoint: `POST /api/v1/auth/login`

**Полный путь:** `POST /api/v1/auth/login`  
**Параметры:**
- Body: `LoginRequest` — `{ email: EmailStr, password: str }`
- Depends: `db: AsyncSession = Depends(get_session)`

**Поведение:**
1. Вызывает `await service.login(db, data)` → `(user, access_token, refresh_token)`
2. Возвращает `TokenResponse(access_token=..., refresh_token=..., user=UserOut.model_validate(user))`

**HTTP-коды:**
- `200 OK` — `TokenResponse`
- `401 Unauthorized` — `{ "detail": "invalid credentials" }`
- `422` — невалидное тело

**Важно:** этот endpoint принимает JSON-тело (`LoginRequest`), а не form-данные (`OAuth2PasswordRequestForm`). `tokenUrl` в `oauth2_scheme` указывает сюда только для Swagger UI — это допустимо, Swagger покажет поле логина/пароля, хотя технически форма не form-encoded.

---

### Endpoint: `POST /api/v1/auth/refresh`

**Полный путь:** `POST /api/v1/auth/refresh`  
**Параметры:**
- Body: `RefreshRequest` — `{ refresh_token: str }`

**Поведение:**
1. Вызывает `service.refresh_access_token(data.refresh_token)` → новый `access_token`
2. Возвращает `{ "access_token": access_token }` (только access, без refresh и user — контракт из PROJECT.md)

**Схема ответа:** анонимная `{"access_token": str}` или отдельная `AccessTokenResponse(BaseModel)` — рекомендуется отдельная схема для явности.

**HTTP-коды:**
- `200 OK` — `{ "access_token": str }`
- `401 Unauthorized` — `{ "detail": "token expired or invalid" }` при истёкшем/невалидном/заблокированном токене или при передаче access-токена вместо refresh

---

### Endpoint: `POST /api/v1/auth/logout`

**Полный путь:** `POST /api/v1/auth/logout`  
**Параметры:**
- Header: `Authorization: Bearer <access_token>` — через `Depends(get_current_user)`
- Body: `RefreshRequest` — `{ refresh_token: str }` (нужен для добавления в blocklist)

**Поведение:**
1. `current_user` получается через `Depends(get_current_user)` — проверяет access-токен
2. Вызывает `service.logout(access_token=token, refresh_token=data.refresh_token)`
3. Возвращает пустой dict `{}`

**Проблема с access_token в logout:** `get_current_user` принимает token через `oauth2_scheme`, но сам token не пробрасывает. Чтобы передать его в `service.logout`, endpoint должен получить token явно: добавить `token: str = Depends(oauth2_scheme)` параллельно с `current_user = Depends(get_current_user)`. Это не дублирует проверку — `get_current_user` делает полную валидацию, `token` нужен только как строка для blocklist.

**HTTP-коды:**
- `200 OK` — `{}`
- `401 Unauthorized` — если access-токен невалидный или отсутствует (из `get_current_user`)

---

## 6. `backend/app/main.py` — дополнение

### Что добавить

**Import:**
```python
from app.auth.router import router as auth_router
```

**Подключение роутера:**
```python
app.include_router(auth_router, prefix="/api/v1")
```
Prefix `/api/v1` задаётся здесь, а не в самом роутере — все модульные роутеры будут подключаться с этим же prefix, единая точка управления версионированием API.

**Endpoint `GET /api/v1/health`:**

Путь: `GET /api/v1/health`  
Depends: `current_user: User = Depends(get_current_user)` — endpoint защищён, используется для проверки что auth-зависимость работает корректно (критерий готовности из README)  
Ответ: `{ "status": "ok", "user_id": str(current_user.id) }` — минимальный ответ, достаточный для диагностики  
HTTP-коды: `200 OK` — аутентифицирован; `401 Unauthorized` — без токена или с невалидным

**Существующие endpoints `GET /` и `GET /protected`:**  
Оставить без изменений (не трогать существующее согласно README).

---

## Сводная карта зависимостей

```
config.py
  └── database.py (импортирует settings)
       └── auth/service.py (импортирует AsyncSession)
            ├── auth/deps.py (импортирует decode_token, get_session)
            │    └── auth/router.py (импортирует get_current_user)
            │         └── main.py (include_router)
            └── auth/router.py (импортирует service-функции)
```

Нет циклических импортов: каждый уровень импортирует только нижележащий.

---

## Открытые вопросы (зафиксированы как MVP-допущения)

| # | Вопрос | Решение в MVP | Срок пересмотра |
|---|--------|---------------|-----------------|
| 1 | `_refresh_blocklist` сбрасывается при рестарте | In-memory `set`, зафиксировано | I-02+ (Redis или таблица БД, задача T-B01) |
| 2 | access_token не инвалидируется при logout | 15-минутный TTL как защита | I-02+ при необходимости |
| 3 | `login` принимает JSON, а не form-data | Swagger UI не полностью совместим | Приемлемо для MVP, Swagger позволяет тестировать вручную |
