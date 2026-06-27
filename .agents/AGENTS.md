# AGENTS.md — Руководство для ИИ-агентов

Этот файл является исчерпывающим техническим справочником по проекту `production-schedule`. **Читать полностью перед любыми изменениями.**

---

## Структура монорепозитория

```
production-schedule/
├── backend/                   # Node.js / Express / Prisma (SQLite)
│   ├── src/
│   │   ├── index.ts           # Единственный API-сервер, все эндпоинты
│   │   ├── seed.ts            # Заполнение БД тестовыми данными (npm run seed)
│   │   ├── seed-entities.ts   # Создание тестовых сотрудников/техники
│   │   ├── migrate-ids.ts     # Одноразовый скрипт: замена имён UUID-ами в ScheduleDate
│   │   ├── importHtml.ts      # Парсер импорта из HTML (Google Sheets экспорт)
│   │   ├── clean-weekends.ts  # Утилита очистки данных выходных
│   │   └── clean-yellow.ts    # Утилита очистки жёлтых ячеек legacy-данных
│   ├── prisma/
│   │   ├── schema.prisma      # Схема БД (6 моделей)
│   │   └── dev.db             # Файл SQLite (НЕ коммитить в production!)
│   ├── .env                   # DATABASE_URL, JWT_SECRET
│   ├── package.json           # npm-скрипты: dev, build, start, seed
│   └── tsconfig.json          # rootDir: src, outDir: dist
│
├── frontend/                  # React 19 + TypeScript + Vite
│   └── src/
│       ├── App.tsx            # React Router: /login, /admin, /my-calendar
│       ├── api/
│       │   └── client.ts      # Axios: baseURL=http://localhost:3000/api + JWT-интерцептор
│       ├── pages/
│       │   ├── AdminBoard/    # Основная панель администратора (AdminBoard.tsx + .module.css)
│       │   ├── Login/         # Страница входа (Login.tsx + .module.css)
│       │   └── StaffView/     # Персональный просмотр для сотрудника/техники (readOnly)
│       └── components/
│           └── Grid/
│               ├── DataGrid.tsx              # Главный компонент сетки расписания (~832 строк)
│               ├── DataGrid.module.css
│               ├── CellSettingsModal.tsx     # Модальное окно редактирования ячейки
│               ├── CellSettingsModal.module.css
│               ├── DesignSettingsModal.tsx   # Редактор темы (цвета типов смен)
│               ├── DesignSettingsModal.module.css
│               ├── ProjectSettingsModal.tsx  # CRUD проектов (имя + цвет)
│               ├── EquipmentModal.tsx        # CRUD техники (эмодзи + название)
│               ├── StaffModal.tsx            # CRUD сотрудников (имя)
│               └── ColumnSettingsModal.tsx   # Управление столбцами (устаревший, не используется активно)
│
├── testdata/                  # Тестовые HTML-файлы для импорта
├── .agents/AGENTS.md          # Этот файл
└── README.md                  # Инструкция для пользователя
```

**Порты:** Frontend — `2626`, Backend — `3000`.

---

## Модель данных (Prisma / SQLite)

