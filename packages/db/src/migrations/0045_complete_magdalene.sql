CREATE TABLE "agent_prompt_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"global_prompt_id" uuid NOT NULL,
	"disabled" boolean DEFAULT true NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"key" text NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"updated_by_agent_id" uuid,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_mockups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"title" text NOT NULL,
	"version" integer NOT NULL,
	"viewport" text DEFAULT 'desktop' NOT NULL,
	"fidelity_level" text DEFAULT 'high' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_prompt_overrides" ADD CONSTRAINT "agent_prompt_overrides_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_prompt_overrides" ADD CONSTRAINT "agent_prompt_overrides_global_prompt_id_global_prompts_id_fk" FOREIGN KEY ("global_prompt_id") REFERENCES "public"."global_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_prompt_overrides" ADD CONSTRAINT "agent_prompt_overrides_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_prompts" ADD CONSTRAINT "global_prompts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_prompts" ADD CONSTRAINT "global_prompts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_prompts" ADD CONSTRAINT "global_prompts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_prompts" ADD CONSTRAINT "global_prompts_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_mockups" ADD CONSTRAINT "issue_mockups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_mockups" ADD CONSTRAINT "issue_mockups_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_mockups" ADD CONSTRAINT "issue_mockups_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_mockups" ADD CONSTRAINT "issue_mockups_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_prompt_overrides_agent_idx" ON "agent_prompt_overrides" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_prompt_overrides_agent_prompt_idx" ON "agent_prompt_overrides" USING btree ("agent_id","global_prompt_id");--> statement-breakpoint
CREATE INDEX "global_prompts_company_project_idx" ON "global_prompts" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "global_prompts_company_enabled_idx" ON "global_prompts" USING btree ("company_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "global_prompts_company_project_key_idx" ON "global_prompts" USING btree ("company_id","project_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "global_prompts_company_null_project_key_idx" ON "global_prompts" USING btree ("company_id","key") WHERE project_id IS NULL;--> statement-breakpoint
CREATE INDEX "issue_mockups_issue_version_idx" ON "issue_mockups" USING btree ("issue_id","version");--> statement-breakpoint
CREATE INDEX "issue_mockups_issue_status_idx" ON "issue_mockups" USING btree ("issue_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_mockups_company_issue_version_uq" ON "issue_mockups" USING btree ("company_id","issue_id","version");--> statement-breakpoint
-- Seed standard prompts for all existing companies (idempotent)
INSERT INTO "global_prompts" ("company_id", "project_id", "key", "title", "body", "enabled", "sort_order", "created_by_user_id")
SELECT c."id", NULL, v."key", v."title", v."body", true, v."sort_order", 'system-migration'
FROM "companies" c
CROSS JOIN (VALUES
  ('culture', 'Culture', 'Define your company''s agent interaction norms, values, and behavioral expectations here.', 0),
  ('conventions', 'Conventions', 'Define your coding standards, naming conventions, and engineering practices here.', 1),
  ('terminology', 'Terminology', 'Define domain-specific vocabulary and terminology that agents should use consistently here.', 2)
) AS v("key", "title", "body", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM "global_prompts" gp
  WHERE gp."company_id" = c."id" AND gp."project_id" IS NULL AND gp."key" = v."key"
);