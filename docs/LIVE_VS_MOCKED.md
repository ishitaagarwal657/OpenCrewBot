# Live vs Mocked / Simulated Features

**Honesty rule:** This document must stay accurate. Never present mocked behaviour as live.

---

## Live (or Fully Implemented Locally)

| Feature | Notes |
|---------|-------|
| Multi-bot chat UI | Original + extended |
| Rooms, @mentions, hand-offs | Original (extended bounds) |
| Per-bot MEMORY.md | Original |
| Shared room + project memory | New — local Markdown + provenance |
| Task plan generation | New — CoS planner + heuristic selector (Market / Campaign / Sales) |
| Parallel task execution | New — ready-queue + dependency promotion |
| Dynamic agent factory | New — natural language → agent creation |
| Skills registry (8 skills) | New — prompt + tool bundles |
| Approval cards (Ask First) | Original + extended |
| Controlled Access policy + **persistent counters** | New |
| Audit log for approvals | New |
| Execution history persistence | New |
| Scheduled workflows (local scheduler + worker) | New — auto-starts on boot |
| Mock model mode | Original — no API keys required |
| Token/cost display | Original |
| **Tavily Web Search** | ✅ Confirmed live in testing (real tool results returned) |

---

## Requires External Keys (Live when keys present)

| Feature | Required Key / Service | Behaviour without key | Current Status |
|---------|------------------------|-----------------------|----------------|
| Real LLM responses | `NEBIUS_API_KEY` | Mock model | ❌ Not set → Mock model |
| Web search / page read | `TAVILY_API_KEY` | Mock search results | ✅ Live (key present) |
| Cloud browser | `BROWSERBASE_API_KEY` | Approval UI still works; no real browser | ❌ Not set → Mocked |
| Composio apps (Gmail, Slack, Notion, etc.) | `COMPOSIO_API_KEY` + user OAuth | Connection UI present; actions mocked | ❌ Not connected |
| Jev Auto routing | `TYPESAFE_API_KEY` | Falls back to room lead | ❌ Not set |
| GitHub MCP / actions | GitHub PAT or Composio | Mocked or skipped | ❌ Not connected |

---

## Intentionally Simulated / Demo-Only

| Feature | Reason |
|---------|--------|
| Some MeetUniversity competitor pricing numbers | Public sources may be incomplete; clearly labelled “estimated / public data” |
| Full end-to-end Gmail send in demo video | Depends on evaluator having connected Gmail; rejection path is always real |
| Heavy financial model calculations | Implemented as skill; accuracy depends on data provided |

---

## Demonstration Checklist (for honesty)

- [x] Demo 1 (Market Intelligence) — Tavily live search used
- [x] Demo 2 (Marketing Campaign) — content generation works (mock model still produces structured output)
- [x] Demo 3 (Business Analysis) — spreadsheet analysis runs locally
- [ ] Demo 4 (Development Team) — GitHub inspection requires token (not connected)
- [x] Demo 5 (Autonomous Routine) — scheduler is local; history verified
- [x] Demo 6 (Memory) — fully local, restart-safe
- [x] Demo 7 (Human Intervention) — rejection path is enforced in code (Browserbase missing → expected mock)

---

## Cost / Dependency Summary

| Dependency | Purpose | Cost model |
|------------|---------|------------|
| Nebius Token Factory | LLM inference | Pay-per-token |
| Tavily | Search | Free tier / paid |
| Browserbase | Cloud browser | Session-based |
| Composio | App integrations | Free tier / paid |
| Local SQLite + files | Persistence | Free |
| Node.js + pnpm | Runtime | Free |

No secrets are committed. All keys live in `.env`.
