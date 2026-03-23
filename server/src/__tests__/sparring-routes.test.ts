import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sparringSessionRoutes } from "../routes/sparring-sessions.js";
import { errorHandler } from "../middleware/index.js";

const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const ISSUE_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "00000000-0000-4000-8000-000000000003";
const COORDINATOR_ID = "00000000-0000-4000-8000-000000000004";
const PARTICIPANT_ID = "00000000-0000-4000-8000-000000000005";
const RUN_ID = "00000000-0000-4000-8000-000000000006";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  addComment: vi.fn().mockResolvedValue(undefined),
}));

const mockSparringService = vi.hoisted(() => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  getActiveSessionForIssue: vi.fn(),
  recordTurn: vi.fn(),
  listTurns: vi.fn(),
  completeSession: vi.fn(),
  abortSession: vi.fn(),
}));

const mockDocumentService = vi.hoisted(() => ({
  upsertIssueDocument: vi.fn().mockResolvedValue(undefined),
}));

const mockLogActivity = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../services/issues.js", () => ({
  issueService: () => mockIssueService,
}));

vi.mock("../services/sparring.js", () => ({
  sparringService: () => mockSparringService,
}));

vi.mock("../services/documents.js", () => ({
  documentService: () => mockDocumentService,
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: mockLogActivity,
}));

function makeDb(selectResult: unknown[] = []) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue(selectResult),
  };
  const thenableChain = Object.assign(Promise.resolve(selectResult), selectChain);
  return {
    select: vi.fn().mockReturnValue(thenableChain),
  };
}

function makeActiveSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    companyId: COMPANY_ID,
    issueId: ISSUE_ID,
    coordinatorAgentId: COORDINATOR_ID,
    topic: "Test topic",
    status: "active",
    config: { maxRounds: 5, totalTimeoutSec: 600, turnTimeoutSec: 120 },
    summary: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    participants: [{ agentId: PARTICIPANT_ID, role: "reviewer", status: "invited" }],
    ...overrides,
  };
}

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: ISSUE_ID,
    companyId: COMPANY_ID,
    checkoutRunId: RUN_ID,
    ...overrides,
  };
}

function createApp(
  actor: any = {
    type: "agent",
    agentId: COORDINATOR_ID,
    companyId: COMPANY_ID,
    runId: RUN_ID,
  },
  dbSelectResult: unknown[] = [],
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", sparringSessionRoutes(makeDb(dbSelectResult) as any));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/issues/:id/sparring-sessions", () => {
  it("creates a session (happy path)", async () => {
    const session = makeActiveSession();
    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockSparringService.getActiveSessionForIssue.mockResolvedValue(null);
    mockSparringService.createSession.mockResolvedValue({ session, participant: session.participants[0] });

    const app = createApp(undefined, [{ id: PARTICIPANT_ID, companyId: COMPANY_ID }]);
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/sparring-sessions`)
      .send({ topic: "Test topic", participantAgentId: PARTICIPANT_ID });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(SESSION_ID);
    expect(mockSparringService.createSession).toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("returns 404 when issue not found", async () => {
    mockIssueService.getById.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/sparring-sessions`)
      .send({ topic: "Test topic", participantAgentId: PARTICIPANT_ID });

    expect(res.status).toBe(404);
  });

  it("returns 403 when actor is not an agent", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue());

    const app = createApp({ type: "board", userId: "board-user", source: "local_implicit" });
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/sparring-sessions`)
      .send({ topic: "Test topic", participantAgentId: PARTICIPANT_ID });

    expect(res.status).toBe(403);
  });

  it("returns 403 when agent does not own the checkout run", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue({ checkoutRunId: "other-run" }));

    const app = createApp();
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/sparring-sessions`)
      .send({ topic: "Test topic", participantAgentId: PARTICIPANT_ID });

    expect(res.status).toBe(403);
  });

  it("returns 409 when active session already exists", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockSparringService.getActiveSessionForIssue.mockResolvedValue(makeActiveSession());

    const app = createApp();
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/sparring-sessions`)
      .send({ topic: "Test topic", participantAgentId: PARTICIPANT_ID });

    expect(res.status).toBe(409);
  });

  it("returns 422 when participant agent not found", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockSparringService.getActiveSessionForIssue.mockResolvedValue(null);
    // The route does a direct db.select().from(agents) for participant lookup
    // Since our mock db returns [] by default, participant won't be found

    const app = createApp();
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/sparring-sessions`)
      .send({ topic: "Test topic", participantAgentId: PARTICIPANT_ID });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/sparring-sessions/:id", () => {
  it("returns session details", async () => {
    const session = makeActiveSession();
    mockSparringService.getSession.mockResolvedValue(session);

    const app = createApp();
    const res = await request(app).get(`/api/sparring-sessions/${SESSION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(SESSION_ID);
    expect(res.body.participants).toHaveLength(1);
  });

  it("returns 404 when session not found", async () => {
    mockSparringService.getSession.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get("/api/sparring-sessions/nonexistent");

    expect(res.status).toBe(404);
  });
});

describe("POST /api/sparring-sessions/:id/turns", () => {
  const turnPayload = {
    agentId: COORDINATOR_ID,
    roundNumber: 1,
    turnNumber: 1,
    role: "coordinator",
    content: "Opening argument",
  };

  it("records a turn (happy path)", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());
    mockSparringService.recordTurn.mockResolvedValue({ id: "turn-1", sessionId: SESSION_ID, ...turnPayload });

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/turns`)
      .send(turnPayload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("turn-1");
    expect(mockSparringService.recordTurn).toHaveBeenCalled();
  });

  it("returns 404 when session not found", async () => {
    mockSparringService.getSession.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/turns`)
      .send(turnPayload);

    expect(res.status).toBe(404);
  });

  it("returns 422 when session is not active", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession({ status: "completed" }));

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/turns`)
      .send(turnPayload);

    expect(res.status).toBe(422);
  });

  it("returns 403 when actor is not the coordinator", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());

    const app = createApp({
      type: "agent",
      agentId: "other-agent",
      companyId: COMPANY_ID,
      runId: "other-run",
    });
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/turns`)
      .send(turnPayload);

    expect(res.status).toBe(403);
  });

  it("returns 422 when roundNumber exceeds maxRounds", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession({ config: { maxRounds: 3 } }));

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/turns`)
      .send({ ...turnPayload, roundNumber: 4 });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/sparring-sessions/:id/turns", () => {
  it("lists turns for a session", async () => {
    const turns = [
      { id: "turn-1", sessionId: SESSION_ID, turnNumber: 1, role: "coordinator", content: "Hi" },
      { id: "turn-2", sessionId: SESSION_ID, turnNumber: 2, role: "participant", content: "Hello" },
    ];
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());
    mockSparringService.listTurns.mockResolvedValue(turns);

    const app = createApp();
    const res = await request(app).get(`/api/sparring-sessions/${SESSION_ID}/turns`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns 404 when session not found", async () => {
    mockSparringService.getSession.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get("/api/sparring-sessions/nonexistent/turns");

    expect(res.status).toBe(404);
  });
});

