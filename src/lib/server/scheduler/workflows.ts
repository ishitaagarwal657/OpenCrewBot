/**
 * Scheduled AI Workflows
 * OpenCrewBot 2.0 — Module I
 */

import { randomUUID } from "crypto";

export type WorkflowStatus = "active" | "paused" | "disabled";

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  /** Cron-like simplified: "daily" | "weekly" | "hourly" | interval minutes */
  schedule: "hourly" | "daily" | "weekly" | { everyMinutes: number };
  instruction: string; // what CoS / agents should do
  roomId?: string;
  projectId?: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export type WorkflowRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt?: string;
  taskRunId?: string; // link to Task Engine Run
  report?: string;
  error?: string;
}

export interface WorkflowStore {
  saveWorkflow(w: WorkflowDefinition): Promise<void>;
  getWorkflow(id: string): Promise<WorkflowDefinition | null>;
  listWorkflows(): Promise<WorkflowDefinition[]>;
  saveRun(run: WorkflowRun): Promise<void>;
  listRuns(workflowId: string, limit?: number): Promise<WorkflowRun[]>;
}

function computeNextRun(
  schedule: WorkflowDefinition["schedule"],
  from: Date = new Date()
): string {
  const d = new Date(from);
  if (schedule === "hourly") {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else if (schedule === "daily") {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
  } else if (schedule === "weekly") {
    d.setDate(d.getDate() + 7);
    d.setHours(8, 0, 0, 0);
  } else {
    d.setMinutes(d.getMinutes() + schedule.everyMinutes);
  }
  return d.toISOString();
}

export class WorkflowScheduler {
  constructor(private store: WorkflowStore) {}

  async create(input: {
    name: string;
    description: string;
    schedule: WorkflowDefinition["schedule"];
    instruction: string;
    roomId?: string;
    projectId?: string;
  }): Promise<WorkflowDefinition> {
    const now = new Date().toISOString();
    const w: WorkflowDefinition = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      schedule: input.schedule,
      instruction: input.instruction,
      roomId: input.roomId,
      projectId: input.projectId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      nextRunAt: computeNextRun(input.schedule),
    };
    await this.store.saveWorkflow(w);
    return w;
  }

  async pause(id: string): Promise<void> {
    const w = await this.store.getWorkflow(id);
    if (!w) return;
    w.status = "paused";
    w.updatedAt = new Date().toISOString();
    await this.store.saveWorkflow(w);
  }

  async resume(id: string): Promise<void> {
    const w = await this.store.getWorkflow(id);
    if (!w) return;
    w.status = "active";
    w.updatedAt = new Date().toISOString();
    w.nextRunAt = computeNextRun(w.schedule);
    await this.store.saveWorkflow(w);
  }

  async listDue(now = new Date()): Promise<WorkflowDefinition[]> {
    const all = await this.store.listWorkflows();
    return all.filter(
      (w) =>
        w.status === "active" &&
        w.nextRunAt &&
        new Date(w.nextRunAt) <= now
    );
  }

  /**
   * Start a run. Caller should invoke Task Engine / CoS with w.instruction
   * and then call completeRun with the result.
   */
  async startRun(workflowId: string): Promise<WorkflowRun> {
    const w = await this.store.getWorkflow(workflowId);
    if (!w) throw new Error("Workflow not found");

    const run: WorkflowRun = {
      id: randomUUID(),
      workflowId,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    await this.store.saveRun(run);

    w.lastRunAt = run.startedAt;
    w.nextRunAt = computeNextRun(w.schedule, new Date(run.startedAt));
    w.updatedAt = run.startedAt;
    await this.store.saveWorkflow(w);

    return run;
  }

  async completeRun(
    runId: string,
    workflowId: string,
    result: { report?: string; error?: string; taskRunId?: string }
  ): Promise<void> {
    const runs = await this.store.listRuns(workflowId, 50);
    const run = runs.find((r) => r.id === runId);
    if (!run) return;

    run.status = result.error ? "failed" : "succeeded";
    run.completedAt = new Date().toISOString();
    run.report = result.report;
    run.error = result.error;
    run.taskRunId = result.taskRunId;
    await this.store.saveRun(run);
  }
}

/** Example workflow for Demo 5 — competitor monitoring */
export const EXAMPLE_COMPETITOR_MONITOR: Omit<
  WorkflowDefinition,
  "id" | "createdAt" | "updatedAt" | "nextRunAt"
> = {
  name: "MeetUniversity Competitor Monitor",
  description: "Recurring competitive intelligence sweep",
  schedule: "weekly",
  instruction: `
Research any material changes in the competitive landscape for MeetUniversity
(career discovery, study abroad, school partnerships). Update the comparison
table and produce a short weekly briefing with sources.
`.trim(),
  status: "active",
};
