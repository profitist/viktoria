# FEAT-0002-ISSUE-003: Решено
## Что исправлено
`field_validator` для `jwt_secret` расширен: теперь помимо проверки на "changeme" добавлена проверка `len(value) < 32` с ошибкой `"jwt_secret must be at least 32 characters"`. Пустые строки и короткие секреты больше не проходят валидацию.
## Файл
`backend/app/config.py`
