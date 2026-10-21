# Bitewise — features

**English** · [Русский](../ru/features.md)

Related: [project plan](PROJECT_PLAN.md) · [architecture](architecture.md)

## 🔴 Tier 1 — MUST HAVE (MVP)

Marks: ✅ works, 🟨 partly (what is missing is in brackets), no mark — not yet. Status by stage: [PROJECT_PLAN](PROJECT_PLAN.md).

### Profile and target
- ✅ Onboarding: sex, birth date, height, weight, activity level, goal (lose / maintain / gain).
- ✅ Target: BMR by the **Mifflin-St Jeor** formula × activity factor (TDEE) ± a goal adjustment.
- ✅ Macros: protein in g per kg of body weight, fat as % of kcal, carbs are the rest.
- 🟨 Manual override of the target (several target profiles per day — not yet).

### Food database
- 🟨 A food is stored **per 100 g**: kcal, protein, fat, carbs, fiber (sugar and salt not yet).
- ✅ Own foods: create, edit, delete, copy a shared food to your own.
- ✅ Portions: "1 piece", "1 spoon", "1 glass" → grams.
- ✅ Name search with typos (`pg_trgm`), own foods first; recent foods are on the "+ Add" screen.
- ✅ A starter set of base foods: 222 items (USDA, translated, plus product labels).

### Own dishes (recipes)
- ✅ A dish = a list of "food × grams" + the cooked weight (water boils off, the weight changes).
- ✅ Automatic kcal per 100 g and per serving.
- ✅ Logged in the diary like any food.

### Diary
- ✅ Day → meals: breakfast, lunch, dinner, snack.
- ✅ Entry: food/dish × grams (or × portions).
- ✅ Quick entry "just 450 kcal" (+ optional macros) without a food.
- ✅ Day totals: kcal and macros, progress bars "eaten / target / left".
- ✅ Day navigation.

### Input speed
- ✅ Favorites and recent foods, added in one tap with Undo.
- ✅ "Repeat a meal": the last filled meal of the same kind.

### Platform
- ✅ PWA: installs on iPhone/Android, works on a laptop; dark theme and accent color; an offline page.
- 🟨 Own VPS, Docker, backups (everything is ready and tested locally; a server and a domain are not chosen yet).

## 🟡 Tier 2 — SHOULD HAVE (v0.2)
- Barcode scanner (camera) → Open Food Facts → cached locally.
- Water: quick +250 / +500 ml buttons.
- Body weight: entries + a chart + a 7-day moving average.
- Statistics: weekly/monthly kcal and macro averages, "days on target".
- CSV export.

## 🔵 Tier 3 — AI (v0.3)
- **Text → entries:** "an omelette of 3 eggs and coffee with milk" → list of items → confirmation card.
- **Photo → entries:** dish recognition and gram estimates with a confidence level → confirmation card (grams adjusted with a slider).
- **A short correction chat** about the recognized result.
- If a food is not in the database, AI suggests a per-100 g estimate; it is saved marked "AI estimate" and never replaces verified data.

> **Photo accuracy.** Estimating a portion from a photo is off by about ±20–30 %. A photo is a quick way to log, not a replacement for a kitchen scale. The interface must say so honestly (confidence, a mark).

## ⚪ Tier 4 — ideas for later
- "What to eat to get 40 g more protein": dishes from your own that fit the remaining target (a simple filter first, AI later).
- A shopping list from selected recipes.
- A weekly meal plan.
- Reminders (web push): "lunch is not logged".
- Day export to Markdown.
- Micronutrients (vitamins, minerals), if the food data allows.
- Multilingual food names (RU / EN / KZ).
