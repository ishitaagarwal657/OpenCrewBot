// What the API routes call. Keeps validation and side effects in one place.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Bot, BotInput, ChatMessage, ConversationId, ConversationSummary, Room, RoomInput } from "@/lib/shared/types";
import { DATA_DIR } from "./config";
import { InputError } from "./errors";
import * as store from "./db";
import { publish } from "./bus";
import { DEFAULT_MODEL } from "./models";
import { deleteWorkspace, writeMemory } from "./memory-files";
import { forgetConversation, resetBot, runTurn, runningBots, stopConversation } from "./runtime";
import { messagePreview } from "@/lib/shared/preview";
import { roomConversationId, runRoom } from "./rooms";

export { InputError };

// ── seeding and restart cleanup (once per process) ──────────────────────

const g = globalThis as unknown as { __opencrewbotBoot?: Promise<void> };

export function boot(): Promise<void> {
  g.__opencrewbotBoot ??= (async () => {
    await sweepInterrupted();
    await seed();
    try {
      const { startSchedulerWorker } = await import("./scheduler/worker");
      startSchedulerWorker();
    } catch (err) {
      console.error("[opencrewbot] scheduler worker failed to start", err);
    }
  })();
  return g.__opencrewbotBoot;
}

/** A turn that was streaming when the server stopped can't resume. Say so. */
async function sweepInterrupted() {
  const client = await store.db();
  const rows = await client.execute(`SELECT data FROM messages WHERE data LIKE '%"status":"streaming"%'`);
  for (const r of rows.rows) {
    const m = JSON.parse(String(r.data)) as ChatMessage;
    if (m.status !== "streaming") continue;
    m.status = "stopped";
    m.error = "Interrupted by a server restart.";
    for (const p of m.parts) if (p.kind === "tool" && (p.status === "running" || p.status === "awaiting-approval")) p.status = "denied";
    await store.saveMessage(m);
  }
}

const SEED_MARKER = join(DATA_DIR, ".seeded");

