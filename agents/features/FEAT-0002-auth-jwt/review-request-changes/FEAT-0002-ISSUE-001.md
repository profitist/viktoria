# FEAT-0002-ISSUE-001: ValueError при malformed UUID в sub-поле JWT не перехватывается

## Severity
major

## Файл
`backend/app/auth/deps.py` строка 24

## Проблема
`uuid.UUID(user_id)` бросает `ValueError`, если поле `sub` в JWT содержит не-UUID строку (например, если токен выдан другим сервисом или намеренно подделан атакующим). FastAPI не обрабатывает `ValueError` как 401 — возвращается `500 Internal Server Error`.

Это нарушает принципы Functional Clarity (Fail-fast с явной обработкой ошибок) и раскрывает факт ошибки парсинга в трейсбеке, что противоречит требованию минимального раскрытия информации.

Текущий код:
```python
user = await db.get(User, uuid.UUID(user_id))
```

## Ожидаемое поведение
При malformed `sub` (не-UUID строка) клиент должен получить `401 {"detail": "token expired or invalid"}`, а не `500`.

Исправление:
```python
try:
    user_uuid = uuid.UUID(user_id)
except ValueError:
    raise HTTPException(status_code=401, detail="token expired or invalid")
user = await db.get(User, user_uuid)
```

## Требует пересмотра архитектуры?
Нет
