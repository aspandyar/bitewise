CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'active', 'veryActive');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('lose', 'maintain', 'gain');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."target_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sex" "sex" NOT NULL,
	"birth_date" date NOT NULL,
	"height_cm" numeric(5, 1) NOT NULL,
	"weight_kg" numeric(5, 1) NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"goal" "goal" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mode" "target_mode" NOT NULL,
	"kcal" numeric(8, 2) NOT NULL,
	"protein_g" numeric(8, 2) NOT NULL,
	"fat_g" numeric(8, 2) NOT NULL,
	"carbs_g" numeric(8, 2) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "targets_user_id_idx" ON "targets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "targets_one_default_per_user" ON "targets" USING btree ("user_id") WHERE "targets"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");