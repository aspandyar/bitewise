# Этап 4 — `ft/recipes`: свои блюда из ингредиентов

Дата: 2026-10-12 · Статус: согласовано · Ветка: `ft/recipes` (от `master`)

## Цель
Домашнее блюдо (борщ, салат, каша) записывается в дневник одной записью, как обычный продукт, без повторного ввода ингредиентов. Блюдо = список «продукт × граммы» + вес готового блюда (вода выкипает) + число порций; ккал/БЖУ на 100 г и на порцию считает `lib/nutrition.ts`.

**Готово, когда:** «борщ» из 8 ингредиентов (часть — порциями) с весом готового блюда и числом порций находится в поиске дневника и добавляется одной записью «1 порция» с верными ккал. `pnpm lint` и `pnpm test` зелёные, CI зелёный.

## Принятые решения
| Вопрос | Решение | Почему |
| --- | --- | --- |
| Как блюдо попадает в дневник | блюдо — строка в `foods` (`source = 'user'`, владелец) + строка `recipes` с `food_id`; цифры на 100 г материализуются в `foods` | поиск, выбор в дневнике, порции, `diary_entries.food_id` работают без изменений; избранное, недавние (этап 5) и AI-сопоставление (этап 10) видят один `food_id` |
| Признак «это блюдо» | наличие строки в `recipes` (EXISTS), а не новое значение enum `food_source` | drizzle применяет все новые миграции в одной транзакции, а новое значение enum нельзя использовать (в CHECK) в транзакции, где его добавили — сломался бы и первый деплой на чистую БД |
| Вес готового блюда не указан | поле необязательное; без него делим на сумму сырых граммов | для салатов это и есть правильный ответ; в форме подсказка |
| Ингредиент изменился | цифры блюда пересчитываются сами из текущих продуктов | цифры в базе изредка уточняются, блюдо становится точнее; записи дневника — снимок, не меняются |
| Количество ингредиента | граммы или порции, как в дневнике; хранится снимок порции + количество | «2 шт (120 г)» в составе, яйцо не нужно взвешивать |
| Блюдо в блюде | нельзя | YAGNI; заодно нет циклов в пересчёте |
| Вес меньше БЖУ состава | форма не даёт сохранить; при пересчёте делим не меньше чем на граммы БЖУ, на странице пометка | готовое блюдо физически не легче своих белков, жиров и углеводов; без границы опечатка «10 г» даёт тысячи ккал на 100 г и переполняет `numeric(8,2)` |
| Порция блюда | `food_portion` «1 порция» = вес / число порций, управляется блюдом (`recipes.serving_portion_id`) | экран количества в дневнике показывает её без изменений |
| Удаление блюда | мягкое удаление строки `foods`; `recipes` и `recipe_items` остаются | записи дневника ссылаются на `food_id` |

## Вне этапа
- Свои дополнительные порции у блюда («тарелка = 350 г») — сейчас только «1 порция» от числа порций.
- Копирование и шаринг блюд, общие блюда в сиде.
- Блюдо как ингредиент другого блюда.
- Изменение порядка ингредиентов, заметки и шаги приготовления.
- Список покупок из рецептов (Tier 4).

## Данные (`db/schema.ts`, через `/db-change`)
`foods`, `food_portions`, `diary_entries` — без изменений схемы.

### `recipes`
| Колонка | Тип | Примечание |
| --- | --- | --- |
| id | uuid pk, default random | |
| user_id | uuid → users, cascade, not null | индекс `recipes_user_id_idx` |
| food_id | uuid → foods, cascade, not null | unique `recipes_food_id_unique` — один `foods` на блюдо |
| cooked_weight_g | numeric(8,2), null | null = «не взвешивали»; CHECK `> 0` |
| servings | integer, null | null = без порций; CHECK `BETWEEN 1 AND 100` |
| serving_portion_id | uuid → food_portions, set null, null | порция «1 порция», которую ведёт блюдо |
| created_at, updated_at | timestamptz | |

### `recipe_items`
| Колонка | Тип | Примечание |
| --- | --- | --- |
| id | uuid pk | |
| recipe_id | uuid → recipes, cascade, not null | индекс |
| user_id | uuid → users, cascade, not null | индекс (правило `db.md`) |
| food_id | uuid → foods, без каскада, not null | индекс — найти блюда, где есть продукт (пересчёт) и FK при каскаде |
| grams | numeric(8,2), not null | CHECK `> 0` |
| portion_label, portion_grams, portion_count | text / numeric(8,2) / numeric(8,2), null | все null или все заданы; граммы порции и количество `> 0` |
| created_at | timestamptz | порядок состава: `created_at`, `id` |

