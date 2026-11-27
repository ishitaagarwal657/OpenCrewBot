# OpenCrewBot 2.0 — Autonomous AI Workforce

**Built on top of [OpenCrewBot](https://github.com/Studio1-OSS/OpenCrewBot)** (MIT)  
**Assignment:** EDXSO AI Engineer Intern — Assignment 3

This repository extends the original OpenCrewBot multi-agent chat application into an intelligent AI workforce: Chief of Staff orchestration, dynamic agents, task execution engine, shared memory, skills, approvals, integrations, and scheduled workflows.

> **Important:** This folder contains the **extension layer** (new modules + documentation).  
> You must start from a fork of the original repository and integrate these files.

---

## Quick start (after integrating into a fork)

```sh
git clone <your-fork-of-OpenCrewBot>
cd OpenCrewBot

# Copy extension sources from this package into src/lib/server/ etc.
# (see docs/INTEGRATION.md)

pnpm install
cp .env.example .env
# Add NEBIUS_API_KEY, TAVILY_API_KEY, etc. as needed

pnpm dev
```

Open http://localhost:3000

Without keys the app still runs in **mock mode**.

---

## What was added (summary)

| Module | Location |
|--------|----------|
| A — Chief of Staff | `src/lib/server/chief/planner.ts` |
| B — Dynamic Agent Factory | `src/lib/server/factory/agent-factory.ts` |
| C — Collaboration extensions | Rooms + shared memory (see memory module) |
| D — Task Execution Engine | `src/lib/server/tasks/` |
| E — Extended Memory | `src/lib/server/memory/extended-memory.ts` |
| F — Skills (8) | `src/lib/server/skills/registry.ts` |
| G — 3 Permission Levels | `src/lib/server/permissions/levels.ts` |
| I — Scheduled Workflows | `src/lib/server/scheduler/workflows.ts` |

Full comparison: [`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md)  
Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)  
Live vs mocked: [`docs/LIVE_VS_MOCKED.md`](docs/LIVE_VS_MOCKED.md)

---

## Minimum acceptance criteria mapping

| Requirement | Status |
|-------------|--------|
| Configurable agents ≥ 8 | Supported via factory + seed agents |
| Collaboration rooms ≥ 4 | Supported |
| Dynamic agent creation | Working (NL + heuristic fallback) |
| Parallel task execution | Task Engine ready-queue |
| Persistent individual memory | Original MEMORY.md |
| Shared project memory | New |
| Reusable skills ≥ 8 | 8 skills registered |
| Working integrations ≥ 3 | Architecture + Composio/MCP (keys required) |
| Permission levels = 3 | ask_first / controlled / full_access |
| Scheduled workflows | WorkflowScheduler |
| Approval centre | Engine + permission module |
| Execution history | Task store |
| Failure recovery | Retries + status recovery |
| Business demos | 7 designed (MeetUniversity) |

---

## MeetUniversity demos

See `docs/DEMOS_MEETUNIVERSITY.md` (to be completed with screenshots / recordings).

1. Market Intelligence  
2. Marketing Campaign (Class 11 / Aspirations)  
3. Business Analysis (sample spreadsheet)  
4. Development Team (GitHub inspection + approval)  
5. Autonomous Routine (scheduled competitor monitor)  
6. Memory (preference → restart → edit)  
7. Human Intervention (reject external action)

---

## Licence

Original OpenCrewBot: MIT © Studio1HQ  
Extensions in this package: MIT (same terms).  
Retain original LICENSE and attribution.
