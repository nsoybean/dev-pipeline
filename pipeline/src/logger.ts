import fs from "node:fs";
import path from "node:path";

export type PhaseName =
  | "Write tests"
  | "Red check"
  | "Build"
  | "Review"
  | "Commit";

export type PipelineLogEntry = {
  at: string;
  type: "phase" | "log" | "agent_start" | "agent_end";
  phase?: PhaseName;
  message?: string;
  label?: string;
};

export type PipelineRunManifest = {
  runId: string;
  workflowName: "dev-pipeline";
  agent: string;
  specPath: string;
  resultPath: string;
  startedAt: string;
  phases: Array<{ title: PhaseName; detail: string }>;
  logs: PipelineLogEntry[];
  status: "running" | "completed" | "failed";
  result?: unknown;
};

export function createLogger(runDir: string) {
  fs.mkdirSync(runDir, { recursive: true });
  const manifestPath = path.join(runDir, "manifest.json");

  let manifest: PipelineRunManifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  );

  function persist() {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return {
    phase(title: PhaseName) {
      manifest.logs.push({
        at: new Date().toISOString(),
        type: "phase",
        phase: title,
      });
      persist();
      console.log(`\n▶ ${title}`);
    },
    log(message: string) {
      manifest.logs.push({
        at: new Date().toISOString(),
        type: "log",
        message,
      });
      persist();
      console.log(message);
    },
    agentStart(label: string, phase?: PhaseName) {
      manifest.logs.push({
        at: new Date().toISOString(),
        type: "agent_start",
        label,
        phase,
      });
      persist();
    },
    agentEnd(label: string) {
      manifest.logs.push({
        at: new Date().toISOString(),
        type: "agent_end",
        label,
      });
      persist();
    },
    complete(result: unknown) {
      manifest.status = "completed";
      manifest.result = result;
      persist();
    },
    fail(error: string) {
      manifest.status = "failed";
      manifest.result = { error };
      persist();
    },
    getManifest() {
      return manifest;
    },
  };
}

export function initRunManifest(
  runDir: string,
  init: Omit<PipelineRunManifest, "logs" | "status">,
): PipelineRunManifest {
  fs.mkdirSync(runDir, { recursive: true });
  const manifest: PipelineRunManifest = {
    ...init,
    logs: [],
    status: "running",
  };
  fs.writeFileSync(
    path.join(runDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return manifest;
}
