# Feature Audit — Original OpenCrewBot vs 2.0

Original repo: https://github.com/Studio1-OSS/OpenCrewBot (MIT, Studio1HQ). Original licence and attribution are kept.

## Already implemented in the original

| Area | What the original had |
|------|-----------------------|
| Bots | Name, role, instructions, model, tools, approval level per bot; tokens and cost per reply |
| Rooms | @mentions, @everyone, Auto routing with Jev, Lead/Everyone modes, bot-to-bot hand-offs up to two hops |
| Memory | One `MEMORY.md` per bot, loaded each turn, editable, secret redaction |
| Approvals | Ask first / Full access, Allow once / Deny cards for browser and MCP actions |
| Tools | Tavily search, Browserbase browser, Mastra Code Mode, Ask me |
| Connections | Composio apps, own MCP servers (GitHub preset) |
| Mock mode | Scripted model, runs with no keys |
| Persistence | SQLite plus Markdown files, restart recovery |

## Partial or simulated in the original

- Jev model routing is shown as "coming soon".
- Composio sign-in and actions, Browserbase sessions and Jev routing were listed by the original as still to verify with live services.
- Delegation between bots is limited to @mention hand-offs; there is no task plan, no dependencies and no tracking.
- No scheduling (listed under "Extending it").

## Limitations of the original that 2.0 addresses

- No Chief of Staff or planning.
- No task execution engine (retries, timeouts, history).
- Agents are created through the form only.
- Only per-bot memory.
- Only two permission levels and only for browser/MCP categories.
- No skills ecosystem.
- No scheduled workflows.

## Added in 2.0

| Module | New work | File(s) |
|--------|----------|---------|
| A. Chief of Staff | Task plan generation with agents and dependencies (heuristic plan selector for Market, Campaign, Sales) and consolidation | `chief/planner.ts` |
| D. Execution engine | Ready-queue, dependency promotion, parallel execution, retries, failure propagation, `waiting_approval`, persisted history | `tasks/*` |
| B. Agent factory | Natural-language agent creation, available without code edits; `POST /api/agents/create` | `factory/agent-factory.ts` |
| C. Collaboration | Delegation bounds and loop guards for rooms; 4 seeded rooms | `rooms-collab.ts` |
| E. Memory | Shared room memory and project memory in Markdown with provenance | `memory/extended-memory.ts` |
| F. Skills | 8 reusable skills loaded per task | `skills/registry.ts` |
| G. Permissions | Third level (Controlled Access) with persistent counters; approval audit log; approvals API | `permissions/*`, `api/approvals` |
| I. Scheduling | Local scheduler and background worker, manual run, history | `scheduler/*` |
| J. Models | Per-agent model and routing helpers | `models-routing.ts` |
| UI | Workforce panel (tasks, factory, skills, workflows, approvals) | `WorkforcePanel.tsx` |
| Tests | Module smoke test | `scripts/smoke-modules.mjs` |

## Not claimed

- Real LLM responses (Nebius key not set; runs on the mock model).
- Cloud browser actions (Browserbase key not set).
- Composio apps and GitHub MCP (not connected during testing).
- Jev auto-routing (key not set).

See `docs/LIVE_VS_MOCKED.md` for the full live-versus-mocked split.
