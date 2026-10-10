CREATE TYPE "public"."food_source" AS ENUM('user', 'usda', 'label');--> statement-breakpoint
CREATE TABLE "food_portions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"user_id" uuid,
	"label" text NOT NULL,
	"grams" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_portions_grams_positive" CHECK ("food_portions"."grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"search_name" text GENERATED ALWAYS AS (replace(lower("name"), 'ё', 'е')) STORED NOT NULL,
	"kcal_100" numeric(8, 2) NOT NULL,
	"protein_100" numeric(8, 2) NOT NULL,
	"fat_100" numeric(8, 2) NOT NULL,
	"carbs_100" numeric(8, 2) NOT NULL,
	"fiber_100" numeric(8, 2),
	"source" "food_source" NOT NULL,
	"seed_key" text,
	"source_url" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_user_source_has_owner" CHECK (("foods"."source" = 'user') = ("foods"."owner_id" IS NOT NULL)),
	CONSTRAINT "foods_seed_key_iff_shared" CHECK (("foods"."owner_id" IS NULL) = ("foods"."seed_key" IS NOT NULL)),
	CONSTRAINT "foods_nutrients_non_negative" CHECK ("foods"."kcal_100" >= 0 AND "foods"."protein_100" >= 0 AND "foods"."fat_100" >= 0 AND "foods"."carbs_100" >= 0 AND ("foods"."fiber_100" IS NULL OR "foods"."fiber_100" >= 0))
);
--> statement-breakpoint
ALTER TABLE "food_portions" ADD CONSTRAINT "food_portions_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_portions" ADD CONSTRAINT "food_portions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_portions_food_id_idx" ON "food_portions" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "food_portions_user_id_idx" ON "food_portions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "foods_owner_id_idx" ON "foods" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_seed_key_unique" ON "foods" USING btree ("seed_key");--> statement-breakpoint
CREATE INDEX "foods_search_name_trgm_idx" ON "foods" USING gin ("search_name" gin_trgm_ops);