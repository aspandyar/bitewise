import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative import: drizzle-kit loads this file outside the Next/Vitest alias resolution.
import { ACTIVITY_LEVELS, GOALS, SEXES, TARGET_MODES } from "../lib/config";

export const sexEnum = pgEnum("sex", SEXES);
export const activityLevelEnum = pgEnum("activity_level", ACTIVITY_LEVELS);
export const goalEnum = pgEnum("goal", GOALS);
export const targetModeEnum = pgEnum("target_mode", TARGET_MODES);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const nutrient = (name: string) =>
  numeric(name, { precision: 8, scale: 2, mode: "number" }).notNull();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored lowercased by the app, so a plain unique index is enough.
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
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
