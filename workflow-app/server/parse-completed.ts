import type { CompletedWorkflowJson, WorkflowAgent, WorkflowRun } from "./types.js";
import { formatResult, readJsonFile } from "./utils.js";

function mapAgentState(state?: string): WorkflowAgent["state"] {
  switch (state) {
    case "running":
      return "running";
    case "done":
      return "done";
    case "error":
      return "error";
    default:
      return "queued";
  }
}

function mapRunStatus(status?: string, error?: string): WorkflowRun["status"] {
  if (status === "completed") return "completed";
  if (status === "failed" || error) return "failed";
  return "running";
}

export function parseCompletedWorkflow(
  jsonPath: string,
  sessionId: string,
): WorkflowRun | null {
  const data = readJsonFile<CompletedWorkflowJson>(jsonPath);
  if (!data?.runId) return null;

  const agents: WorkflowAgent[] = (data.workflowProgress ?? [])
    .filter((item) => item.type === "workflow_agent")
    .map((item) => ({
      agentId: item.agentId ?? `agent-${item.index ?? 0}`,
      label: item.label ?? `Agent ${item.index ?? ""}`,
      phaseTitle: item.phaseTitle,
      phaseIndex: item.phaseIndex,
      state: mapAgentState(item.state),
      tokens: item.tokens,
      durationMs: item.durationMs,
      lastToolName: item.lastToolName,
      lastToolSummary: item.lastToolSummary,
      promptPreview: item.promptPreview,
      resultPreview: item.resultPreview ?? (item.error ? item.error : undefined),
    }));

  return {
    runId: data.runId,
    sessionId,
    workflowName: data.workflowName ?? "workflow",
    status: mapRunStatus(data.status, data.error),
    summary: data.summary ?? "",
    args: data.args,
    startedAt: data.startTime,
    durationMs: data.durationMs,
    phases: data.phases ?? [],
    agents,
    logs: data.logs ?? [],
    result: data.result,
    agentCount: data.agentCount ?? agents.length,
    totalTokens: data.totalTokens,
  };
}

export function mergeCompletedIntoRun(
  run: WorkflowRun,
  jsonPath: string,
): WorkflowRun {
  const completed = parseCompletedWorkflow(jsonPath, run.sessionId);
  if (!completed) return run;

  return {
    ...run,
    ...completed,
    phases: completed.phases.length ? completed.phases : run.phases,
    agents: completed.agents.length ? completed.agents : run.agents,
    logs: completed.logs.length ? completed.logs : run.logs,
  };
}

export function resultToLogLine(agentId: string, result: unknown): string {
  return `[${agentId}] ${formatResult(result)}`;
}
