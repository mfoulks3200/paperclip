import { pgTable, uuid, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const globalPrompts = pgTable(
  "global_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").references(() => projects.id),
    key: text("key").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("global_prompts_company_project_idx").on(table.companyId, table.projectId),
    companyEnabledIdx: index("global_prompts_company_enabled_idx").on(table.companyId, table.enabled),
    companyProjectKeyIdx: uniqueIndex("global_prompts_company_project_key_idx").on(
      table.companyId,
      table.projectId,
      table.key,
    ),
    companyNullProjectKeyIdx: uniqueIndex("global_prompts_company_null_project_key_idx")
      .on(table.companyId, table.key)
      .where(sql`project_id IS NULL`),
  }),
);