### Модели

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  role         String   @default("STAFF")  // ADMIN | STAFF
  passwordHash String?                      // Только для ADMIN
  accessToken  String?  @unique             // Только для STAFF — токен персональной ссылки
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Car {
  id          String   @id @default(uuid())
  label       String                         // Формат: "🚗 Газель"
  accessToken String?  @unique               // Токен персональной ссылки для водителя
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Project {
  id        String   @id @default(uuid())
  name      String
  color     String   @default("#0a84ff")   // HEX-цвет для визуализации в сетке
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProjectColumn {
  id        String   @id @default(uuid())
  name      String
  order     Int      @default(0)            // Порядок столбцов в сетке
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ScheduleDate {
  id        String   @id @default(uuid())
  date      String   @unique               // Формат строго: YYYY-MM-DD
  data      Json                           // Весь контент дня по всем столбцам
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model StudioSetting {
  id        String   @id @default(uuid())
  key       String   @unique               // Ключи из интерфейса ThemeSettings
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Структура поля `data` в `ScheduleDate` ⚠️ КРИТИЧЕСКИ ВАЖНО

Это JSON-объект, где ключи — это UUID столбцов (`ProjectColumn.id`):

```json
{
  "<column-uuid>": {
    "cellType": "project_start" | "shift" | "day_off" | "sleep_off" | "warehouse" | "relocation" | "stop" | "",
    "text": "строка для отображения (генерируется в handleSave CellSettingsModal)",
    "color": "#hex (цвет проекта, используется в legacy данных)",
    "projectId": "UUID из таблицы Project (только для project_start)",
    "projectName": "Название проекта (только для legacy данных без projectId)",
    "comment": "Комментарий к блоку проекта (только для project_start)",
    "staff": ["uuid-сотрудника-1", "uuid-сотрудника-2"],
    "cars": ["uuid-техники-1"],
    "dayType": "натура" | "павильон",
    "options": ["погрузка", "разгрузка"]
  }
}
```

> **⚠️ АРХИТЕКТУРНЫЙ ПРИНЦИП (после миграции 2026-06-27):**  
> Поля `staff` и `cars` хранят **UUID** из таблиц `User.id` и `Car.id`, а **НЕ строки имён**.  
> Фронтенд разрешает UUID→имя динамически при рендеринге, обращаясь к спискам `activeStaffList` и `activeCars`.  
> Это позволяет мгновенно переименовывать сотрудников и технику без пересчёта всей истории.

> **Legacy данные:** В базе могут существовать старые записи, где `staff`/`cars` содержат текстовые строки имён (импортированные из Google Sheets до миграции). Фронтенд корректно их обрабатывает через двойную проверку: `st.id === s || st.name === s`.

---

## API Бэкенда (backend/src/index.ts)

Все эндпоинты имеют префикс `/api`.

### Аутентификация

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `POST` | `/auth/login` | — | Вход админа. Принимает `{name, password}`, возвращает JWT-токен. |

### Расписание (защищено JWT)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/schedule` | Admin JWT | Возвращает `{columns, dates}` — все столбцы и все даты с данными. |
| `PUT` | `/schedule` | Admin JWT | Upsert одной даты. Body: `{date: "YYYY-MM-DD", data: {...}}`. |

### Столбцы (защищено JWT)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `POST` | `/columns` | Admin JWT | Создать столбец. Body: `{name, order}`. |
| `PUT` | `/columns/reorder` | Admin JWT | Массовое изменение порядка. Body: `[{id, order}]`. |
| `DELETE` | `/columns/:id` | Admin JWT | Удалить столбец + каскадно удалить его данные из всех `ScheduleDate` через `$transaction`. |

### Управление сущностями (защищено JWT)

**Проекты:**

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/admin/projects` | Список всех проектов |
| `POST` | `/admin/projects` | Создать проект. Body: `{name, color}` |
| `PUT` | `/admin/projects/:id` | Обновить имя/цвет проекта |
| `DELETE` | `/admin/projects/:id` | Удалить из справочника (исторические данные сохраняются) |

**Сотрудники:**

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/admin/staff` | Список сотрудников (role=STAFF). Автоматически генерирует `accessToken` если отсутствует. |
| `POST` | `/admin/staff` | Создать сотрудника. Body: `{name}`. Генерирует `accessToken`. |
| `PUT` | `/admin/staff/:id` | Переименовать. Без каскадного обновления истории (хранятся UUID). |
| `DELETE` | `/admin/staff/:id` | Удалить + каскадно убрать UUID сотрудника из всех ячеек в `$transaction`. |

**Техника:**

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/admin/cars` | Список техники. Автоматически генерирует `accessToken` если отсутствует. |
| `POST` | `/admin/cars` | Создать. Body: `{label}`. Формат label: `"🚗 Название"`. |
| `PUT` | `/admin/cars/:id` | Переименовать. Без каскадного обновления истории (хранятся UUID). |
| `DELETE` | `/admin/cars/:id` | Удалить + каскадно убрать UUID из всех ячеек в `$transaction`. |

### Настройки (частично публичные)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/settings` | — | Публичный. Возвращает все `StudioSetting` как `{key: value}`. |
| `PUT` | `/settings` | Admin JWT | Обновить/создать настройки темы. Upsert по ключу. |

### Staff View (без JWT)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/staff/schedule?token=<accessToken>` | Личное расписание. Принимает `accessToken` сотрудника **или** техники. Возвращает `{staffName, columns, dates (отфильтрованные), staffList, cars}`. |

> **Логика фильтрации StaffView:** Сервер возвращает все даты, но в каждой дате оставляет только ячейки типа `project_start`/`stop` (для контекста) + ячейки, где в `staff` присутствует `entityId` (или `entityName` для legacy). Также возвращает полные списки `staffList` и `cars` для разрешения UUID→имя на фронтенде без Admin-прав.

---

## Middleware

```typescript
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  // JWT verify → decoded.role === 'ADMIN'
};
```

JWT выдаётся на 1 день (`expiresIn: '1d'`). Токен хранится в `localStorage` на фронтенде.

---

## Логика сетки (DataGrid.tsx)

### Типы ячеек и их визуализация

| `cellType` | Цвет фона | Поведение |
|------------|-----------|-----------|
| `project_start` | `cell.color` (цвет проекта) | Запускает контекст проекта для колонки. Ниже всё принадлежит этому проекту до `stop`. В ячейке отображается `projectName` жирным. |
| `shift` | `themeSettings.shiftColor` или `pavilionColor` | Показывает: `[emoji техники] [имена сотрудников] [натура/павильон, опции]`. |
| `warehouse` | `themeSettings.warehouseColor` | Аналогично shift, но без требования локации. Если нет сотрудников — показывает "Склад". |
| `relocation` | `themeSettings.transferColor` | Аналогично warehouse, показывает "Переезд" без сотрудников. |
| `day_off` | `themeSettings.weekendColor` | Выходной. Текст: "Выходной". |
| `sleep_off` | `themeSettings.weekendColor` | Отсыпной. Текст: "Отсыпной". |
| `stop` | Цвет проекта (затемнённый) | Закрывает активный проект. Текст: "СТОП". |

### Ключевые вычисления (`useMemo`)

**`activeProjectsContext`** — O(columns × rows). Для каждого столбца создаёт массив `[activeProject | null]` по каждой строке. Обходит строки сверху вниз: встречает `project_start` → запоминает проект, встречает `stop` → сбрасывает в `null`. Используется для:
- Sticky-заголовков проектов в хедере
- `isCellInProject` — определение, должна ли ячейка иметь glow-эффект
- Определения доступных типов ячеек в `CellSettingsModal`

**`gridItems`** — Плоский массив виртуализируемых элементов типа `GridItem`:
```typescript
type GridItem =
  | { type: 'month-header'; monthKey: string; label: string; isCollapsed: boolean }
  | { type: 'row'; row: Row; originalIndex: number };
```
Месяцы свёрнуты по умолчанию (кроме текущего). `originalIndex` — индекс строки в массиве `rows[]` (не в виртуализированном списке).

**`selectionBounds`** — Нормализованные границы выделения (minRow, maxRow, minCol, maxCol), кешируются чтобы не пересчитывать в каждой ячейке.

### Виртуализация

`@tanstack/react-virtual` — рендерятся только видимые строки + 10 строк overscan. `estimateSize: () => 40`. Общая высота = `rowVirtualizer.getTotalSize() + 40` (+ 40px для sticky-хедера).

### Sticky-заголовки проектов

При скролле вниз активный проект "прилипает" к верху колонки. Логика определения `topOriginalIndex`:
- Перебираем `virtualItems` от начала
- Берём первый `type === 'row'`, у которого `vi.start + vi.size > scrollTop + 40`
- Это даёт индекс первой строки, частично или полностью видимой в viewport

### Glow-эффект проектов

Ячейки внутри проекта (`isCellInProject = !!activeProjectForCell && !isProjectStart && (isWorkingShift || isWeekend)`) получают `inset box-shadow`:
- Смены: `color + '26'` (~15% opacity)
- Выходные: `color + '1A'` (~10% opacity)

### Разрешение цветов (`resolveCellColor`)

Приоритет:
1. `project_start` / legacy с `projectName` → цвет из `cell.color` (через `DARK_COLOR_MAP`)
2. `day_off` / `sleep_off` / legacy выходные → `themeSettings.weekendColor`
3. `stop` → цвет активного проекта (через `DARK_COLOR_MAP`)
4. `warehouse` → `themeSettings.warehouseColor`
5. `relocation` → `themeSettings.transferColor`
6. `dayType === 'павильон'` → `themeSettings.pavilionColor`
7. Рабочая смена (shift / legacy) → `themeSettings.shiftColor`
8. Пусто → `undefined` (стандартный фон ячейки)

### Legacy цвета Google Sheets (`DARK_COLOR_MAP`)

| Исходный (светлый) | Тёмный эквивалент | Значение |
|--------------------|--------------------|----------|
| `#b6d7a8` | `#1e4620` | Зелёный → тёмно-зелёный |
| `#fff2cc` | `#5c4008` | Жёлтый (смена) → тёмно-жёлтый |
| `#f4cccc` | `#5c1e1e` | Красный (стоп) → тёмно-красный |
| `#ffe599` / `#ffd966` | `#7f6000` | Насыщенный жёлтый → тёмно-янтарный |
| `#e06666` / `#cc0000` | `#660000` | Красный → тёмно-красный |
| `#cccccc` | `#2c2c2e` | Серый (техника) → тёмно-серый |
| `#efefef` | `#1c1c1e` | Пустой placeholder → почти чёрный |
| `#ffcc00` | `#5c4008` | Жёлтый → тёмно-янтарный |
| `#66ccff` | `#0a3050` | Голубой → тёмно-синий |

### Разрешение имён из UUID (`activeStaffList` / `activeCars`)

DataGrid держит две версии списков:
- `staffList` / `cars` — пришли через props от AdminBoard (с полными данными)
- `localStaffList` / `localCars` — загружены из ответа `/staff/schedule` API (для StaffView)

Активные списки: `const activeStaffList = staffList || localStaffList;`

При рендеринге ячейки:
```typescript
// Для staff: ищем UUID или fallback на имя (legacy)
const st = activeStaffList?.find(s => s.id === idOrName || s.name === idOrName);
return st ? st.name : idOrName;

// Для cars: ищем UUID или fallback на label (legacy)
const car = activeCars?.find(c => c.id === carIdOrLabel || c.label === carIdOrLabel);
```

### Highlight/Dimming

При активном `highlightText` ячейки, не содержащие текст, получают класс `styles.dimmed`. Поиск выполняется по:
1. `cellData.text` (legacy)
2. `staff` массив → резолвим через `activeStaffList` → сравниваем по `.name`
3. `cars` массив → резолвим через `activeCars` → сравниваем по `.label`

### Copy/Paste

- **Копирование (Cmd/Ctrl+C):** Сохраняет в clipboard два формата: `text/plain` (tab-separated) и `application/json` (массив объектов ячеек).
- **Вставка:** Приоритетно читает `application/json`. При вставке `project_start` автоматически меняет `cellType` на `shift`. Вставка в ячейки без активного проекта пропускается.

---

## CellSettingsModal — логика редактирования ячеек

### Контекст открытия

- **Нет активного проекта** → доступен только `project_start`. Обязательно выбрать проект из `globalProjects`.
- **Есть активный проект** → доступны: `shift`, `warehouse`, `relocation`, `day_off`, `sleep_off`, `stop`.

### Поля по типам

| Тип | Обязательные поля | Опциональные |
|-----|-------------------|--------------|
| `project_start` | `projectId` (выпадающий список) | `comment` |
| `shift` | `dayType` (натура/павильон) | `staff[]`, `cars[]`, `options[]` |
| `warehouse` | — | `staff[]`, `cars[]`, `options[]` |
| `relocation` | — | `staff[]`, `cars[]`, `options[]` |
| `day_off` / `sleep_off` / `stop` | — | — |

### Сохранение данных

При `handleSave`:
1. Для `shift`/`warehouse`/`relocation`: формирует `text` из имён сотрудников (через `staffList.find(st => st.id === s || st.name === s)`) + `[dayType, ...options]` в скобках
2. Для `project_start`: берёт имя/цвет из `globalProjects` по `projectId`
3. В `staff[]` сохраняет **UUID** сотрудников (из `<select value={s.id}>`)
4. В `cars[]` сохраняет **UUID** техники (из `toggleCar(car.id)`)
5. `text` поле используется для обратной совместимости с legacy-данными

### detectLegacyCellType

Автодетекция типа ячейки при открытии модала для legacy-данных (без `cellType`):
```
dayType === 'стоп' || text === 'СТОП'  →  'stop'
dayType === 'отсыпной' || text === 'Отсыпной'  →  'sleep_off'
dayType === 'выходной' || text === 'Выходной'  →  'day_off'
dayType === 'склад' || text.includes('Склад')  →  'warehouse'
dayType === 'переезд' || text.includes('Переезд')  →  'relocation'
projectName || (text && !hasActiveProject && !staff && !cars)  →  'project_start'
staff.length || cars.length || dayType || text  →  'shift'
!hasActiveProject  →  'project_start'
```

---

## Управление столбцами

- **Добавить столбец:** Кнопка «➕ Добавить столбец» в нижней части сайдбара AdminBoard. Вызывает `gridRef.current.addColumn()`, который через `useImperativeHandle`-паттерн вызывает `handleAddColumn` в DataGrid.
- **Удалить столбец:** Кнопка «✕» на заголовке каждого столбца (видна только в readOnly=false). При удалении каскадно очищаются все данные этого столбца из `ScheduleDate` через `$transaction`.
- **Порядок столбцов:** Управляется полем `order` в `ProjectColumn`. Эндпоинт `PUT /columns/reorder` принимает массив `[{id, order}]`.

---

## Управление сотрудниками и техникой (AdminBoard sidebar)

Логика взаимодействия:

1. **Клик на невыделенную сущность** → выделяет + показывает кнопку `🔗`
2. **Клик на кнопку `🔗`** → копирует в clipboard URL `${origin}/my-calendar?token=${accessToken}` + открывает его в новой вкладке
3. **При выделении** → показываются кнопки `✏️` (редактировать) и `🗑` (удалить)
4. **Клик на уже выделенную** → снимает выделение (возврат к режиму highlight)
5. **Highlight режим:** клик на сотрудника устанавливает `highlight.text = s.name`, что передаётся в DataGrid как `highlightText`. Сетка затемняет ячейки, в которых этот сотрудник не назначен.

---

## Тема (ThemeSettings)

Все настройки хранятся в `StudioSetting` таблице (key-value).

```typescript
interface ThemeSettings {
  weekendColor: string;    // Цвет day_off и sleep_off
  shiftColor: string;      // Цвет обычной смены (натура)
  pavilionColor: string;   // Цвет павильонной смены
  warehouseColor: string;  // Цвет склада
  transferColor: string;   // Цвет переезда
  hoverGlowColor: string;  // Цвет glow при hover (CSS --glow-rgb)
  currentDayColor: string; // Цвет выделения текущего дня (CSS --current-day-rgb)
  fontSize: string;        // Размер шрифта в ячейках ("13px")
}
```

Defaults определены в `DesignSettingsModal.tsx` как `DEFAULT_THEME`. Тема применяется через CSS custom properties на корневом элементе `DataGrid`:
```tsx
style={{ '--glow-rgb': hexToRgbString(themeSettings.hoverGlowColor), ... }}
```

---

## Стилизация

- **Только чистый CSS / CSS Modules.** Tailwind CSS запрещён.
- CSS-переменные темы определены в `frontend/src/index.css`.

### Z-index слои

| Элемент | z-index |
|---------|---------|
| `.dateCell` (sticky колонка дат) | 10 |
| `.monthHeaderRow` | 19 |
| `.headerRow` | 20 |
| Ячейка "Дата" в заголовке | 21 |
| Оверлей активного проекта в хедере | 22 |
| `isCellInProject` glow overlay | 1 (внутри ячейки) |
| `.cellText` | 2 (поверх glow) |

---

## Работа с датами

- Даты хранятся и сравниваются строго как строки `YYYY-MM-DD`.
- **Никогда** не использовать `new Date(dateString)` для сравнений — риск сдвига таймзоны.
- «Текущий день» определяется через `formatTodayStr(new Date())` один раз на монтировании (`useMemo`).
- В сетке отображаются как `DD.MM` (парсинг: `const [,,day] = d.date.split('-')`).

---

## SQLite и транзакции

При каскадных операциях (удаление сотрудника/техники/столбца) **всегда** накапливать операции в массив и выполнять через `await prisma.$transaction(updates)`.

Последовательные `await` внутри цикла в SQLite работают в 10–50 раз медленнее транзакции!

---

## JWT и безопасность

- Все эндпоинты `/api/schedule`, `/api/columns`, `/api/admin/*` защищены middleware `requireAdmin`.
- JWT токен: `Authorization: Bearer <token>` в заголовке запроса.
- `GET /api/settings` — публичный (нужен для StaffView чтобы загрузить тему).
- Staff View использует `?token=<accessToken>` — без JWT. `accessToken` генерируется `crypto.randomBytes(16).toString('hex')`.
- `JWT_SECRET` **обязательно** должен быть задан в `.env`. При его отсутствии сервер не запустится.

---

## Бэкенд: компиляция

- TypeScript компилируется в `dist/` (`rootDir: src`, `outDir: dist`).
- Команды: `npm run dev` (nodemon + tsx, без компиляции), `npm run build` (tsc), `npm run start` (node dist/index.js).
- **Никогда** не коммитить скомпилированные `.js` файлы в `src/`.

---

## Частые ошибки и как их избежать

1. **Белые ячейки** — legacy `color` из Google Sheets (напр. `#cccccc`) не добавлен в `DARK_COLOR_MAP`. Решение: добавить маппинг в `DataGrid.tsx` или очистить данные через утилиту.

2. **Sticky-заголовок проекта исчезает при скролле** — Баг при использовании `gridItems[0].originalIndex`. Нужно перебирать виртуальные items и брать первый с `type === 'row'` и `vi.start + vi.size > scrollTop`.

3. **Прокрутка к сегодня не работает** — При закрытом месяце нужно сначала открыть его через `setCollapsedMonths`, затем вызвать `scrollToIndex` с задержкой `setTimeout(..., 50)`.

4. **z-index конфликт заголовков со sticky-хедером** — Sticky `position` на заголовках столбцов (не date) должен быть `relative`, не `sticky`.

5. **Сотрудник не отображается в StaffView** — Проверить что в `cell.staff[]` присутствует либо `user.id`, либо `user.name` (для legacy). Функция фильтрации на бэкенде проверяет оба.

6. **Переименование не отражается в сетке** — Проверить что `AdminBoard` передаёт полный объект `staffList` (не `.map(s => s.name)`), и что `DataGrid.activeStaffList` не пустой.

7. **Новая ячейка не показывает имя сотрудника** — Проверить что `CellSettingsModal` сохраняет `s.id` в `staff[]`, а не `s.name`.

---

## Инструменты разработки

```bash
# Backend
cd backend
npm run dev          # Запуск с hot-reload (nodemon + tsx)
npm run build        # Компиляция TypeScript
npm run seed         # Заполнение БД тестовыми данными
npx prisma studio    # Браузерный интерфейс для просмотра БД
npx prisma db push   # Применить изменения схемы без миграций

# Frontend
cd frontend
npm run dev          # Vite dev server на порту 2626
npm run build        # Production сборка
npm run preview      # Предпросмотр production сборки
```
