CREATE TABLE "weight_save_requests" (
	"user_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weight_save_requests_user_id_client_request_id_pk" PRIMARY KEY("user_id","client_request_id")
);
--> statement-breakpoint
ALTER TABLE "weight_save_requests" ADD CONSTRAINT "weight_save_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;