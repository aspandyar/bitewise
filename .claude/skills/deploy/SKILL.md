---
name: deploy
description: Выкатить текущий master на VPS — образ в GHCR, бэкап, миграции, сид, админ, перезапуск, проверка.
disable-model-invocation: true
---
Runbook и устройство прода — docs/deploy.md. Сервер — в CLAUDE.local.md (host, user, /opt/bitewise).

1. Проверь: ветка master, дерево чистое, `git fetch && git status` — HEAD совпадает с `origin/master` (CI собирает образ из origin), `pnpm lint && pnpm test && pnpm build` зелёные.
2. Покажи коммиты с прошлого деплоя (`git log deploy-<последний>..HEAD`, тег `deploy-*`). Жди «ок».
3. Образ: `gh workflow run release.yml --ref master`; id запуска — строго по коммиту и ветке: `gh run list --workflow release.yml --branch master --commit <sha> --event workflow_dispatch -L 1 --json databaseId -q '.[0].databaseId'` (не «последний запуск»: он может быть из другой ветки); `gh run watch <id> --exit-status` до зелёного. Тег образа — `git rev-parse HEAD`, digest — `gh run download <id> -n image-digest -D "$(mktemp -d)"` → `image-digest.txt` (`sha256:…`).
4. Файлы стека на сервер: `rsync -av docker-compose.prod.yml docker <user>@<host>:/opt/bitewise/` (новые шаблоны nginx `release.sh` применит сам).
5. Релиз: `ssh <user>@<host> 'cd /opt/bitewise && docker/scripts/release.sh <sha> <digest>'` — внутри бэкап, роль приложения в БД, миграции и проверки БД, сид, админ, новый контейнер (по digest), ожидание здоровья, откат при ошибке.
6. Проверка: `curl -sI https://<домен>/login` → 200 (снаружи `/api/health` закрыт — 404; здоровье уже проверил `release.sh`); `docker/scripts/compose.sh logs --since 2m app nginx` без ошибок; главная открывается.
7. Тег `deploy-<YYYYMMDD-HHMM>` на HEAD и `git push origin <тег>`. Если релиз упал — скрипт уже вернул прошлый образ: сообщи, что откатилось и почему.
