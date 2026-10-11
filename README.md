# Mycelia

Веб-редактор інтелект-карт: ідеї ростуть від кореневої думки гілками, як грибниця.
Курсова робота з дисципліни «Технології розроблення програмного забезпечення».

**Стек:** Vue 3 + Pinia + Vue Router (клієнт), Node.js + Express (сервер), Prisma ORM,
MySQL у розробці → PostgreSQL (Supabase) у продакшені, JWT в httpOnly-cookie.

## Структура

```
mycelia/
├── client/                    Vue 3 + Vite
│   └── src/
│       ├── core/              ядро предметної області БЕЗ Vue (патерни живуть тут)
│       │   ├── TreeNode.js    Composite
│       │   ├── layout/        Strategy: radial, tree, bilateral + LayoutContext
│       │   ├── render/        Bridge: MapRenderer + RenderBackend (SvgSceneBackend)
│       │   ├── geometry.js    криві між вузлами
│       │   └── viewport.js    зум, панорама, «вписати»
│       ├── api/               fetch-обгортка (cookie, обробка помилок)
│       ├── stores/            Pinia: авторизація, редактор карти (вузли, виділення, розкладка)
│       ├── router/            маршрути і guard для сторінок
│       ├── views/             Login, Register, Maps, Editor
│       └── components/        AuthForm, NodeItem, MapCanvas (SVG-полотно)
└── server/                    Express + Prisma
    ├── prisma/schema.prisma   модель даних
    ├── src/
    │   ├── services/          шар SOA: AuthService, MapService (пізніше FileService, ExportService)
    │   ├── repositories/      єдине місце, що знає про Prisma
    │   ├── routes/            HTTP-маршрути (тонкі, без логіки)
    │   ├── middleware/        авторизація, обробка помилок
    │   ├── app.js             фабрика застосунку (залежності передаються ззовні)
    │   └── server.js          точка складання: Prisma → репозиторії → сервіси → HTTP
    └── tests/                 тести через фейкові репозиторії, без БД
```

Ланцюжок викликів: **route → service → repository → Prisma**. Сервіси нічого не знають
про Express і Prisma, тому їх можна тестувати без БД, а перехід MySQL → PostgreSQL
торкається тільки `schema.prisma`.

## Запуск

Потрібно: Node.js 20+, MySQL.

```bash
# 1. База даних
mysql -u root -p -e "CREATE DATABASE mycelia CHARACTER SET utf8mb4;"

# 2. Налаштування сервера
cp server/.env.example server/.env      # впиши DATABASE_URL і JWT_SECRET

# 3. Залежності (в корені; тут же згенерується клієнт Prisma)
npm install

# 4. Таблиці
cd server && npx prisma migrate dev --name init && cd ..

# 5. Два термінали
npm run dev:server      # http://localhost:3000
npm run dev:client      # http://localhost:5173
```

Тести: `npm test` (сервер і клієнт). Вони не потребують БД.

## API

