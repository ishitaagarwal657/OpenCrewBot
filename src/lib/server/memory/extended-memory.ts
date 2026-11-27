/**
 * Extended Persistent Memory
 * OpenCrewBot 2.0 — Module E
 *
 * Extends original per-bot MEMORY.md with:
 * - Shared room memory
 * - Project memory
 * - Provenance (what / when / why)
 */

import { promises as fs } from "fs";
import path from "path";

export type MemoryScope = "agent" | "room" | "project";

export interface ProvenanceEntry {
  timestamp: string;
  scope: MemoryScope;
  scopeId: string;
  action: "add" | "edit" | "delete";
  contentSnippet: string;
  reason: string;
  actor: string; // agent id or "user"
}

export interface MemoryPaths {
  dataDir: string;
}

function scopePath(paths: MemoryPaths, scope: MemoryScope, id: string): string {
  switch (scope) {
    case "agent":
      return path.join(paths.dataDir, "workspaces", id, "MEMORY.md");
    case "room":
      return path.join(paths.dataDir, "rooms", id, "SHARED_MEMORY.md");
    case "project":
      return path.join(paths.dataDir, "projects", id, "PROJECT_MEMORY.md");
  }
}

function provenancePath(paths: MemoryPaths): string {
  return path.join(paths.dataDir, "memory-provenance.jsonl");
}

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readMemory(
  paths: MemoryPaths,
  scope: MemoryScope,
  id: string
): Promise<string> {
  const file = scopePath(paths, scope, id);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

export async function writeMemory(
  paths: MemoryPaths,
  scope: MemoryScope,
  id: string,
  content: string,
  actor: string,
  reason: string
): Promise<void> {
  const file = scopePath(paths, scope, id);
  await ensureParent(file);
  await fs.writeFile(file, content, "utf8");
  await appendProvenance(paths, {
    timestamp: new Date().toISOString(),
    scope,
    scopeId: id,
    action: "edit",
    contentSnippet: content.slice(0, 200),
    reason,
    actor,
  });
}

export async function appendMemoryLine(
  paths: MemoryPaths,
  scope: MemoryScope,
  id: string,
  line: string,
  actor: string,
  reason: string
): Promise<void> {
  const existing = await readMemory(paths, scope, id);
  const next = existing
    ? `${existing.trimEnd()}\n- ${line.trim()}\n`
    : `# Memory\n\n- ${line.trim()}\n`;
  const file = scopePath(paths, scope, id);
  await ensureParent(file);
  await fs.writeFile(file, next, "utf8");
  await appendProvenance(paths, {
    timestamp: new Date().toISOString(),
    scope,
    scopeId: id,
    action: "add",
    contentSnippet: line.slice(0, 200),
    reason,
    actor,
  });
}

async function appendProvenance(
  paths: MemoryPaths,
  entry: ProvenanceEntry
): Promise<void> {
  const file = provenancePath(paths);
  await ensureParent(file);
  await fs.appendFile(file, JSON.stringify(entry) + "\n", "utf8");
}

export async function readProvenance(
  paths: MemoryPaths,
  filter?: { scope?: MemoryScope; scopeId?: string }
): Promise<ProvenanceEntry[]> {
  const file = provenancePath(paths);
  try {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split("\n").filter(Boolean);
    let entries = lines.map((l) => JSON.parse(l) as ProvenanceEntry);
    if (filter?.scope) {
      entries = entries.filter((e) => e.scope === filter.scope);
    }
    if (filter?.scopeId) {
      entries = entries.filter((e) => e.scopeId === filter.scopeId);
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Load the first N lines of agent + optional room/project memory
 * for injection into the system prompt (same pattern as original MEMORY.md).
 */
export async function loadMemoryForPrompt(
  paths: MemoryPaths,
  opts: {
    agentId: string;
    roomId?: string;
    projectId?: string;
    maxLines?: number;
  }
): Promise<string> {
  const maxLines = opts.maxLines ?? 200;
  const parts: string[] = [];

  const agentMem = await readMemory(paths, "agent", opts.agentId);
  if (agentMem.trim()) {
    parts.push("## Agent Memory\n" + takeLines(agentMem, maxLines));
  }

  if (opts.roomId) {
    const roomMem = await readMemory(paths, "room", opts.roomId);
    if (roomMem.trim()) {
      parts.push("## Shared Room Memory\n" + takeLines(roomMem, 80));
    }
  }

  if (opts.projectId) {
    const projMem = await readMemory(paths, "project", opts.projectId);
    if (projMem.trim()) {
      parts.push("## Project Memory\n" + takeLines(projMem, 80));
    }
  }

  return parts.join("\n\n");
}

function takeLines(text: string, n: number): string {
  return text.split("\n").slice(0, n).join("\n");
}
