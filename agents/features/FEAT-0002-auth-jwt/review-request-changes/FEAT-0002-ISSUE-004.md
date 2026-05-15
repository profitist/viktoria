# FEAT-0002-ISSUE-004: logout добавляет refresh_token в blocklist без предварительной валидации

## Severity
minor

## Файл
`backend/app/auth/service.py` строка 84-85

## Проблема
Функция `logout` принимает `refresh_token: str` и сразу добавляет его в `_refresh_blocklist` без проверки:

```python
def logout(access_token: str, refresh_token: str) -> None:
    _refresh_blocklist.add(refresh_token)
```

Клиент может передать произвольную строку в поле `refresh_token` тела `/logout`. Access-токен проверяется через `Depends(get_current_user)`, но refresh_token не валидируется — в blocklist попадают мусорные строки.

Последствия для MVP незначительны (in-memory set, сбрасывается при рестарте), но формирует неправильный паттерн для I-02+, когда blocklist переедет в Redis и каждая запись будет стоить ресурсов.

## Ожидаемое поведение
Перед добавлением в blocklist вызвать `decode_token(refresh_token)` и проверить `type == "refresh"`. Если невалидный — либо просто проигнорировать (logout идемпотентен), либо бросить 401:

```python
def logout(access_token: str, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") == "refresh":
            _refresh_blocklist.add(refresh_token)
    except HTTPException:
        pass  # уже недействительный токен — logout всё равно успешен
```

Решение об игнорировании vs 401 зависит от требований UX: logout с уже истёкшим refresh_token должен ли быть ошибкой? По текущему контракту README `/logout` не возвращает ошибок при невалидном refresh_token (только access проверяется).

## Требует пересмотра архитектуры?
Нет
