/**
 * Bridge Task Engine → existing Mastra runTurn harness.
 * When an assignee bot exists, the task description is sent as a turn.
 */

import { getBot } from "../db";
import { runTurn } from "../runtime";
import type { Task, Run } from "./types";
import type { ChatMessage } from "@/lib/shared/types";

function extractText(message: ChatMessage | null): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/**
 * Execute a task by running a real agent turn in a dedicated task conversation.
 * Conversation id: `task:<runId>:<taskId>` so history stays isolated.
 */
export async function executeTaskWithAgent(args: {
  task: Task;
  run: Run;
}): Promise<{ output: string; error?: string }> {
  const { task, run } = args;
  if (!task.assigneeAgentId) {
    return { output: "", error: "No assignee agent for task" };
  }

  const bot = await getBot(task.assigneeAgentId);
  if (!bot) {
    return { output: "", error: `Assignee bot not found: ${task.assigneeAgentId}` };
  }

  const conversationId = `task:${run.id}:${task.id}`;
  const content = [
    `## Task from Chief of Staff`,
    `**Title:** ${task.title}`,
    `**Description:** ${task.description}`,
    task.requiredSkills.length
      ? `**Skills to use:** ${task.requiredSkills.join(", ")}`
      : "",
    "",
    `Original user request: ${run.userInstruction}`,
    "",
    "Complete this task thoroughly. Cite sources when researching. Return a self-contained result.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const message = await runTurn({
      bot,
      conversationId,
      content,
      route: { by: "lead" },
    });

    if (!message) {
      return { output: "", error: "Turn was stopped before it started" };
    }
    if (message.status === "error" || message.status === "stopped") {
      return {
        output: extractText(message),
        error: message.error || `Turn ended with status ${message.status}`,
      };
    }

    const text = extractText(message);
    return {
      output: text || "(Agent finished with no text output)",
    };
  } catch (err) {
    return {
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
