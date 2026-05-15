# FEAT-0002-ISSUE-002: Решено
## Что исправлено
Добавлена константа `_DUMMY_HASH` на уровне модуля (bcrypt-хеш заглушки). В `login`, если пользователь не найден по email, вызывается `verify_password("dummy", _DUMMY_HASH)` перед броском 401 — это выравнивает время ответа и исключает user enumeration по timing.
## Файл
`backend/app/auth/service.py`
