/**
 * Multi-agent collaboration helpers — Module C
 * Loop prevention, hop limits, interruption flags.
 */

const MAX_HANDOFF_HOPS = 3;

export interface HandoffState {
  conversationId: string;
  hops: number;
  chain: string[]; // bot ids in order
  interrupted: boolean;
  lastInstruction?: string;
}

const g = globalThis as unknown as { __opencrewbotHandoffs?: Map<string, HandoffState> };
const handoffs = (g.__opencrewbotHandoffs ??= new Map());

export function getHandoffState(conversationId: string): HandoffState {
  let s = handoffs.get(conversationId);
  if (!s) {
    s = { conversationId, hops: 0, chain: [], interrupted: false };
    handoffs.set(conversationId, s);
  }
  return s;
}

/** Returns false if this handoff would create a loop or exceed hop limit. */
export function canHandoff(
  conversationId: string,
  fromBotId: string,
  toBotId: string
): { ok: true } | { ok: false; reason: string } {
  const s = getHandoffState(conversationId);
  if (s.interrupted) {
    return { ok: false, reason: "Conversation interrupted by a new user instruction; awaiting replan." };
  }
  if (s.hops >= MAX_HANDOFF_HOPS) {
    return { ok: false, reason: `Handoff limit (${MAX_HANDOFF_HOPS}) reached — consolidate instead of delegating further.` };
  }
  // Simple cycle: don't hand back to someone already in the chain this turn sequence
  if (s.chain.includes(toBotId)) {
    return { ok: false, reason: `Loop prevented: ${toBotId} already participated in this handoff chain.` };
  }
  return { ok: true };
}

export function recordHandoff(conversationId: string, fromBotId: string, toBotId: string): void {
  const s = getHandoffState(conversationId);
  if (s.chain.length === 0) s.chain.push(fromBotId);
  s.chain.push(toBotId);
  s.hops += 1;
}

export function resetHandoffs(conversationId: string): void {
  handoffs.set(conversationId, {
    conversationId,
    hops: 0,
    chain: [],
    interrupted: false,
  });
}

/** Call when user sends a new instruction mid-run. */
export function markInterrupted(conversationId: string, newInstruction: string): void {
  const s = getHandoffState(conversationId);
  s.interrupted = true;
  s.lastInstruction = newInstruction;
  s.hops = 0;
  s.chain = [];
}

export function clearInterrupted(conversationId: string): void {
  const s = getHandoffState(conversationId);
  s.interrupted = false;
  s.lastInstruction = undefined;
}

export const COLLAB_SYSTEM_NOTE = `
## Collaboration rules
- Prefer @mention handoffs over vague "someone should…".
- Max ${MAX_HANDOFF_HOPS} handoff hops per chain; then consolidate results.
- Do not re-delegate to a bot already in the current chain (loop prevention).
- If the user interrupts with a new instruction, stop the current chain and replan.
`.trim();
