"use client";

/**
 * Workforce control centre — Task Dashboard, Agent Factory, Skills, Workflows.
 * Extra surface beyond the original OpenCrewBot chat UI (Assignment product interface).
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "./OpenCrewBotApp";
import { Button, IconButton } from "./ui";
import { ListChecks, Plus, RefreshCw, Sparkles, Workflow, X, Bot, BookOpen } from "lucide-react";

type Tab = "tasks" | "factory" | "skills" | "workflows";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  assigneeAgentId?: string | null;
  error?: string;
  output?: string;
}

interface RunRow {
  id: string;
  userInstruction: string;
  status: string;
  createdAt: string;
  taskIds?: string[];
}

export function WorkforcePanel({ onClose }: { onClose: () => void }) {
  const { toast, refresh } = useApp();
  const [tab, setTab] = useState<Tab>("tasks");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selectedRun, setSelectedRun] = useState<{ run: RunRow; tasks: TaskRow[] } | null>(null);
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string; whenToUse: string }>>([]);
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; status: string; schedule: string; instruction: string }>>([]);
  const [factoryText, setFactoryText] = useState("");
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState(
    "Research the competitive landscape for MeetUniversity across career discovery, study abroad, and school partnerships.",
  );

  const loadRuns = useCallback(async () => {
    try {
      const { runs } = await api.listTaskRuns();
      setRuns(runs as RunRow[]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load runs");
    }
  }, [toast]);

  const loadSkills = useCallback(async () => {
    try {
      const { skills } = await api.listSkills();
      setSkills(skills);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load skills");
    }
  }, [toast]);

  const loadWorkflows = useCallback(async () => {
    try {
      const { workflows } = await api.listWorkflows();
      setWorkflows(workflows as typeof workflows);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load workflows");
    }
  }, [toast]);

  useEffect(() => {
    if (tab === "tasks") void loadRuns();
    if (tab === "skills") void loadSkills();
    if (tab === "workflows") void loadWorkflows();
  }, [tab, loadRuns, loadSkills, loadWorkflows]);

  async function startExampleRun() {
    setBusy(true);
    try {
      const res = await api.createTaskRun({ instruction, useExample: true });
      toast(`Run ${(res.run as RunRow).status}: ${(res.tasks as TaskRow[]).length} tasks`);
      setSelectedRun({ run: res.run as RunRow, tasks: res.tasks as TaskRow[] });
      await loadRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function openRun(id: string) {
    try {
      const res = await api.getTaskRun(id);
      setSelectedRun({ run: res.run as RunRow, tasks: res.tasks as TaskRow[] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to open run");
    }
  }

  async function createAgent() {
    if (!factoryText.trim()) return;
    setBusy(true);
    try {
      const { bot } = await api.createAgentFromDescription(factoryText.trim());
      toast(`Created agent: ${bot.name}`);
      setFactoryText("");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedWorkflow() {
    setBusy(true);
    try {
      const { workflow } = await api.createWorkflow({ useExample: true });
      toast(`Workflow created: ${(workflow as { name: string }).name}`);
      await loadWorkflows();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Workflow create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
      <div className="flex h-full w-full max-w-xl flex-col bg-surface shadow-pop ring-1 ring-line-strong">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Workforce</h2>
            <p className="text-[12px] text-mute">Tasks · Agents · Skills · Schedules</p>
          </div>
          <IconButton onClick={onClose} aria-label="Close">
            <X size={16} />
          </IconButton>
        </header>

        <nav className="flex gap-1 border-b border-line px-3 py-2">
          {(
            [
              ["tasks", ListChecks, "Tasks"],
              ["factory", Bot, "Factory"],
              ["skills", BookOpen, "Skills"],
              ["workflows", Workflow, "Workflows"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] ${
                tab === id ? "bg-raised-2 text-ink" : "text-mute hover:bg-raised"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "tasks" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-raised p-3 ring-1 ring-line">
                <label className="text-[12px] text-mute">Complex instruction (MeetUniversity demo)</label>
                <textarea
                  className="mt-1 w-full rounded-xl bg-surface p-2 text-[13px] text-ink ring-1 ring-line"
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={busy} onClick={startExampleRun}>
                    <Sparkles size={14} /> Run market-intel plan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={loadRuns}>
                    <RefreshCw size={14} /> Refresh
                  </Button>
                </div>
              </div>

              {selectedRun && (
                <div className="rounded-2xl bg-raised p-3 ring-1 ring-line">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-ink">Run · {selectedRun.run.status}</p>
                    <button className="text-[12px] text-mute" onClick={() => setSelectedRun(null)}>
                      Close
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] text-mute">{selectedRun.run.userInstruction}</p>
                  <ul className="mt-3 space-y-2">
                    {selectedRun.tasks.map((t) => (
                      <li key={t.id} className="rounded-xl bg-surface px-3 py-2 text-[12.5px] ring-1 ring-line">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-ink">{t.title}</span>
                          <span className="text-mute">{t.status}</span>
                        </div>
                        {t.error && <p className="mt-1 text-danger">{t.error}</p>}
                        {t.output && <p className="mt-1 line-clamp-3 text-mute">{t.output}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-mute">History</p>
                <ul className="space-y-1.5">
                  {runs.length === 0 && <li className="text-[13px] text-mute">No runs yet.</li>}
                  {runs.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => openRun(r.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-raised px-3 py-2 text-left text-[13px] hover:bg-raised-2"
                    >
                      <span className="truncate text-ink">{r.userInstruction.slice(0, 60)}</span>
                      <span className="ml-2 shrink-0 text-mute">{r.status}</span>
                    </button>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === "factory" && (
            <div className="space-y-3">
              <p className="text-[13px] text-mute">
                Describe an agent in natural language. It becomes available immediately — no code edit.
              </p>
              <textarea
                className="w-full rounded-2xl bg-raised p-3 text-[13px] text-ink ring-1 ring-line"
                rows={5}
                placeholder="e.g. Create a pricing analyst who compares EdTech subscription plans and writes short memos"
                value={factoryText}
                onChange={(e) => setFactoryText(e.target.value)}
              />
              <Button disabled={busy || !factoryText.trim()} onClick={createAgent}>
                <Plus size={14} /> Create agent
              </Button>
            </div>
          )}

          {tab === "skills" && (
            <ul className="space-y-2">
              {skills.map((s) => (
                <li key={s.id} className="rounded-2xl bg-raised p-3 ring-1 ring-line">
                  <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
                  <p className="mt-1 text-[12.5px] text-mute">{s.description}</p>
                  <p className="mt-1 text-[11.5px] text-mute">When: {s.whenToUse}</p>
                </li>
              ))}
              {skills.length === 0 && <li className="text-[13px] text-mute">Loading skills…</li>}
            </ul>
          )}

          {tab === "workflows" && (
            <div className="space-y-3">
              <Button size="sm" disabled={busy} onClick={seedWorkflow}>
                <Plus size={14} /> Seed MeetUniversity competitor monitor
              </Button>
              <ul className="space-y-2">
                {workflows.map((w) => (
                  <li key={w.id} className="rounded-2xl bg-raised p-3 ring-1 ring-line">
                    <div className="flex justify-between">
                      <p className="text-[13.5px] font-medium text-ink">{w.name}</p>
                      <span className="text-[12px] text-mute">{w.status}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-mute">
                      Schedule: {typeof w.schedule === "string" ? w.schedule : "custom"}
                    </p>
                    <p className="mt-1 line-clamp-3 text-[12.5px] text-ink">{w.instruction}</p>
                  </li>
                ))}
                {workflows.length === 0 && <li className="text-[13px] text-mute">No workflows yet.</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
