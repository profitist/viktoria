# FEAT-0001-ISSUE-002: Решено

## Что исправлено
Убран вызов `scheduleReconnect()` из обработчика `onerror`. Браузер всегда вызывает `onclose` после `onerror`, поэтому только `onclose` отвечает за reconnect. Двойной вызов `scheduleReconnect()` приводил к двум параллельным таймерам переподключения.

## Файл
`frontend/lib/ws.ts`