async function seed() {
  if (existsSync(SEED_MARKER)) return;
  const tools = { webSearch: true, memory: true, codeMode: false, browser: false, askUser: true };

  // ── Core 3 (original) ───────────────────────────────────────────────
  const scout = await createBot({
    name: "Scout",
    title: "Research",
    description: "Finds things out on the web and comes back with sourced answers.",
    instructions:
      "Research before answering anything time-sensitive. Search, read the best two or three sources, then answer with the URLs you used. Say plainly when sources disagree or you couldn't verify something. Skills: market_research, competitor_analysis.",
    emoji: "🔭",
    color: "#2f7df6",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: true,
  });
  const quill = await createBot({
    name: "Quill",
    title: "Writing",
    description: "Turns notes and research into clear posts, docs and emails.",
    instructions:
      "Write in plain, specific language. Match the person's voice once you know it, and keep their style preferences in memory. Offer one tight draft, not three options. Skills: email_drafting, presentation_creation.",
    emoji: "✒️",
    color: "#e0663d",
    model: DEFAULT_MODEL,
    tools: { ...tools, webSearch: false },
    approval: "ask",
    pinned: false,
  });
  const atlas = await createBot({
    name: "Atlas",
    title: "Chief of Staff / Planning",
    description: "Breaks goals into task plans, assigns work, consolidates results.",
    instructions:
      "You are the Chief of Staff. For complex requests: (1) produce a short ordered task plan with owners and dependencies, (2) hand research to @scout, drafting to @quill, analysis to @cipher, code review to @forge, (3) consolidate final deliverables. Keep decisions in memory. Prefer parallel independent work.",
    emoji: "🧭",
    color: "#1f9d6b",
    model: DEFAULT_MODEL,
    tools,
    approval: "ask",
    pinned: true,
  });

  // ── Extra agents (minimum ≥8) ───────────────────────────────────────
  const cipher = await createBot({
    name: "Cipher",
    title: "Data Analysis",
    description: "Analyses spreadsheets, finds bottlenecks, recommends actions.",
    instructions:
      "Profile data, compute metrics, find conversion bottlenecks and segment performance. State assumptions. Skills: data_analysis, financial_modelling.",
    emoji: "📊",
    color: "#7c5cff",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true, webSearch: false },
    approval: "controlled",
    pinned: false,
  });
  const forge = await createBot({
    name: "Forge",
    title: "Engineering",
    description: "Inspects repos, reviews code, proposes development plans.",
    instructions:
      "Inspect repositories carefully. Rank issues by severity. Never apply changes without approval. Skills: code_review.",
    emoji: "⚒️",
    color: "#c45c26",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: false,
  });
  const reach = await createBot({
    name: "Reach",
    title: "Lead Generation",
    description: "Finds and qualifies leads and partnership targets.",
    instructions:
      "Define ICP, search for matching orgs, tier the list with fit reasons. Skills: lead_generation, email_drafting.",
    emoji: "🎯",
    color: "#d4a017",
    model: DEFAULT_MODEL,
    tools,
    approval: "ask",
    pinned: false,
  });
  const pulse = await createBot({
    name: "Pulse",
    title: "Competitor Monitor",
    description: "Tracks competitor moves and weekly briefings.",
    instructions:
      "Watch competitive landscape for material changes. Update comparison notes and produce short briefings with sources. Skills: competitor_analysis, market_research.",
    emoji: "📡",
    color: "#0d9488",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "controlled",
    pinned: false,
  });
  const muse = await createBot({
    name: "Muse",
    title: "Campaign Creative",
    description: "Audience research, campaign concepts, content calendars.",
    instructions:
      "Research the audience, surface concerns, propose campaign concepts and a content calendar with sample drafts. Skills: market_research, presentation_creation, email_drafting.",
    emoji: "🎨",
    color: "#db2777",
    model: DEFAULT_MODEL,
    tools: { ...tools, webSearch: true },
    approval: "ask",
    pinned: false,
  });

  // ── Rooms (≥4) ──────────────────────────────────────────────────────
  await createRoom({
    name: "Studio",
    topic: "Content and launches",
    emoji: "🎬",
    memberIds: [atlas.id, scout.id, quill.id],
    leadId: atlas.id,
    responder: "auto",
    pinned: true,
  });
  await createRoom({
    name: "Market Intel",
    topic: "Competitive research and opportunity scans",
    emoji: "🔍",
    memberIds: [atlas.id, scout.id, pulse.id, cipher.id],
    leadId: atlas.id,
    responder: "auto",
    pinned: true,
  });
  await createRoom({
    name: "Growth",
    topic: "Campaigns, leads, and outreach",
    emoji: "🚀",
    memberIds: [atlas.id, muse.id, reach.id, quill.id],
    leadId: atlas.id,
    responder: "auto",
    pinned: false,
  });
  await createRoom({
    name: "Engineering",
    topic: "Code review and development plans",
    emoji: "🛠️",
    memberIds: [atlas.id, forge.id, cipher.id],
    leadId: forge.id,
    responder: "lead",
    pinned: false,
  });

  writeFileSync(SEED_MARKER, new Date().toISOString());

  // Project memory for MeetUniversity demos (Module E)
  try {
    const { writeMemory } = await import("./memory/extended-memory");
    await writeMemory(
      { dataDir: DATA_DIR },
      "project",
      "meetuniversity",
      `# MeetUniversity project memory\n\n- Website: https://www.meetuniversity.com/\n- Lines: Aspirations (Class 11 career), Study Abroad, School Partnerships\n- Prefer evidence-backed findings with sources.\n- User prefers concise bullet reports unless asked otherwise.\n`,
      "system",
      "Seeded project context for demos",
    );
  } catch (err) {
    console.error("[opencrewbot] project memory seed failed", err);
  }
}

// ── bots ────────────────────────────────────────────────────────────────

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "bot";
}

async function uniqueHandle(wanted: string, exceptId?: string): Promise<string> {
  const taken = new Set((await store.listBots()).filter((b) => b.id !== exceptId).map((b) => b.handle));
  const base = slug(wanted);
  let handle = base;
  for (let n = 2; taken.has(handle) || ["everyone", "all"].includes(handle); n++) handle = `${base}${n}`;
  return handle;
}

