import { Router, type Request } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { globalPromptService, agentService, projectService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { validate } from "../middleware/validate.js";
import { badRequest, forbidden, notFound } from "../errors.js";

const promptKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);

const upsertPromptSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  body: z.string().min(1).max(131072),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const overrideSchema = z.object({
  disabled: z.boolean(),
});

export function globalPromptRoutes(db: Db) {
  const svc = globalPromptService(db);
  const agentSvc = agentService(db);
  const projectSvc = projectService(db);

  // ─── Helpers ───

  async function assertBoardOrCeo(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    const agent = await agentSvc.getById(req.actor.agentId);
    if (!agent || agent.companyId !== companyId || agent.role !== "ceo") {
      throw forbidden("Only board users or CEO agents may manage company prompts");
    }
  }

  async function assertBoardOrProjectManager(req: Request, companyId: string, projectId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    const agent = await agentSvc.getById(req.actor.agentId);
    if (!agent || agent.companyId !== companyId) {
      throw forbidden("Agent key cannot access another company");
    }
    if (agent.role === "ceo") return;
    const project = await projectSvc.getById(projectId);
    if (!project) throw notFound("Project not found");
    if (project.leadAgentId === agent.id) return;
    if (project.leadAgentId) {
      const chain = await agentSvc.getChainOfCommand(project.leadAgentId);
      if (chain.some((m) => m.id === agent.id)) return;
    }
    throw forbidden("Only board users, CEO, or project managers may manage project prompts");
  }

  async function assertBoardOrAgentManager(req: Request, targetAgentId: string) {
    const targetAgent = await agentSvc.getById(targetAgentId);
    if (!targetAgent) throw notFound("Agent not found");
    assertCompanyAccess(req, targetAgent.companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    if (req.actor.agentId === targetAgentId) {
      throw forbidden("Agents cannot override their own prompts");
    }
    const actorAgent = await agentSvc.getById(req.actor.agentId);
    if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) {
      throw forbidden("Agent key cannot access another company");
    }
    const chain = await agentSvc.getChainOfCommand(targetAgentId);
    if (chain.some((m) => m.id === actorAgent.id)) return;
    throw forbidden("Only board users or the agent's manager may manage prompt overrides");
  }

  async function assertCanViewResolvedPrompts(req: Request, targetAgentId: string) {
    const targetAgent = await agentSvc.getById(targetAgentId);
    if (!targetAgent) throw notFound("Agent not found");
    assertCompanyAccess(req, targetAgent.companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    if (req.actor.agentId === targetAgentId) return;
    const actorAgent = await agentSvc.getById(req.actor.agentId);
    if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) {
      throw forbidden("Agent key cannot access another company");
    }
    const chain = await agentSvc.getChainOfCommand(targetAgentId);
    if (chain.some((m) => m.id === actorAgent.id)) return;
    throw forbidden("Only board users, the agent itself, or its manager may view resolved prompts");
  }

  // ─── Company Prompt Routes ───

  const router = Router();

  // GET /api/companies/:companyId/prompts
  router.get("/companies/:companyId/prompts", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const enabled = req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : undefined;
    const prompts = await svc.listCompanyPrompts(companyId, { enabled });
    res.json(prompts);
  });

  // GET /api/companies/:companyId/prompts/:key
  router.get("/companies/:companyId/prompts/:key", async (req, res) => {
    const companyId = req.params.companyId as string;
    const key = req.params.key as string;
    assertCompanyAccess(req, companyId);
    const prompt = await svc.getCompanyPrompt(companyId, key);
    if (!prompt) throw notFound("Prompt not found");
    res.json(prompt);
  });

  // PUT /api/companies/:companyId/prompts/:key
  router.put("/companies/:companyId/prompts/:key", validate(upsertPromptSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    const key = req.params.key as string;
    const parsed = promptKeySchema.safeParse(key);
    if (!parsed.success) throw badRequest("Invalid prompt key");
    await assertBoardOrCeo(req, companyId);
    const actor = getActorInfo(req);
    const { prompt, created } = await svc.upsertCompanyPrompt(
      companyId,
      parsed.data,
      req.body,
      { agentId: actor.agentId, userId: actor.actorType === "user" ? actor.actorId : null },
    );
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: created ? "global_prompt.created" : "global_prompt.updated",
      entityType: "global_prompt",
      entityId: prompt.id,
      details: { key: parsed.data, scope: "company" },
    });
    res.status(created ? 201 : 200).json(prompt);
  });

  // DELETE /api/companies/:companyId/prompts/:key
  router.delete("/companies/:companyId/prompts/:key", async (req, res) => {
    const companyId = req.params.companyId as string;
    const key = req.params.key as string;
    await assertBoardOrCeo(req, companyId);
    const deleted = await svc.deleteCompanyPrompt(companyId, key);
    if (!deleted) throw notFound("Prompt not found");
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "global_prompt.deleted",
      entityType: "global_prompt",
      entityId: deleted.id,
      details: { key, scope: "company" },
    });
    res.json({ deleted: true });
  });

  // ─── Project Prompt Routes ───

  // GET /api/projects/:projectId/prompts
  router.get("/projects/:projectId/prompts", async (req, res) => {
    const projectId = req.params.projectId as string;
    const project = await projectSvc.getById(projectId);
    if (!project) throw notFound("Project not found");
    assertCompanyAccess(req, project.companyId);
    const enabled = req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : undefined;
    const prompts = await svc.listProjectPrompts(projectId, { enabled });
    res.json(prompts);
  });

  // GET /api/projects/:projectId/prompts/:key
  router.get("/projects/:projectId/prompts/:key", async (req, res) => {
    const projectId = req.params.projectId as string;
    const key = req.params.key as string;
    const project = await projectSvc.getById(projectId);
    if (!project) throw notFound("Project not found");
    assertCompanyAccess(req, project.companyId);
    const prompt = await svc.getProjectPrompt(projectId, key);
    if (!prompt) throw notFound("Prompt not found");
    res.json(prompt);
  });

  // PUT /api/projects/:projectId/prompts/:key
  router.put("/projects/:projectId/prompts/:key", validate(upsertPromptSchema), async (req, res) => {
    const projectId = req.params.projectId as string;
    const key = req.params.key as string;
    const parsed = promptKeySchema.safeParse(key);
    if (!parsed.success) throw badRequest("Invalid prompt key");
    const project = await projectSvc.getById(projectId);
    if (!project) throw notFound("Project not found");
    await assertBoardOrProjectManager(req, project.companyId, projectId);
    const actor = getActorInfo(req);
    const { prompt, created } = await svc.upsertProjectPrompt(
      project.companyId,
      projectId,
      parsed.data,
      req.body,
      { agentId: actor.agentId, userId: actor.actorType === "user" ? actor.actorId : null },
    );
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: created ? "global_prompt.created" : "global_prompt.updated",
      entityType: "global_prompt",
      entityId: prompt.id,
      details: { key: parsed.data, scope: "project", projectId },
    });
    res.status(created ? 201 : 200).json(prompt);
  });

  // DELETE /api/projects/:projectId/prompts/:key
  router.delete("/projects/:projectId/prompts/:key", async (req, res) => {
    const projectId = req.params.projectId as string;
    const key = req.params.key as string;
    const project = await projectSvc.getById(projectId);
    if (!project) throw notFound("Project not found");
    await assertBoardOrProjectManager(req, project.companyId, projectId);
    const deleted = await svc.deleteProjectPrompt(projectId, key);
    if (!deleted) throw notFound("Prompt not found");
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "global_prompt.deleted",
      entityType: "global_prompt",
      entityId: deleted.id,
      details: { key, scope: "project", projectId },
    });
    res.json({ deleted: true });
  });

  // ─── Agent Override Routes ───

  // GET /api/agents/:agentId/prompt-overrides
  router.get("/agents/:agentId/prompt-overrides", async (req, res) => {
    const agentId = req.params.agentId as string;
    const targetAgent = await agentSvc.getById(agentId);
    if (!targetAgent) throw notFound("Agent not found");
    assertCompanyAccess(req, targetAgent.companyId);
    if (req.actor.type === "agent") {
      if (req.actor.agentId !== agentId) {
        const actorAgent = req.actor.agentId ? await agentSvc.getById(req.actor.agentId) : null;
        if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) {
          throw forbidden("Agent key cannot access another company");
        }
        const chain = await agentSvc.getChainOfCommand(agentId);
        if (!chain.some((m) => m.id === actorAgent.id)) {
          throw forbidden("Only board users, the agent itself, or its manager may view overrides");
        }
      }
    }
    const overrides = await svc.listAgentOverrides(agentId);
    res.json(overrides);
  });

  // PUT /api/agents/:agentId/prompt-overrides/:globalPromptId
  router.put("/agents/:agentId/prompt-overrides/:globalPromptId", validate(overrideSchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const globalPromptId = req.params.globalPromptId as string;
    await assertBoardOrAgentManager(req, agentId);
    const actor = getActorInfo(req);
    const { override, created } = await svc.setAgentOverride(
      agentId,
      globalPromptId,
      req.body.disabled,
      { agentId: actor.agentId, userId: actor.actorType === "user" ? actor.actorId : null },
    );
    const targetAgent = await agentSvc.getById(agentId);
    await logActivity(db, {
      companyId: targetAgent!.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent_prompt_override.set",
      entityType: "agent_prompt_override",
      entityId: override.id,
      details: { agentId, globalPromptId, disabled: req.body.disabled },
    });
    res.status(created ? 201 : 200).json(override);
  });

  // DELETE /api/agents/:agentId/prompt-overrides/:globalPromptId
  router.delete("/agents/:agentId/prompt-overrides/:globalPromptId", async (req, res) => {
    const agentId = req.params.agentId as string;
    const globalPromptId = req.params.globalPromptId as string;
    await assertBoardOrAgentManager(req, agentId);
    const deleted = await svc.deleteAgentOverride(agentId, globalPromptId);
    if (!deleted) throw notFound("Override not found");
    const targetAgent = await agentSvc.getById(agentId);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: targetAgent!.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent_prompt_override.removed",
      entityType: "agent_prompt_override",
      entityId: deleted.id,
      details: { agentId, globalPromptId },
    });
    res.json({ deleted: true });
  });

  // ─── Resolved Prompts Preview ───

  // GET /api/agents/:agentId/resolved-prompts?projectId=X
  router.get("/agents/:agentId/resolved-prompts", async (req, res) => {
    const agentId = req.params.agentId as string;
    await assertCanViewResolvedPrompts(req, agentId);
    const targetAgent = await agentSvc.getById(agentId);
    if (!targetAgent) throw notFound("Agent not found");
    const projectId = (req.query.projectId as string) || null;
    const result = await svc.resolveForAgent(agentId, targetAgent.companyId, projectId);
    res.json({
      agentId,
      projectId,
      ...result,
    });
  });

  return router;
}
