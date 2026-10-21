---
type: note
status: learning
review: false
tags:
  - project/bitewise
  - project/bitewise/api
---
# Bitewise — API

> Наверх: [[Bitewise]] · связано: [[Projects/Bitewise/architecture|architecture]] · [[Projects/Bitewise/development|development]]

У приложения два вида серверных входов:
- **HTTP route handlers** в `app/api/**`. Их три: поиск продуктов, проверка живости и Auth.js.
- **Server actions** (`"use server"` в `app/**/actions.ts`). Их вызывает только собственный интерфейс через формы. Это не публичное REST-API: Next.js сам формирует для них POST-запросы с внутренним id действия.

## Почему без Swagger / OpenAPI
- Публичного REST почти нет: поиск, проверка живости и служебный маршрут Auth.js.
- Server actions описывать в OpenAPI бессмысленно: у них нет стабильного URL и формата, клиент и сервер собираются вместе.
- Контракт уже задан в коде: каждый вход проверяется zod-схемой (`lib/**/schema.ts`), а этот документ сводит их в одно место.

**Когда заводить OpenAPI.** Когда появится внешний клиент: нативное приложение, бот, интеграции или публичные AI-эндпоинты на этапах 9–12. Тогда спецификацию лучше генерировать из тех же zod-схем (`zod-to-openapi`), а не писать вручную.

