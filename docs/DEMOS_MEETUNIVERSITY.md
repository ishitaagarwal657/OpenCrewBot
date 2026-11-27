# MeetUniversity Demonstrations

Business: MeetUniversity (https://www.meetuniversity.com/) with three product lines: Aspirations, Study Abroad / University Applications, School Partnerships.

Status labels follow `docs/TEST_EVIDENCE.md`. "Mock model" means no Nebius key was set.

## How to run

```sh
pnpm install
cp .env.example .env
pnpm dev
# open http://localhost:3000, then the Workforce icon in the sidebar footer
node scripts/smoke-modules.mjs
```

## Demo 1: Market Intelligence (passed)
1. Workforce, run the market-intel plan.
2. Parallel research tasks run for competitors, products, pricing, customers and positioning.
3. Expected: delegated tasks, comparison table, strategic opportunities, consolidated report.
Live parts: Tavily search. Mock parts: model text. Pricing figures are marked estimated / public data.

## Demo 2: Marketing Campaign, Class 11 / Aspirations (passed)
1. Run the campaign plan (Growth room).
2. Expected: audience research, strategy, creative concepts, 30-day content calendar, sample drafts.
Mock parts: model text.

## Demo 3: Business Analysis (passed)
1. Run the sales plan on `docs/sample-sales.csv` with the Cipher skill.
2. Expected: calculations, conversion bottlenecks, segment performance, recommendations.
Runs locally on the sample spreadsheet.

## Demo 4: Development Team (partial)
GitHub token or Composio is not connected, so repository inspection has not been run against a real repo. Only the approval gate structure was verified through an Ask-first bot. Not claimed as complete.

## Demo 5: Autonomous Routine (passed)
1. Workforce, Workflows, open "MeetUniversity Competitor Monitor".
2. Run it manually, then show the history and the generated report.
Scheduler is local; history verified.

## Demo 6: Memory (passed)
1. Tell an agent a preference.
2. Restart the app and confirm the preference is remembered.
3. Edit the agent's `MEMORY.md` and confirm the agent follows the correction.
Fully local.

## Demo 7: Human Intervention (verified in mock mode)
1. Use an Ask-first bot and request an external action.
2. Reject the approval card.
3. Show that the action did not execute. In this setup no browser key is set, so the browser tool did not fire. Reject-cancels-task is verified at code level.

## Suggested video order
Agents and rooms, Demos 1 to 3, agent factory, Demo 6, Demo 7, Demo 5, Demo 4 only if keys are available. Say on screen which parts are live and which are mock.
