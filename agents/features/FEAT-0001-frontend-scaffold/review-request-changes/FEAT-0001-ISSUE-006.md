# FEAT-0001-ISSUE-006: RuleActionParams использует обязательные поля вместо опциональных

## Severity
minor

## Файл
`frontend/lib/types.ts` строки 87–91

## Проблема

```typescript
export interface RuleActionParams {
  column_id: string | undefined;
  tag: string | undefined;
  message: string | undefined;
}
```

Поля объявлены как `string | undefined` (обязательные поля, которые могут иметь значение `undefined`), а не как `string?` (опциональные поля, которых может не быть вовсе).

Разница критична при строгом TypeScript (`strict: true`):
- `string | undefined` требует **явно** передавать `column_id: undefined` при создании объекта
- `string?` (т.е. `column_id?: string`) позволяет **опустить** поле полностью

Пример: при создании действия типа `"add_tag"` разработчик должен писать:
```typescript
const params: RuleActionParams = {
  column_id: undefined, // ← вынужден писать это явно
  tag: "urgent",
  message: undefined,   // ← и это
};
```

Вместо ожидаемого:
```typescript
const params: RuleActionParams = { tag: "urgent" };
```

Это создаёт лишнее когнитивное трение и не соответствует тому, как бэкенд реально сериализует/десериализует объекты (JSON не передаёт поля с null/undefined — они просто отсутствуют).

## Ожидаемое поведение

```typescript
export interface RuleActionParams {
  column_id?: string;
  tag?: string;
  message?: string;
}
```

Опциональные поля (`?`) семантически точнее описывают контракт: поле отсутствует, а не присутствует со значением undefined.

## Требует пересмотра архитектуры?
Нет — изменение только в `types.ts`, не затрагивает логику.
