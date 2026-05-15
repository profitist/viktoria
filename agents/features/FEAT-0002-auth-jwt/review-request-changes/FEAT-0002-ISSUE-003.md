# FEAT-0002-ISSUE-003: Валидатор jwt_secret не защищает от пустой строки и whitespace-only значений

## Severity
minor

## Файл
`backend/app/config.py` строка 22-24

## Проблема
Валидатор проверяет только `value == "changeme"`. Следующие значения пройдут валидацию и создадут слабо защищённый секрет:

- `JWT_SECRET=""` (пустая строка)
- `JWT_SECRET=" "` (пробел)
- `JWT_SECRET="secret"`, `JWT_SECRET="test"`, `JWT_SECRET="1234"` (слабые, но не `"changeme"`)

PyJWT примет любую строку в качестве ключа HS256. Минимальная защита — проверка минимальной длины (32+ символа для HS256 по NIST SP 800-107).

Текущий код:
```python
if value == "changeme":
    raise ValueError("JWT_SECRET must not be 'changeme' in production")
```

## Ожидаемое поведение
Добавить проверку минимальной длины и непустоты:

```python
if not value or value.strip() == "":
    raise ValueError("JWT_SECRET must not be empty")
if value == "changeme":
    raise ValueError("JWT_SECRET must not be 'changeme' in production")
if len(value) < 32:
    raise ValueError("JWT_SECRET must be at least 32 characters for HS256")
```

## Требует пересмотра архитектуры?
Нет