## Общие правила для всех входов
- **Проверка сессии — первой строкой:**
  - `requireActionUser(formData)` в действиях с формой: без сессии — `/login`; форма, отправленная под другим аккаунтом (повтор после смены входа), ничего не пишет — главная с тостом (#107); считается лимит записи;
  - `requireWriteUser()` в действиях без формы (удаления, «Отменить»): то же, кроме проверки формы;
  - `requireAccountUser(formData)` у «Сменить пароль» и «Выйти на всех устройствах»: без лимита записи, чтобы вор с украденной сессией не мог помешать себя отозвать;
  - `getSessionUserId()` в route handlers: без сессии — `401`.
- **Сессия** при каждом чтении сверяет версию токена и роль с базой (#29): после смены пароля или «Выйти на всех устройствах» старые сессии не действуют.
- **Все входные данные — через zod.** id из URL и связанных аргументов (`action.bind(null, id)`) проверяются `parseId`. Битый uuid даёт 404, а не ошибку Postgres.
- **Чужой или несуществующий объект — `404`** (`notFound()`), никогда не `403`: ответ не выдаёт, что объект существует. Удаление, которое ничего не нашло, ведёт туда же, куда успешное.
- **Ключ запроса (#95).** Клиент ставит в каждую форму `requestId` (uuid) и `requestUser` (`stampRequestId`). Создающее действие при повторе с тем же ключом возвращает уже созданное; ключ, использованный для другой цели, — отказ.
- **Ошибки формы** возвращаются как `FormState { fieldErrors?, formError?, ok? }` и показываются у поля. Наружу не уходят ни детали, ни SQL; логи чистятся от параметров запросов (#76).
- **Rate limit** (в памяти, `lib/auth/rate-limit.ts`; ограничения — в `RATE_LIMITS` в `lib/config.ts`):
  - вход — 10 попыток за 15 минут с IP и на аккаунт; доверенные устройства (метка после входа) считаются в отдельном счётчике аккаунта (#30);
  - регистрация — 5 в час с одного IP (и только при `REGISTRATION=open`);
  - поиск продуктов — 120 запросов в минуту на пользователя;
  - любое действие, которое пишет, — 60 в минуту на пользователя (#31);
  - смена пароля — 5 попыток за 15 минут на аккаунт.

## HTTP

### `GET /api/foods/search`
Поиск продуктов для клиентского компонента `FoodSearch`. Логика — в чистой функции `handleFoodSearch` (`lib/foods/search-api.ts`), `route.ts` только связывает её с запросом.

| Параметр | Тип | Правила |
| --- | --- | --- |
| `q` | string | trim, схлопывание пробелов, нижний регистр, `ё`→`е`; 1–50 символов (`foodQuerySchema`) |
| `exclude` | `"recipes"` (необязательный) | скрыть блюда — для выбора ингредиентов; другое значение → `400` |

Ответы (всегда `Cache-Control: no-store`):

| Статус | Тело |
| --- | --- |
| 200 | `{ items: FoodListItem[] }` — до 20, свои выше общих |
| 400 | `{ error: "bad_query" }` |
| 401 | `{ error: "unauthorized" }` |
| 429 | `{ error: "rate_limited" }` |
| 500 | `{ error: "server_error" }` — детали только в логе сервера |

```ts
type FoodListItem = {
  id: string;
  name: string;
  kcal100: number; protein100: number; fat100: number; carbs100: number; // на 100 г, углеводы без клетчатки
  source: "user" | "usda" | "label";
  isOwn: boolean;    // считается на сервере, owner_id наружу не уходит
  isRecipe: boolean; // строка-блюдо (этап 4)
};
```

Как ищет: до 3 символов — начало любого слова (`LIKE` с экранированием `%`, `_`, `\`); с 3 символов — ещё и `word_similarity` из `pg_trgm` (порог 0,4). Видны общие продукты и свои, удалённые — нет.

### `GET /api/health`
Проверка живости для `release.sh` и мониторинга: `select 1` к базе с таймаутом `HEALTH.timeoutMs`. Без сессии.

| Статус | Тело |
| --- | --- |
| 200 | `{ ok: true }` |
| 503 | `{ ok: false }` — без текста ошибки, хостов и версий |

### `GET|POST /api/auth/[...nextauth]`
Auth.js v4: провайдер Credentials (email + пароль), JWT-сессия на 30 дней. Это единственный маршрут без проверки сессии, потому что именно он её создаёт. Пароли хешируются scrypt (`lib/auth/password.ts`). Для несуществующего email тоже считается фиктивный хеш, чтобы по времени ответа нельзя было узнать, зарегистрирован ли адрес.

## Server actions

| Файл | Action | Вход (zod) | Результат |
| --- | --- | --- | --- |
| `app/(auth)/register/actions.ts` | `registerAction(formData)` | `lib/auth/schema.ts` | `RegisterResult`; закрыто, пока не `REGISTRATION=open`; лимит по IP; роль всегда `user`; повтор с тем же ключом находит созданный аккаунт |
| `app/(auth)/login/actions.ts` | `rememberDeviceAction()` | — | после входа ставит httpOnly-метку устройства для аккаунта текущей сессии (#30) |
| `app/(app)/actions.ts` | `saveProfileAction` | `makeProfileSchema(today)` | → `/` |
| | `saveManualTargetAction` | `targetsSchema` | → `/` |
| | `resetTargetAction(formData?)` | — | → `/` или `/onboarding` |
| | `changePasswordAction(formData)` | текущий пароль, новый (`passwordSchema`) | `{ ok, email }` или ошибки у полей; отзывает все сессии; пароль админа — только через `ADMIN_PASSWORD` |
| | `signOutEverywhereAction(formData?)` | — | отзывает все сессии аккаунта, клиент затем выходит |
| `app/(app)/foods/actions.ts` | `createFoodAction` | `foodSchema` | → `/foods/[id]` (или к количеству, если начат из дневника); лимит 1000 своих |
| | `updateFoodAction(foodId)` | `foodSchema` | → `/foods/[id]`; чужой продукт или блюдо → 404 |
| | `deleteFoodAction(foodId)` | — | → `/foods`; продукт без ссылок удаляется совсем, со ссылками — мягко (#108) |
| | `copyFoodAction(foodId, formData?)` | — | копия общего продукта к себе → правка копии (переход с заменой истории) |
| | `addPortionAction(foodId)` | `portionSchema` | `{ ok }`; до 20 своих порций; блюду → 404 |
| | `deletePortionAction(foodId, portionId)` | — | только своя порция; порцию блюда — нельзя |
| `app/(app)/diary/actions.ts` | `addEntryAction` | `date` (`parseDiaryDate`), `foodId`, `addEntryFormSchema` (приём пищи + граммы или порция × количество) | → день; 100 записей в день, 100 000 на аккаунт |
| | `updateEntryAction(entryId)` | `updateEntryFormSchema` | → день записи |
| | `deleteEntryAction(entryId, rawDate)` | — | → день записи |
| | `quickAddAction(foodId, date, meal, formData?)` | — | быстрое «+» из избранного или недавних с прошлым количеством → день с тостом «Добавлено» и «Отменить» |
| | `repeatMealAction(date, meal, formData?)` | — | копирует последний заполненный такой же приём пищи → день; повтор отвечает теми же записями |
| | `undoAddAction(ids)` | до 100 uuid | удаляет свои записи, созданные в окне отмены |
| | `addQuickEntryAction` | `quickEntryFormSchema` (ккал, необязательные название и БЖУ) | «просто N ккал» → день |
| | `updateQuickEntryAction(entryId)` | `quickEntryFormSchema` | → день записи |
| | `setFavoriteAction(foodId, starred)` | `starred: boolean` | ставит или снимает звезду (состояние, не переключение); `"limit"` при 100 избранных |
| `app/(app)/recipes/actions.ts` | `createRecipeAction` | `recipeFormSchema` (название, вес готового?, порций?) | → `/recipes/[id]`; входит в лимит 1000 своих |
| | `updateRecipeAction(recipeId)` | `recipeFormSchema` | → блюдо; вес меньше состава — ошибка у поля |
| | `deleteRecipeAction(recipeId)` | — | → `/recipes`; блюдо без записей в дневнике удаляется совсем, иначе мягко |
| | `addItemAction(recipeId, foodId)` | `addAmountSchema` | → поиск ингредиентов с тостом; до 50 ингредиентов; блюдо, удалённый или чужой продукт → 404 |
| | `updateItemAction(recipeId, itemId)` | `updateAmountSchema` | → блюдо |
| | `deleteItemAction(recipeId, itemId)` | — | → блюдо |

Форма количества одна на дневник и на ингредиенты блюда (`lib/amount.ts`):
- граммы: 0,1–5000, запятая принимается;
- порция: `portionId` + количество 0,25–50.

Оба значения округляются до точности столбца (сотые), чтобы после сохранения выполнялось `граммы = количество × граммы порции`.

## Служебные маршруты
Не API, но отвечают не страницей:
- `/manifest.webmanifest` (`app/manifest.ts`), `/icon`, `/apple-icon`, `/pwa-icons/[file]` — манифест PWA и иконки (`next/og`);
- `/sw.js` — service worker из `lib/pwa/service-worker.ts` (`Cache-Control: no-cache`);
- `/offline` — страница «Нет сети», которую worker держит в кэше;
- `/favicon.ico` — временный редирект на `/icon`.
