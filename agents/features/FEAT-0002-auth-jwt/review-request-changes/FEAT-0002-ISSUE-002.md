# FEAT-0002-ISSUE-002: Timing-атака при логине — verify_password пропускается когда пользователь не найден

## Severity
minor

## Файл
`backend/app/auth/service.py` строка 68

## Проблема
Текущая реализация использует short-circuit `or`:

```python
if user is None or not verify_password(data.password, user.hashed_password):
    raise HTTPException(status_code=401, detail="invalid credentials")
```

Когда `user is None`, вызов `verify_password` (bcrypt) пропускается полностью. bcrypt занимает ~100-300 мс. В результате ответ при несуществующем email возвращается значительно быстрее, чем при существующем email с неверным паролем. Атакующий может за счёт измерения времени ответа определить, зарегистрирован ли email — именно та атака перечисления пользователей, которую требования требуют предотвратить.

Это нарушает пункт README: *"401 — не раскрывать существует ли email"*.

## Ожидаемое поведение
При несуществующем email нужно всё равно вызвать `verify_password` с фиктивным хэшем, чтобы выровнять время ответа:

```python
DUMMY_HASH = hash_password("dummy-constant-value")  # на уровне модуля

async def login(db: AsyncSession, data: LoginRequest) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    candidate_hash = user.hashed_password if user is not None else DUMMY_HASH
    if user is None or not verify_password(data.password, candidate_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    ...
```

## Требует пересмотра архитектуры?
Нет
