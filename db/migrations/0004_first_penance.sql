CREATE TYPE "public"."meal" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal" "meal" NOT NULL,
	"food_id" uuid NOT NULL,
	"food_name" text NOT NULL,
	"kcal_100" numeric(8, 2) NOT NULL,
	"protein_100" numeric(8, 2) NOT NULL,
	"fat_100" numeric(8, 2) NOT NULL,
	"carbs_100" numeric(8, 2) NOT NULL,
	"grams" numeric(8, 2) NOT NULL,
	"portion_label" text,
	"portion_grams" numeric(8, 2),
	"portion_count" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diary_entries_grams_positive" CHECK ("diary_entries"."grams" > 0),
	CONSTRAINT "diary_entries_nutrients_non_negative" CHECK ("diary_entries"."kcal_100" >= 0 AND "diary_entries"."protein_100" >= 0 AND "diary_entries"."fat_100" >= 0 AND "diary_entries"."carbs_100" >= 0),
	CONSTRAINT "diary_entries_portion_all_or_none" CHECK (("diary_entries"."portion_label" IS NULL) = ("diary_entries"."portion_grams" IS NULL) AND ("diary_entries"."portion_grams" IS NULL) = ("diary_entries"."portion_count" IS NULL)),
	CONSTRAINT "diary_entries_portion_positive" CHECK (("diary_entries"."portion_grams" IS NULL OR "diary_entries"."portion_grams" > 0) AND ("diary_entries"."portion_count" IS NULL OR "diary_entries"."portion_count" > 0))
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diary_entries_user_id_date_idx" ON "diary_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "diary_entries_food_id_idx" ON "diary_entries" USING btree ("food_id");