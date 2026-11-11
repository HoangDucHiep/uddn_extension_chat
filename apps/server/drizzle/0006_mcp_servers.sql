CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"transport" text DEFAULT 'stdio' NOT NULL,
	"command" text NOT NULL,
	"args" text[] DEFAULT '{}'::text[] NOT NULL,
	"env" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"last_connected_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_name_idx" ON "mcp_servers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "mcp_servers_enabled_idx" ON "mcp_servers" USING btree ("enabled");