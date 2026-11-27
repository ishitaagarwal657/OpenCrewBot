/**
 * Chief of Staff — Planner
 * OpenCrewBot 2.0 — Module A
 *
 * Produces a structured TaskPlan from a natural-language business instruction.
 * This module defines the system prompt and the expected JSON schema.
 * The actual LLM call is made by the existing Mastra agent runtime.
 */

import type { TaskPlan } from "../tasks/types";

export const CHIEF_OF_STAFF_SYSTEM_PROMPT = `
You are the Chief of Staff of an AI workforce.

Your job is NOT to do the work yourself.
Your job is to understand a complex business request, break it into clear tasks,
choose the right specialist agents (or request new ones), define dependencies,
and produce a single consolidated plan that the Task Execution Engine can run.

Rules:
1. Prefer existing agents when their role matches.
2. If no agent fits, propose a new agent in "createAgents".
3. Independent research/analysis tasks should be in the same parallelGroup so they can run together.
4. Tasks that need external side-effects (send email, open PR, write to Notion, etc.) must set requiresApproval: true.
5. Keep task descriptions concrete and actionable.
6. Output ONLY valid JSON matching the TaskPlan schema. No markdown fences.

TaskPlan schema:
{
  "summary": "one-paragraph plan overview",
  "tasks": [
    {
      "title": "short title",
      "description": "what to do, what success looks like",
      "requiredSkills": ["market_research", ...],
      "requiredCapabilities": ["web_search", "analysis", ...],
      "assigneeHint": "Scout" | "Quill" | "Atlas" | role name,
      "dependsOn": [0, 1],
      "requiresApproval": false,
      "parallelGroup": "research",
      "timeoutMs": 300000
    }
  ],
  "createAgents": [
    {
      "name": "Competitor Analyst",
      "role": "Competitive intelligence",
      "instructions": "persona and rules",
      "skills": ["competitor_analysis"]
    }
  ]
}
`.trim();

export const MEETUNIVERSITY_CONTEXT = `
Business context (MeetUniversity):
- Website: https://www.meetuniversity.com/
- Product lines:
  1. Aspirations — student career discovery and navigation
  2. Study Abroad / University Applications
  3. School Partnerships
Use this context when the user refers to MeetUniversity.
`.trim();

/** Example plan for Demo 1 — Market Intelligence (for tests / mock mode) */
export const EXAMPLE_MARKET_INTEL_PLAN: TaskPlan = {
  summary:
    "Research the competitive landscape for MeetUniversity across career discovery, study-abroad, and school-partnership segments. Produce a comparison table and strategic opportunities report.",
  tasks: [
    {
      title: "Identify competitors",
      description:
        "Find direct and indirect competitors for MeetUniversity's three product lines. List company name, URL, and primary offering.",
      requiredSkills: ["market_research", "competitor_analysis"],
      requiredCapabilities: ["web_search"],
      assigneeHint: "Scout",
      parallelGroup: "research",
    },
    {
      title: "Collect product & pricing signals",
      description:
        "For each major competitor, gather publicly available product features, pricing, and target customer segments.",
      requiredSkills: ["competitor_analysis"],
      requiredCapabilities: ["web_search"],
      assigneeHint: "Scout",
      dependsOn: [0],
      parallelGroup: "research",
    },
    {
      title: "Positioning analysis",
      description:
        "Compare positioning and messaging. Identify gaps and differentiation opportunities for MeetUniversity.",
      requiredSkills: ["competitor_analysis", "market_research"],
      requiredCapabilities: ["analysis"],
      assigneeHint: "Atlas",
      dependsOn: [1],
    },
    {
      title: "Build comparison table",
      description:
        "Create a structured comparison table: Competitor | Products | Pricing | Target customers | Positioning.",
      requiredSkills: ["data_analysis"],
      requiredCapabilities: ["analysis"],
      assigneeHint: "Atlas",
      dependsOn: [1, 2],
    },
    {
      title: "Strategic opportunities report",
      description:
        "Write a consolidated report with evidence-backed findings and 5–7 strategic opportunities.",
      requiredSkills: ["market_research"],
      requiredCapabilities: ["writing"],
      assigneeHint: "Quill",
      dependsOn: [3],
    },
  ],
};

