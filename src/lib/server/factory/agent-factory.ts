/**
 * Dynamic Agent Factory
 * OpenCrewBot 2.0 — Module B
 *
 * Create agents from natural language without editing application source.
 */

import { randomUUID } from "crypto";

export type ApprovalLevel = "ask_first" | "controlled" | "full_access";

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  instructions: string;
  model: string;
  tools: string[];
  skills: string[];
  approvalLevel: ApprovalLevel;
  memoryScope: "private" | "room" | "project";
  expectedOutputFormat?: string;
  color?: string;
  createdAt: string;
  createdVia: "ui" | "natural_language" | "chief_of_staff";
}

export interface AgentFactoryInput {
  description: string; // natural language
  defaultModel?: string;
  defaultApprovalLevel?: ApprovalLevel;
}

export interface AgentRegistry {
  list(): Promise<AgentDefinition[]>;
  get(id: string): Promise<AgentDefinition | null>;
  getByName(name: string): Promise<AgentDefinition | null>;
  save(agent: AgentDefinition): Promise<void>;
  remove(id: string): Promise<void>;
}

export const AGENT_FACTORY_SYSTEM_PROMPT = `
You convert a natural-language request into a single agent definition JSON.

Output ONLY valid JSON:
{
  "name": "short unique name",
  "role": "one-line role",
  "instructions": "detailed persona and operating rules",
  "tools": ["web_search", "memory", "code_mode"],
  "skills": ["market_research"],
  "approvalLevel": "ask_first" | "controlled" | "full_access",
  "memoryScope": "private" | "room" | "project",
  "expectedOutputFormat": "optional"
}

Rules:
- Prefer ask_first for agents that can send messages or modify external systems.
- Include only tools/skills that are relevant.
- Instructions should be specific enough that the agent does not need further clarification for its core job.
`.trim();

/** Deterministic fallback when LLM is unavailable (mock mode) */
export function heuristicAgentFromDescription(
  description: string,
  defaults?: { model?: string; approvalLevel?: ApprovalLevel }
): Omit<AgentDefinition, "id" | "createdAt" | "createdVia"> {
  const lower = description.toLowerCase();

  let name = "Specialist";
  let role = "General specialist";
  let skills: string[] = [];
  let tools = ["memory", "web_search"];
  let approvalLevel: ApprovalLevel = defaults?.approvalLevel ?? "ask_first";

  if (lower.includes("research") || lower.includes("competitor") || lower.includes("market")) {
    name = "Research Analyst";
    role = "Market and competitive research";
    skills = ["market_research", "competitor_analysis"];
  } else if (lower.includes("write") || lower.includes("content") || lower.includes("campaign")) {
    name = "Content Strategist";
    role = "Writing and campaign content";
    skills = ["email_drafting", "presentation_creation"];
    tools = ["memory"];
  } else if (lower.includes("code") || lower.includes("github") || lower.includes("developer")) {
    name = "Engineering Reviewer";
    role = "Code review and technical planning";
    skills = ["code_review"];
    tools = ["memory", "code_mode"];
  } else if (lower.includes("data") || lower.includes("spreadsheet") || lower.includes("analysis")) {
    name = "Data Analyst";
    role = "Data analysis and recommendations";
    skills = ["data_analysis", "financial_modelling"];
    tools = ["memory", "code_mode"];
  } else if (lower.includes("lead") || lower.includes("sales")) {
    name = "Lead Generator";
    role = "Lead generation and outreach drafts";
    skills = ["lead_generation", "email_drafting"];
  }

  return {
    name,
    role,
    instructions: `You are ${name}, a specialist in ${role}.\n\nUser request that created you:\n${description}\n\nBe precise, cite sources when researching, and ask for clarification only when necessary.`,
    model: defaults?.model ?? "default",
    tools,
    skills,
    approvalLevel,
    memoryScope: "private",
  };
}

export async function createAgentFromNaturalLanguage(
  registry: AgentRegistry,
  input: AgentFactoryInput,
  llmParser?: (description: string) => Promise<Partial<AgentDefinition>>
): Promise<AgentDefinition> {
  let partial: Partial<AgentDefinition>;

  if (llmParser) {
    try {
      partial = await llmParser(input.description);
    } catch {
      partial = heuristicAgentFromDescription(input.description, {
        model: input.defaultModel,
        approvalLevel: input.defaultApprovalLevel,
      });
    }
  } else {
    partial = heuristicAgentFromDescription(input.description, {
      model: input.defaultModel,
      approvalLevel: input.defaultApprovalLevel,
    });
  }

  const existing = await registry.getByName(partial.name ?? "Specialist");
  const name =
    existing && existing.name === partial.name
      ? `${partial.name} ${Math.floor(Math.random() * 100)}`
      : partial.name ?? "Specialist";

  const agent: AgentDefinition = {
    id: randomUUID(),
    name,
    role: partial.role ?? "Specialist",
    instructions: partial.instructions ?? input.description,
    model: partial.model ?? input.defaultModel ?? "default",
    tools: partial.tools ?? ["memory"],
    skills: partial.skills ?? [],
    approvalLevel: partial.approvalLevel ?? input.defaultApprovalLevel ?? "ask_first",
    memoryScope: partial.memoryScope ?? "private",
    expectedOutputFormat: partial.expectedOutputFormat,
    color: partial.color,
    createdAt: new Date().toISOString(),
    createdVia: "natural_language",
  };

  await registry.save(agent);
  return agent;
}
