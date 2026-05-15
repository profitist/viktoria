# FEAT-0002-ISSUE-006: Решено
## Что исправлено
Все `HTTPException(status_code=401, ...)` в `service.py` и `deps.py` дополнены `headers={"WWW-Authenticate": "Bearer"}` согласно RFC 7235. Затронуты: `decode_token` (2 места), `login` (2 места), `refresh_access_token` (2 места), `get_current_user` (3 места).
## Файлы
`backend/app/auth/service.py`, `backend/app/auth/deps.py`
