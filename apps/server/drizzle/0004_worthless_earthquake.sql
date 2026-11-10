CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"prompt_template" text NOT NULL,
	"scope" text DEFAULT 'user' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "skills_name_idx" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "skills_scope_enabled_idx" ON "skills" USING btree ("scope","enabled");