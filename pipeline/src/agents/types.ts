import type { JsonSchema } from "./parse-json.js";

export type AgentRunOptions = {
  label?: string;
  phase?: string;
  schema?: JsonSchema;
  cwd?: string;
};

export type AgentRunResult = {
  text: string;
  structured?: unknown;
};

export interface CodingAgent {
  readonly name: string;
  run(prompt: string, options?: AgentRunOptions): Promise<AgentRunResult>;
}

export type AgentName = "claude" | "codex" | "cursor";

export type AgentFactoryOptions = {
  cwd: string;
  model?: string;
  /** Extra CLI args forwarded to the underlying agent binary */
  extraArgs?: string[];
};
