import fs from "node:fs";
import path from "node:path";
import { getClaudeProjectDir } from "./claude-path.js";
import { parseCompletedWorkflow } from "./parse-completed.js";
import { enrichRunFromLiveDir, parseLiveWorkflow } from "./parse-live.js";
import type { DiscoveredRunRef, WorkflowRun } from "./types.js";
import { findScriptForRun, listSessionDirs } from "./utils.js";

function discoverInSession(sessionDir: string): DiscoveredRunRef[] {
  const sessionId = path.basename(sessionDir);
  const refs = new Map<string, DiscoveredRunRef>();

  const workflowsDir = path.join(sessionDir, "workflows");
  if (fs.existsSync(workflowsDir)) {
    for (const name of fs.readdirSync(workflowsDir)) {
      if (!name.startsWith("wf_") || !name.endsWith(".json")) continue;
      const runId = name.replace(/\.json$/, "");
      refs.set(runId, {
        runId,
        sessionId,
        completedJsonPath: path.join(workflowsDir, name),
        scriptPath: findScriptForRun(sessionDir, runId),
      });
    }
  }

  const liveRoot = path.join(sessionDir, "subagents", "workflows");
  if (fs.existsSync(liveRoot)) {
    for (const name of fs.readdirSync(liveRoot, { withFileTypes: true })) {
      if (!name.isDirectory() || !name.name.startsWith("wf_")) continue;
      const runId = name.name;
      const liveDir = path.join(liveRoot, runId);
      const journal = path.join(liveDir, "journal.jsonl");
      if (!fs.existsSync(journal)) continue;

      const existing = refs.get(runId);
      refs.set(runId, {
        runId,
        sessionId,
        liveDir,
        scriptPath: existing?.scriptPath ?? findScriptForRun(sessionDir, runId),
        completedJsonPath: existing?.completedJsonPath,
      });
    }
  }

  return [...refs.values()];
}

export function discoverRuns(projectDir = getClaudeProjectDir()): DiscoveredRunRef[] {
  const all: DiscoveredRunRef[] = [];

  for (const sessionDir of listSessionDirs(projectDir)) {
    all.push(...discoverInSession(sessionDir));
  }

  return all;
}

function runSortKey(run: WorkflowRun): number {
  return run.startedAt ?? run.durationMs ?? 0;
}

export function loadAllRuns(projectDir = getClaudeProjectDir()): WorkflowRun[] {
  const refs = discoverRuns(projectDir);
  const runs: WorkflowRun[] = [];

  for (const ref of refs) {
    let run: WorkflowRun | null = null;

    if (ref.completedJsonPath && fs.existsSync(ref.completedJsonPath)) {
      run = parseCompletedWorkflow(ref.completedJsonPath, ref.sessionId);
    }

    if (ref.liveDir && fs.existsSync(ref.liveDir)) {
      const liveRun = parseLiveWorkflow(ref);
      if (liveRun) {
        if (run) {
          const completedStatus = run.status;
          run = {
            ...run,
            ...liveRun,
            status:
              completedStatus === "completed" || completedStatus === "failed"
                ? completedStatus
                : liveRun.status,
          };
        } else {
          run = liveRun;
        }
      }
    }

    if (run) runs.push(run);
  }

  return runs.sort((a, b) => runSortKey(b) - runSortKey(a));
}

export function loadRun(
  runId: string,
  projectDir = getClaudeProjectDir(),
): WorkflowRun | null {
  const ref = discoverRuns(projectDir).find((r) => r.runId === runId);
  if (!ref) return null;

  if (ref.completedJsonPath && fs.existsSync(ref.completedJsonPath)) {
    const completed = parseCompletedWorkflow(ref.completedJsonPath, ref.sessionId);
    if (completed && (completed.status === "completed" || completed.status === "failed")) {
      return ref.liveDir
        ? enrichRunFromLiveDir(completed, ref.liveDir)
        : completed;
    }
  }

  if (ref.liveDir) {
    const live = parseLiveWorkflow(ref);
    if (live) return live;
  }

  if (ref.completedJsonPath) {
    return parseCompletedWorkflow(ref.completedJsonPath, ref.sessionId);
  }

  return null;
}
