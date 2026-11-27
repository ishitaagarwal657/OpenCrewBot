/**
 * Human Approval & Autonomy — 3 permission levels
 * OpenCrewBot 2.0 — Module G
 */

export type PermissionLevel = "ask_first" | "controlled" | "full_access";

export type ActionCategory =
  | "read"
  | "search"
  | "memory_write"
  | "browser"
  | "external_message" // email, slack, etc.
  | "external_write" // create issue, update notion, etc.
  | "code_execution"
  | "destructive";

export interface ControlledPolicy {
  allowedCategories: ActionCategory[];
  maxExternalMessagesPerHour?: number;
  maxBrowserSessionsPerDay?: number;
  blockedTools?: string[];
}

export const DEFAULT_CONTROLLED_POLICY: ControlledPolicy = {
  allowedCategories: ["read", "search", "memory_write", "code_execution"],
  maxExternalMessagesPerHour: 5,
  maxBrowserSessionsPerDay: 3,
  blockedTools: [],
};

export interface ActionRequest {
  agentId: string;
  toolName: string;
  category: ActionCategory;
  preview: string;
  permissionLevel: PermissionLevel;
  controlledPolicy?: ControlledPolicy;
  usageCounters?: {
    externalMessagesThisHour?: number;
    browserSessionsToday?: number;
  };
}

export type PermissionDecision =
  | { allow: true; reason: string }
  | { allow: false; requireApproval: true; reason: string }
  | { allow: false; requireApproval: false; reason: string };

/**
 * Decide whether an action may proceed, needs approval, or is denied.
 * Rejected / denied actions must never execute.
 */
export function evaluatePermission(req: ActionRequest): PermissionDecision {
  const level = req.permissionLevel;

  if (level === "full_access") {
    if (req.category === "destructive") {
      return {
        allow: false,
        requireApproval: true,
        reason: "Destructive actions always require approval even in full_access",
      };
    }
    return { allow: true, reason: "full_access" };
  }

  if (level === "ask_first") {
    // Read-only local memory can still be free; everything external needs approval
    if (req.category === "memory_write" || req.category === "read") {
      return { allow: true, reason: "local read/memory under ask_first" };
    }
    return {
      allow: false,
      requireApproval: true,
      reason: "ask_first: external or sensitive action requires approval",
    };
  }

  // controlled
  const policy = req.controlledPolicy ?? DEFAULT_CONTROLLED_POLICY;

  if (policy.blockedTools?.includes(req.toolName)) {
    return {
      allow: false,
      requireApproval: false,
      reason: `Tool ${req.toolName} is blocked by controlled policy`,
    };
  }

  if (!policy.allowedCategories.includes(req.category)) {
    return {
      allow: false,
      requireApproval: true,
      reason: `Category ${req.category} not in controlled allow-list`,
    };
  }

  if (
    req.category === "external_message" &&
    policy.maxExternalMessagesPerHour !== undefined &&
    (req.usageCounters?.externalMessagesThisHour ?? 0) >=
      policy.maxExternalMessagesPerHour
  ) {
    return {
      allow: false,
      requireApproval: true,
      reason: "Hourly external message limit reached",
    };
  }

  if (
    req.category === "browser" &&
    policy.maxBrowserSessionsPerDay !== undefined &&
    (req.usageCounters?.browserSessionsToday ?? 0) >=
      policy.maxBrowserSessionsPerDay
  ) {
    return {
      allow: false,
      requireApproval: true,
      reason: "Daily browser session limit reached",
    };
  }

  return { allow: true, reason: "controlled policy allows this action" };
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  agentId: string;
  toolName: string;
  category: ActionCategory;
  decision: "allowed" | "approved" | "rejected" | "denied";
  preview: string;
  reason: string;
  decidedBy?: string;
}

/** Append-only audit helper (caller persists) */
export function makeAuditEntry(
  partial: Omit<AuditEntry, "id" | "timestamp">
): AuditEntry {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Convenience: evaluate with live persisted counters (Controlled Access).
 * Import getUsageSnapshot from ./counters when calling from tool path.
 */
export function evaluateWithCounters(
  req: Omit<ActionRequest, "usageCounters">,
  counters: { externalMessagesThisHour?: number; browserSessionsToday?: number },
): PermissionDecision {
  return evaluatePermission({
    ...req,
    usageCounters: counters,
  });
}
