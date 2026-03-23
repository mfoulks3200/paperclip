import { api } from "./client";

export interface GlobalPrompt {
  id: string;
  companyId: string;
  projectId: string | null;
  key: string;
  title: string | null;
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

export interface UpsertPromptPayload {
  title?: string | null;
  body: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface AgentPromptOverride {
  id: string;
  agentId: string;
  globalPromptId: string;
  globalPromptKey: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedPrompt {
  key: string;
  title: string | null;
  body: string;
  source: "company" | "project";
  sourceId: string;
  overriddenByProject: boolean;
}

export interface ResolvedPromptsResult {
  agentId: string;
  projectId: string | null;
  resolvedPrompts: ResolvedPrompt[];
  disabledPrompts: { key: string; source: string; reason: string }[];
}

export const promptsApi = {
  // Company prompts
  listCompany: (companyId: string) =>
    api.get<GlobalPrompt[]>(`/companies/${companyId}/prompts`),
  getCompany: (companyId: string, key: string) =>
    api.get<GlobalPrompt>(`/companies/${companyId}/prompts/${key}`),
  upsertCompany: (companyId: string, key: string, data: UpsertPromptPayload) =>
    api.put<GlobalPrompt>(`/companies/${companyId}/prompts/${key}`, data),
  deleteCompany: (companyId: string, key: string) =>
    api.delete<{ deleted: true }>(`/companies/${companyId}/prompts/${key}`),

  // Project prompts
  listProject: (projectId: string) =>
    api.get<GlobalPrompt[]>(`/projects/${projectId}/prompts`),
  upsertProject: (projectId: string, key: string, data: UpsertPromptPayload) =>
    api.put<GlobalPrompt>(`/projects/${projectId}/prompts/${key}`, data),
  deleteProject: (projectId: string, key: string) =>
    api.delete<{ deleted: true }>(`/projects/${projectId}/prompts/${key}`),

  // Agent overrides
  listAgentOverrides: (agentId: string) =>
    api.get<AgentPromptOverride[]>(`/agents/${agentId}/prompt-overrides`),
  setAgentOverride: (agentId: string, globalPromptId: string, disabled: boolean) =>
    api.put<AgentPromptOverride>(
      `/agents/${agentId}/prompt-overrides/${globalPromptId}`,
      { disabled },
    ),
  deleteAgentOverride: (agentId: string, globalPromptId: string) =>
    api.delete<{ deleted: true }>(`/agents/${agentId}/prompt-overrides/${globalPromptId}`),

  // Resolved prompts
  resolveForAgent: (agentId: string, projectId?: string) =>
    api.get<ResolvedPromptsResult>(
      `/agents/${agentId}/resolved-prompts${projectId ? `?projectId=${projectId}` : ""}`,
    ),
};
