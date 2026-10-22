ALTER TYPE "public"."food_source" ADD VALUE 'off';--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "barcode" text;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_shared_barcode_unique" ON "foods" USING btree ("barcode") WHERE "foods"."owner_id" IS NULL AND "foods"."barcode" IS NOT NULL AND "foods"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_own_barcode_unique" ON "foods" USING btree ("owner_id","barcode") WHERE "foods"."owner_id" IS NOT NULL AND "foods"."barcode" IS NOT NULL AND "foods"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_barcode_digits" CHECK ("foods"."barcode" IS NULL OR "foods"."barcode" ~ '^[0-9]{8,14}$');