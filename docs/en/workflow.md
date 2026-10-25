# Bitewise — how we work

**English** · [Русский](../ru/workflow.md)

Related: [project plan](PROJECT_PLAN.md) · [development](development.md) · [decision log (Russian)](../ru/notes.md)

The project is built stage by stage from the [plan](PROJECT_PLAN.md). Claude Code writes the code; decisions and approvals ("ok") belong to the owner. Everything Claude must follow is written down in the repository: `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/`.

## The stage cycle (`/stage N`)
| Step | What happens | Who decides |
| --- | --- | --- |
| 1 | Read the stage in the plan, `notes.md`, the rules for the paths involved | — |
| 2 | Fresh `master` → branch `ft/<stage>` | — |
| 3 | A big stage (new table, screen, external API) → brainstorming: questions one at a time, 2–3 approaches, the design in sections | the owner answers questions and picks the approach |
| 4 | Spec → `docs/ru/superpowers/specs/`, plan → `docs/ru/superpowers/plans/` | **"ok" on the spec and on the plan**; the execution mode: native or subagents |
| 5 | Implementation by the plan's tasks: TDD (test → red → code → green), a commit per task, a log in `.superpowers/sdd/<plan>/progress.md` | schema changes: **"ok" on the migration SQL** |
| 6 | `pnpm lint && pnpm test` until green | — |
| 7 | Reviews by subagents; fixes also go through a test | — |
| 8 | "Current status" in the plan, decisions and open questions in `notes.md`, the spec updated; changed reference docs also in `docs/en/` | — |
| 9 | Commits (Conventional Commits), a summary; push and PR **only when asked** | the owner decides on the PR and the merge |

A plan runs in one of two ways:
- **Native**: Claude does the tasks itself, in a row, and the whole branch is reviewed at the end. Stages 3 and 4 went this way.
- **Subagent-driven**: each task goes to a fresh subagent, with a separate review after each. More reliable, but more expensive.

With the Savvy Progress mod installed, the stage's progress shows in a bar above the prompt: the plan after the "ok", finished steps, review, close. Without the mod `/stage` works the same, just without the bar.

## Rules (`.claude/rules/`)
Picked up automatically by the paths an edit touches.

| File | Paths | The gist |
| --- | --- | --- |
| `general.md` | always | English "why" comments, no magic numbers, zod on every input, stay inside the stage |
| `nutrition.md` | `lib/nutrition*`, `lib/config.ts` | pure functions, units in names, tests with hand-computed numbers, recipe = sum / cooked weight × 100 |
| `db.md` | `db/**`, `lib/**/repo*.ts` | schema only via migrations, `user_id` + an index, a snapshot in the diary, soft delete, `numeric(8,2)` |
| `ui.md` | `app/**`, `components/**` | 375 px, tap targets ≥ 44 px, texts from `ru.ts`, the client never computes nutrients, a `key` for forms under `cacheComponents` |
| `api-security.md` | `app/api/**`, `lib/auth/**`, `actions.ts` | the session first, someone else's → 404, zod, rate limits, no secrets in responses, request keys, the write cap |
| `testing.md` | tests | TDD for calculations, no network, db tests on a separate database, never weaken tests |
| `ai.md` | `lib/ai/**`, `app/api/ai/**` | AI returns only "what and how many grams", code computes the numbers (stages 9–12) |
| `deploy.md` | `docker/**`, `Dockerfile`, compose | production environment rules (stage 6) |

## Skills (`.claude/skills/`)
| Skill | When |
| --- | --- |
| `/stage N` | start a stage of the plan |
| `/db-change` | any change to tables, columns, indexes |
| `/food-source` | connect a food source (Open Food Facts in stage 7) |
| `/ai-provider` | an AI provider behind the `FoodRecognizer` interface (stages 9–12) |
| `/deploy` | ship `master` to the VPS (manual only, stage 6) |
| `/sync-notes` | copy the status and decisions to Obsidian (manual only) |

## Subagents (`.claude/agents/`)
| Agent | When | What it does |
| --- | --- | --- |
| `reviewer` | before every merge | `git diff master...HEAD` against the project rules, findings with severity and a scenario |
| `security-reviewer` | stages with auth, API, AI; changes to `app/api` and `lib/auth` | IDOR, validation, limits, leaks, abuse |
| `ui-checker` | UI stages | scenarios in a browser at 375 px, layout, texts, input speed |

Agents don't edit code. Their findings are handled by the implementer:
- **critical and important** ones are fixed with a test that fails first;
- **minor** ones become a GitHub issue with the stage's label or `polish`, linked from "Open questions" in `notes.md`.

## Guard rails (`.claude/settings.json`)
- **Without asking:** `pnpm dev/build/test/lint/db:generate/db:seed`, reading git, `git add/commit/switch`, `docker compose up/ps/logs`.
- **With confirmation:** `git push/merge/rebase/reset`, `pnpm add/remove`, `pnpm db:migrate`, `ssh/scp/rsync`.
- **Forbidden:**
  - reading and writing `.env*` (except `.env.example`);
  - editing `db/migrations/**`;
  - `drizzle-kit push`;
  - `docker compose down -v`, `docker volume rm`;
  - `rm -rf`;
  - force-push.
- **A hook after every edit:** Prettier + `eslint --fix` for ts/tsx, Prettier for css/json/md.

## Branches, commits, PRs
- **Branches.** The main branch is `master` only. One stage, one `ft/<stage>` branch; service work goes to `ft/docs` and the like.
- **Commits** in English, Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). Usually one commit per plan task plus review fixes. No `Co-Authored-By:` or other attribution lines, in commits or PR descriptions.
- **A PR** is ready for review, describing what was done, why, what the reviewer should look at, and the test plan. Merge after green CI.

## Sessions (chats) with Claude
A long session compresses its context, and a fresh one starts from zero. So the work is split like this:

| Chat | What it holds | Why separate |
| --- | --- | --- |
| One stage, one chat (`/stage N`) | from questions to the PR | the whole stage context in one place; the log in `.superpowers/sdd/` survives compression |
| Polish | `polish` issues once there are enough for a branch | does not bloat a stage |
| Documentation and reviews | README, docs, reports | reads a lot, changes little code |
| Research | the photo model, Open Food Facts, the domain | the answer is a recommendation, no code stays |
| Deployment | stage 6, then `/deploy` | VPS access and dangerous commands, kept separate and deliberate |

Close or push the previous branch before a new chat. The state between chats lives in files:
- `PROJECT_PLAN.md`: "Current status";
- `notes.md`: decisions and the index of open questions (the tasks themselves are GitHub issues);
- the stage's spec and plan;
- the `progress.md` log (outside git);
- Claude's memory: for example, "the branch is `master` only", "I maintain `.env.example`".

## Documentation in two languages
- `docs/ru/` is the main one, in Russian; `docs/en/` is the English one, with the same file names. Each file starts with a link to its pair.
- Reference documents have pairs: `PROJECT_PLAN`, `features`, `architecture`, `api`, `development`, `deploy`, `workflow`. When one changes, the other changes in the same commit.
- Russian only: `notes.md` (the decision log) and the stage specs and plans in `docs/ru/superpowers/`.
- `README.md` is for GitHub visitors, in English; `README.ru.md` is the Russian version. Screenshots live in `docs/images/`.

## Obsidian
`docs/ru/*.md` (except the `README.md` index) are notes in an Obsidian vault: `type/status/review/tags` frontmatter, an "up" line and wiki links. That is why Prettier skips them. `/sync-notes` copies the status to the vault by hand; the vault path is in `CLAUDE.local.md`.
