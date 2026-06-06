import type { WorkflowRun } from "../types";
import { formatDuration } from "../api";

type Props = {
  runs: WorkflowRun[];
  selectedRunId?: string;
  onSelect: (runId: string) => void;
};

export default function RunList({ runs, selectedRunId, onSelect }: Props) {
  if (runs.length === 0) {
    return (
      <div className="empty-state empty-state--compact">
        <p>No runs yet.</p>
        <p className="subtle">Start /dev-pipeline in Claude Code.</p>
      </div>
    );
  }

  return (
    <nav className="run-list" aria-label="Workflow runs">
      {runs.map((run) => {
        const selected = selectedRunId === run.runId;
        return (
          <button
            key={run.runId}
            type="button"
            className={`run-item ${selected ? "active" : ""}`}
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(run.runId)}
          >
            <div className="run-item-title">{run.workflowName}</div>
            <div className="run-item-id">{run.runId}</div>
            <div className="run-item-meta">
              <span className={`badge badge--${run.status}`}>{run.status}</span>
              <span className="subtle">
                {run.agents.length} · {formatDuration(run.durationMs)}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
