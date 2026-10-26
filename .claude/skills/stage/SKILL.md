---
name: stage
description: Провести этап N из docs/ru/PROJECT_PLAN.md — ветка, план, реализация с тестами, ревью, статус. Использовать, когда начинаем новый этап плана.
argument-hint: <номер этапа>
---
1. Прочитай этап $ARGUMENTS в docs/ru/PROJECT_PLAN.md, docs/ru/notes.md и rules, относящиеся к затронутым путям.
2. Проверь, что рабочее дерево чистое и master свежий. `git switch -c ft/<имя-этапа>`.
3. Если этап большой (новая таблица, новый экран или внешний API) — используй superpowers: brainstorming → spec в docs/ru/superpowers/specs/, план — в docs/ru/superpowers/plans/.
4. Напиши план: файлы, изменения схемы БД, новые зависимости, тесты, критерий «готово» из плана.
   ОСТАНОВИСЬ и жди моего «ок».
   После «ок», если доступен инструмент `mcp__savvy-progress__progress` (мод Savvy Progress), доложи план
   в полосу прогресса: `title` — имя этапа, `phase: "delegate"`, `tasks` — шаги плана по порядку, последними —
   ревью (у задач с субагентом `title` совпадает с `description` в Agent), `tier: "medium"`, `total`, `done: 0`.
   Нет инструмента — пропусти этот пункт и все вызовы `progress` ниже.
5. Реализуй. Для расчётов — сначала тест. Изменения схемы — через /db-change.
   Каждый законченный шаг плана — `progress` с новым `done`.
6. `pnpm lint && pnpm test` — до зелёного.
7. Запусти субагента reviewer на `git diff master...HEAD`; для этапов с auth/API/AI — ещё security-reviewer;
   для UI-этапов — ui-checker. Исправь замечания. Перед ревью — `progress` с `phase: "review"`.
8. Обнови «Текущий статус» в docs/ru/PROJECT_PLAN.md и его пару docs/en/PROJECT_PLAN.md, решения — в docs/ru/notes.md; изменённые справочные документы — тоже на обоих языках.
9. Коммит(ы) по Conventional Commits. Итог: что сделано, что осталось, что дальше. Не пушь без спроса.
   В конце — `progress` с `phase: "close"` и `finished: true`.
