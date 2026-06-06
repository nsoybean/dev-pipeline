import { useState } from "react";
import type { WorkflowAgent } from "../types";
import { formatDuration, formatTokens } from "../api";
import ExpandableText from "./ExpandableText";

type Props = {
  agents: WorkflowAgent[];
  flat?: boolean;
};

function stateLabel(state: WorkflowAgent["state"]): string {
  return state;
}

export default function AgentPanel({ agents, flat = true }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (agents.length === 0) {
    return <p className="subtle">No agents started yet.</p>;
  }

  const groups = flat
    ? [["Agents", agents] as const]
    : [...groupByPhase(agents)];

  return (
    <div className="agent-list">
      {groups.map(([phaseTitle, phaseAgents]) => (
        <div key={phaseTitle}>
          {!flat ? <h3 className="section-title">{phaseTitle}</h3> : null}
          <div className="agent-grid">
            {phaseAgents.map((agent) => {
              const expanded = expandedId === agent.agentId;
              return (
                <div key={agent.agentId} className="agent-card">
                  <button
                    type="button"
                    className="agent-header"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedId(expanded ? null : agent.agentId)
                    }
                  >
                    <span className="agent-label">
                      {agent.phaseTitle ? (
                        <span className="agent-phase">{agent.phaseTitle}</span>
                      ) : null}
                      <span>{agent.label}</span>
                    </span>
                    <span
                      className={`badge badge--${agent.state === "done" ? "completed" : agent.state}`}
                    >
                      {stateLabel(agent.state)}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="agent-body">
                      <div className="agent-meta">
                        <span>id: {agent.agentId}</span>
                        {agent.durationMs != null ? (
                          <span>{formatDuration(agent.durationMs)}</span>
                        ) : null}
                        {agent.tokens != null ? (
                          <span>{formatTokens(agent.tokens)} tok</span>
                        ) : null}
                        {agent.lastToolName ? (
                          <span>{agent.lastToolName}</span>
                        ) : null}
                      </div>
                      {agent.lastToolSummary ? (
                        <div className="subtle">{agent.lastToolSummary}</div>
                      ) : null}
                      {agent.promptPreview ? (
                        <div className="agent-block">
                          <div className="block-label">Prompt</div>
                          <ExpandableText text={agent.promptPreview} />
                        </div>
                      ) : null}
                      {agent.resultPreview ? (
                        <div className="agent-block">
                          <div className="block-label">Result</div>
                          <ExpandableText text={agent.resultPreview} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByPhase(agents: WorkflowAgent[]): Map<string, WorkflowAgent[]> {
  const grouped = new Map<string, WorkflowAgent[]>();
  for (const agent of agents) {
    const key = agent.phaseTitle ?? "Agents";
    const list = grouped.get(key) ?? [];
    list.push(agent);
    grouped.set(key, list);
  }
  return grouped;
}
