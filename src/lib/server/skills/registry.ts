/**
 * Skills Ecosystem
 * OpenCrewBot 2.0 — Module F
 *
 * 8 reusable skills. Agents dynamically select and load them.
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  requiredTools: string[];
  procedure: string; // injected into agent prompt when skill is active
  expectedOutput: string;
}

export const SKILLS: Skill[] = [
  {
    id: "market_research",
    name: "Market Research",
    description: "Research markets, segments, trends, and customer needs.",
    whenToUse:
      "When the task involves understanding a market, audience, or industry landscape.",
    requiredTools: ["web_search"],
    procedure: `
1. Clarify the market / segment in one sentence.
2. Search for recent reports, articles, and primary sources.
3. Extract market size signals, growth drivers, and pain points.
4. List sources with URLs.
5. Summarise findings in structured bullets.
`.trim(),
    expectedOutput: "Structured findings with sources and key numbers.",
  },
  {
    id: "competitor_analysis",
    name: "Competitor Analysis",
    description: "Identify competitors and compare products, pricing, positioning.",
    whenToUse:
      "When the task asks for competitive landscape, comparison tables, or differentiation.",
    requiredTools: ["web_search"],
    procedure: `
1. Identify direct and indirect competitors.
2. For each: products, publicly available pricing, target customers, positioning.
3. Build a comparison table.
4. Note gaps and opportunities.
5. Cite sources.
`.trim(),
    expectedOutput: "Comparison table + opportunity list with sources.",
  },
  {
    id: "financial_modelling",
    name: "Financial Modelling",
    description: "Build simple models, unit economics, and scenario analysis.",
    whenToUse:
      "When numbers, margins, conversion, or revenue scenarios are required.",
    requiredTools: ["code_mode"],
    procedure: `
1. State assumptions clearly.
2. Build calculations step by step.
3. Provide base / upside / downside if relevant.
4. Highlight sensitivity drivers.
`.trim(),
    expectedOutput: "Assumptions, calculations, and scenario summary.",
  },
  {
    id: "presentation_creation",
    name: "Presentation Creation",
    description: "Outline slides and draft presentation content.",
    whenToUse: "When a deck, pitch outline, or slide narrative is needed.",
    requiredTools: ["memory"],
    procedure: `
1. Define audience and goal.
2. Propose slide outline (title + one-line purpose).
3. Draft key bullets per slide.
4. Suggest visuals / charts where useful.
`.trim(),
    expectedOutput: "Slide-by-slide outline with draft copy.",
  },
  {
    id: "email_drafting",
    name: "Email Drafting",
    description: "Draft professional emails and sequences.",
    whenToUse: "When outreach, follow-up, or internal email copy is needed.",
    requiredTools: ["memory"],
    procedure: `
1. Clarify recipient and objective.
2. Draft subject line + body.
3. Offer 1–2 tone variants if useful.
4. Keep CTAs clear.
`.trim(),
    expectedOutput: "Subject + body ready to send (still subject to approval).",
  },
  {
    id: "code_review",
    name: "Code Review",
    description: "Inspect repositories or diffs and recommend improvements.",
    whenToUse:
      "When reviewing GitHub repos, PRs, architecture, or technical debt.",
    requiredTools: ["web_search", "code_mode"],
    procedure: `
1. Understand the stated goals of the codebase.
2. Identify issues by severity (security, correctness, maintainability, performance).
3. Propose prioritised improvements.
4. Suggest concrete next steps (do not apply changes without approval).
`.trim(),
    expectedOutput: "Issue list with priority + development plan.",
  },
  {
    id: "data_analysis",
    name: "Data Analysis",
    description: "Analyse tabular data, find bottlenecks, segment performance.",
    whenToUse:
      "When a spreadsheet or dataset needs analysis, charts, or recommendations.",
    requiredTools: ["code_mode"],
    procedure: `
1. Profile the data (columns, missing values, ranges).
2. Compute key metrics and segments.
3. Identify conversion bottlenecks or outliers.
4. Recommend actions with supporting numbers.
`.trim(),
    expectedOutput: "Metrics, findings, visual descriptions, recommendations.",
  },
  {
    id: "lead_generation",
    name: "Lead Generation",
    description: "Find and qualify potential leads or partner schools.",
    whenToUse:
      "When building lead lists, school partnership targets, or outreach targets.",
    requiredTools: ["web_search"],
    procedure: `
1. Define ideal customer / partner profile.
2. Search for matching organisations.
3. Capture name, website, contact signals, fit reason.
4. Score or tier the list.
`.trim(),
    expectedOutput: "Tiered lead list with sources and fit notes.",
  },
];

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function listSkills(): Skill[] {
  return SKILLS;
}

export function matchSkillsForTask(taskDescription: string): Skill[] {
  const lower = taskDescription.toLowerCase();
  return SKILLS.filter((s) => {
    const hay = `${s.name} ${s.description} ${s.whenToUse}`.toLowerCase();
    return hay.split(/\s+/).some((w) => w.length > 4 && lower.includes(w));
  });
}

/** Build prompt fragment when skills are active for an agent turn */
export function skillsPromptFragment(skillIds: string[]): string {
  const skills = skillIds.map(getSkill).filter(Boolean) as Skill[];
  if (skills.length === 0) return "";
  return (
    "Active skills for this task:\n\n" +
    skills
      .map(
        (s) =>
          `### ${s.name}\n${s.procedure}\nExpected output: ${s.expectedOutput}`
      )
      .join("\n\n")
  );
}
