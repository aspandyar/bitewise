---
paths:
  - "db/**"
  - "lib/**/repo*.ts"
---
# База данных
- Схема — только в db/schema.ts. Изменение → `pnpm db:generate` → показать SQL → `pnpm db:migrate`.
- Никогда не править сгенерированные миграции и не использовать drizzle-kit push.
- Каждая пользовательская таблица: `user_id` + индекс; каждый запрос фильтрует по user_id текущей сессии.
- diary_entries хранит снимок kcal/protein/fat/carbs — изменение продукта не меняет историю.
- Удаление продукта, который есть в дневнике, — soft delete (`deleted_at`).
- Поиск продуктов — pg_trgm (GIN-индекс по name), не LIKE '%x%'.
- Числа нутриентов — numeric(8,2), не float.
