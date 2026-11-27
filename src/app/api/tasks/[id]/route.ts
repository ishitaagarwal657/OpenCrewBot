import { handle } from "@/lib/server/http";
import { DATA_DIR } from "@/lib/server/config";
import { createFileTaskStore } from "@/lib/server/tasks/memory-store";
import { TaskEngine } from "@/lib/server/tasks/engine";
import { executeTaskWithAgent } from "@/lib/server/tasks/runtime-bridge";
import { randomUUID } from "node:crypto";
import type { ApprovalRecord } from "@/lib/server/tasks/types";

function getEngine() {
  const store = createFileTaskStore(DATA_DIR);
  const engine = new TaskEngine({
    store,
    executeAgent: executeTaskWithAgent,
    requestApproval: async ({ task, run, preview }) => {
      const record: ApprovalRecord = {
        id: randomUUID(),
        taskId: task.id,
        runId: run.id,
        agentId: task.assigneeAgentId ?? "unknown",
        actionPreview: preview,
        status: "pending",
      };
      await store.saveApproval(record);
      return record;
    },
  });
  return { store, engine };
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { store } = getEngine();
    const run = await store.getRun(id);
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    const tasks = await store.listTasksByRun(id);
    return { run, tasks };
  });
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { store, engine } = getEngine();
    const run = await store.getRun(id);
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.status === "paused") await engine.resumeRun(id);
    const updated = await engine.tick(id);
    const tasks = await store.listTasksByRun(id);
    return { run: updated, tasks };
  });
}