describe("POST /api/sparring-sessions/:id/complete", () => {
  it("completes a session with document and comment", async () => {
    const session = makeActiveSession();
    const updatedSession = { ...session, status: "completed", summary: "All resolved" };
    const turns = [
      { id: "turn-1", turnNumber: 1, roundNumber: 1, role: "coordinator", content: "Point A", tokenCount: 100 },
      { id: "turn-2", turnNumber: 2, roundNumber: 1, role: "participant", content: "Point B", tokenCount: 150 },
    ];

    mockSparringService.getSession.mockResolvedValue(session);
    mockSparringService.completeSession.mockResolvedValue(updatedSession);
    mockSparringService.listTurns.mockResolvedValue(turns);

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/complete`)
      .send({ summary: "All resolved" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(mockDocumentService.upsertIssueDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: ISSUE_ID,
        key: "sparring",
        format: "markdown",
      }),
    );
    expect(mockIssueService.addComment).toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("returns 403 when actor is not the coordinator", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());

    const app = createApp({
      type: "agent",
      agentId: "other-agent",
      companyId: COMPANY_ID,
      runId: "other-run",
    });
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/complete`)
      .send({ summary: "Done" });

    expect(res.status).toBe(403);
  });

  it("returns 409 when session is not active", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());
    mockSparringService.completeSession.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/complete`)
      .send({ summary: "Done" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/sparring-sessions/:id/abort", () => {
  it("aborts a session as coordinator", async () => {
    const session = makeActiveSession();
    const aborted = { ...session, status: "aborted", summary: "No longer needed" };
    mockSparringService.getSession.mockResolvedValue(session);
    mockSparringService.abortSession.mockResolvedValue(aborted);

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/abort`)
      .send({ reason: "No longer needed" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aborted");
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("allows board user to abort", async () => {
    const session = makeActiveSession();
    const aborted = { ...session, status: "aborted" };
    mockSparringService.getSession.mockResolvedValue(session);
    mockSparringService.abortSession.mockResolvedValue(aborted);

    const app = createApp({ type: "board", userId: "board-user", source: "local_implicit" });
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/abort`)
      .send({});

    expect(res.status).toBe(200);
  });

  it("returns 403 when non-coordinator agent tries to abort", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());

    const app = createApp({
      type: "agent",
      agentId: "other-agent",
      companyId: COMPANY_ID,
      runId: "other-run",
    });
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/abort`)
      .send({ reason: "test" });

    expect(res.status).toBe(403);
  });

  it("returns 409 when session is not active", async () => {
    mockSparringService.getSession.mockResolvedValue(makeActiveSession());
    mockSparringService.abortSession.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post(`/api/sparring-sessions/${SESSION_ID}/abort`)
      .send({ reason: "test" });

    expect(res.status).toBe(409);
  });
});
