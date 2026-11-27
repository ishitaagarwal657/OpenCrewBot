import { handle } from "@/lib/server/http";
import { appStatus, DATA_DIR } from "@/lib/server/config";
import { listBots, listRooms } from "@/lib/server/db";
import { listSkills } from "@/lib/server/skills/registry";
import { MODEL_PROVIDERS, routeModelForTask } from "@/lib/server/models-routing";
import { createFileTaskStore } from "@/lib/server/tasks/memory-store";

/** Extended status for evaluators — agents, rooms, skills, providers, recent runs. */
export async function GET() {
  return handle(async () => {
    const status = appStatus();
    const bots = await listBots();
    const rooms = await listRooms();
    const skills = listSkills();
    const store = createFileTaskStore(DATA_DIR);
    const runs = await store.listRuns(10);

    return {
      status,
      counts: {
        agents: bots.length,
        rooms: rooms.length,
        skills: skills.length,
        recentRuns: runs.length,
      },
      agents: bots.map((b) => ({
        id: b.id,
        name: b.name,
        title: b.title,
        approval: b.approval,
        model: b.model,
      })),
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        members: r.memberIds.length,
        leadId: r.leadId,
      })),
      skills: skills.map((s) => ({ id: s.id, name: s.name })),
      providers: MODEL_PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        live: p.live(),
      })),
      modelRouting: {
        planning: routeModelForTask("planning"),
        research: routeModelForTask("research"),
        analysis: routeModelForTask("analysis"),
      },
      dataDir: DATA_DIR,
      version: "2.0.0-opencrewbot-workforce",
    };
  });
}
