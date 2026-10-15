import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative import: drizzle-kit loads this file outside the Next/Vitest alias resolution.
import {
  ACTIVITY_LEVELS,
  FOOD_SOURCES,
  GOALS,
  MEALS,
  SEXES,
  TARGET_MODES,
  USER_ROLES,
} from "../lib/config";

export const sexEnum = pgEnum("sex", SEXES);
export const activityLevelEnum = pgEnum("activity_level", ACTIVITY_LEVELS);
export const goalEnum = pgEnum("goal", GOALS);
export const targetModeEnum = pgEnum("target_mode", TARGET_MODES);
export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const foodSourceEnum = pgEnum("food_source", FOOD_SOURCES);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const nutrient = (name: string) =>
  numeric(name, { precision: 8, scale: 2, mode: "number" }).notNull();
const optionalNutrient = (name: string) =>
  numeric(name, { precision: 8, scale: 2, mode: "number" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored lowercased by the app, so a plain unique index is enough.
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    // Sign-up never sets this; managers are assigned by an admin, the admin by the bootstrap script.
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const profiles = pgTable("profiles", {
  // One profile per user, so the user id is the key and its own index.
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  sex: sexEnum("sex").notNull(),
  birthDate: date("birth_date").notNull(),
  heightCm: numeric("height_cm", { precision: 5, scale: 1, mode: "number" }).notNull(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 1, mode: "number" }).notNull(),
  activityLevel: activityLevelEnum("activity_level").notNull(),
  goal: goalEnum("goal").notNull(),
  updatedAt: updatedAt(),
});

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mode: targetModeEnum("mode").notNull(),
    kcal: nutrient("kcal"),
    proteinG: nutrient("protein_g"),
    fatG: nutrient("fat_g"),
    carbsG: nutrient("carbs_g"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("targets_user_id_idx").on(t.userId),
    // Exactly one default target per user; also the ON CONFLICT target for upserts.
    uniqueIndex("targets_one_default_per_user")
      .on(t.userId)
      .where(sql`${t.isDefault}`),
  ],
);

export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null means a shared food from the seed; otherwise the food belongs to this user only.
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Search compares against this, so "свекла" finds "Свёкла" and case never matters.
    searchName: text("search_name")
      .notNull()
      .generatedAlwaysAs(sql`replace(lower("name"), 'ё', 'е')`),
    kcal100: nutrient("kcal_100"),
    protein100: nutrient("protein_100"),
    fat100: nutrient("fat_100"),
    // Net of fiber, the way Russian labels count carbs.
    carbs100: nutrient("carbs_100"),
    fiber100: optionalNutrient("fiber_100"),
    source: foodSourceEnum("source").notNull(),
    // Stable key the seed upserts by: "usda:<fdcId>" or "label:<slug>".
    seedKey: text("seed_key"),
    sourceUrl: text("source_url"),
    // A copy is the user's own food, but its numbers came from somewhere: shown as "копия: USDA".
    copiedFrom: foodSourceEnum("copied_from"),
    // Soft delete: diary entries (stage 3) will keep pointing at foods the user removed.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("foods_owner_id_idx").on(t.ownerId),
    uniqueIndex("foods_seed_key_unique").on(t.seedKey),
    index("foods_search_name_trgm_idx").using("gin", t.searchName.op("gin_trgm_ops")),
    // A user's own food is never seed data, and every shared food comes from the seed.
    check("foods_user_source_has_owner", sql`(${t.source} = 'user') = (${t.ownerId} IS NOT NULL)`),
    check("foods_seed_key_iff_shared", sql`(${t.ownerId} IS NULL) = (${t.seedKey} IS NOT NULL)`),
    check("foods_copied_from_only_own", sql`${t.copiedFrom} IS NULL OR ${t.source} = 'user'`),
    // Rendered as a link on the food card; the seed validates it, the database guarantees it.
    check("foods_source_url_https", sql`${t.sourceUrl} IS NULL OR ${t.sourceUrl} LIKE 'https://%'`),
    check(
      "foods_nutrients_non_negative",
      sql`${t.kcal100} >= 0 AND ${t.protein100} >= 0 AND ${t.fat100} >= 0 AND ${t.carbs100} >= 0 AND (${t.fiber100} IS NULL OR ${t.fiber100} >= 0)`,
    ),
  ],
);

export const foodPortions = pgTable(
  "food_portions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    // Null means a shared portion from the seed; otherwise only this user sees it.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    grams: nutrient("grams"),
    createdAt: createdAt(),
  },
  (t) => [
    index("food_portions_food_id_idx").on(t.foodId),
    index("food_portions_user_id_idx").on(t.userId),
    check("food_portions_grams_positive", sql`${t.grams} > 0`),
  ],
);

