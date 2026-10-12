CREATE TABLE "recipe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"grams" numeric(8, 2) NOT NULL,
	"portion_label" text,
	"portion_grams" numeric(8, 2),
	"portion_count" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_items_grams_positive" CHECK ("recipe_items"."grams" > 0),
	CONSTRAINT "recipe_items_portion_all_or_none" CHECK (("recipe_items"."portion_label" IS NULL) = ("recipe_items"."portion_grams" IS NULL) AND ("recipe_items"."portion_grams" IS NULL) = ("recipe_items"."portion_count" IS NULL)),
	CONSTRAINT "recipe_items_portion_positive" CHECK (("recipe_items"."portion_grams" IS NULL OR "recipe_items"."portion_grams" > 0) AND ("recipe_items"."portion_count" IS NULL OR "recipe_items"."portion_count" > 0))
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"cooked_weight_g" numeric(8, 2),
	"servings" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_cooked_weight_positive" CHECK ("recipes"."cooked_weight_g" IS NULL OR "recipes"."cooked_weight_g" > 0),
	CONSTRAINT "recipes_servings_positive" CHECK ("recipes"."servings" IS NULL OR "recipes"."servings" > 0)
);
--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_items_recipe_id_idx" ON "recipe_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_items_user_id_idx" ON "recipe_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_items_food_id_idx" ON "recipe_items" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "recipes_user_id_idx" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_food_id_unique" ON "recipes" USING btree ("food_id");