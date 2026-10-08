---
name: deploy
description: Выкатить текущий main на VPS — сборка образа, бэкап, миграции, перезапуск, проверка.
disable-model-invocation: true
---
1. Проверь: ветка main, дерево чистое, `pnpm lint && pnpm test && pnpm build` зелёные.
2. Покажи список коммитов с прошлого деплоя (тег deploy-*). Жди «ок».
3. На сервере (данные — в CLAUDE.local.md): pg_dump в /opt/bitewise/backups/<дата>.sql.gz.
4. Сборка/обновление образа, `docker compose run --rm app pnpm db:migrate`, затем `docker compose up -d app`.
5. Проверка: healthcheck-эндпоинт 200, логи без ошибок 2 минуты, главная открывается.
6. Тег `deploy-<YYYYMMDD-HHMM>`. Если проверка упала — откат на предыдущий образ и сообщить.
