import type { AgentFactoryOptions, AgentName, CodingAgent } from "./types.js";
import {
  createClaudeAgent,
  createCodexAgent,
  createCursorAgent,
} from "./cli-agents.js";

export function createAgent(name: AgentName, options: AgentFactoryOptions): CodingAgent {
  switch (name) {
    case "claude":
      return createClaudeAgent(options);
    case "codex":
      return createCodexAgent(options);
    case "cursor":
      return createCursorAgent(options);
    default:
      throw new Error(`Unknown agent: ${name as string}. Use claude, codex, or cursor.`);
  }
}

export function detectDefaultAgent(): AgentName {
  if (process.env.DEV_PIPELINE_AGENT) {
    return process.env.DEV_PIPELINE_AGENT as AgentName;
  }
  return "claude";
}
