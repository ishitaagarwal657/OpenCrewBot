import { body, handle } from "@/lib/server/http";
import { DATA_DIR } from "@/lib/server/config";
import { TaskEngine } from "@/lib/server/tasks/engine";
import { createFileTaskStore } from "@/lib/server/tasks/memory-store";
import { executeTaskWithAgent } from "@/lib/server/tasks/runtime-bridge";
import {
  EXAMPLE_MARKET_INTEL_PLAN,
  parseTaskPlan,
  selectExamplePlan,
  MEETUNIVERSITY_CONTEXT,
} from "@/lib/server/chief/planner";
import { listBots } from "@/lib/server/db";
import { randomUUID } from "node:crypto";
import type { ApprovalRecord } from "@/lib/server/tasks/types";

function buildEngine() {
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

export async function GET() {
  return handle(async () => {
    const { store } = buildEngine();
    const runs = await store.listRuns(30);
    return { runs };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const payload = await body<{
      instruction?: string;
      plan?: unknown;
      useExample?: boolean;
      ticks?: number;
    }>(request);

    const { engine, store } = buildEngine();
    const bots = await listBots();
    const byName = new Map(bots.map((b) => [b.name.toLowerCase(), b.id]));
    const atlas = bots.find((b) => /atlas/i.test(b.name)) ?? bots[0];

    const instruction = payload.instruction?.trim() || "";
    let plan: ReturnType<typeof selectExamplePlan>;
    if (payload.plan) {
      plan = parseTaskPlan(payload.plan);
    } else if (instruction) {
      plan = selectExamplePlan(instruction);
    } else {
      plan = { ...EXAMPLE_MARKET_INTEL_PLAN };
    }

    const { run, tasks } = await engine.createRunFromPlan({
      plan,
      userInstruction: instruction || plan.summary,
      chiefOfStaffAgentId: atlas?.id ?? "atlas",
      agentIdResolver: (hint) => {
        if (!hint) return atlas?.id ?? null;
        const id = byName.get(hint.toLowerCase());
        if (id) return id;
        const lower = hint.toLowerCase();
        const hit = bots.find(
          (b) =>
            b.name.toLowerCase().includes(lower) ||
            b.title.toLowerCase().includes(lower) ||
            b.handle.includes(lower),
        );
        return hit?.id ?? atlas?.id ?? null;
      },
    });

    const maxTicks = Math.min(payload.ticks ?? tasks.length + 3, 40);
    for (let i = 0; i < maxTicks; i++) {
      const latest = await engine.tick(run.id);
      if (latest.status === "completed" || latest.status === "failed" || latest.status === "cancelled") break;
      const currentTasks = await store.listTasksByRun(run.id);
      const blocked = currentTasks.every((t) =>
        ["succeeded", "failed", "cancelled", "timed_out", "waiting_approval"].includes(t.status),
      );
      if (blocked && currentTasks.some((t) => t.status === "waiting_approval")) break;
    }

    const finalRun = await store.getRun(run.id);
    const finalTasks = await store.listTasksByRun(run.id);

    // Ensure consolidation happened
    if (finalRun && !finalRun.finalDeliverable && ["completed", "failed"].includes(finalRun.status)) {
      try {
        await engine.consolidate(run.id);
      } catch {
        /* ignore */
      }
    }
    const refreshed = await store.getRun(run.id);

    return {
      run: refreshed ?? finalRun,
      tasks: finalTasks,
      meta: {
        meetUniversityContext: MEETUNIVERSITY_CONTEXT.slice(0, 120) + "…",
        note: "executeAgent uses real runTurn against assignee bots (mock model without NEBIUS_API_KEY). Final deliverable is consolidated automatically.",
        hasFinalDeliverable: Boolean(refreshed?.finalDeliverable),
      },
    };
  });
}
