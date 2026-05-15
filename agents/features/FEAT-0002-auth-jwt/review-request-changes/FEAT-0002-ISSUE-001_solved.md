# FEAT-0002-ISSUE-001: Решено
## Что исправлено
`uuid.UUID(user_id)` обёрнут в `try/except ValueError`. При невалидном `sub` в токене бросается `HTTPException(401, detail="invalid token", headers={"WWW-Authenticate": "Bearer"})` вместо необработанного 500.
## Файл
`backend/app/auth/deps.py`
