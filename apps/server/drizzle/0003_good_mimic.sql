CREATE TABLE "budget_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"limit_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"warn_threshold_percent" integer DEFAULT 80 NOT NULL,
	"period" text DEFAULT 'monthly' NOT NULL,
	"hard_block" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
