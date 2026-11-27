/**
 * Multi-Model Intelligence helpers — Module J
 * Extends single-provider (Nebius) with task-based routing + fallbacks.
 */

export type TaskKind =
  | "routing"
  | "research"
  | "writing"
  | "analysis"
  | "code"
  | "planning"
  | "default";

export interface ModelRoute {
  primary: string;
  fallbacks: string[];
  reason: string;
}

/** Suggested model ids on Nebius Token Factory — override via env if needed. */
const ROUTES: Record<TaskKind, ModelRoute> = {
  routing: {
    primary: process.env.MODEL_FAST ?? "minimax-m2",
    fallbacks: ["default"],
    reason: "Fast model for room routing / short decisions",
  },
  research: {
    primary: process.env.MODEL_RESEARCH ?? "default",
    fallbacks: ["default"],
    reason: "Strong tool-calling model for search + synthesis",
  },
  writing: {
    primary: process.env.MODEL_WRITING ?? "default",
    fallbacks: ["default"],
    reason: "Clear prose for drafts and calendars",
  },
  analysis: {
    primary: process.env.MODEL_ANALYSIS ?? "default",
    fallbacks: ["default"],
    reason: "Reasoning for numbers and comparisons",
  },
  code: {
    primary: process.env.MODEL_CODE ?? "default",
    fallbacks: ["default"],
    reason: "Code-aware model for review plans",
  },
  planning: {
    primary: process.env.MODEL_PLANNING ?? "default",
    fallbacks: ["default"],
    reason: "Chief of Staff / task decomposition",
  },
  default: {
    primary: process.env.MODEL_DEFAULT ?? "default",
    fallbacks: [],
    reason: "Default bot model",
  },
};

export function routeModelForTask(kind: TaskKind): ModelRoute {
  return ROUTES[kind] ?? ROUTES.default;
}

export function inferTaskKind(text: string): TaskKind {
  const t = text.toLowerCase();
  if (/\b(plan|delegate|break down|orchestrat)/.test(t)) return "planning";
  if (/\b(code|github|repo|pr|bug|refactor)/.test(t)) return "code";
  if (/\b(analy[sz]e|spreadsheet|metric|conversion|revenue)/.test(t)) return "analysis";
  if (/\b(research|competitor|market|search|pricing)/.test(t)) return "research";
  if (/\b(write|draft|email|campaign|calendar|post)/.test(t)) return "writing";
  return "default";
}

/** Providers the app can target (extensible). */
export const MODEL_PROVIDERS = [
  {
    id: "nebius",
    label: "Nebius Token Factory",
    envKey: "NEBIUS_API_KEY",
    live: () => Boolean(process.env.NEBIUS_API_KEY),
  },
  {
    id: "mock",
    label: "Mock (local scripted)",
    envKey: null,
    live: () => !process.env.NEBIUS_API_KEY,
  },
  // Placeholders for future providers — wire without hard-coding one LLM
  {
    id: "openai_compatible",
    label: "OpenAI-compatible endpoint",
    envKey: "OPENAI_API_KEY",
    live: () => Boolean(process.env.OPENAI_API_KEY),
  },
] as const;
