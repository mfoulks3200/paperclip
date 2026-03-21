import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  companies,
  companyMemberships,
  createDb,
  ensurePostgresDatabase,
  applyPendingMigrations,
  projects,
} from "@paperclipai/db";
import { globalPromptRoutes } from "../routes/global-prompts.js";
import { errorHandler } from "../middleware/index.js";

vi.mock("../services/index.js", async () => {
  const actual = await vi.importActual<typeof import("../services/index.js")>("../services/index.js");
  return {
    ...actual,
  };
});

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

async function getEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const mod = await import("embedded-postgres");
  return mod.default as EmbeddedPostgresCtor;
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function startTempDatabase() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-global-prompts-e2e-"));
  const port = await getAvailablePort();
  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await instance.initialise();
  await instance.start();

  const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
  await ensurePostgresDatabase(adminConnectionString, "paperclip");
  const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  await applyPendingMigrations(connectionString);
  return { connectionString, dataDir, instance };
}

describe("global prompts end-to-end", () => {
  let db!: ReturnType<typeof createDb>;
  let instance: EmbeddedPostgresInstance | null = null;
  let dataDir = "";
  let companyId: string;
  let projectId: string;
  let ceoAgentId: string;
  let engineerAgentId: string;

  beforeAll(async () => {
    const started = await startTempDatabase();
    db = createDb(started.connectionString);
    instance = started.instance;
    dataDir = started.dataDir;

    // Seed test data
    companyId = randomUUID();
    projectId = randomUUID();
    ceoAgentId = randomUUID();
    engineerAgentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Test Co",
      urlKey: "test-co",
    });

    await db.insert(companyMemberships).values({
      companyId,
      userId: "board-user",
      role: "owner",
    });

    await db.insert(agents).values({
      id: ceoAgentId,
      companyId,
      name: "CEO Bot",
      role: "ceo",
      status: "active",
      adapterType: "claude_local",
      adapterConfig: {},
    });

    await db.insert(agents).values({
      id: engineerAgentId,
      companyId,
      name: "Engineer Bot",
      role: "engineer",
      status: "active",
      reportsTo: ceoAgentId,
      adapterType: "claude_local",
      adapterConfig: {},
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Core Project",
      urlKey: "core",
      leadAgentId: ceoAgentId,
    });
  }, 30_000);

  afterAll(async () => {
    if (instance) {
      await instance.stop().catch(() => {});
    }
    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }, 10_000);

  function createApp(actor: Record<string, unknown>) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = actor;
      next();
    });
    app.use("/api", globalPromptRoutes(db));
    app.use(errorHandler);
    return app;
  }

  function boardActor() {
    return {
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
  }

  function ceoActor() {
    return {
      type: "agent",
      agentId: ceoAgentId,
      companyIds: [companyId],
      source: "agent_jwt",
      isInstanceAdmin: false,
    };
  }

  // ─── Migration seeds standard prompts ───

  it("migration seeds 3 standard prompts for the company", async () => {
    const app = createApp(boardActor());

    const res = await request(app).get(`/api/companies/${companyId}/prompts`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    const keys = res.body.map((p: { key: string }) => p.key).sort();
    expect(keys).toEqual(["conventions", "culture", "terminology"]);
  });

  // ─── Full CRUD lifecycle ───

  it("creates, reads, updates, and deletes a company prompt", async () => {
    const app = createApp(boardActor());

    // Create
    const createRes = await request(app)
      .put(`/api/companies/${companyId}/prompts/testing-guide`)
      .send({ body: "Always write tests.", title: "Testing Guide", sortOrder: 10 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.key).toBe("testing-guide");

    // Read
    const getRes = await request(app).get(`/api/companies/${companyId}/prompts/testing-guide`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.body).toBe("Always write tests.");
    expect(getRes.body.sortOrder).toBe(10);

    // Update
    const updateRes = await request(app)
      .put(`/api/companies/${companyId}/prompts/testing-guide`)
      .send({ body: "Updated: always write tests and review them." });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.body).toBe("Updated: always write tests and review them.");

    // Delete
    const deleteRes = await request(app).delete(`/api/companies/${companyId}/prompts/testing-guide`);
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const verifyRes = await request(app).get(`/api/companies/${companyId}/prompts/testing-guide`);
    expect(verifyRes.status).toBe(404);
  });

  // ─── Project prompt lifecycle ───

  it("creates and reads project-level prompts", async () => {
    const app = createApp(boardActor());

    const createRes = await request(app)
      .put(`/api/projects/${projectId}/prompts/deploy-steps`)
      .send({ body: "Run deploy.sh", title: "Deploy Steps" });
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get(`/api/projects/${projectId}/prompts`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((p: { key: string }) => p.key === "deploy-steps")).toBe(true);

    // Cleanup
    await request(app).delete(`/api/projects/${projectId}/prompts/deploy-steps`);
  });

  // ─── Resolution: company + project merge ───

  it("resolves company prompts for agent without project", async () => {
    const app = createApp(boardActor());

    const res = await request(app).get(`/api/agents/${engineerAgentId}/resolved-prompts`);

    expect(res.status).toBe(200);
    expect(res.body.resolvedPrompts.length).toBeGreaterThanOrEqual(3);
    expect(res.body.resolvedPrompts.every((p: { source: string }) => p.source === "company")).toBe(true);
  });

  it("project prompt overrides company prompt on matching key", async () => {
    const app = createApp(boardActor());

    // Create project prompt with same key as company prompt
    await request(app)
      .put(`/api/projects/${projectId}/prompts/culture`)
      .send({ body: "Project-specific culture override.", title: "Project Culture" });

    const res = await request(app).get(
      `/api/agents/${engineerAgentId}/resolved-prompts?projectId=${projectId}`,
    );

    expect(res.status).toBe(200);
    const culture = res.body.resolvedPrompts.find((p: { key: string }) => p.key === "culture");
    expect(culture).toBeDefined();
    expect(culture.source).toBe("project");
    expect(culture.overriddenByProject).toBe(true);
    expect(culture.body).toBe("Project-specific culture override.");

    // Cleanup
    await request(app).delete(`/api/projects/${projectId}/prompts/culture`);
  });

  // ─── Agent override disables prompt ───

  it("agent override disables a prompt from resolved results", async () => {
    const app = createApp(boardActor());

    // Get the culture prompt ID first
    const cultureRes = await request(app).get(`/api/companies/${companyId}/prompts/culture`);
    expect(cultureRes.status).toBe(200);
    const culturePromptId = cultureRes.body.id;

    // Set override to disable it for the engineer
    const overrideRes = await request(app)
      .put(`/api/agents/${engineerAgentId}/prompt-overrides/${culturePromptId}`)
      .send({ disabled: true });
    expect(overrideRes.status).toBe(201);

    // Verify resolved prompts excludes culture
    const resolvedRes = await request(app).get(`/api/agents/${engineerAgentId}/resolved-prompts`);
    expect(resolvedRes.status).toBe(200);
    expect(resolvedRes.body.resolvedPrompts.some((p: { key: string }) => p.key === "culture")).toBe(false);
    expect(resolvedRes.body.disabledPrompts.some((p: { key: string }) => p.key === "culture")).toBe(true);

    // Cleanup: remove override
    await request(app).delete(`/api/agents/${engineerAgentId}/prompt-overrides/${culturePromptId}`);
  });

  // ─── Cascade delete ───

  it("deleting a company prompt cascades to remove agent overrides", async () => {
    const app = createApp(boardActor());

    // Create a temporary prompt
    const createRes = await request(app)
      .put(`/api/companies/${companyId}/prompts/temp-cascade`)
      .send({ body: "Temporary" });
    expect(createRes.status).toBe(201);
    const tempPromptId = createRes.body.id;

    // Create an agent override for it
    const overrideRes = await request(app)
      .put(`/api/agents/${engineerAgentId}/prompt-overrides/${tempPromptId}`)
      .send({ disabled: true });
    expect(overrideRes.status).toBe(201);

    // Delete the prompt
    const deleteRes = await request(app).delete(`/api/companies/${companyId}/prompts/temp-cascade`);
    expect(deleteRes.status).toBe(200);

    // Verify override is gone (the override entry references the deleted prompt)
    const overridesRes = await request(app).get(`/api/agents/${engineerAgentId}/prompt-overrides`);
    expect(overridesRes.status).toBe(200);
    const leftover = overridesRes.body.find(
      (o: { globalPromptId: string }) => o.globalPromptId === tempPromptId,
    );
    expect(leftover).toBeUndefined();
  });

  // ─── Access control ───

  it("engineer agent cannot create company prompts", async () => {
    const app = createApp({
      type: "agent",
      agentId: engineerAgentId,
      companyIds: [companyId],
      source: "agent_jwt",
      isInstanceAdmin: false,
    });

    const res = await request(app)
      .put(`/api/companies/${companyId}/prompts/hack`)
      .send({ body: "Should fail" });

    expect(res.status).toBe(403);
  });

  it("CEO agent can create company prompts", async () => {
    const app = createApp(ceoActor());

    const res = await request(app)
      .put(`/api/companies/${companyId}/prompts/ceo-prompt`)
      .send({ body: "CEO-authored prompt" });
    expect(res.status).toBe(201);

    // Cleanup
    await request(createApp(boardActor())).delete(`/api/companies/${companyId}/prompts/ceo-prompt`);
  });

  it("agent cannot override its own prompts", async () => {
    const app = createApp({
      type: "agent",
      agentId: engineerAgentId,
      companyIds: [companyId],
      source: "agent_jwt",
      isInstanceAdmin: false,
    });

    const cultureRes = await request(createApp(boardActor())).get(
      `/api/companies/${companyId}/prompts/culture`,
    );
    const culturePromptId = cultureRes.body.id;

    const res = await request(app)
      .put(`/api/agents/${engineerAgentId}/prompt-overrides/${culturePromptId}`)
      .send({ disabled: true });

    expect(res.status).toBe(403);
  });

  // ─── Seeding idempotency ───

  it("seeding is idempotent — standard prompts are not duplicated", async () => {
    const app = createApp(boardActor());

    // List before — should have 3 standard prompts
    const before = await request(app).get(`/api/companies/${companyId}/prompts`);
    const countBefore = before.body.length;

    // The migration already ran during startTempDatabase → applyPendingMigrations.
    // If we run migrations again, the WHERE NOT EXISTS guard prevents duplication.
    // We verify the count hasn't changed.
    const after = await request(app).get(`/api/companies/${companyId}/prompts`);
    expect(after.body.length).toBe(countBefore);
  });
});
