import type { WorkflowRun } from "../types";
import { formatDuration, formatTokens } from "../api";
import AgentPanel from "./AgentPanel";
import ExpandableText from "./ExpandableText";
import LogPanel from "./LogPanel";
import PhaseStepper from "./PhaseStepper";

type Props = {
  run: WorkflowRun;
};

export default function RunDetail({ run }: Props) {
  return (
    <>
      <header className="run-header">
        <div className="run-header-main">
          <h1>{run.workflowName}</h1>
          <p className="run-meta">
            <span className={`badge badge--${run.status}`}>{run.status}</span>
            <span>{run.runId}</span>
            <span>{run.agents.length} agents</span>
            {run.totalTokens ? <span>{formatTokens(run.totalTokens)} tok</span> : null}
            {run.durationMs ? <span>{formatDuration(run.durationMs)}</span> : null}
          </p>
          {run.summary ? <p className="run-summary">{run.summary}</p> : null}
        </div>
        {run.args ? (
          <details className="run-args">
            <summary>Arguments</summary>
            <ExpandableText text={run.args} collapsedLines={2} />
          </details>
        ) : null}
      </header>

      <div className="run-body">
        <aside className="timeline-aside">
          <h2 className="panel-title">Pipeline</h2>
          <p className="timeline-hint">Reference only — live progress is in agents &amp; logs.</p>
          <PhaseStepper run={run} />
        </aside>

        <div className="run-main">
          <section className="panel" aria-label="Workflow agents">
            <div className="panel-head">
              <h2 className="panel-title">Agents</h2>
            </div>
            <AgentPanel agents={run.agents} flat />
          </section>

          <LogPanel logs={run.logs} />

          {run.result != null ? (
            <section className="panel result-block">
              <div className="panel-head">
                <h2 className="panel-title">Final result</h2>
              </div>
              <ExpandableText
                text={
                  typeof run.result === "string"
                    ? run.result
                    : JSON.stringify(run.result, null, 2)
                }
              />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
