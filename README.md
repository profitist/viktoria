# Viktoria

Viktoria — event-driven kanban-система для управления задачами и автоматизации рабочих процессов.

Проект разработан в рамках хакатона как аналог Jira/Trello с упором на:
- real-time синхронизацию,
- обработку событий,
- автоматизацию действий,
- масштабируемую backend-архитектуру.

---

## Что умеет система

### Канбан-доска
- создание и перемещение задач,
- колонки To Do / In Progress / Done,
- кастомные колонки,
- drag & drop интерфейс,
- теги, приоритеты, дедлайны.

### Real-time работа
Все изменения синхронизируются между пользователями через WebSocket:
- создание задач,
- обновление,
- перемещение между колонками,
- уведомления,
- изменения статусов.

### Event-driven архитектура
Каждое действие внутри системы превращается в событие:

Пользователь → API → RabbitMQ → обработка → WebSocket → обновление UI

События:
- валидируются,
- дедуплицируются,
- обогащаются метаданными,
- отправляются в automation engine.

### Автоматизация
Система поддерживает правила автоматизации:
- уведомления при изменениях,
- реакции на перемещение задач,
- автоматические флаги,
- обработка событий по тегам и статусам.

### AI-функции
Реализован AI-assisted grooming:
- генерация задач,
- уточнение описаний,
- помощь при формировании task flow.

---

## Архитектура

Frontend (Next.js)
        ↓
FastAPI Backend
        ↓
RabbitMQ Event Bus
        ↓
Automation Engine
        ↓
PostgreSQL + WebSocket Sync

---

## Стек технологий

### Frontend
- Next.js 16
- React 19
- TypeScript
- TailwindCSS
- shadcn/ui

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic

### Infrastructure
- PostgreSQL
- RabbitMQ
- Docker Compose

### Realtime
- WebSocket
- JSON-RPC 2.0

---

## Почему проект интересен

В отличие от обычного CRUD-канбана, Viktoria построена как поток событий.

Это позволяет:
- синхронизировать пользователей в real-time,
- подключать автоматизацию,
- масштабировать систему,
- отслеживать изменения,
- строить event-driven workflow.

---

## Запуск проекта

git clone https://github.com/profitist/viktoria
cd viktoria

docker compose up --build

---

## Соответствие требованиям кейса

### Реализовано
- Kanban board
- Real-time обновления
- Event-driven обработка
- RabbitMQ pipeline
- Автоматизация событий
- Уведомления
- WebSocket синхронизация
- Docker deployment
- Масштабируемая архитектура

### Дополнительно
- AI-assisted task grooming
- Deadline highlighting
- Analytics foundation
- Modular backend architecture
