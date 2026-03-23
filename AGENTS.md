# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Paperclip is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `doc/`: operational and product docs

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep plan docs dated and centralized.
New plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Run this full check before claiming done:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change

## 11. Retro Learnings — Frontend Engineer

_Last updated: 2026-03-23_

### Keep doing
- **Small, focused components:** Decomposing UI into single-responsibility pieces (e.g. `MockupPreview`, `MockupVersionStrip`, `MockupViewportToggle`) keeps code testable and reusable.
- **TanStack Query hooks per resource:** Creating dedicated query/mutation hooks in `api/` modules keeps data-fetching concerns out of components and makes cache invalidation predictable.
- **Security-first rendering:** Using sandboxed iframes (`sandbox="allow-scripts"`, no `allow-same-origin`, `referrerpolicy="no-referrer"`) for untrusted HTML content (mockups) prevents XSS without sacrificing functionality.

### Stop or change
- **Verify base branch before starting work:** On PAP-37 (mockups), work was done on two different branches, producing duplicate effort. Always confirm the correct base branch with the team lead or backend ticket before writing code.
- **Check for existing partial work:** Before building a feature, check if prior commits or stubs already exist on the target branch to avoid reimplementing what's already there.

### Workflow adjustments
- Before starting any frontend ticket that depends on backend work, read the backend ticket's comments to confirm: (1) which branch has the API code, (2) whether it's merged to master yet, and (3) what endpoints are available.
- When a ticket has multiple deliverables, commit incrementally per deliverable rather than in one large commit — this makes it easier to recover if a branch needs to be rebased or cherry-picked.

## 12. Retro Learnings — DevOps Engineer

_Last updated: 2026-03-23_

### Keep doing
- **Thorough test coverage with clear structure:** Three-layer testing strategy (unit, mocked routes, embedded Postgres E2E) catches real bugs. PAP-38 shipped 31 tests; PAP-33 shipped 74 tests.
- **Documenting blockers with specifics:** Listing exact missing files, commits, and migration names in blocker comments gets faster unblock responses.
- **Addressing code review feedback completely in one pass:** On PAP-33, all critical and minor fixes plus coverage gaps were handled in a single commit, avoiding review round-trips.
- **Finding real bugs through testing:** Discovered missing `companyId` on agent actors (tests passing accidentally because 403 was expected), migration column conflicts, and missing `errorHandler` middleware in test setup.

### Stop or change
- **Don't use `release` to clear stale execution locks:** On PAP-35, attempting to release a task to clear a stale lock also unassigned it, creating a worse state. Escalate stale lock issues to manager immediately instead.
- **Verify code exists before starting verification tasks:** On both PAP-35 and PAP-33, wasted heartbeats discovering implementation code was in unmerged worktrees. Before starting, run `git log --oneline -5` and check for specific files/migrations.
- **Don't retry checkout on locked tasks:** On PAP-35, spent multiple heartbeats retrying. Post one escalation comment and move to other assigned work.

### Workflow adjustments
- Before checkout on verification tasks, confirm the code under test exists on the current branch (`git log`, `ls` key files).
- Run `pnpm -r build` (or at minimum build `@paperclipai/shared` and `@paperclipai/db`) before test runs — missing `dist/` directories cause cryptic `safeParse undefined` errors.
- Always add `errorHandler` middleware to test Express apps to match production `app.ts` and get proper error responses.
- If blocked on checkout or missing code, post one clear escalation comment with `@mention`, then work on the next assigned task in the same heartbeat.
- Check migration ordering early: when E2E tests use embedded Postgres, verify migrations apply cleanly before writing test cases.

## 13. Retro Learnings — Platform Engineer

_Last updated: 2026-03-23_

### Keep doing
- **Early push, rebase later:** Pushing implementation to a feature branch while blocked on an upstream dependency (PAP-30) let review start sooner. Rebasing after merge was clean and low-risk.
- **Type-first approach:** Defining shared types (`ResolvedGlobalPrompt` in `packages/shared`) before wiring heartbeat and adapter integration kept all layers consistent from the start.
- **Stale context cleanup:** Adding explicit `delete context.paperclipGlobalPrompts` on empty/error paths prevents cross-session data leakage in long-lived heartbeat contexts.

### Stop or change
- **Check dependency status before checkout:** On PAP-31, checked out and started work before confirming PAP-30 (the service layer dependency) was merged, resulting in a blocked status and an extra heartbeat cycle. Verify upstream task status before committing to dependent work.
- **Put cross-layer constants in shared:** The 512KB global prompt size cap was initially hardcoded in the heartbeat service. Constants shared across service and adapter layers belong in `packages/shared/src/constants/` so all consumers stay in sync.

### Workflow adjustments
- Before starting integration work that depends on another task, check that task's status and branch state — don't assume it's merged.
- When adding cross-layer features (db → shared → server → adapter), define types and constants in `packages/shared` first, then wire outward to services and adapters.
- Always clean up injected context on error/empty paths to prevent stale data in long-lived agent sessions.
- Keep blocker comments specific: name the exact dependency task, what it provides, and what you've already completed so reviewers can unblock quickly.
