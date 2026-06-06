#!/usr/bin/env node
import path from "node:path";
import { createAgent, detectDefaultAgent } from "./agents/index.js";
import type { AgentName } from "./agents/types.js";
import { runDevPipeline } from "./dev-pipeline.js";

function printHelp() {
  console.log(`dev-pipeline — agent-agnostic TDD build pipeline

Usage:
  dev-pipeline <spec-path> [options]

Arguments:
  spec-path    Path to plan.md, or feature folder name (resolves to plans/<name>/plan.md)

Options:
  --agent <name>     Coding agent backend: claude | codex | cursor (default: claude or DEV_PIPELINE_AGENT)
  --cwd <dir>        Repository root (default: current directory)
  --model <id>       Model override for the selected agent
  --max-rounds <n>   Max build iterations (default: 5)
  --agent-tests      Ask the agent to run tests instead of shell (pytest/npm)
  --help             Show this help

Examples:
  npm run dev-pipeline -- plans/address-geocode-endpoint/plan.md
  npm run dev-pipeline -- address-geocode-endpoint --agent codex
  DEV_PIPELINE_AGENT=cursor npm run dev-pipeline -- plans/foo/plan.md

The Claude Code workflow at .claude/workflows/dev-pipeline.js remains the native
integration when running inside Claude Code. This CLI is the portable equivalent.
`);
}

function parseArgs(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  let specPath: string | undefined;
  let agent: AgentName = detectDefaultAgent();
  let cwd = process.cwd();
  let model: string | undefined;
  let maxRounds = 5;
  let shellTests = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--agent") {
      agent = argv[++i] as AgentName;
    } else if (arg === "--cwd") {
      cwd = path.resolve(argv[++i]);
    } else if (arg === "--model") {
      model = argv[++i];
    } else if (arg === "--max-rounds") {
      maxRounds = Number(argv[++i]);
    } else if (arg === "--agent-tests") {
      shellTests = false;
    } else if (!arg.startsWith("-")) {
      specPath = arg;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!specPath) {
    printHelp();
    process.exit(1);
  }

  return { specPath, agent, cwd, model, maxRounds, shellTests };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const codingAgent = createAgent(opts.agent, {
    cwd: opts.cwd,
    model: opts.model,
  });

  const result = await runDevPipeline({
    specPath: opts.specPath,
    cwd: opts.cwd,
    agent: codingAgent,
    maxRounds: opts.maxRounds,
    shellTests: opts.shellTests,
  });

  console.log("\n--- Pipeline complete ---");
  console.log(JSON.stringify(result, null, 2));

  if (!result.testsPassed) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
