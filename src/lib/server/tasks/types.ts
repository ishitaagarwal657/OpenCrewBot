/**
 * Task Execution Engine — core types
 * OpenCrewBot 2.0
 */

export type TaskStatus =
  | "pending"
  | "ready"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type RunStatus =
  | "planning"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  id: string;
  runId: string;
  title: string;
  description: string;
  assigneeAgentId: string | null;
  requiredSkills: string[];
  requiredCapabilities: string[];
  dependencies: string[]; // task ids
  status: TaskStatus;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  approvalPreview?: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  parallelGroup?: string;
  metadata?: Record<string, unknown>;
}

export interface Run {
  id: string;
  userInstruction: string;
  roomId?: string;
  projectId?: string;
  status: RunStatus;
  chiefOfStaffAgentId: string;
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  finalDeliverable?: string;
  error?: string;
}

export interface TaskPlan {
  summary: string;
  tasks: Array<{
    title: string;
    description: string;
    requiredSkills: string[];
    requiredCapabilities: string[];
    assigneeHint?: string; // agent name or role
    dependsOn?: number[]; // indices in this array
    requiresApproval?: boolean;
    parallelGroup?: string;
    timeoutMs?: number;
  }>;
  createAgents?: Array<{
    name: string;
    role: string;
    instructions: string;
    skills?: string[];
  }>;
}

export interface ApprovalRecord {
  id: string;
  taskId: string;
  runId: string;
  agentId: string;
  actionPreview: string;
  toolName?: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}
