import { api } from "./client";

/* ── Types ── */

export interface Mockup {
  id: string;
  companyId: string;
  issueId: string;
  assetId: string;
  title: string;
  version: number;
  viewport: string;
  fidelityLevel: string;
  status: string;
  notes: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  previewPath: string;
  /* joined from asset */
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
}

/* ── API ── */

export const mockupsApi = {
  list: (issueId: string, filters?: { status?: string; title?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.title) params.set("title", filters.title);
    const qs = params.toString();
    return api.get<Mockup[]>(`/issues/${issueId}/mockups${qs ? `?${qs}` : ""}`);
  },
  get: (mockupId: string) => api.get<Mockup>(`/mockups/${mockupId}`),
  updateStatus: (mockupId: string, status: string) =>
    api.patch<Mockup>(`/mockups/${mockupId}`, { status }),
  remove: (mockupId: string) => api.delete<{ ok: true }>(`/mockups/${mockupId}`),
};
