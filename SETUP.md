# Setup — OpenCrewBot 2.0

## Requirements
- Node.js **22.13+** (developed on 24)
- **pnpm** 9+ (`corepack enable && corepack prepare pnpm@11.21.0 --activate`)

## Install & run

```sh
unzip OpenCrewBot-2.0-workforce.zip   # if using the zip
cd OpenCrewBot-fork

pnpm install
cp .env.example .env
pnpm dev
```

Open **http://localhost:3000** (bound to 127.0.0.1).

### Optional keys (`.env`)

| Key | Effect |
|-----|--------|
| `NEBIUS_API_KEY` | Real models (else mock) |
| `TAVILY_API_KEY` | Live web search |
| `BROWSERBASE_API_KEY` | Cloud browser |
| `COMPOSIO_API_KEY` | Gmail / Slack / Notion / GitHub apps |
| `TYPESAFE_API_KEY` | Jev auto-routing in rooms |

No keys required to explore the UI (mock mode).

## First-run seed
Creates 8 bots + 4 rooms + MeetUniversity project memory marker.

## Workforce panel
Sidebar footer → **list-checks** icon → Tasks / Factory / Skills / Workflows.

## Smoke test
```sh
node scripts/smoke-modules.mjs
```

## Push to your GitHub fork
```sh
# from a fresh clone of YOUR fork of Studio1-OSS/OpenCrewBot
# copy these sources over, then:
git add -A
git commit -F COMMIT_MESSAGE.txt
git push origin main
```

## Assignment submission links
1. GitHub repo URL  
2. Local run confirmation (Node version + `pnpm dev`)  
3. Screen recording (use `docs/DEMO_PROMPTS.md`)  
4. Docs already in `docs/`
