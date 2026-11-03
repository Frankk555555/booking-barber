CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"staff_name" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"items" jsonb NOT NULL,
	"total_price" integer NOT NULL,
	"total_duration" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text NOT NULL,
	"token_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bookings_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "bookings_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "valid_booking" CHECK ("bookings"."end_at" > "bookings"."start_at" AND "bookings"."total_price" >= 0 AND "bookings"."total_duration" > 0),
	CONSTRAINT "valid_booking_status" CHECK ("bookings"."status" IN ('confirmed','in_service','completed','cancelled','no_show'))
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"duration" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "valid_service" CHECK ("services"."price" >= 0 AND "services"."duration" > 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shop" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"hours" jsonb NOT NULL,
	"slot_minutes" integer DEFAULT 15 NOT NULL,
	"horizon_days" integer DEFAULT 30 NOT NULL,
	"cutoff_hours" integer DEFAULT 2 NOT NULL,
	CONSTRAINT "singleton_shop" CHECK ("shop"."id" = 1),
	CONSTRAINT "positive_settings" CHECK ("shop"."slot_minutes" > 0 AND "shop"."horizon_days" > 0 AND "shop"."cutoff_hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hours" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "staff_services_staff_id_service_id_pk" PRIMARY KEY("staff_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT 'วันหยุด' NOT NULL,
	CONSTRAINT "valid_time_off" CHECK ("time_off"."end_at" > "time_off"."start_at")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_start" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "bookings_staff_start" ON "bookings" USING btree ("staff_id","start_at");