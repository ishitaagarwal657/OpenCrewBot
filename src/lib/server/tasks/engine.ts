/**
 * Task Execution Engine
 * OpenCrewBot 2.0 — Module D
 *
 * Responsible for:
 * - Materialising a TaskPlan into Run + Tasks
 * - Ready-queue & parallel execution
 * - Retries, timeouts, cancellation
 * - Approval gating
 * - Persistence & recovery
 */

import { randomUUID } from "crypto";
import type {
  Task,
  Run,
  TaskPlan,
  TaskStatus,
  ApprovalRecord,
  RunStatus,
} from "./types";

// In production this would be backed by SQLite (tasks.db).
// This in-memory + file-friendly version is the contract the rest of the system uses.

export interface TaskStore {
  saveRun(run: Run): Promise<void>;
  getRun(id: string): Promise<Run | null>;
  listRuns(limit?: number): Promise<Run[]>;
  saveTask(task: Task): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  listTasksByRun(runId: string): Promise<Task[]>;
  saveApproval(record: ApprovalRecord): Promise<void>;
  getApproval(id: string): Promise<ApprovalRecord | null>;
  listPendingApprovals(): Promise<ApprovalRecord[]>;
}

export type AgentExecutor = (args: {
  task: Task;
  run: Run;
}) => Promise<{ output: string; error?: string }>;

export type ApprovalRequester = (args: {
  task: Task;
  run: Run;
  preview: string;
}) => Promise<ApprovalRecord>;

export class TaskEngine {
  private store: TaskStore;
  private executeAgent: AgentExecutor;
  private requestApproval: ApprovalRequester;
  private running = new Map<string, AbortController>();

  constructor(opts: {
    store: TaskStore;
    executeAgent: AgentExecutor;
    requestApproval: ApprovalRequester;
  }) {
    this.store = opts.store;
    this.executeAgent = opts.executeAgent;
    this.requestApproval = opts.requestApproval;
  }

