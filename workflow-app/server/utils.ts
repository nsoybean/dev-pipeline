import fs from "node:fs";
import path from "node:path";
import type { ScriptMeta } from "./types.js";

export function parseScriptMeta(scriptPath: string): ScriptMeta | null {
  if (!fs.existsSync(scriptPath)) return null;

  const source = fs.readFileSync(scriptPath, "utf8");
  const metaMatch = source.match(/export\s+const\s+meta\s*=\s*(\{[\s\S]*?\n\})/);
  if (!metaMatch) return null;

  try {
    const metaObj = new Function(`return (${metaMatch[1]})`)() as {
      name?: string;
      description?: string;
      phases?: Array<{ title?: string; detail?: string }>;
    };

    return {
      name: metaObj.name ?? "workflow",
      description: metaObj.description ?? "",
      phases: (metaObj.phases ?? []).map((p) => ({
        title: p.title ?? "Phase",
        detail: p.detail,
      })),
    };
  } catch {
    return null;
  }
}

export function findScriptForRun(
  sessionDir: string,
  runId: string,
): string | undefined {
  const scriptsDir = path.join(sessionDir, "workflows", "scripts");
  if (!fs.existsSync(scriptsDir)) return undefined;

  const suffix = `-${runId}.js`;
  const match = fs
    .readdirSync(scriptsDir)
    .find((name) => name.endsWith(suffix));

  return match ? path.join(scriptsDir, match) : undefined;
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function readJsonlLines<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is T => entry !== null);
}

export function truncate(text: string, max = 400): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function previewResult(result: unknown, max = 400): string {
  return truncate(formatResult(result), max);
}

export function listSessionDirs(projectDir: string): string[] {
  if (!fs.existsSync(projectDir)) return [];

  return fs
    .readdirSync(projectDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "memory" &&
        !entry.name.startsWith("."),
    )
    .map((entry) => path.join(projectDir, entry.name));
}
