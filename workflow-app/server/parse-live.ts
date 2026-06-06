import path from "node:path";
import { readAgentTranscript } from "./agent-transcript.js";
import type {
  DiscoveredRunRef,
  JournalEntry,
  WorkflowAgent,
  WorkflowPhase,
  WorkflowRun,
} from "./types.js";
import { mergeCompletedIntoRun, resultToLogLine } from "./parse-completed.js";
import {
  findScriptForRun,
  formatResult,
  parseScriptMeta,
  readJsonlLines,
  truncate,
} from "./utils.js";

function enrichAgentFromTranscript(
  liveDir: string,
  agent: WorkflowAgent,
): WorkflowAgent {
  const transcript = readAgentTranscript(
    path.join(liveDir, `agent-${agent.agentId}.jsonl`),
  );

  const journalResult = agent.resultPreview;
  const result =
    transcript.result && transcript.result.length >= (journalResult?.length ?? 0)
      ? transcript.result
      : journalResult;

  return {
    ...agent,
    promptPreview: transcript.prompt ?? agent.promptPreview,
    resultPreview: result,
    lastToolName: transcript.lastToolName ?? agent.lastToolName,
    lastToolSummary: transcript.lastToolSummary ?? agent.lastToolSummary,
  };
}

function inferPhaseIndex(
  agentIndex: number,
  phases: WorkflowPhase[],
  journalCount: number,
): number {
  if (phases.length === 0) return 1;
  const phaseSlot = Math.min(
    Math.ceil((agentIndex / Math.max(journalCount, 1)) * phases.length),
    phases.length,
  );
  return Math.max(1, phaseSlot);
}

export function parseLiveWorkflow(ref: DiscoveredRunRef): WorkflowRun | null {
  if (!ref.liveDir) return null;

  const journalPath = path.join(ref.liveDir, "journal.jsonl");
  const journal = readJsonlLines<JournalEntry>(journalPath);

  const sessionDir = path.dirname(path.dirname(path.dirname(ref.liveDir)));
  const scriptPath = ref.scriptPath ?? findScriptForRun(sessionDir, ref.runId);
  const meta = scriptPath ? parseScriptMeta(scriptPath) : null;

  const phases = meta?.phases ?? [];
  const agentMap = new Map<string, WorkflowAgent>();
  const logs: string[] = [];
  let startedAt: number | undefined;

  for (const entry of journal) {
    if (entry.type === "started") {
      const transcript = readAgentTranscript(
        path.join(ref.liveDir, `agent-${entry.agentId}.jsonl`),
      );
      const index = agentMap.size + 1;
      const phaseIndex = inferPhaseIndex(
        index,
        phases,
        Math.max(phases.length, journal.length / 2),
      );

      agentMap.set(entry.agentId, {
        agentId: entry.agentId,
        label: transcript.prompt
          ? truncate(transcript.prompt.replace(/\s+/g, " "), 60)
          : `Agent ${entry.agentId.slice(-6)}`,
        phaseTitle: phases[phaseIndex - 1]?.title,
        phaseIndex,
        state: "running",
        promptPreview: transcript.prompt,
        lastToolName: transcript.lastToolName,
        lastToolSummary: transcript.lastToolSummary,
      });

      if (!startedAt) startedAt = Date.now();
      logs.push(`[started] agent ${entry.agentId}`);
    }

    if (entry.type === "result") {
      const existing = agentMap.get(entry.agentId);
      const journalResult = formatResult(entry.result);

      let agent: WorkflowAgent = {
        agentId: entry.agentId,
        label: existing?.label ?? `Agent ${entry.agentId.slice(-6)}`,
        phaseTitle: existing?.phaseTitle,
        phaseIndex: existing?.phaseIndex,
        state: "done",
        promptPreview: existing?.promptPreview,
        lastToolName: existing?.lastToolName,
        lastToolSummary: existing?.lastToolSummary,
        resultPreview: journalResult,
      };

      agent = enrichAgentFromTranscript(ref.liveDir, agent);
      agentMap.set(entry.agentId, agent);
      logs.push(resultToLogLine(entry.agentId, entry.result));
    }
  }

  let agents = [...agentMap.values()].map((agent) =>
    enrichAgentFromTranscript(ref.liveDir!, agent),
  );

  const hasRunning = agents.some((a) => a.state === "running");

  let run: WorkflowRun = {
    runId: ref.runId,
    sessionId: ref.sessionId,
    workflowName: meta?.name ?? "workflow",
    status: hasRunning || agents.length === 0 ? "running" : "running",
    summary: meta?.description ?? "",
    phases,
    agents,
    logs,
    startedAt,
    agentCount: agents.length,
  };

  if (ref.completedJsonPath) {
    run = mergeCompletedIntoRun(run, ref.completedJsonPath);
    if (run.status !== "completed" && run.status !== "failed" && hasRunning) {
      run.status = "running";
    }
    if (ref.liveDir) {
      run.agents = run.agents.map((agent) =>
        enrichAgentFromTranscript(ref.liveDir!, agent),
      );
    }
  }

  return run;
}

export function enrichRunFromLiveDir(
  run: WorkflowRun,
  liveDir: string,
): WorkflowRun {
  return {
    ...run,
    agents: run.agents.map((agent) => enrichAgentFromTranscript(liveDir, agent)),
  };
}
