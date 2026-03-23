import { api } from "./client";

/* ── Types ── */

export interface GlobalPrompt {
  id: string;
  companyId: string;
  projectId: string | null;
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPromptOverride {
  id: string;
  agentId: string;
  globalPromptId: string;
  disabled: boolean;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedPrompt {
  key: string;
  title: string;
  body: string;
  source: "company" | "project";
  promptId: string;
  enabled: boolean;
  disabledByOverride?: boolean;
}

export interface UpsertPromptPayload {
  title: string;
  body: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface UpsertOverridePayload {
  disabled: boolean;
}

/* ── Company prompts ── */

export const globalPromptsApi = {
  // Company prompts
  listCompany: (companyId: string) =>
    api.get<GlobalPrompt[]>(`/companies/${companyId}/prompts`),

  getCompany: (companyId: string, key: string) =>
    api.get<GlobalPrompt>(`/companies/${companyId}/prompts/${encodeURIComponent(key)}`),

  upsertCompany: (companyId: string, key: string, data: UpsertPromptPayload) =>
    api.put<GlobalPrompt>(`/companies/${companyId}/prompts/${encodeURIComponent(key)}`, data),

  deleteCompany: (companyId: string, key: string) =>
    api.delete<void>(`/companies/${companyId}/prompts/${encodeURIComponent(key)}`),

  // Project prompts
  listProject: (projectId: string) =>
    api.get<GlobalPrompt[]>(`/projects/${projectId}/prompts`),

  getProject: (projectId: string, key: string) =>
    api.get<GlobalPrompt>(`/projects/${projectId}/prompts/${encodeURIComponent(key)}`),

  upsertProject: (projectId: string, key: string, data: UpsertPromptPayload) =>
    api.put<GlobalPrompt>(`/projects/${projectId}/prompts/${encodeURIComponent(key)}`, data),

  deleteProject: (projectId: string, key: string) =>
    api.delete<void>(`/projects/${projectId}/prompts/${encodeURIComponent(key)}`),

  // Agent overrides
  listOverrides: (agentId: string) =>
    api.get<AgentPromptOverride[]>(`/agents/${agentId}/prompt-overrides`),

  upsertOverride: (agentId: string, promptId: string, data: UpsertOverridePayload) =>
    api.put<AgentPromptOverride>(
      `/agents/${agentId}/prompt-overrides/${encodeURIComponent(promptId)}`,
      data,
    ),

  deleteOverride: (agentId: string, promptId: string) =>
    api.delete<void>(`/agents/${agentId}/prompt-overrides/${encodeURIComponent(promptId)}`),

  // Resolved prompts preview
  resolvedPrompts: (agentId: string, projectId?: string) => {
    const params = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return api.get<ResolvedPrompt[]>(`/agents/${agentId}/resolved-prompts${params}`);
  },
};
