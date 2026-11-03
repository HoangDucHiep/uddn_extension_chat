-- Bật extension pgvector (RAG). Idempotent nên chạy lại cũng an toàn.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"idx" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"snippet" text DEFAULT '' NOT NULL,
	"tab_id" integer,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Cuộc trò chuyện mới' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"label" text DEFAULT 'default' NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"hint" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"conversation_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"key_source" text DEFAULT 'K1' NOT NULL,
	"prompt_text" text,
	"context_hash" text,
	"context_snapshot" jsonb,
	"response_text" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"ttft_ms" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"tool_calls" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"name" text NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approved_by_user" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "citations_message_idx" ON "citations" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "conversations_archived_updated_idx" ON "conversations" USING btree ("archived","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_pinned_updated_idx" ON "conversations" USING btree ("pinned","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_keys_provider_active_idx" ON "provider_keys" USING btree ("provider_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_keys_provider_label_idx" ON "provider_keys" USING btree ("provider_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "request_logs_request_id_idx" ON "request_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_logs_created_idx" ON "request_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "request_logs_provider_created_idx" ON "request_logs" USING btree ("provider","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tool_calls_message_idx" ON "tool_calls" USING btree ("message_id");