/** Best-effort JSON extraction from agent text when native schema output isn't available. */

export type JsonSchema = Record<string, unknown>;

export function schemaInstruction(schema: JsonSchema): string {
  return `\n\nRespond with ONLY valid JSON matching this schema (no markdown fences, no commentary):\n${JSON.stringify(schema, null, 2)}`;
}

export function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("Could not parse JSON from agent response");
}

export function parseStructured<T>(text: string, structured?: unknown): T {
  if (structured !== undefined) return structured as T;
  return parseJsonFromText(text) as T;
}
