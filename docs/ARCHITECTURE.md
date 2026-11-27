# Architecture — OpenCrewBot 2.0

OpenCrewBot 2.0 is an extension layer on top of the original MIT-licensed OpenCrewBot (Next.js 16 + Mastra + SQLite). The original agent loop (Mastra `AgentController`, one per bot, one session per conversation) is kept unchanged. The 2.0 modules sit beside it and call into it through a runtime bridge.

## Layers

1. Original core (kept): chat UI, bots, rooms, per-bot `MEMORY.md`, Ask-first / Full-access approval cards, Tavily search, Browserbase browser, Composio and MCP connections, mock model, token/cost display.
2. Workforce layer (new), all under `src/lib/server/`:
   - `chief/planner.ts` — Chief of Staff. Turns one instruction into a task plan (tasks, assigned agents, dependencies). Plan selection is heuristic (Market Intelligence, Campaign, Sales analysis templates), not a free-form LLM planner.
   - `tasks/engine.ts`, `tasks/types.ts`, `tasks/memory-store.ts`, `tasks/runtime-bridge.ts` — execution engine. Ready-queue with dependency promotion, parallel execution of independent tasks, retries up to `maxRetries`, failure propagation to dependents, `waiting_approval` state, execution history persisted to disk. The runtime bridge hands each task to the original bot runtime.
   - `factory/agent-factory.ts` — natural-language agent creation. Produces name, role, persona, model, tools, skills, permissions and output format, and registers the agent without editing source code.
   - `skills/registry.ts` — 8 reusable skills (prompt + tool bundles) that agents load by task.
   - `memory/extended-memory.ts` — shared room memory and project memory as Markdown files, with provenance (what, when, why).
   - `permissions/levels.ts`, `permissions/counters.ts` — Ask First, Controlled Access, Full Access. `evaluatePermission` decides whether an action needs approval. Controlled Access limits are enforced with persistent counters in `data/permissions/counters.json`.
   - `rooms-collab.ts` — collaboration rooms with delegation bounds (loop guards).
   - `scheduler/workflows.ts`, `scheduler/worker.ts` — scheduled workflows (local scheduler and background worker, started on boot), manual run, history.
   - `models-routing.ts` — multi-model routing helpers (per-agent model choice).
3. HTTP API (new), `src/app/api/`: `agents/create`, `approvals`, `tasks`, `tasks/[id]`, `skills`, `workflows`, `status/extended`, `rooms/[id]/memory`.
4. UI (new): `src/components/WorkforcePanel.tsx`, opened from the Workforce icon in the sidebar footer. Covers tasks, agent factory, skills, workflows and approvals.

## Execution flow

1. User gives one instruction (Workforce panel or a room).
2. Chief of Staff builds a visible plan: task ID, agent, dependencies, approval requirement.
3. Engine promotes tasks whose dependencies are done and runs independent ones in parallel.
4. Each task runs through the runtime bridge on the assigned bot. External or sensitive actions go through `evaluatePermission`.
5. If approval is required, the task waits in `waiting_approval`. Approve continues it. Reject marks the task `cancelled` and the executor is never called.
6. Failures retry up to `maxRetries`, then the task is `failed` and its dependents are cancelled.
7. Results are consolidated into one final deliverable, including on partial failure. History is stored for later viewing.

## Memory

- Individual: `data/workspaces/<botId>/MEMORY.md` (original). Editable in the Memory tab or any editor.
- Shared room and project memory: local Markdown files with provenance.
- Persistence: files and SQLite live under `data/`, so they survive a restart.

## Permissions

- Ask First: external and sensitive actions need approval.
- Controlled Access: pre-approved actions run within limits; anything outside the limits asks.
- Full Access: permitted actions run without asking.
- Audit log for approvals; secrets stay in `.env` and never in source.

## Persistence and secrets

SQLite (`data/opencrewbot.db`, `data/mastra.db`), Markdown memory, task store, workflow history and permission counters are all local. `.env` and `data/` are git-ignored.
