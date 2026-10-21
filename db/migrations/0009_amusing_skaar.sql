ALTER TABLE "diary_entries" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "food_portions" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "diary_entries_user_request_unique" ON "diary_entries" USING btree ("user_id","client_request_id") WHERE "diary_entries"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "food_portions_user_request_unique" ON "food_portions" USING btree ("user_id","client_request_id") WHERE "food_portions"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_owner_request_unique" ON "foods" USING btree ("owner_id","client_request_id") WHERE "foods"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_items_user_request_unique" ON "recipe_items" USING btree ("user_id","client_request_id") WHERE "recipe_items"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_user_request_unique" ON "recipes" USING btree ("user_id","client_request_id") WHERE "recipes"."client_request_id" IS NOT NULL;