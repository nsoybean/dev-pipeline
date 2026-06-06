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

export type SseEvent =
  | { type: "update"; runId?: string }
  | { type: "connected" };

export type DiscoveredRunRef = {
  runId: string;
  sessionId: string;
  completedJsonPath?: string;
  liveDir?: string;
  scriptPath?: string;
};

export type JournalEntry =
  | { type: "started"; key: string; agentId: string }
  | { type: "result"; key: string; agentId: string; result: unknown };

export type ScriptMeta = {
  name: string;
  description: string;
  phases: WorkflowPhase[];
};

export type CompletedWorkflowJson = {
  runId: string;
  workflowName?: string;
  summary?: string;
  args?: string;
  status?: string;
  startTime?: number;
  durationMs?: number;
  logs?: string[];
  result?: unknown;
  phases?: WorkflowPhase[];
  agentCount?: number;
  totalTokens?: number;
  error?: string;
  workflowProgress?: Array<{
    type: string;
    index?: number;
    title?: string;
    label?: string;
    phaseIndex?: number;
    phaseTitle?: string;
    agentId?: string;
    model?: string;
    state?: string;
    startedAt?: number;
    tokens?: number;
    durationMs?: number;
    lastToolName?: string;
    lastToolSummary?: string;
    promptPreview?: string;
    resultPreview?: string;
    error?: string;
  }>;
};
