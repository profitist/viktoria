# FEAT-0001-ISSUE-002: WsClient — двойной scheduleReconnect при ошибке соединения

## Severity
major

## Файл
`frontend/lib/ws.ts` строки 54–64

## Проблема

В браузере, когда WebSocket-соединение завершается с ошибкой, **оба** обработчика срабатывают последовательно: сначала `onerror`, затем `onclose`. Это поведение описано в спецификации W3C WebSocket API:

> "If the connection fails, after the error event is fired, the WebSocket object's readyState attribute is changed to CLOSED and a close event is fired."

Текущая реализация вызывает `scheduleReconnect()` в обоих обработчиках:

```typescript
this.socket.onclose = () => {
  if (this.shouldReconnect) {
    this.scheduleReconnect(); // вызов 1
  }
};

this.socket.onerror = () => {
  if (this.shouldReconnect) {
    this.scheduleReconnect(); // вызов 2 (срабатывает первым)
  }
};
```

Результат: при каждой ошибке соединения создаются **два таймера** reconnect. Оба таймера вызовут `connect()`, что создаёт два WebSocket-объекта одновременно. Каждый из них при следующей ошибке снова создаёт два таймера — число соединений растёт экспоненциально. Дополнительно `retryDelay` удваивается дважды за одну ошибку (вместо одного раза), что ломает заявленную схему задержек: 1с → 4с → 16с → 30с вместо 1с → 2с → 4с → 8с.

## Ожидаемое поведение

`onerror` не должен вызывать `scheduleReconnect()`. Обработчик `onerror` нужен только для логирования (опционально). Reconnect должен планироваться исключительно в `onclose`, так как `onclose` всегда срабатывает после `onerror`:

```typescript
this.socket.onerror = () => {
  // только логирование при необходимости; reconnect — в onclose
};

this.socket.onclose = () => {
  if (this.shouldReconnect) {
    this.scheduleReconnect();
  }
};
```

## Требует пересмотра архитектуры?
Нет — однострочное исправление в `ws.ts`.
