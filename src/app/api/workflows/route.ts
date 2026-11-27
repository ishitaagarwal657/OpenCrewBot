import { body, handle } from "@/lib/server/http";
import { DATA_DIR } from "@/lib/server/config";
import {
  WorkflowScheduler,
  EXAMPLE_COMPETITOR_MONITOR,
  type WorkflowDefinition,
  type WorkflowRun,
} from "@/lib/server/scheduler/workflows";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root = () => path.join(DATA_DIR, "workflows");

async function fileStore() {
  const dir = root();
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, "runs"), { recursive: true });

  return {
    async saveWorkflow(w: WorkflowDefinition) {
      await fs.writeFile(path.join(dir, `${w.id}.json`), JSON.stringify(w, null, 2));
    },
    async getWorkflow(id: string) {
      try {
        return JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), "utf8")) as WorkflowDefinition;
      } catch {
        return null;
      }
    },
    async listWorkflows() {
      const files = await fs.readdir(dir);
      const list: WorkflowDefinition[] = [];
      for (const f of files.filter((x) => x.endsWith(".json"))) {
        list.push(JSON.parse(await fs.readFile(path.join(dir, f), "utf8")));
      }
      return list;
    },
    async saveRun(run: WorkflowRun) {
      await fs.writeFile(path.join(dir, "runs", `${run.id}.json`), JSON.stringify(run, null, 2));
    },
    async listRuns(workflowId: string, limit = 20) {
      const files = await fs.readdir(path.join(dir, "runs"));
      const list: WorkflowRun[] = [];
      for (const f of files.filter((x) => x.endsWith(".json"))) {
        const r = JSON.parse(await fs.readFile(path.join(dir, "runs", f), "utf8")) as WorkflowRun;
        if (r.workflowId === workflowId) list.push(r);
      }
      return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
    },
  };
}

/** GET — list workflows */
export async function GET() {
  return handle(async () => {
    const store = await fileStore();
    return { workflows: await store.listWorkflows() };
  });
}

/** POST — create workflow or seed example
 *  { name, description, schedule, instruction } | { useExample: true }
 */
export async function POST(request: Request) {
  return handle(async () => {
    const payload = await body<{
      useExample?: boolean;
      name?: string;
      description?: string;
      schedule?: "hourly" | "daily" | "weekly";
      instruction?: string;
    }>(request);

    const store = await fileStore();
    const scheduler = new WorkflowScheduler(store);

    if (payload.useExample) {
      const w = await scheduler.create({
        name: EXAMPLE_COMPETITOR_MONITOR.name,
        description: EXAMPLE_COMPETITOR_MONITOR.description,
        schedule: EXAMPLE_COMPETITOR_MONITOR.schedule,
        instruction: EXAMPLE_COMPETITOR_MONITOR.instruction,
      });
      return { workflow: w };
    }

    if (!payload.name || !payload.instruction) {
      return Response.json({ error: "name and instruction required" }, { status: 400 });
    }

    const w = await scheduler.create({
      name: payload.name,
      description: payload.description ?? "",
      schedule: payload.schedule ?? "weekly",
      instruction: payload.instruction,
    });
    return { workflow: w };
  });
}
