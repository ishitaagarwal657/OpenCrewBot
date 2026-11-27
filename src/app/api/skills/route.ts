import { handle } from "@/lib/server/http";
import { listSkills } from "@/lib/server/skills/registry";

/** GET — list reusable skills (Module F). */
export async function GET() {
  return handle(async () => ({ skills: listSkills() }));
}
