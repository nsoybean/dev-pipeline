import type { WorkflowPhase, WorkflowRun } from "../types";

type Props = {
  run: WorkflowRun;
};

function currentPhaseIndex(run: WorkflowRun): number {
  const running = run.agents.find((a) => a.state === "running");
  if (running?.phaseIndex) return running.phaseIndex;

  const doneIndices = run.agents
    .filter((a) => a.state === "done" && a.phaseIndex)
    .map((a) => a.phaseIndex as number);

  if (doneIndices.length === 0) return 1;
  return Math.max(...doneIndices);
}

function phaseState(
  phase: WorkflowPhase,
  index: number,
  current: number,
  run: WorkflowRun,
): "done" | "current" | "pending" {
  const phaseNum = index + 1;
  const agentsInPhase = run.agents.filter(
    (a) => a.phaseIndex === phaseNum || a.phaseTitle === phase.title,
  );

  if (agentsInPhase.some((a) => a.state === "running")) return "current";
  if (run.status === "completed" || phaseNum < current) return "done";
  if (phaseNum === current) return "current";
  return "pending";
}

function stateLabel(state: "done" | "current" | "pending"): string {
  if (state === "done") return "done";
  if (state === "current") return "active";
  return "pending";
}

export default function PhaseStepper({ run }: Props) {
  if (run.phases.length === 0) {
    return <p className="subtle">No pipeline metadata.</p>;
  }

  const current = currentPhaseIndex(run);

  return (
    <ol className="phase-timeline" aria-label="Pipeline phases">
      {run.phases.map((phase, index) => {
        const state = phaseState(phase, index, current, run);
        const isLast = index === run.phases.length - 1;

        return (
          <li
            key={phase.title}
            className={`timeline-step timeline-step--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <div className="timeline-rail" aria-hidden="true">
              <span className="timeline-dot" />
              {!isLast ? <span className="timeline-line" /> : null}
            </div>
            <div className="timeline-body">
              <div className="timeline-row">
                <span className="timeline-title">{phase.title}</span>
                <span className={`timeline-status timeline-status--${state}`}>
                  {stateLabel(state)}
                </span>
              </div>
              {phase.detail ? (
                <p className="timeline-detail">{phase.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
