import fs from "node:fs";
import { readJsonlLines } from "./utils.js";

function extractTextContent(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;

  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "object" && part !== null) {
      const block = part as { type?: string; text?: string };
      if (block.type === "text" && block.text) parts.push(block.text);
    }
  }

  return parts.length ? parts.join("\n") : undefined;
}

export type AgentTranscript = {
  prompt?: string;
  result?: string;
  lastToolName?: string;
  lastToolSummary?: string;
};

export function readAgentTranscript(agentFile: string): AgentTranscript {
  if (!fs.existsSync(agentFile)) return {};

  const lines = readJsonlLines<Record<string, unknown>>(agentFile);
  let prompt: string | undefined;
  let result: string | undefined;
  let lastToolName: string | undefined;
  let lastToolSummary: string | undefined;

  for (const line of lines) {
    const message = line.message as Record<string, unknown> | undefined;
    if (!message) continue;

    if (message.role === "user") {
      const text = extractTextContent(message.content);
      if (text && !prompt) prompt = text;
    }

    if (message.role === "assistant") {
      const text = extractTextContent(message.content);
      if (text) result = text;

      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (
            typeof part === "object" &&
            part !== null &&
            (part as { type?: string }).type === "tool_use"
          ) {
            const tool = part as { name?: string; input?: Record<string, unknown> };
            lastToolName = tool.name;
            const input = tool.input ?? {};
            lastToolSummary =
              (input.description as string | undefined) ??
              (input.command as string | undefined) ??
              (input.file_path as string | undefined);
          }
        }
      }
    }
  }

  return { prompt, result, lastToolName, lastToolSummary };
}
