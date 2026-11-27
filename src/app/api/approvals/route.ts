import { body, handle } from "@/lib/server/http";
import { DATA_DIR } from "@/lib/server/config";
import { createFileTaskStore } from "@/lib/server/tasks/memory-store";
import { TaskEngine } from "@/lib/server/tasks/engine";
import { randomUUID } from "node:crypto";
import type { ApprovalRecord } from "@/lib/server/tasks/types";

function getEngine() {
  const store = createFileTaskStore(DATA_DIR);
  const engine = new TaskEngine({
    store,
    executeAgent: async ({ task }) => ({ output: `[stub] ${task.title}` }),
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

/** GET — pending task-level approvals (Approval Centre) */
export async function GET() {
  return handle(async () => {
    const { store } = getEngine();
    const pending = await store.listPendingApprovals();
    return { approvals: pending };
  });
}

/** POST { approvalId, decision: "approved" | "rejected", reason? } */
export async function POST(request: Request) {
  return handle(async () => {
    const { approvalId, decision, reason } = await body<{
      approvalId?: string;
      decision?: "approved" | "rejected";
      reason?: string;
    }>(request);
    if (!approvalId || !decision) {
      return Response.json({ error: "approvalId and decision required" }, { status: 400 });
    }
    const { engine } = getEngine();
    if (decision === "approved") await engine.approve(approvalId);
    else await engine.reject(approvalId, reason);
    return { ok: true, decision };
  });
}
