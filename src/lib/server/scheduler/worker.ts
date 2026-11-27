/**
 * Background scheduler worker — starts once with the app boot.
 * Polls due workflows and starts runs (instruction logged; full CoS optional).
 */

import { DATA_DIR } from "../config";
import {
  WorkflowScheduler,
  type WorkflowDefinition,
  type WorkflowRun,
} from "./workflows";
import { promises as fs } from "node:fs";
import path from "node:path";

const INTERVAL_MS = 60_000;

async function fileStore() {
  const dir = path.join(DATA_DIR, "workflows");
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

const g = globalThis as unknown as { __opencrewbotScheduler?: NodeJS.Timeout };

export function startSchedulerWorker(): void {
  if (g.__opencrewbotScheduler) return;
  g.__opencrewbotScheduler = setInterval(() => {
    void tickDue().catch((err) => console.error("[scheduler]", err));
  }, INTERVAL_MS);
  // Don't keep process alive solely for the timer in some environments
  g.__opencrewbotScheduler.unref?.();
  console.log(`[opencrewbot] scheduler worker started (every ${INTERVAL_MS / 1000}s)`);
}

async function tickDue(): Promise<void> {
  const store = await fileStore();
  const scheduler = new WorkflowScheduler(store);
  const due = await scheduler.listDue();
  for (const w of due) {
    const run = await scheduler.startRun(w.id);
    try {
      // Attempt a full Task Engine run from the workflow instruction
      let taskRunId: string | undefined;
      let reportBody = "";
      try {
        const { createFileTaskStore } = await import("../tasks/memory-store");
        const { TaskEngine } = await import("../tasks/engine");
        const { executeTaskWithAgent } = await import("../tasks/runtime-bridge");
        const { EXAMPLE_MARKET_INTEL_PLAN } = await import("../chief/planner");
        const { listBots } = await import("../db");
        const { randomUUID } = await import("node:crypto");

        const taskStore = createFileTaskStore(DATA_DIR);
        const engine = new TaskEngine({
          store: taskStore,
          executeAgent: executeTaskWithAgent,
          requestApproval: async ({ task, run: r, preview }) => {
            const record = {
              id: randomUUID(),
              taskId: task.id,
              runId: r.id,
              agentId: task.assigneeAgentId ?? "unknown",
              actionPreview: preview,
              status: "pending" as const,
            };
            await taskStore.saveApproval(record);
            return record;
          },
        });

        const bots = await listBots();
        const byName = new Map(bots.map((b) => [b.name.toLowerCase(), b.id]));
        const atlas = bots.find((b) => /atlas/i.test(b.name)) ?? bots[0];

        const plan = {
          ...EXAMPLE_MARKET_INTEL_PLAN,
          summary: w.instruction,
        };

        const { run: taskRun, tasks } = await engine.createRunFromPlan({
          plan,
          userInstruction: w.instruction,
          chiefOfStaffAgentId: atlas?.id ?? "atlas",
          roomId: w.roomId,
          projectId: w.projectId,
          agentIdResolver: (hint) => {
            if (!hint) return atlas?.id ?? null;
            const id = byName.get(hint.toLowerCase());
            if (id) return id;
            const lower = hint.toLowerCase();
            const hit = bots.find(
              (b) =>
                b.name.toLowerCase().includes(lower) ||
                (b as { title?: string }).title?.toLowerCase().includes(lower) ||
                b.handle?.includes(lower),
            );
            return hit?.id ?? atlas?.id ?? null;
          },
        });

        taskRunId = taskRun.id;
        const maxTicks = Math.min(tasks.length + 4, 30);
        for (let i = 0; i < maxTicks; i++) {
          const latest = await engine.tick(taskRun.id);
          if (["completed", "failed", "cancelled"].includes(latest.status)) break;
          const current = await taskStore.listTasksByRun(taskRun.id);
          const blocked = current.every((t) =>
            ["succeeded", "failed", "cancelled", "timed_out", "waiting_approval"].includes(t.status),
          );
          if (blocked) break;
        }

        const finalRun = await taskStore.getRun(taskRun.id);
        const finalTasks = await taskStore.listTasksByRun(taskRun.id);
        const deliverable =
          finalRun?.finalDeliverable ??
          finalTasks
            .filter((t) => t.output)
            .map((t) => `### ${t.title}\n${t.output}`)
            .join("\n\n");

        reportBody = [
          `# Workflow run: ${w.name}`,
          `Started: ${run.startedAt}`,
          `Task Run ID: ${taskRunId}`,
          ``,
          `## Instruction`,
          w.instruction,
          ``,
          `## Results`,
          deliverable || "_No task outputs produced (check approvals or keys)._",
        ].join("\n");
      } catch (inner) {
        reportBody = [
          `# Workflow run: ${w.name}`,
          `Started: ${run.startedAt}`,
          ``,
          `## Instruction`,
          w.instruction,
          ``,
          `## Note`,
          `Full agent execution deferred: ${inner instanceof Error ? inner.message : String(inner)}`,
          `_Open Workforce → Tasks and paste the instruction to run a full plan._`,
        ].join("\n");
      }

      await scheduler.completeRun(run.id, w.id, {
        report: reportBody,
        taskRunId,
      });
    } catch (err) {
      await scheduler.completeRun(run.id, w.id, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