| Метод | Шлях | Опис |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ email, password }` → створює акаунт і ставить cookie |
| POST | `/api/auth/login` | `{ email, password }` → ставить cookie |
| POST | `/api/auth/logout` | очищає cookie |
| GET | `/api/auth/me` | поточний користувач |
| GET | `/api/maps` | список карт користувача |
| POST | `/api/maps` | `{ title, theme?, layout? }` → карта з кореневим вузлом |
| GET | `/api/maps/:id` | карта з вузлами, вкладеннями й областями |
| PATCH | `/api/maps/:id` | зміна назви, теми, розкладки |
| DELETE | `/api/maps/:id` | видалення |
| POST | `/api/maps/:id/nodes` | `{ parentId, text?, index? }` → новий вузол (index — позиція серед сусідів) |
| PATCH | `/api/maps/:id/nodes/:nodeId` | `text`, `collapsed`, `style`, `category`, `priority` (low / normal / high / urgent або null) |
| POST | `/api/maps/:id/nodes/:nodeId/move` | `{ parentId, index? }` → список змінених позицій `{ id, parentId, order }` |
| DELETE | `/api/maps/:id/nodes/:nodeId` | видаляє вузол з піддеревом, повертає `{ deleted, changes }` |

Корінь карти не можна видалити чи перемістити; вузол не можна перемістити у власне піддерево;
на карті не більше 2000 вузлів.

Чужа карта повертає 404, а не 403, щоб не розкривати чужі id.

## Відомі обмеження

- MySQL обмежує вкладеність каскадних видалень самопосилання 15 рівнями. Видалення вузла це
  враховує (`NodeRepository.deleteLeafFirst`), але видалення цілої карти з гілкою глибшою за 15
  рівнів на MySQL може не пройти. У PostgreSQL такого обмеження немає.

## Безпека (що вже закладено)

- Паролі: bcrypt, 8–72 символи (межа bcrypt).
- JWT (HS256) в httpOnly-cookie: недоступний JavaScript, тому XSS його не вкраде.
  Заголовок `Authorization: Bearer` теж підтримується (Postman, тести).
- Однакова відповідь на неправильний email і неправильний пароль, щоб не розкривати, хто зареєстрований.
- Rate limit на `/api/auth`: 20 спроб за 15 хвилин з одного IP.
- `helmet`, CORS лише для `CLIENT_ORIGIN`, ліміт тіла запиту 1 МБ, валідація всіх входів через zod.

## Перехід на PostgreSQL (Supabase)

1. У `server/prisma/schema.prisma` змінити `provider = "mysql"` на `"postgresql"`.
2. У `.env` поставити рядок підключення Supabase.
3. Видалити `server/prisma/migrations` і створити заново: `npx prisma migrate dev --name init`.

Код сервісів і репозиторіїв не змінюється.

## Деплой (Render)

Клієнт і API на різних доменах, тому на сервері: `NODE_ENV=production`, `COOKIE_SAMESITE=none`,
`CLIENT_ORIGIN=<адреса клієнта>`; на клієнті: `VITE_API_URL=<адреса API>/api`.
Команда збірки сервера: `npm install && npx prisma migrate deploy`.

## Карта патернів

| Патерн | Де |
| --- | --- |
| Composite | `client/src/core/TreeNode.js` (готово) |
| Strategy | `client/src/core/layout/`: три розкладки, `LayoutContext` міняє їх на льоту (готово); формати експорту ще попереду |
| Bridge | `client/src/core/render/`: `MapRenderer` не знає, чим малює; зараз бекенд `SvgSceneBackend`, Canvas можна додати без змін у рендерері (готово) |
| SOA | `server/src/services/*` (AuthService, MapService, NodeService готові) |
| Prototype | клонування гілки, створення карти з `Template` |
| Abstract Factory | родини об'єктів за темою: вузол, зв'язок, стиль |

## Розкладки

Нова карта за замовчуванням двостороння (`bilateral`): це класичний вигляд карти думок, і вона
найкраще читається. `radial` компактна лише на малих картах: довгі підписи розсувають кільця, на
великих картах вона розповзається; `tree` росте вниз. Усі три не допускають перетину вузлів
(перевіряється тестами до 24 дітей кореня), 2000 вузлів рахуються за 5–40 мс.

Керування полотном: колесо миші масштабує навколо курсора, перетягування фону панорамує,
клік вибирає вузол, подвійний клік згортає або розгортає гілку, Enter на вузлі в фокусі вибирає його.

Перетягування вузла: кинь на середину іншого вузла, щоб зробити його дитиною (останньою), або на верхній чи нижній край (у «дереві» лівий чи правий), щоб стати сусідом до або після. Корінь не тягнеться, у власне піддерево кинути не можна. Логіка цілі скидання: `core/dragdrop.js` (чиста функція з тестами).

Гарячі клавіші (полотно має фокус після кліку по вузлу): `Tab` додає дитину, `Enter` сусіда після вузла, `F2` змінює текст, `Delete` видаляє (з підтвердженням), `Esc` знімає виділення. Новий вузол одразу відкривається для правки; під час правки `Enter` зберігає, `Esc` скасовує.

## Що далі

1. ~~Редагування вузлів~~ (готово: API, сховище `mapEditor`, правка в списку).
2. ~~Полотно на SVG, розкладки (Strategy), автоматичні лінії~~ (готово).
3. ~~Перетягування вузлів мишею~~ (готово). Правка тексту на полотні і гарячі клавіші теж готові.
4. Undo/redo, вкладки карт.
5. Вкладення (`FileService` + Supabase Storage), значки категорій і терміновості, області.