/** Example plan for Demo 2 — Marketing Campaign (Class 11 / Aspirations) */
export const EXAMPLE_CAMPAIGN_PLAN: TaskPlan = {
  summary:
    "Create a 30-day marketing campaign targeting Class 11 students for MeetUniversity Aspirations product line.",
  tasks: [
    {
      title: "Audience research",
      description:
        "Research Class 11 students in India: career anxiety, information sources, decision influences, preferred content formats.",
      requiredSkills: ["market_research"],
      requiredCapabilities: ["web_search"],
      assigneeHint: "Scout",
      parallelGroup: "research",
    },
    {
      title: "Campaign strategy",
      description:
        "Define positioning, key messages, channels, and success metrics for the Aspirations campaign.",
      requiredSkills: ["market_research"],
      requiredCapabilities: ["analysis"],
      assigneeHint: "Atlas",
      dependsOn: [0],
    },
    {
      title: "Creative concepts",
      description:
        "Develop 3–5 creative concepts (hooks, themes) that address student concerns.",
      requiredSkills: ["presentation_creation"],
      requiredCapabilities: ["writing"],
      assigneeHint: "Muse",
      dependsOn: [1],
    },
    {
      title: "30-day content calendar",
      description:
        "Produce a day-by-day content calendar with format, topic, channel, and CTA.",
      requiredSkills: ["presentation_creation"],
      requiredCapabilities: ["writing"],
      assigneeHint: "Quill",
      dependsOn: [2],
    },
    {
      title: "Sample assets",
      description:
        "Draft 3 sample posts / email subject lines / carousel outlines ready for review.",
      requiredSkills: ["email_drafting"],
      requiredCapabilities: ["writing"],
      assigneeHint: "Quill",
      dependsOn: [3],
    },
  ],
};

/** Example plan for Demo 3 — Business Analysis */
export const EXAMPLE_SALES_ANALYSIS_PLAN: TaskPlan = {
  summary:
    "Analyse sample sales spreadsheet, identify conversion bottlenecks, segment performance and revenue opportunities.",
  tasks: [
    {
      title: "Load and summarise data",
      description:
        "Read the provided sales CSV. Summarise totals, conversion rates, and key segments.",
      requiredSkills: ["data_analysis"],
      requiredCapabilities: ["code_execution"],
      assigneeHint: "Cipher",
      parallelGroup: "analysis",
    },
    {
      title: "Bottleneck identification",
      description:
        "Identify stages or segments with the largest drop-offs. Quantify impact.",
      requiredSkills: ["data_analysis", "financial_modelling"],
      requiredCapabilities: ["analysis"],
      assigneeHint: "Cipher",
      dependsOn: [0],
    },
    {
      title: "Recommendations",
      description:
        "Write prioritised business recommendations with estimated impact.",
      requiredSkills: ["data_analysis"],
      requiredCapabilities: ["writing"],
      assigneeHint: "Atlas",
      dependsOn: [1],
    },
  ],
};

/**
 * Heuristic plan selector when no LLM plan is provided.
 * Matches keywords in the instruction to the most relevant example plan.
 */
export function selectExamplePlan(instruction: string): TaskPlan {
  const lower = instruction.toLowerCase();
  if (
    lower.includes("campaign") ||
    lower.includes("class 11") ||
    lower.includes("aspirations") ||
    lower.includes("content calendar")
  ) {
    return { ...EXAMPLE_CAMPAIGN_PLAN, summary: instruction };
  }
  if (
    lower.includes("sales") ||
    lower.includes("spreadsheet") ||
    lower.includes("conversion") ||
    lower.includes("bottleneck") ||
    lower.includes("csv")
  ) {
    return { ...EXAMPLE_SALES_ANALYSIS_PLAN, summary: instruction };
  }
  // Default to market intel
  return { ...EXAMPLE_MARKET_INTEL_PLAN, summary: instruction };
}

/**
 * Validate and normalise a raw plan object from the LLM.
 */
export function parseTaskPlan(raw: unknown): TaskPlan {
  if (!raw || typeof raw !== "object") {
    throw new Error("TaskPlan must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.summary !== "string") {
    throw new Error("TaskPlan.summary is required");
  }
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new Error("TaskPlan.tasks must be a non-empty array");
  }
  return obj as unknown as TaskPlan;
}
