import { spawn } from "node:child_process";
import type { CodingAgent, AgentRunOptions, AgentRunResult } from "./types.js";
import { parseJsonFromText, schemaInstruction } from "./parse-json.js";

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  stdin?: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

export function createClaudeAgent(options: {
  cwd: string;
  model?: string;
  extraArgs?: string[];
}): CodingAgent {
  const { cwd, model, extraArgs = [] } = options;

  return {
    name: "claude",
    async run(prompt: string, runOptions: AgentRunOptions = {}): Promise<AgentRunResult> {
      const args = [
        "-p",
        prompt,
        "--output-format",
        "json",
        "--dangerously-skip-permissions",
        ...extraArgs,
      ];

      if (model) {
        args.push("--model", model);
      }

      if (runOptions.schema) {
        args.push("--json-schema", JSON.stringify(runOptions.schema));
      }

      const { stdout, stderr, code } = await runCommand("claude", args, runOptions.cwd ?? cwd);

      if (code !== 0 && !stdout.trim()) {
        throw new Error(`claude exited ${code}: ${stderr || "no output"}`);
      }

      let text = stdout.trim();
      let structured: unknown;

      try {
        const envelope = JSON.parse(text) as { result?: string; structured_output?: unknown };
        text = envelope.result ?? text;
        structured = envelope.structured_output;
      } catch {
        // plain text fallback
      }

      if (runOptions.schema && structured === undefined) {
        structured = parseJsonFromText(text);
      }

      return { text, structured };
    },
  };
}

export function createCodexAgent(options: {
  cwd: string;
  model?: string;
  extraArgs?: string[];
}): CodingAgent {
  const { cwd, model, extraArgs = [] } = options;

  return {
    name: "codex",
    async run(prompt: string, runOptions: AgentRunOptions = {}): Promise<AgentRunResult> {
      const fullPrompt = runOptions.schema
        ? prompt + schemaInstruction(runOptions.schema)
        : prompt;

      const args = ["exec", "--full-auto", ...extraArgs];
      if (model) args.push("-m", model);

      const { stdout, stderr, code } = await runCommand(
        "codex",
        args,
        runOptions.cwd ?? cwd,
        fullPrompt,
      );

      if (code !== 0 && !stdout.trim()) {
        throw new Error(`codex exited ${code}: ${stderr || "no output"}`);
      }

      const text = stdout.trim();
      let structured: unknown;
      if (runOptions.schema) {
        structured = parseJsonFromText(text);
      }

      return { text, structured };
    },
  };
}

export function createCursorAgent(options: {
  cwd: string;
  model?: string;
  extraArgs?: string[];
}): CodingAgent {
  const { cwd, model, extraArgs = [] } = options;

  return {
    name: "cursor",
    async run(prompt: string, runOptions: AgentRunOptions = {}): Promise<AgentRunResult> {
      const fullPrompt = runOptions.schema
        ? prompt + schemaInstruction(runOptions.schema)
        : prompt;

      const args = ["agent", "--print", ...extraArgs];
      if (model) args.push("--model", model);

      const { stdout, stderr, code } = await runCommand(
        "cursor",
        args,
        runOptions.cwd ?? cwd,
        fullPrompt,
      );

      if (code !== 0 && !stdout.trim()) {
        throw new Error(
          `cursor agent exited ${code}: ${stderr || "no output"}. Install Cursor CLI or use --agent claude|codex.`,
        );
      }

      const text = stdout.trim();
      let structured: unknown;
      if (runOptions.schema) {
        structured = parseJsonFromText(text);
      }

      return { text, structured };
    },
  };
}