  /** Create a Run from a CoS TaskPlan */
  async createRunFromPlan(args: {
    plan: TaskPlan;
    userInstruction: string;
    chiefOfStaffAgentId: string;
    roomId?: string;
    projectId?: string;
    agentIdResolver: (hint?: string) => string | null;
  }): Promise<{ run: Run; tasks: Task[] }> {
    const runId = randomUUID();
    const now = new Date().toISOString();

    const tasks: Task[] = args.plan.tasks.map((t, index) => {
      const id = randomUUID();
      return {
        id,
        runId,
        title: t.title,
        description: t.description,
        assigneeAgentId: args.agentIdResolver(t.assigneeHint),
        requiredSkills: t.requiredSkills ?? [],
        requiredCapabilities: t.requiredCapabilities ?? [],
        dependencies: [], // filled after all ids known
        status: "pending" as TaskStatus,
        requiresApproval: Boolean(t.requiresApproval),
        approvalStatus: t.requiresApproval ? "pending" : "not_required",
        retryCount: 0,
        maxRetries: 2,
        timeoutMs: t.timeoutMs ?? 300_000,
        parallelGroup: t.parallelGroup,
        metadata: { planIndex: index },
      };
    });

    // Resolve dependency indices → task ids
    args.plan.tasks.forEach((t, index) => {
      if (t.dependsOn?.length) {
        tasks[index].dependencies = t.dependsOn
          .filter((i) => i >= 0 && i < tasks.length)
          .map((i) => tasks[i].id);
      }
    });

    // Mark tasks with no deps as ready
    for (const task of tasks) {
      if (task.dependencies.length === 0) {
        task.status = "ready";
      }
    }

    const run: Run = {
      id: runId,
      userInstruction: args.userInstruction,
      roomId: args.roomId,
      projectId: args.projectId,
      status: "running",
      chiefOfStaffAgentId: args.chiefOfStaffAgentId,
      taskIds: tasks.map((t) => t.id),
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveRun(run);
    for (const task of tasks) {
      await this.store.saveTask(task);
    }

    return { run, tasks };
  }

  /** Main loop: dispatch ready tasks until terminal state */
  async tick(runId: string): Promise<Run> {
    const run = await this.store.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.status === "paused" || run.status === "cancelled") return run;

    const tasks = await this.store.listTasksByRun(runId);
    const byId = new Map(tasks.map((t) => [t.id, t]));

    // Promote pending → ready when deps succeed
    for (const task of tasks) {
      if (task.status !== "pending") continue;
      const depsOk = task.dependencies.every(
        (d) => byId.get(d)?.status === "succeeded"
      );
      const depsFailed = task.dependencies.some((d) => {
        const s = byId.get(d)?.status;
        return s === "failed" || s === "cancelled" || s === "timed_out";
      });
      if (depsFailed) {
        task.status = "failed";
        task.error = "Upstream dependency failed";
        task.completedAt = new Date().toISOString();
        await this.store.saveTask(task);
      } else if (depsOk) {
        task.status = "ready";
        await this.store.saveTask(task);
      }
    }

    // Dispatch ready tasks (parallel)
    const ready = tasks.filter((t) => t.status === "ready");
    await Promise.all(ready.map((t) => this.dispatchTask(t, run)));

    // Re-read and decide run status
    const updatedTasks = await this.store.listTasksByRun(runId);
    const allTerminal = updatedTasks.every((t) =>
      ["succeeded", "failed", "cancelled", "timed_out"].includes(t.status)
    );
    const anyFailed = updatedTasks.some((t) =>
      ["failed", "timed_out"].includes(t.status)
    );

    if (allTerminal) {
      run.status = anyFailed ? "failed" : "completed";
      run.completedAt = new Date().toISOString();
      run.updatedAt = run.completedAt;
      if (anyFailed) {
        run.error = "One or more tasks failed";
      }
      await this.store.saveRun(run);
      // Always produce a consolidated deliverable when the run finishes
      try {
        await this.consolidate(runId);
      } catch (err) {
        console.error("[TaskEngine] consolidate failed", err);
      }
    }

    return run;
  }

  private async dispatchTask(task: Task, run: Run): Promise<void> {
    if (task.requiresApproval && task.approvalStatus === "pending") {
      task.status = "waiting_approval";
      await this.store.saveTask(task);
      const preview =
        task.approvalPreview ??
        `Task "${task.title}" requires approval before execution.\n\n${task.description}`;
      await this.requestApproval({ task, run, preview });
      return;
    }

    if (task.requiresApproval && task.approvalStatus === "rejected") {
      task.status = "cancelled";
      task.error = "Approval rejected by human";
      task.completedAt = new Date().toISOString();
      await this.store.saveTask(task);
      return;
    }

    task.status = "running";
    task.startedAt = new Date().toISOString();
    await this.store.saveTask(task);

    const controller = new AbortController();
    this.running.set(task.id, controller);

    const timeout = setTimeout(() => {
      controller.abort();
    }, task.timeoutMs);

    try {
      const result = await Promise.race([
        this.executeAgent({ task, run }),
        new Promise<{ output: string; error: string }>((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("Task timed out or cancelled"))
          );
        }),
      ]);

