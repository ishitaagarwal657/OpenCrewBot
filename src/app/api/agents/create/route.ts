import { body, handle } from "@/lib/server/http";
import { createBotFromDescription } from "@/lib/server/service";

/** POST { description: string } → creates a bot via natural language (Module B). */
export async function POST(request: Request) {
  return handle(async () => {
    const { description } = await body<{ description?: string }>(request);
    const bot = await createBotFromDescription(description ?? "");
    return { bot };
  });
}
