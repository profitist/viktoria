# FEAT-0002-ISSUE-006: 401-ответы из service.py не содержат заголовок WWW-Authenticate

## Severity
minor

## Файл
`backend/app/auth/service.py` строки 44, 46, 78, 80; `backend/app/auth/deps.py` строки 22, 26

## Проблема
RFC 7235 (HTTP Authentication) требует, чтобы ответ 401 Unauthorized содержал заголовок `WWW-Authenticate`. OAuth2PasswordBearer автоматически добавляет этот заголовок только для 401, генерируемых им самим (при отсутствии Bearer-токена в запросе).

`HTTPException(status_code=401, ...)` из service.py и deps.py не содержит `headers={"WWW-Authenticate": "Bearer"}`. Это нарушает стандарт и может вызвать проблемы с некоторыми HTTP-клиентами (браузеры, библиотеки, которые ожидают этот заголовок для автоматического перезапроса учётных данных).

Текущий код (пример):
```python
raise HTTPException(status_code=401, detail="token expired or invalid")
```

## Ожидаемое поведение
Добавить заголовок во все 401-ответы:

```python
raise HTTPException(
    status_code=401,
    detail="token expired or invalid",
    headers={"WWW-Authenticate": "Bearer"},
)
```

Затронуто: `decode_token` (2 места), `refresh_access_token` (2 места), `get_current_user` (2 места), `login` (1 место).

## Требует пересмотра архитектуры?
Нет
