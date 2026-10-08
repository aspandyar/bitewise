---
name: ai-provider
description: Добавить или изменить AI-провайдера (OpenAI, Anthropic и др.) за общим интерфейсом распознавания еды. Использовать на этапах 9–12.
---
1. Прочитай lib/ai/provider.ts и rules/ai.md.
2. Новый файл lib/ai/<provider>.ts реализует FoodRecognizer: parseText, parseImage, refine (чат правок).
3. Используй структурированный вывод провайдера (tool use / JSON schema), схему бери из lib/ai/schemas.ts.
4. Модель, лимиты, цена за токен — в lib/config.ts; выбор через AI_PROVIDER / AI_MODEL.
5. Логируй в ai_requests; ошибки провайдера → понятная ошибка пользователю, без утечки деталей.
6. Тесты на fixtures; реальный вызов — только ручной скрипт scripts/ai-smoke.ts.
7. Сверь актуальный API провайдера через Context7.
