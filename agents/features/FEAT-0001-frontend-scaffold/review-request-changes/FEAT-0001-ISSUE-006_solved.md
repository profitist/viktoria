# FEAT-0001-ISSUE-006: Решено

## Что исправлено
Заменены явные `field: string | undefined` на краткую форму `field?: string` для опциональных полей в трёх интерфейсах: `Column.color`, `RuleActionParams.column_id/tag/message`, `AuditLogEntry.task_title`. Семантика не изменилась, но код стал идиоматичным TypeScript.

## Файл
`frontend/lib/types.ts`
