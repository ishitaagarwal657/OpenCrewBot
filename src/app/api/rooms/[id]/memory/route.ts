import { body, handle } from "@/lib/server/http";
import { DATA_DIR } from "@/lib/server/config";
import { getRoom } from "@/lib/server/db";
import { readMemory, writeMemory } from "@/lib/server/memory/extended-memory";

/** Shared room memory (Module E) — editable Markdown. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const room = await getRoom(id);
    if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
    const content = await readMemory({ dataDir: DATA_DIR }, "room", id);
    return { content, path: `data/rooms/${id}/SHARED_MEMORY.md` };
  });
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const room = await getRoom(id);
    if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
    const { content } = await body<{ content?: string }>(request);
    await writeMemory(
      { dataDir: DATA_DIR },
      "room",
      id,
      content ?? "",
      "user",
      "Edited via Memory UI"
    );
    return { content: content ?? "" };
  });
}
