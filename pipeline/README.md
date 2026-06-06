# dev-pipeline (agent-agnostic)

Portable TDD build pipeline extracted from [`.claude/workflows/dev-pipeline.js`](../.claude/workflows/dev-pipeline.js).

## What was Claude-specific?

The original workflow is ~90% orchestration logic and ~10% Claude Code runtime primitives:

| Primitive | Role | Portable replacement |
|-----------|------|----------------------|
| `agent(prompt, { schema })` | Spawn headless coding agent | `CodingAgent` adapter (claude / codex / cursor CLI) |
| `phase(title)` | UI progress | `logger.phase()` + manifest JSON |
| `log(msg)` | Workflow log | `logger.log()` + stdout |
| `args` | Input spec path | CLI argument |

## Architecture

```
CLI (cli.ts)
  └── runDevPipeline (dev-pipeline.ts)     ← phase orchestration (agent-agnostic)
        ├── prompts.ts                     ← extracted prompt templates
        ├── test-runner.ts                 ← pytest/npm via shell (deterministic red/green)
        └── agents/
              ├── claude  → claude -p --json-schema
              ├── codex   → codex exec --full-auto
              └── cursor  → cursor agent --print
```

**Key improvement:** red-check and build test phases run `uv run pytest` / `npm test` directly instead of asking the agent to run tests. That makes pass/fail deterministic and removes one source of agent variance.

Use `--agent-tests` to restore the original behaviour (agent runs tests and returns structured JSON).

## Adding a new agent

Implement `CodingAgent` in `src/agents/`:

```typescript
export interface CodingAgent {
  readonly name: string;
  run(prompt: string, options?: AgentRunOptions): Promise<AgentRunResult>;
}
```

Register it in `src/agents/index.ts`.

## Run manifests

Each run writes `.pipeline/runs/<run-id>/manifest.json` with phases, logs, and final result. The workflow viewer (`workflow-app/`) could be extended to watch this directory alongside Claude's native workflow output.

## Usage

```bash
npm install
npm run dev-pipeline -- plans/my-feature/plan.md --agent claude
npm run dev-pipeline -- my-feature --agent codex
DEV_PIPELINE_AGENT=codex npm run dev-pipeline -- plans/my-feature/plan.md
```
