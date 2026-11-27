# Known Limitations

Written to match `docs/LIVE_VS_MOCKED.md` and `docs/TEST_EVIDENCE.md`.

## Model
- No `NEBIUS_API_KEY` was set during testing, so all agent output came from the scripted mock model. Content quality in the demos reflects that, not a real LLM.
- Multi-model routing is implemented as helpers; fallback and cost tracking were not exercised against real providers.

## Planning
- The Chief of Staff selects from heuristic plan templates (Market Intelligence, Campaign, Sales analysis). It does not yet generate an arbitrary plan for a completely new business problem with a real LLM.

## Integrations
- Tavily web search: live (confirmed).
- Browserbase (cloud browser): not connected. Browser actions stay mocked; the approval path was verified structurally.
- Composio (Gmail, Slack, Notion) and GitHub MCP: not connected. Demo 4 (GitHub inspection) is partial and has not been run against a real repository.
- Jev auto-routing: not set, falls back to the room lead.
- Because only Tavily is live, the "three working integrations" requirement is met only if local memory and the local workflow engine are counted as integrations. This is stated openly rather than hidden.

## Approval demo
- Demo 7 was verified in mock mode: with no browser key, the browser tool did not fire. The reject-cancels-task behaviour is verified at code level, not with a live external tool.

## Demonstrations
- Some MeetUniversity competitor pricing figures are estimated from public sources and labelled as such.
- Gmail send was not demonstrated end to end.

## Security and scope
- Single local owner, no sign-in. Listens on 127.0.0.1 only. Do not expose it to the internet as-is.
- Next.js 16.4.0 shows a security-upgrade notice (16.4.6 available). Not upgraded at submission time.

## Testing
- Automated coverage is a smoke script of module-level checks (skills count, permission matrix, dependency promotion, factory heuristic, seeding, plan selector, consolidation shape). There is no full integration or end-to-end suite.
