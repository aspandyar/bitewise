---
paths:
  - "docker/**"
  - "Dockerfile"
  - "docker-compose*.yml"
  - ".github/**"
---
# Деплой и инфраструктура
- Образ: multi-stage, Next.js standalone output, запуск не от root.
- Postgres — именованный volume; порт БД наружу не публикуется.
- nginx: TLS, gzip/brotli, client_max_body_size под фото (из config), заголовки безопасности.
- Миграции на сервере — отдельным шагом до старта нового контейнера.
- Бэкап: pg_dump по cron + проверка восстановления раз в месяц.
- CI: lint + test на push; деплой только вручную через /deploy.
