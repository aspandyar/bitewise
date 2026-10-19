---
name: deploy
description: Выкатить текущий master на VPS — образ в GHCR, бэкап, миграции, сид, админ, перезапуск, проверка.
disable-model-invocation: true
---
Runbook и устройство прода — docs/deploy.md. Сервер — в CLAUDE.local.md (host, user, /opt/bitewise).

1. Проверь: ветка master, дерево чистое, `pnpm lint && pnpm test && pnpm build` зелёные.
2. Покажи коммиты с прошлого деплоя (`git log deploy-<последний>..HEAD`, тег `deploy-*`). Жди «ок».
3. Образ: `gh workflow run release.yml --ref master`, затем `gh run watch` до зелёного. Тег образа — `git rev-parse HEAD`.
4. Файлы стека на сервер: `rsync -av docker-compose.prod.yml docker <user>@<host>:/opt/bitewise/`.
5. Релиз: `ssh <user>@<host> 'cd /opt/bitewise && docker/scripts/release.sh <sha>'` — внутри бэкап, миграции и проверки БД, сид, админ, новый контейнер, ожидание здоровья, откат при ошибке.
6. Проверка: `curl -s https://<домен>/api/health` → `{"ok":true}`; логи `app` и `nginx` 2 минуты без ошибок; главная открывается.
7. Тег `deploy-<YYYYMMDD-HHMM>` на HEAD и `git push origin <тег>`. Если релиз упал — скрипт уже вернул прошлый тег: сообщи, что откатилось и почему.
