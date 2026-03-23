import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { globalPromptRoutes } from "../routes/global-prompts.js";
import { errorHandler } from "../middleware/index.js";

// ─── Mocks ───

const mockGlobalPromptService = vi.hoisted(() => ({
  listCompanyPrompts: vi.fn(),
  getCompanyPrompt: vi.fn(),
  upsertCompanyPrompt: vi.fn(),
  deleteCompanyPrompt: vi.fn(),
  listProjectPrompts: vi.fn(),
  getProjectPrompt: vi.fn(),
  upsertProjectPrompt: vi.fn(),
  deleteProjectPrompt: vi.fn(),
  listAgentOverrides: vi.fn(),
  setAgentOverride: vi.fn(),
  deleteAgentOverride: vi.fn(),
  resolveForAgent: vi.fn(),
  seedStandardPrompts: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  getChainOfCommand: vi.fn(),
}));

const mockProjectService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  globalPromptService: () => mockGlobalPromptService,
  agentService: () => mockAgentService,
  projectService: () => mockProjectService,
  logActivity: mockLogActivity,
}));

// ─── Helpers ───

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const AGENT_ID = "33333333-3333-4333-8333-333333333333";
const CEO_AGENT_ID = "44444444-4444-4444-8444-444444444444";
const MANAGER_AGENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_AGENT_ID = "66666666-6666-4666-8666-666666666666";
const PROMPT_ID = "77777777-7777-4777-8777-777777777777";

