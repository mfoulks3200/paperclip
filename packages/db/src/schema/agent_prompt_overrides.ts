import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { globalPrompts } from "./global_prompts.js";

export const agentPromptOverrides = pgTable(
  "agent_prompt_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    globalPromptId: uuid("global_prompt_id")
      .notNull()
      .references(() => globalPrompts.id, { onDelete: "cascade" }),
    disabled: boolean("disabled").notNull().default(true),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdx: index("agent_prompt_overrides_agent_idx").on(table.agentId),
    agentPromptIdx: uniqueIndex("agent_prompt_overrides_agent_prompt_idx").on(
      table.agentId,
      table.globalPromptId,
    ),
  }),
);
