import type { HealthResponse, WorkflowListResponse, WorkflowRun } from "./types";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json() as Promise<HealthResponse>;
}

export async function fetchRuns(): Promise<WorkflowListResponse> {
  const res = await fetch("/api/workflows");
  if (!res.ok) throw new Error("Failed to load workflows");
  return res.json() as Promise<WorkflowListResponse>;
}

export async function fetchRun(runId: string): Promise<WorkflowRun> {
  const res = await fetch(`/api/workflows/${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error("Failed to load workflow run");
  return res.json() as Promise<WorkflowRun>;
}

export function subscribeToUpdates(
  onUpdate: () => void,
  runId?: string,
): () => void {
  const url = runId
    ? `/api/workflows/${encodeURIComponent(runId)}/stream`
    : "/api/stream";

  const source = new EventSource(url);
  source.onmessage = () => onUpdate();
  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}

export function formatDuration(ms?: number): string {
  if (!ms && ms !== 0) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return `${min}m ${rem}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export function formatTokens(n?: number): string {
  if (!n) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