function validateBot(input: Partial<BotInput>) {
  if (input.name !== undefined && !input.name.trim()) throw new InputError("A bot needs a name.");
  if (input.name && input.name.length > 40) throw new InputError("Keep the name under 40 characters.");
  if (input.instructions && input.instructions.length > 8000) throw new InputError("Instructions are limited to 8,000 characters.");
}

export async function createBot(input: BotInput): Promise<Bot> {
  validateBot(input);
  const bot: Bot = {
    ...input,
    id: randomUUID().slice(0, 8),
    name: input.name.trim(),
    connections: input.connections ?? [],
    handle: await uniqueHandle(input.handle || input.name),
    createdAt: new Date().toISOString(),
  };
  await store.saveBot(bot);
  writeMemory(bot.id, `# ${bot.name}'s memory\n\n`);
  publish({ type: "bots-changed" });
  return bot;
}

/** Module B — create a bot from a natural-language description (no source edit). */
export async function createBotFromDescription(description: string): Promise<Bot> {
  const text = description?.trim();
  if (!text) throw new InputError("Describe the agent you want to create.");
  if (text.length > 2000) throw new InputError("Keep the description under 2,000 characters.");

  const { heuristicAgentFromDescription } = await import("./factory/agent-factory");
  const partial = heuristicAgentFromDescription(text, {
    model: DEFAULT_MODEL,
    approvalLevel: "ask_first",
  });

  const approvalMap = {
    ask_first: "ask" as const,
    controlled: "controlled" as const,
    full_access: "full" as const,
  };

  const toolFlags = {
    webSearch: partial.tools.includes("web_search"),
    memory: partial.tools.includes("memory") || true,
    codeMode: partial.tools.includes("code_mode"),
    browser: partial.tools.includes("browser"),
    askUser: true,
  };

  return createBot({
    name: partial.name,
    title: partial.role,
    description: partial.role,
    instructions: partial.instructions,
    emoji: "🤖",
    color: "#6366f1",
    model: DEFAULT_MODEL,
    tools: toolFlags,
    approval: approvalMap[partial.approvalLevel] ?? "ask",
    pinned: false,
  });
}

export async function updateBot(id: string, patch: Partial<BotInput>): Promise<Bot> {
  const bot = await store.getBot(id);
  if (!bot) throw new InputError("That bot doesn't exist.");
  validateBot(patch);
  const next: Bot = {
    ...bot,
    ...patch,
    id: bot.id,
    createdAt: bot.createdAt,
    tools: { ...bot.tools, ...(patch.tools ?? {}) },
    handle: patch.handle !== undefined || patch.name !== undefined ? await uniqueHandle(patch.handle || patch.name || bot.handle, id) : bot.handle,
  };
  await store.saveBot(next);
  await resetBot(id);
  publish({ type: "bots-changed" });
  return next;
}

export async function deleteBot(id: string): Promise<void> {
  await stopConversation(`dm:${id}`);
  await resetBot(id);
  await store.deleteBotRow(id);
  await store.clearMessages(`dm:${id}`);
  for (const room of await store.listRooms()) {
    if (!room.memberIds.includes(id)) continue;
    const memberIds = room.memberIds.filter((m) => m !== id);
    await store.saveRoom({ ...room, memberIds, leadId: room.leadId === id ? (memberIds[0] ?? null) : room.leadId });
  }
  deleteWorkspace(id);
  publish({ type: "bots-changed" });
  publish({ type: "rooms-changed" });
}

// ── rooms ───────────────────────────────────────────────────────────────

async function cleanRoomInput<T extends Partial<RoomInput>>(input: T): Promise<T> {
  if (input.name !== undefined && !input.name.trim()) throw new InputError("A room needs a name.");
  if (input.memberIds) {
    const known = new Set((await store.listBots()).map((b) => b.id));
    input.memberIds = [...new Set(input.memberIds)].filter((id) => known.has(id));
  }
  return input;
}