### Лимиты (`RECIPE_LIMITS` в `config.ts`)
- `maxItems: 50` — ингредиентов в блюде.
- `cookedWeightG: { min: 0.1, max: 20_000 }`.
- `servings: { min: 1, max: 100 }`.
- `itemGrams` и `portionCount` — как в дневнике (`DIARY_LIMITS.grams`, `DIARY_LIMITS.portionCount`).
- Название — `FOOD_LIMITS.nameLength`; блюда входят в `FOOD_LIMITS.maxOwnFoods` (1000), потому что это строки `foods`.

### Доступ
- Блюдо читается и меняется только владельцем: `recipes.user_id = сессия` и строка `foods` не удалена. Чужое или удалённое → `null` → 404.
- Ингредиент при добавлении: продукт виден пользователю (`visibleTo`), не удалён и не блюдо; иначе «не найдено» → 404.
- Состав читается через блюдо владельца, продукты ингредиентов — без фильтра `deleted_at` (удалённый остаётся в составе с пометкой «удалён»).

## Расчёты (`lib/nutrition.ts`, тест первым)
- `calcRecipe(items: { per100g: Per100g; grams: number }[], cookedWeightG: number | null)` → `{ rawWeightG, weightG, totals: Nutrients, per100g: Per100g, weightRaisedToNutrients: boolean }`:
  - `totals` = `sumNutrients(items.map(calcEntryNutrients))`;
  - `rawWeightG` = Σ граммов; `nutrientGrams` = белки + жиры + углеводы в `totals`;
  - `weightG` = `max(cookedWeightG ?? rawWeightG, nutrientGrams)`; `weightRaisedToNutrients` — сработала ли граница;
  - `per100g` = `totals / weightG × NUTRIENT_BASE_GRAMS`; при `weightG = 0` (пустой состав) — нули;
  - `cookedWeightG ≤ 0` или не число → `RangeError`.
- `calcServingGrams(weightG, servings)` = `weightG / servings`; `servings ≤ 0` → `RangeError`.
- Ручные числа для тестов: гречка 200 г (343 ккал/100 г) + масло 10 г (899): с весом 500 г → **155,18** ккал на 100 г; без веса → (686 + 89,9) / 210 × 100 = **369,48**; пустой состав → нули; вода 0 ккал только добавляет вес; граница по БЖУ; порция 500 / 4 = 125 г.

## Серверная логика
### `lib/recipes/`
- `schema.ts` — zod: `recipeFormSchema` (название, вес — `optionalDecimalField`, порции — необязательное целое); `addItemFormSchema` / `updateItemFormSchema` — граммы/порции из общей `amount`-схемы, вынесенной из `lib/diary/schema.ts` (дневник использует её же, его поведение не меняется); `parseId` — общий.
- `recompute.ts` — `recomputeRecipes(tx, recipeIds)`: читает состав с текущими цифрами продуктов, `calcRecipe`, пишет `kcal_100…carbs_100` (клетчатка — null) в строку блюда в `foods`; ведёт порцию: создать, обновить граммы, удалить при `servings = null`; `recipeIdsUsingFoods(tx, foodIds)` — для пересчёта после правки продуктов.
- `repo.ts`:
  - `listRecipes(db, userId)` — для `/recipes`: id, название, ккал на 100 г, ккал на порцию (сервер).
  - `getRecipe(db, userId, recipeId)` — блюдо + состав (название продукта, удалён ли, граммы, снимок порции) для страницы.
  - `getRecipeIdByFoodId(db, userId, foodId)` — для перенаправления `/foods/[id]`.
  - `createRecipe` (строка `foods` через `createFood` + `recipes`, лимит 1000) → `{ id } | "limit"`.
  - `updateRecipe` (название в `foods`, вес, порции) → `"ok" | "not_found" | "weight_below_nutrients"`.
  - `deleteRecipe` — мягкое удаление `foods`.
  - `addItem` / `updateItem` / `deleteItem` → `"ok" | "not_found" | "limit" | "weight_below_nutrients"`.
  - Каждая запись — транзакция под `pg_advisory_xact_lock(hashtext(recipeId))` + `recomputeRecipes` в ней же: параллельные добавления не превысят 50 и не запишут устаревшие цифры.
- Проверка «вес меньше БЖУ» при записи: если указан вес и после изменения `calcRecipe(...).weightRaisedToNutrients` — отказ `"weight_below_nutrients"`, транзакция откатывается.