      if (result.error) {
        await this.handleFailure(task, result.error);
      } else {
        task.status = "succeeded";
        task.output = result.output;
        task.completedAt = new Date().toISOString();
        await this.store.saveTask(task);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("timed out")) {
        task.status = "timed_out";
        task.error = message;
        task.completedAt = new Date().toISOString();
        await this.store.saveTask(task);
      } else {
        await this.handleFailure(task, message);
      }
    } finally {
      clearTimeout(timeout);
      this.running.delete(task.id);
    }
  }

  private async handleFailure(task: Task, error: string): Promise<void> {
    if (task.retryCount < task.maxRetries) {
      task.retryCount += 1;
      task.status = "ready";
      task.error = `Retry ${task.retryCount}/${task.maxRetries}: ${error}`;
      await this.store.saveTask(task);
      return;
    }
    task.status = "failed";
    task.error = error;
    task.completedAt = new Date().toISOString();
    await this.store.saveTask(task);
  }

  async approve(approvalId: string, decidedBy = "user"): Promise<void> {
    const record = await this.store.getApproval(approvalId);
    if (!record || record.status !== "pending") return;
    record.status = "approved";
    record.decidedAt = new Date().toISOString();
    record.decidedBy = decidedBy;
    await this.store.saveApproval(record);

    const task = await this.store.getTask(record.taskId);
    if (task) {
      task.approvalStatus = "approved";
      task.status = "ready";
      await this.store.saveTask(task);
    }
  }

  async reject(
    approvalId: string,
    reason?: string,
    decidedBy = "user"
  ): Promise<void> {
    const record = await this.store.getApproval(approvalId);
    if (!record || record.status !== "pending") return;
    record.status = "rejected";
    record.decidedAt = new Date().toISOString();
    record.decidedBy = decidedBy;
    record.reason = reason;
    await this.store.saveApproval(record);

    const task = await this.store.getTask(record.taskId);
    if (task) {
      task.approvalStatus = "rejected";
      task.status = "cancelled";
      task.error = reason ?? "Rejected by human";
      task.completedAt = new Date().toISOString();
      await this.store.saveTask(task);
    }
  }

  async cancelRun(runId: string): Promise<void> {
    const run = await this.store.getRun(runId);
    if (!run) return;
    run.status = "cancelled";
    run.updatedAt = new Date().toISOString();
    await this.store.saveRun(run);

    const tasks = await this.store.listTasksByRun(runId);
    for (const task of tasks) {
      if (["pending", "ready", "running", "waiting_approval"].includes(task.status)) {
        task.status = "cancelled";
        task.completedAt = new Date().toISOString();
        await this.store.saveTask(task);
        this.running.get(task.id)?.abort();
      }
    }
  }

  async pauseRun(runId: string): Promise<void> {
    const run = await this.store.getRun(runId);
    if (!run) return;
    run.status = "paused";
    run.updatedAt = new Date().toISOString();
    await this.store.saveRun(run);
  }

  async resumeRun(runId: string): Promise<void> {
    const run = await this.store.getRun(runId);
    if (!run || run.status !== "paused") return;
    run.status = "running";
    run.updatedAt = new Date().toISOString();
    await this.store.saveRun(run);
  }

  /**
   * Consolidate successful task outputs into a final deliverable on the Run.
   * Called automatically when a run reaches a terminal state.
   */
  async consolidate(runId: string): Promise<string> {
    const run = await this.store.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const tasks = await this.store.listTasksByRun(runId);
    const succeeded = tasks.filter((t) => t.status === "succeeded" && t.output);
    const failed = tasks.filter((t) =>
      ["failed", "timed_out", "cancelled"].includes(t.status),
    );

    const sections: string[] = [
      `# Final Deliverable`,
      ``,
      `**Original instruction:** ${run.userInstruction}`,
      `**Run status:** ${run.status}`,
      `**Completed:** ${run.completedAt ?? new Date().toISOString()}`,
      ``,
    ];

    if (succeeded.length) {
      sections.push(`## Completed Tasks (${succeeded.length})`, ``);
      for (const t of succeeded) {
        sections.push(`### ${t.title}`, ``, t.output!.trim(), ``);
      }
    }

    if (failed.length) {
      sections.push(`## Incomplete / Failed Tasks (${failed.length})`, ``);
      for (const t of failed) {
        sections.push(`- **${t.title}**: ${t.error ?? t.status}`);
      }
      sections.push(``);
    }

    sections.push(
      `---`,
      `_Consolidated by OpenCrewBot Task Engine. Individual agent outputs preserved above._`,
    );

    const deliverable = sections.join("\n");
    run.finalDeliverable = deliverable;
    run.updatedAt = new Date().toISOString();
    await this.store.saveRun(run);
    return deliverable;
  }
}