export const mealEnum = pgEnum("meal", MEALS);

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The user's local calendar date, computed from their time zone when the entry was added.
    date: date("date").notNull(),
    meal: mealEnum("meal").notNull(),
    // No cascade: foods are only soft-deleted, so history keeps pointing at them.
    // Null is a "just kcal" entry: its numbers live only in the snapshot below.
    foodId: uuid("food_id").references(() => foods.id),
    // Snapshot: renaming or editing the food later never rewrites past days.
    foodName: text("food_name").notNull(),
    kcal100: nutrient("kcal_100"),
    protein100: nutrient("protein_100"),
    fat100: nutrient("fat_100"),
    carbs100: nutrient("carbs_100"),
    grams: nutrient("grams"),
    // Snapshot of the portion used, if any; grams = count × portion grams is kept by the app,
    // since a CHECK would break on rounding to hundredths.
    portionLabel: text("portion_label"),
    portionGrams: optionalNutrient("portion_grams"),
    portionCount: optionalNutrient("portion_count"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("diary_entries_user_id_date_idx").on(t.userId, t.date),
    // Lets the FK check on cascaded food deletes use an index instead of a full scan.
    index("diary_entries_food_id_idx").on(t.foodId),
    check("diary_entries_grams_positive", sql`${t.grams} > 0`),
    check(
      "diary_entries_nutrients_non_negative",
      sql`${t.kcal100} >= 0 AND ${t.protein100} >= 0 AND ${t.fat100} >= 0 AND ${t.carbs100} >= 0`,
    ),
    check(
      "diary_entries_portion_all_or_none",
      sql`(${t.portionLabel} IS NULL) = (${t.portionGrams} IS NULL) AND (${t.portionGrams} IS NULL) = (${t.portionCount} IS NULL)`,
    ),
    check(
      "diary_entries_quick_has_no_portion",
      sql`${t.foodId} IS NOT NULL OR ${t.portionLabel} IS NULL`,
    ),
    check(
      "diary_entries_portion_positive",
      sql`(${t.portionGrams} IS NULL OR ${t.portionGrams} > 0) AND (${t.portionCount} IS NULL OR ${t.portionCount} > 0)`,
    ),
  ],
);

// A star on a food or dish: kept on the add screen above recent foods.
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.foodId] }),
    // Lets the FK check on a cascaded food delete use an index instead of a full scan.
    index("favorites_food_id_idx").on(t.foodId),
  ],
);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The dish is a food row too, so search, portions and the diary treat it like any food;
    // its name, per-100 g numbers and soft delete live there.
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    // Null: not weighed, the raw weight of the ingredients is used.
    cookedWeightG: optionalNutrient("cooked_weight_g"),
    // Null: no "1 serving" portion. The 1–100 range is checked by the form schema.
    servings: integer("servings"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("recipes_user_id_idx").on(t.userId),
    uniqueIndex("recipes_food_id_unique").on(t.foodId),
    check(
      "recipes_cooked_weight_positive",
      sql`${t.cookedWeightG} IS NULL OR ${t.cookedWeightG} > 0`,
    ),
    check("recipes_servings_positive", sql`${t.servings} IS NULL OR ${t.servings} > 0`),
  ],
);

export const recipeItems = pgTable(
  "recipe_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // No cascade: foods are only soft-deleted, and a deleted ingredient keeps counting.
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id),
    grams: nutrient("grams"),
    // Snapshot of the portion used, as in diary_entries.
    portionLabel: text("portion_label"),
    portionGrams: optionalNutrient("portion_grams"),
    portionCount: optionalNutrient("portion_count"),
    createdAt: createdAt(),
  },
  (t) => [
    index("recipe_items_recipe_id_idx").on(t.recipeId),
    index("recipe_items_user_id_idx").on(t.userId),
    // Finds the recipes to recompute when a food changes, and serves the FK check on deletes.
    index("recipe_items_food_id_idx").on(t.foodId),
    check("recipe_items_grams_positive", sql`${t.grams} > 0`),
    check(
      "recipe_items_portion_all_or_none",
      sql`(${t.portionLabel} IS NULL) = (${t.portionGrams} IS NULL) AND (${t.portionGrams} IS NULL) = (${t.portionCount} IS NULL)`,
    ),
    check(
      "recipe_items_portion_positive",
      sql`(${t.portionGrams} IS NULL OR ${t.portionGrams} > 0) AND (${t.portionCount} IS NULL OR ${t.portionCount} > 0)`,
    ),
  ],
);
