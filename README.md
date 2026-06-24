# Production Schedule

Система управления расписанием сотрудников на проектах.

## Структура проекта

Проект разделен на две части (монорепозиторий):

* `frontend/` - SPA приложение на React (Vite, TypeScript, CSS Modules).
* `backend/` - REST API на Node.js (Express, TypeScript, Prisma, PostgreSQL/SQLite).

### Frontend
- **Стек**: React, TypeScript, Vite.
- **Оформление**: Чистый CSS / CSS Modules. Используется тема "Apple Dark Mode".
- **Сетка расписания**: Виртуализированная таблица на базе `@tanstack/react-virtual` с поддержкой Copy/Paste (как текста, так и цвета ячеек).

### Backend
- **Стек**: Node.js, Express, TypeScript.
- **ORM / База данных**: Prisma (в данный момент настроена на локальный SQLite `dev.db`, для продакшена - PostgreSQL).
- **Авторизация**: JWT-токены для администратора и Magic-ссылки для линейного персонала.

## Локальный запуск

1. **База данных и Backend**:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init  # создание таблиц
   npm run seed                        # наполнение тестовыми данными
   npm run dev                         # запуск на порту 3000
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev                         # запуск на порту 2626
   ```

**Доступы для тестирования**:
- Панель администратора: `http://localhost:2626/admin`
- Логин: `Admin` / Пароль: `admin`
