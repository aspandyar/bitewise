# Общие правила (всегда)
- Code comments in English only. Explain *why*, not *what*. No commented-out code.
- No magic numbers: every tunable value lives in lib/config.ts.
- TypeScript strict; no `any`, no `@ts-ignore` without a comment explaining why.
- Validate every external input (forms, API bodies, query params, AI output) with zod.
- Keep changes inside the current stage. Out-of-scope ideas → docs/notes.md «Открытые вопросы».
- Prefer small pure functions; side effects at the edges (route handlers, server actions).
- Не добавляй зависимость, не объяснив зачем и почему без неё нельзя.
