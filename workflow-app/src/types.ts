export type AgentState = "queued" | "running" | "done" | "error";

export type WorkflowPhase = {
  title: string;
  detail?: string;
};

export type WorkflowAgent = {
  agentId: string;
  label: string;
  phaseTitle?: string;
  phaseIndex?: number;
  state: AgentState;
  tokens?: number;
  durationMs?: number;
  lastToolName?: string;
  lastToolSummary?: string;
  promptPreview?: string;
  resultPreview?: string;
};

export type WorkflowRun = {
  runId: string;
  sessionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed";
  summary: string;
  args?: string;
  startedAt?: number;
  durationMs?: number;
  phases: WorkflowPhase[];
  agents: WorkflowAgent[];
  logs: string[];
  result?: unknown;
  agentCount?: number;
  totalTokens?: number;
};

export type WorkflowListResponse = {
  runs: WorkflowRun[];
};

export type HealthResponse = {
  ok: boolean;
  projectDir: string;
};