export async function createRoom(input: RoomInput): Promise<Room> {
  const clean = await cleanRoomInput(input);
  const room: Room = {
    ...clean,
    id: randomUUID().slice(0, 8),
    name: clean.name.trim(),
    leadId: clean.leadId && clean.memberIds.includes(clean.leadId) ? clean.leadId : (clean.memberIds[0] ?? null),
    createdAt: new Date().toISOString(),
  };
  await store.saveRoom(room);
  publish({ type: "rooms-changed" });
  return room;
}

export async function updateRoom(id: string, patch: Partial<RoomInput>): Promise<Room> {
  const room = await store.getRoom(id);
  if (!room) throw new InputError("That room doesn't exist.");
  const clean = await cleanRoomInput(patch);
  const next: Room = { ...room, ...clean, id: room.id, createdAt: room.createdAt };
  if (!next.leadId || !next.memberIds.includes(next.leadId)) next.leadId = next.memberIds[0] ?? null;
  await store.saveRoom(next);
  publish({ type: "rooms-changed" });
  return next;
}

export async function deleteRoom(id: string): Promise<void> {
  const conversationId = roomConversationId(id);
  await stopConversation(conversationId);
  await store.deleteRoomRow(id);
  await store.clearMessages(conversationId);
  publish({ type: "rooms-changed" });
}

// ── conversations ───────────────────────────────────────────────────────

function parseConversation(conversationId: ConversationId): { kind: "dm" | "room"; id: string } {
  const [kind, id] = conversationId.split(":");
  if ((kind !== "dm" && kind !== "room") || !id) throw new InputError("Unknown conversation.");
  return { kind, id };
}

export async function sendMessage(conversationId: ConversationId, text: string): Promise<ChatMessage> {
  const content = text.trim();
  if (!content) throw new InputError("Type a message first.");
  if (content.length > 20000) throw new InputError("Messages are limited to 20,000 characters.");
  const { kind, id } = parseConversation(conversationId);

  const bot = kind === "dm" ? await store.getBot(id) : null;
  const room = kind === "room" ? await store.getRoom(id) : null;
  if (kind === "dm" && !bot) throw new InputError("That bot doesn't exist.");
  if (kind === "room" && !room) throw new InputError("That room doesn't exist.");
  if (room && room.memberIds.length === 0) throw new InputError("Add at least one bot to this room first.");

  const message: ChatMessage = {
    id: randomUUID(),
    conversationId,
    role: "user",
    createdAt: new Date().toISOString(),
    status: "done",
    parts: [{ kind: "text", text: content }],
  };
  await store.saveMessage(message);
  await store.markRead(conversationId);
  publish({ type: "message", message });

  // The reply streams over SSE; the request returns as soon as it's queued.
  if (bot) void runTurn({ bot, conversationId, content }).catch(() => {});
  if (room) void runRoom(room, message).catch(() => {});
  return message;
}

export async function clearConversation(conversationId: ConversationId): Promise<void> {
  parseConversation(conversationId);
  await stopConversation(conversationId);
  await store.clearMessages(conversationId);
  await store.bumpGeneration(conversationId);
  forgetConversation(conversationId);
}

export async function summaries(): Promise<ConversationSummary[]> {
  const [bots, rooms, last, unread] = await Promise.all([store.listBots(), store.listRooms(), store.lastMessages(), store.unreadCounts()]);
  const names = new Map(bots.map((b) => [b.id, b.name]));
  const ids = [...bots.map((b) => `dm:${b.id}`), ...rooms.map((r) => roomConversationId(r.id))];
  return ids.map((id) => {
    const m = last.get(id);
    return {
      id,
      running: runningBots(id),
      unread: unread.get(id) ?? 0,
      lastMessage: m
        ? {
            text: messagePreview(m),
            createdAt: m.createdAt,
            author: m.role === "user" ? "You" : (names.get(m.botId ?? "") ?? "Bot"),
          }
        : undefined,
    };
  });
}