### Изменения в продуктах
- `listColumns` + `isRecipe` (`EXISTS` по `recipes.food_id`); `FoodListItem.isRecipe`.
- `updateOwnFood`: строка-блюдо не правится (`NOT EXISTS recipe`) → `false`; после правки обычного продукта — `recomputeRecipes(recipeIdsUsingFoods([foodId]))` в той же транзакции.
- `softDeleteOwnFood` для строки-блюда → `false` (блюдо удаляется через `deleteRecipe`).
- `copyFood`, `addPortion` для строки-блюда → «не найдено» (порции блюда ведёт рецепт).
- `searchFoods(db, userId, query, { excludeRecipes })`; `/api/foods/search?exclude=recipes` (zod: `exclude` ∈ `{"recipes"}` или нет); `FoodSearch` получает `excludeRecipes`.
- Сид (`loadFoodSeed`): id изменённых общих продуктов собираются из upsert (`returning`), после цикла — `recomputeRecipes(recipeIdsUsingFoods(changedIds))` в той же транзакции.

### Серверные действия (`app/(app)/recipes/actions.ts`)
`createRecipeAction`, `updateRecipeAction(recipeId)`, `deleteRecipeAction(recipeId)`, `addItemAction(recipeId, foodId)`, `updateItemAction(recipeId, itemId)`, `deleteItemAction(recipeId, itemId)`. Первая строка — `requireUserId()`; связанные аргументы — `parseId`; форма — zod; «не найдено» → `notFound()`; ошибки — у поля (`FormState`). После успеха — редирект на `/recipes/[id]`.

## Экраны (mobile-first 375 px, тексты из `ru.recipes`, тап-зоны ≥ 44 px)
| Путь | Содержимое |
| --- | --- |
| `/` | в навигации ссылка «Блюда» |
| `/recipes` | свои блюда: название, ккал на 100 г, ккал на порцию; «Новое блюдо»; пустое состояние |
| `/recipes/new` | название, вес готового блюда (необяз., подсказка «не взвешивали — посчитаем по сырому весу»), число порций (необяз.) → страница блюда |
| `/recipes/[id]` | ккал на 100 г крупно, БЖУ на 100 г, «1 порция · 125 г · 194 ккал», «Всё блюдо · 500 г · 776 ккал», пометка о границе веса; состав со ссылками на правку и пометкой «удалён»; «Добавить ингредиент» (пока < 50), «Изменить», «Удалить блюдо» (двойной тап), «В дневник» |
| `/recipes/[id]/edit` | форма как у нового блюда |
| `/recipes/[id]/add` | `FoodSearch` с `link.prefix = /recipes/[id]/add/` и `excludeRecipes` |
| `/recipes/[id]/add/[foodId]` | `AmountFields` (граммы / порции) → «Добавить» → блюдо |
| `/recipes/[id]/items/[itemId]/edit` | количество + удаление ингредиента (двойной тап) |

- «В дневник» ведёт на `/diary/add/[foodId]?date=<сегодня>&meal=lunch` (`DIARY_DEFAULT_MEAL` в config): обычный экран количества, приём пищи там меняется.
- `/foods/[id]` для строки-блюда перенаправляет на `/recipes/[id]`; в `FoodList` метка «Блюдо» вместо источника.
- Все клиентские формы и поиск получают `key` из входных данных (правило `ui.md`).
- Загрузка — `PageLoading` под `<Suspense>`, ошибки — общий `error.tsx`, 404 — `notFound()`.

## Тесты
- **Unit** `lib/nutrition.test.ts` — `calcRecipe`, `calcServingGrams` (ручные числа и границы выше).
- **Unit** `lib/recipes/schema.test.ts` — формы блюда и ингредиента: пустое название, вес 0 / пустой / с запятой, порции 0 / 101 / дробные, граммы и порции ингредиента.
- **Unit** `lib/foods/search-api.test.ts` — параметр `exclude`.
- **DB** `lib/recipes/repo.db.test.ts` — создание (строка `foods`, `isRecipe`, лимит 1000); добавить / изменить / удалить ингредиент → цифры в `foods` пересчитаны; порция создаётся, меняет граммы, удаляется; блюдо в блюде, удалённый и чужой продукт → «не найдено»; чужое блюдо → `null`; лимит 50; граница веса; мягкое удаление, запись дневника остаётся; сценарий борща из 8 ингредиентов → `addEntry` порцией → снимок верный.
- **DB** `lib/foods/repo.db.test.ts` / `seed.db.test.ts` — `updateOwnFood` ингредиента пересчитывает блюдо; строку-блюдо нельзя править, удалять, копировать, добавлять ей порции; сид с изменённым общим продуктом пересчитывает блюдо.
- **DB** `lib/foods/search.db.test.ts` — блюдо находится с `isRecipe`, с `excludeRecipes` — нет.
- **Ревью:** reviewer, security-reviewer (server actions, параметр поиска), ui-checker (встроенный браузер, 375 px).

## Новые зависимости
Нет.
