import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function encodeClaudeProjectSlug(absPath: string): string {
  const resolved = path.resolve(absPath);
  return resolved.replace(/\//g, "-");
}

export function getWorkspaceRoot(): string {
  return path.resolve(__dirname, "../..");
}

export function getClaudeProjectDir(): string {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  }

  const slug = encodeClaudeProjectSlug(getWorkspaceRoot());
  return path.join(os.homedir(), ".claude", "projects", slug);
}

export function assertClaudeProjectDir(): string {
  const projectDir = getClaudeProjectDir();

  if (!fs.existsSync(projectDir)) {
    throw new Error(
      `Claude project directory not found: ${projectDir}\n` +
        "Start a Claude Code session in this repo first, or set CLAUDE_PROJECT_DIR.",
    );
  }

  return projectDir;
}
