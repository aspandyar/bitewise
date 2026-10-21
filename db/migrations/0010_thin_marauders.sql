ALTER TABLE "foods" DROP CONSTRAINT "foods_copied_from_only_own";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
CREATE INDEX "diary_entries_user_created_idx" ON "diary_entries" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_request_unique" ON "users" USING btree ("client_request_id") WHERE "users"."client_request_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_copied_from_only_own" CHECK ("foods"."copied_from" IS NULL OR ("foods"."source" = 'user' AND "foods"."copied_from" <> 'user'));