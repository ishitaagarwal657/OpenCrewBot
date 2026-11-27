/**
 * Simple file-backed TaskStore for local development.
 * Swap for SQLite in production integration.
 */

import { promises as fs } from "fs";
import path from "path";
import type { TaskStore } from "./engine";
import type { Run, Task, ApprovalRecord } from "./types";

export function createFileTaskStore(dataDir: string): TaskStore {
  const root = path.join(dataDir, "tasks");
  const runsDir = path.join(root, "runs");
  const tasksDir = path.join(root, "items");
  const approvalsDir = path.join(root, "approvals");

  async function ensure() {
    await fs.mkdir(runsDir, { recursive: true });
    await fs.mkdir(tasksDir, { recursive: true });
    await fs.mkdir(approvalsDir, { recursive: true });
  }

  return {
    async saveRun(run: Run) {
      await ensure();
      await fs.writeFile(
        path.join(runsDir, `${run.id}.json`),
        JSON.stringify(run, null, 2),
        "utf8"
      );
    },
    async getRun(id: string) {
      try {
        const t = await fs.readFile(path.join(runsDir, `${id}.json`), "utf8");
        return JSON.parse(t) as Run;
      } catch {
        return null;
      }
    },
    async listRuns(limit = 50) {
      await ensure();
      const files = await fs.readdir(runsDir);
      const runs: Run[] = [];
      for (const f of files.filter((x) => x.endsWith(".json")).slice(0, limit)) {
        const t = await fs.readFile(path.join(runsDir, f), "utf8");
        runs.push(JSON.parse(t));
      }
      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async saveTask(task: Task) {
      await ensure();
      await fs.writeFile(
        path.join(tasksDir, `${task.id}.json`),
        JSON.stringify(task, null, 2),
        "utf8"
      );
    },
    async getTask(id: string) {
      try {
        const t = await fs.readFile(path.join(tasksDir, `${id}.json`), "utf8");
        return JSON.parse(t) as Task;
      } catch {
        return null;
      }
    },
    async listTasksByRun(runId: string) {
      await ensure();
      const files = await fs.readdir(tasksDir);
      const tasks: Task[] = [];
      for (const f of files.filter((x) => x.endsWith(".json"))) {
        const t = await fs.readFile(path.join(tasksDir, f), "utf8");
        const task = JSON.parse(t) as Task;
        if (task.runId === runId) tasks.push(task);
      }
      return tasks;
    },
    async saveApproval(record: ApprovalRecord) {
      await ensure();
      await fs.writeFile(
        path.join(approvalsDir, `${record.id}.json`),
        JSON.stringify(record, null, 2),
        "utf8"
      );
    },
    async getApproval(id: string) {
      try {
        const t = await fs.readFile(
          path.join(approvalsDir, `${id}.json`),
          "utf8"
        );
        return JSON.parse(t) as ApprovalRecord;
      } catch {
        return null;
      }
    },
    async listPendingApprovals() {
      await ensure();
      const files = await fs.readdir(approvalsDir);
      const list: ApprovalRecord[] = [];
      for (const f of files.filter((x) => x.endsWith(".json"))) {
        const t = await fs.readFile(path.join(approvalsDir, f), "utf8");
        const rec = JSON.parse(t) as ApprovalRecord;
        if (rec.status === "pending") list.push(rec);
      }
      return list;
    },
  };
}
