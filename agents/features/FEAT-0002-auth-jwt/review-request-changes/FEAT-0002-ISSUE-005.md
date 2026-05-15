# FEAT-0002-ISSUE-005: /protected endpoint не защищён аутентификацией

## Severity
minor

## Файл
`backend/app/main.py` строки 37-41

## Проблема
Endpoint `GET /protected` существовал до этой фичи и не был изменён. Он не имеет `Depends(get_current_user)` и возвращает `{"message": "Backend connected successfully"}` без аутентификации:

```python
@app.get("/protected")
async def protected():
    return {"message": "Backend connected successfully"}
```

Название `protected` вводит в заблуждение — endpoint публичен. Это не нарушение безопасности текущей фичи (endpoint не раскрывает данных), но нарушает принцип Явной обработки ошибок (Error Hiding): имя говорит одно, поведение — другое.

## Ожидаемое поведение
Два варианта:
1. Переименовать в `GET /ping` или `GET /test` — честное название для открытого endpoint
2. Добавить `Depends(get_current_user)` — сделать реально защищённым

Если endpoint является scaffolding-артефактом, подлежащим удалению в следующей итерации — зафиксировать в TODO-комментарии.

## Требует пересмотра архитектуры?
Нет