function makePrompt(overrides: Record<string, unknown> = {}) {
  return {
    id: PROMPT_ID,
    companyId: COMPANY_ID,
    projectId: null,
    key: "culture",
    title: "Culture",
    body: "Our culture values.",
    enabled: true,
    sortOrder: 0,
    createdByAgentId: null,
    createdByUserId: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCeoAgent() {
  return {
    id: CEO_AGENT_ID,
    companyId: COMPANY_ID,
    name: "CEO",
    role: "ceo",
    title: "CEO",
    status: "active",
    reportsTo: null,
    adapterType: "claude_local",
    adapterConfig: {},
    permissions: null,
  };
}

function makeEngineerAgent() {
  return {
    id: AGENT_ID,
    companyId: COMPANY_ID,
    name: "Engineer",
    role: "engineer",
    title: "Engineer",
    status: "active",
    reportsTo: MANAGER_AGENT_ID,
    adapterType: "claude_local",
    adapterConfig: {},
    permissions: null,
  };
}

function makeManagerAgent() {
  return {
    id: MANAGER_AGENT_ID,
    companyId: COMPANY_ID,
    name: "Manager",
    role: "engineer",
    title: "Manager",
    status: "active",
    reportsTo: CEO_AGENT_ID,
    adapterType: "claude_local",
    adapterConfig: {},
    permissions: null,
  };
}

function makeProject() {
  return {
    id: PROJECT_ID,
    companyId: COMPANY_ID,
    name: "Core",
    leadAgentId: MANAGER_AGENT_ID,
  };
}

type Actor = {
  type: string;
  userId?: string;
  agentId?: string;
  companyId?: string;
  companyIds?: string[];
  source: string;
  isInstanceAdmin: boolean;
};

function createApp(actor: Actor) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", globalPromptRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const boardActor: Actor = {
  type: "board",
  userId: "local-board",
  companyIds: [COMPANY_ID],
  source: "local_implicit",
  isInstanceAdmin: false,
};

function ceoActor(): Actor {
  return {
    type: "agent",
    agentId: CEO_AGENT_ID,
    companyId: COMPANY_ID,
    source: "agent_jwt",
    isInstanceAdmin: false,
  };
}

function engineerActor(): Actor {
  return {
    type: "agent",
    agentId: AGENT_ID,
    companyId: COMPANY_ID,
    source: "agent_jwt",
    isInstanceAdmin: false,
  };
}

function managerActor(): Actor {
  return {
    type: "agent",
    agentId: MANAGER_AGENT_ID,
    companyId: COMPANY_ID,
    source: "agent_jwt",
    isInstanceAdmin: false,
  };
}

function otherCompanyActor(): Actor {
  return {
    type: "board",
    userId: "other-board",
    companyIds: ["other-company"],
    source: "session",
    isInstanceAdmin: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY PROMPT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe("company prompt routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === CEO_AGENT_ID) return makeCeoAgent();
      if (id === AGENT_ID) return makeEngineerAgent();
      if (id === MANAGER_AGENT_ID) return makeManagerAgent();
      return null;
    });
  });

  // ─── GET /api/companies/:companyId/prompts ───

  describe("GET /api/companies/:companyId/prompts", () => {
    it("lists company prompts for board user", async () => {
      const prompts = [makePrompt(), makePrompt({ key: "conventions", title: "Conventions" })];
      mockGlobalPromptService.listCompanyPrompts.mockResolvedValue(prompts);

      const res = await request(createApp(boardActor))
        .get(`/api/companies/${COMPANY_ID}/prompts`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockGlobalPromptService.listCompanyPrompts).toHaveBeenCalledWith(COMPANY_ID, { enabled: undefined });
    });

    it("filters by enabled=true", async () => {
      mockGlobalPromptService.listCompanyPrompts.mockResolvedValue([]);

      const res = await request(createApp(boardActor))
        .get(`/api/companies/${COMPANY_ID}/prompts?enabled=true`);

      expect(res.status).toBe(200);
      expect(mockGlobalPromptService.listCompanyPrompts).toHaveBeenCalledWith(COMPANY_ID, { enabled: true });
    });

    it("filters by enabled=false", async () => {
      mockGlobalPromptService.listCompanyPrompts.mockResolvedValue([]);

      const res = await request(createApp(boardActor))
        .get(`/api/companies/${COMPANY_ID}/prompts?enabled=false`);

      expect(res.status).toBe(200);
      expect(mockGlobalPromptService.listCompanyPrompts).toHaveBeenCalledWith(COMPANY_ID, { enabled: false });
    });

    it("rejects access from a different company", async () => {
      const res = await request(createApp(otherCompanyActor()))
        .get(`/api/companies/${COMPANY_ID}/prompts`);

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/companies/:companyId/prompts/:key ───

  describe("GET /api/companies/:companyId/prompts/:key", () => {
    it("returns a single prompt by key", async () => {
      mockGlobalPromptService.getCompanyPrompt.mockResolvedValue(makePrompt());

      const res = await request(createApp(boardActor))
        .get(`/api/companies/${COMPANY_ID}/prompts/culture`);

      expect(res.status).toBe(200);
      expect(res.body.key).toBe("culture");
    });

    it("returns 404 for missing prompt", async () => {
      mockGlobalPromptService.getCompanyPrompt.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .get(`/api/companies/${COMPANY_ID}/prompts/nonexistent`);

      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/companies/:companyId/prompts/:key ───

  describe("PUT /api/companies/:companyId/prompts/:key", () => {
    it("creates a new company prompt as board user", async () => {
      mockGlobalPromptService.upsertCompanyPrompt.mockResolvedValue({
        prompt: makePrompt({ key: "testing" }),
        created: true,
      });

      const res = await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/testing`)
        .send({ body: "Test content" });

      expect(res.status).toBe(201);
      expect(mockGlobalPromptService.upsertCompanyPrompt).toHaveBeenCalledWith(
        COMPANY_ID,
        "testing",
        { body: "Test content" },
        { agentId: null, userId: "local-board" },
      );
    });

    it("updates an existing company prompt (returns 200)", async () => {
      mockGlobalPromptService.upsertCompanyPrompt.mockResolvedValue({
        prompt: makePrompt(),
        created: false,
      });

      const res = await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "Updated culture values.", title: "Culture v2", enabled: true, sortOrder: 5 });

      expect(res.status).toBe(200);
    });

    it("allows CEO agent to upsert company prompts", async () => {
      mockGlobalPromptService.upsertCompanyPrompt.mockResolvedValue({
        prompt: makePrompt(),
        created: true,
      });

      const res = await request(createApp(ceoActor()))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "CEO content" });

      expect(res.status).toBe(201);
    });

    it("rejects non-CEO agent from creating company prompts", async () => {
      const res = await request(createApp(engineerActor()))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "Should fail" });

      expect(res.status).toBe(403);
    });

    it("rejects invalid prompt key format", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/INVALID-KEY`)
        .send({ body: "Content" });

      expect(res.status).toBe(400);
    });

    it("rejects empty body", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "" });

      expect(res.status).toBe(400);
    });

    it("rejects body exceeding 128KB", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "x".repeat(131073) });

      expect(res.status).toBe(400);
    });

    it("rejects sortOrder out of range", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "Valid", sortOrder: 1001 });

      expect(res.status).toBe(400);
    });

    it("logs activity on upsert", async () => {
      mockGlobalPromptService.upsertCompanyPrompt.mockResolvedValue({
        prompt: makePrompt(),
        created: true,
      });

      await request(createApp(boardActor))
        .put(`/api/companies/${COMPANY_ID}/prompts/culture`)
        .send({ body: "Content" });

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          companyId: COMPANY_ID,
          action: "global_prompt.created",
          entityType: "global_prompt",
        }),
      );
    });
  });

  // ─── DELETE /api/companies/:companyId/prompts/:key ───

  describe("DELETE /api/companies/:companyId/prompts/:key", () => {
    it("deletes a company prompt as board user", async () => {
      mockGlobalPromptService.deleteCompanyPrompt.mockResolvedValue(makePrompt());

      const res = await request(createApp(boardActor))
        .delete(`/api/companies/${COMPANY_ID}/prompts/culture`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true });
    });

    it("returns 404 when deleting non-existent prompt", async () => {
      mockGlobalPromptService.deleteCompanyPrompt.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .delete(`/api/companies/${COMPANY_ID}/prompts/nonexistent`);

      expect(res.status).toBe(404);
    });

    it("allows CEO agent to delete company prompts", async () => {
      mockGlobalPromptService.deleteCompanyPrompt.mockResolvedValue(makePrompt());

      const res = await request(createApp(ceoActor()))
        .delete(`/api/companies/${COMPANY_ID}/prompts/culture`);

      expect(res.status).toBe(200);
    });

    it("rejects non-CEO agent from deleting company prompts", async () => {
      const res = await request(createApp(engineerActor()))
        .delete(`/api/companies/${COMPANY_ID}/prompts/culture`);

      expect(res.status).toBe(403);
    });

    it("logs activity on delete", async () => {
      mockGlobalPromptService.deleteCompanyPrompt.mockResolvedValue(makePrompt());

      await request(createApp(boardActor))
        .delete(`/api/companies/${COMPANY_ID}/prompts/culture`);

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "global_prompt.deleted",
          entityType: "global_prompt",
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT PROMPT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe("project prompt routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockProjectService.getById.mockResolvedValue(makeProject());
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === CEO_AGENT_ID) return makeCeoAgent();
      if (id === AGENT_ID) return makeEngineerAgent();
      if (id === MANAGER_AGENT_ID) return makeManagerAgent();
      return null;
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
  });

  // ─── GET /api/projects/:projectId/prompts ───

  describe("GET /api/projects/:projectId/prompts", () => {
    it("lists project prompts for board user", async () => {
      const prompts = [makePrompt({ projectId: PROJECT_ID, key: "style" })];
      mockGlobalPromptService.listProjectPrompts.mockResolvedValue(prompts);

      const res = await request(createApp(boardActor))
        .get(`/api/projects/${PROJECT_ID}/prompts`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("filters by enabled=true", async () => {
      mockGlobalPromptService.listProjectPrompts.mockResolvedValue([]);

      const res = await request(createApp(boardActor))
        .get(`/api/projects/${PROJECT_ID}/prompts?enabled=true`);

      expect(res.status).toBe(200);
      expect(mockGlobalPromptService.listProjectPrompts).toHaveBeenCalledWith(PROJECT_ID, { enabled: true });
    });

    it("filters by enabled=false", async () => {
      mockGlobalPromptService.listProjectPrompts.mockResolvedValue([]);

      const res = await request(createApp(boardActor))
        .get(`/api/projects/${PROJECT_ID}/prompts?enabled=false`);

      expect(res.status).toBe(200);
      expect(mockGlobalPromptService.listProjectPrompts).toHaveBeenCalledWith(PROJECT_ID, { enabled: false });
    });

    it("returns 404 for non-existent project", async () => {
      mockProjectService.getById.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .get(`/api/projects/${PROJECT_ID}/prompts`);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/projects/:projectId/prompts/:key ───

  describe("GET /api/projects/:projectId/prompts/:key", () => {
    it("returns a single project prompt by key", async () => {
      mockGlobalPromptService.getProjectPrompt.mockResolvedValue(
        makePrompt({ projectId: PROJECT_ID, key: "style" }),
      );

      const res = await request(createApp(boardActor))
        .get(`/api/projects/${PROJECT_ID}/prompts/style`);

      expect(res.status).toBe(200);
      expect(res.body.key).toBe("style");
    });

    it("returns 404 for missing project prompt", async () => {
      mockGlobalPromptService.getProjectPrompt.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .get(`/api/projects/${PROJECT_ID}/prompts/missing`);

      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/projects/:projectId/prompts/:key ───

  describe("PUT /api/projects/:projectId/prompts/:key", () => {
    it("creates a project prompt as board user", async () => {
      mockGlobalPromptService.upsertProjectPrompt.mockResolvedValue({
        prompt: makePrompt({ projectId: PROJECT_ID, key: "style" }),
        created: true,
      });

      const res = await request(createApp(boardActor))
        .put(`/api/projects/${PROJECT_ID}/prompts/style`)
        .send({ body: "Project style guide." });

      expect(res.status).toBe(201);
    });

    it("allows CEO agent to create project prompts", async () => {
      mockGlobalPromptService.upsertProjectPrompt.mockResolvedValue({
        prompt: makePrompt({ projectId: PROJECT_ID }),
        created: true,
      });

      const res = await request(createApp(ceoActor()))
        .put(`/api/projects/${PROJECT_ID}/prompts/culture`)
        .send({ body: "Project culture" });

      expect(res.status).toBe(201);
    });

    it("allows project lead to create project prompts", async () => {
      mockGlobalPromptService.upsertProjectPrompt.mockResolvedValue({
        prompt: makePrompt({ projectId: PROJECT_ID }),
        created: true,
      });

      const res = await request(createApp(managerActor()))
        .put(`/api/projects/${PROJECT_ID}/prompts/culture`)
        .send({ body: "Manager content" });

      expect(res.status).toBe(201);
    });

    it("rejects non-manager agent from creating project prompts", async () => {
      const res = await request(createApp(engineerActor()))
        .put(`/api/projects/${PROJECT_ID}/prompts/culture`)
        .send({ body: "Should fail" });

      expect(res.status).toBe(403);
    });

    it("rejects invalid prompt key", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/projects/${PROJECT_ID}/prompts/UPPER_CASE`)
        .send({ body: "Content" });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/projects/:projectId/prompts/:key ───

  describe("DELETE /api/projects/:projectId/prompts/:key", () => {
    it("deletes a project prompt as board user", async () => {
      mockGlobalPromptService.deleteProjectPrompt.mockResolvedValue(makePrompt({ projectId: PROJECT_ID }));

      const res = await request(createApp(boardActor))
        .delete(`/api/projects/${PROJECT_ID}/prompts/culture`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true });
    });

    it("returns 404 when deleting non-existent project prompt", async () => {
      mockGlobalPromptService.deleteProjectPrompt.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .delete(`/api/projects/${PROJECT_ID}/prompts/nonexistent`);

      expect(res.status).toBe(404);
    });

    it("rejects non-manager agent from deleting project prompts", async () => {
      const res = await request(createApp(engineerActor()))
        .delete(`/api/projects/${PROJECT_ID}/prompts/culture`);

      expect(res.status).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT OVERRIDE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe("agent prompt override routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === CEO_AGENT_ID) return makeCeoAgent();
      if (id === AGENT_ID) return makeEngineerAgent();
      if (id === MANAGER_AGENT_ID) return makeManagerAgent();
      if (id === OTHER_AGENT_ID) return { ...makeEngineerAgent(), id: OTHER_AGENT_ID, companyId: "other-company" };
      return null;
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([makeManagerAgent()]);
  });

  // ─── GET /api/agents/:agentId/prompt-overrides ───

  describe("GET /api/agents/:agentId/prompt-overrides", () => {
    it("lists overrides for board user", async () => {
      mockGlobalPromptService.listAgentOverrides.mockResolvedValue([]);

      const res = await request(createApp(boardActor))
        .get(`/api/agents/${AGENT_ID}/prompt-overrides`);

      expect(res.status).toBe(200);
    });

    it("allows agent to list its own overrides", async () => {
      mockGlobalPromptService.listAgentOverrides.mockResolvedValue([]);

      const res = await request(createApp(engineerActor()))
        .get(`/api/agents/${AGENT_ID}/prompt-overrides`);

      expect(res.status).toBe(200);
    });

    it("allows manager to list subordinate overrides", async () => {
      mockGlobalPromptService.listAgentOverrides.mockResolvedValue([]);

      const res = await request(createApp(managerActor()))
        .get(`/api/agents/${AGENT_ID}/prompt-overrides`);

      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent agent", async () => {
      mockAgentService.getById.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .get(`/api/agents/nonexistent/prompt-overrides`);

      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/agents/:agentId/prompt-overrides/:globalPromptId ───

  describe("PUT /api/agents/:agentId/prompt-overrides/:globalPromptId", () => {
    it("sets an override as board user", async () => {
      mockGlobalPromptService.setAgentOverride.mockResolvedValue({
        override: { id: "override-1", agentId: AGENT_ID, globalPromptId: PROMPT_ID, disabled: true },
        created: true,
      });

      const res = await request(createApp(boardActor))
        .put(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`)
        .send({ disabled: true });

      expect(res.status).toBe(201);
    });

    it("updates an existing override (returns 200)", async () => {
      mockGlobalPromptService.setAgentOverride.mockResolvedValue({
        override: { id: "override-1", agentId: AGENT_ID, globalPromptId: PROMPT_ID, disabled: false },
        created: false,
      });

      const res = await request(createApp(boardActor))
        .put(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`)
        .send({ disabled: false });

      expect(res.status).toBe(200);
    });

    it("allows manager to set override for subordinate", async () => {
      mockGlobalPromptService.setAgentOverride.mockResolvedValue({
        override: { id: "override-1", agentId: AGENT_ID, globalPromptId: PROMPT_ID, disabled: true },
        created: true,
      });

      const res = await request(createApp(managerActor()))
        .put(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`)
        .send({ disabled: true });

      expect(res.status).toBe(201);
    });

    it("rejects agent from overriding its own prompts", async () => {
      const res = await request(createApp(engineerActor()))
        .put(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`)
        .send({ disabled: true });

      expect(res.status).toBe(403);
    });

    it("rejects invalid disabled value", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`)
        .send({ disabled: "yes" });

      expect(res.status).toBe(400);
    });

    it("rejects missing disabled field", async () => {
      const res = await request(createApp(boardActor))
        .put(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/agents/:agentId/prompt-overrides/:globalPromptId ───

  describe("DELETE /api/agents/:agentId/prompt-overrides/:globalPromptId", () => {
    it("deletes an override as board user", async () => {
      mockGlobalPromptService.deleteAgentOverride.mockResolvedValue({
        id: "override-1",
        agentId: AGENT_ID,
        globalPromptId: PROMPT_ID,
      });

      const res = await request(createApp(boardActor))
        .delete(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true });
    });

    it("returns 404 for non-existent override", async () => {
      mockGlobalPromptService.deleteAgentOverride.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .delete(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`);

      expect(res.status).toBe(404);
    });

    it("rejects agent from deleting its own overrides", async () => {
      const res = await request(createApp(engineerActor()))
        .delete(`/api/agents/${AGENT_ID}/prompt-overrides/${PROMPT_ID}`);

      expect(res.status).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESOLVED PROMPTS ROUTE
// ═══════════════════════════════════════════════════════════════════════════

describe("resolved prompts route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === CEO_AGENT_ID) return makeCeoAgent();
      if (id === AGENT_ID) return makeEngineerAgent();
      if (id === MANAGER_AGENT_ID) return makeManagerAgent();
      if (id === OTHER_AGENT_ID) return { ...makeEngineerAgent(), id: OTHER_AGENT_ID, companyId: "other-company" };
      return null;
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([makeManagerAgent()]);
  });

  describe("GET /api/agents/:agentId/resolved-prompts", () => {
    it("returns resolved prompts for board user", async () => {
      mockGlobalPromptService.resolveForAgent.mockResolvedValue({
        resolvedPrompts: [{ key: "culture", title: "Culture", body: "Values", source: "company", sourceId: PROMPT_ID, overriddenByProject: false }],
        disabledPrompts: [],
      });

      const res = await request(createApp(boardActor))
        .get(`/api/agents/${AGENT_ID}/resolved-prompts`);

      expect(res.status).toBe(200);
      expect(res.body.resolvedPrompts).toHaveLength(1);
      expect(res.body.agentId).toBe(AGENT_ID);
    });

    it("resolves without projectId (company-only prompts)", async () => {
      mockGlobalPromptService.resolveForAgent.mockResolvedValue({
        resolvedPrompts: [{ key: "culture", title: "Culture", body: "Values", source: "company", sourceId: PROMPT_ID, overriddenByProject: false }],
        disabledPrompts: [],
      });

      const res = await request(createApp(boardActor))
        .get(`/api/agents/${AGENT_ID}/resolved-prompts`);

      expect(res.status).toBe(200);
      expect(mockGlobalPromptService.resolveForAgent).toHaveBeenCalledWith(
        AGENT_ID,
        COMPANY_ID,
        null,
      );
    });

    it("passes projectId query parameter", async () => {
      mockGlobalPromptService.resolveForAgent.mockResolvedValue({
        resolvedPrompts: [],
        disabledPrompts: [],
      });

      await request(createApp(boardActor))
        .get(`/api/agents/${AGENT_ID}/resolved-prompts?projectId=${PROJECT_ID}`);

      expect(mockGlobalPromptService.resolveForAgent).toHaveBeenCalledWith(
        AGENT_ID,
        COMPANY_ID,
        PROJECT_ID,
      );
    });

    it("allows agent to view its own resolved prompts", async () => {
      mockGlobalPromptService.resolveForAgent.mockResolvedValue({
        resolvedPrompts: [],
        disabledPrompts: [],
      });

      const res = await request(createApp(engineerActor()))
        .get(`/api/agents/${AGENT_ID}/resolved-prompts`);

      expect(res.status).toBe(200);
    });

    it("allows manager to view subordinate resolved prompts", async () => {
      mockGlobalPromptService.resolveForAgent.mockResolvedValue({
        resolvedPrompts: [],
        disabledPrompts: [],
      });

      const res = await request(createApp(managerActor()))
        .get(`/api/agents/${AGENT_ID}/resolved-prompts`);

      expect(res.status).toBe(200);
    });

    it("rejects unauthorized agent from viewing another agent's resolved prompts", async () => {
      // Engineer is not in another engineer's chain of command
      mockAgentService.getChainOfCommand.mockResolvedValue([]);

      // Create a second engineer not managed by the first
      const secondEngineerId = "88888888-8888-4888-8888-888888888888";
      mockAgentService.getById.mockImplementation(async (id: string) => {
        if (id === AGENT_ID) return makeEngineerAgent();
        if (id === secondEngineerId) return { ...makeEngineerAgent(), id: secondEngineerId };
        return null;
      });

      const res = await request(createApp(engineerActor()))
        .get(`/api/agents/${secondEngineerId}/resolved-prompts`);

      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent agent", async () => {
      mockAgentService.getById.mockResolvedValue(null);

      const res = await request(createApp(boardActor))
        .get(`/api/agents/nonexistent/resolved-prompts`);

      expect(res.status).toBe(404);
    });
  });
});
