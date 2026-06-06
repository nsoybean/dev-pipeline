import crypto from "node:crypto";
import path from "node:path";
import type { CodingAgent } from "./agents/types.js";
import { parseStructured } from "./agents/parse-json.js";
import { createLogger, initRunManifest } from "./logger.js";
import {
  buildPrompt,
  commitPrompt,
  redCheckPrompt,
  reviewPrompt,
  writeTestsPrompt,
} from "./prompts.js";
import {
  REVIEW_SCHEMA,
  type ReviewResult,
  type TestResult,
} from "./schemas.js";
import { formatFailures, interpretRedCheck, runTests } from "./test-runner.js";

export const PIPELINE_PHASES = [
  { title: "Write tests" as const, detail: "write full test suite from plan.md before any implementation" },
  { title: "Red check" as const, detail: "confirm tests fail (TDD red state)" },
  { title: "Build" as const, detail: "implement until tests pass; iterate up to 5 rounds" },
  { title: "Review" as const, detail: "adversarial review of the implementation" },
  { title: "Commit" as const, detail: "commit and report merge readiness" },
];

export type DevPipelineOptions = {
  specPath: string;
  cwd: string;
  agent: CodingAgent;
  maxRounds?: number;
  runDir?: string;
  /** When true, run pytest/npm directly instead of asking the agent to run tests */
  shellTests?: boolean;
};

export type DevPipelineResult = {
  specPath: string;
  resultPath: string;
  testsPassed: boolean;
  testFailures: TestResult["failures"];
  reviewConfidence: number;
  reviewNotes: string;
  buildRounds: number;
  runDir: string;
};

function resolveSpecPath(input: string, cwd: string): string {
  const normalized = input.endsWith(".md")
    ? input
    : path.join("plans", input, "plan.md");
  return path.isAbsolute(normalized) ? normalized : path.join(cwd, normalized);
}

async function invokeAgent(
  agent: CodingAgent,
  logger: ReturnType<typeof createLogger>,
  prompt: string,
  options: { label: string; phase?: (typeof PIPELINE_PHASES)[number]["title"]; schema?: typeof REVIEW_SCHEMA },
): Promise<{ text: string; structured?: unknown }> {
  logger.agentStart(options.label, options.phase);
  try {
    const result = await agent.run(prompt, {
      label: options.label,
      phase: options.phase,
      schema: options.schema,
    });
    logger.agentEnd(options.label);
    return result;
  } catch (err) {
    logger.agentEnd(options.label);
    throw err;
  }
}

export async function runDevPipeline(options: DevPipelineOptions): Promise<DevPipelineResult> {
  const {
    cwd,
    agent,
    maxRounds = 5,
    shellTests = true,
  } = options;

  const specPath = resolveSpecPath(options.specPath, cwd);
  const resultPath = specPath.replace(/\/plan\.md$/, "/result.md");
  const runId = `run_${crypto.randomUUID()}`;
  const runDir =
    options.runDir ?? path.join(cwd, ".pipeline", "runs", runId);

  initRunManifest(runDir, {
    runId,
    workflowName: "dev-pipeline",
    agent: agent.name,
    specPath,
    resultPath,
    startedAt: new Date().toISOString(),
    phases: PIPELINE_PHASES,
  });

  const logger = createLogger(runDir);
  logger.log(`plan: ${specPath}`);
  logger.log(`result will be written to: ${resultPath}`);
  logger.log(`agent: ${agent.name}`);

  // 1. Write tests
  logger.phase("Write tests");
  await invokeAgent(agent, logger, writeTestsPrompt(specPath), {
    label: "write-tests",
    phase: "Write tests",
  });

  // 2. Red check
  logger.phase("Red check");
  let redCheck: TestResult;
  if (shellTests) {
    const raw = runTests(cwd);
    redCheck = interpretRedCheck(raw);
  } else {
    const response = await invokeAgent(agent, logger, redCheckPrompt(), {
      label: "red-check",
      phase: "Red check",
      schema: undefined,
    });
    redCheck = parseStructured<TestResult>(response.text, response.structured);
  }

  if (!redCheck.passed) {
    logger.log(`⚠ red-check WARN: ${redCheck.summary}`);
  } else {
    logger.log(`✓ red state confirmed — ${redCheck.failures.length} tests failing as expected`);
  }

  // 3. Build loop
  logger.phase("Build");
  let testResult: TestResult = { passed: false, summary: "", failures: [] };
  let round = 0;

  while (!testResult.passed && round < maxRounds) {
    round++;
    logger.log(`build round ${round}/${maxRounds}`);

    await invokeAgent(agent, logger, buildPrompt(specPath, round, maxRounds, testResult.failures), {
      label: `build:round-${round}`,
      phase: "Build",
    });

    if (shellTests) {
      testResult = runTests(cwd);
    } else {
      const response = await invokeAgent(
        agent,
        logger,
        "Run the full test suite. Return passed=true only if all tests pass. List any failures with test name, error, and file.",
        { label: `test:round-${round}`, phase: "Build" },
      );
      testResult = parseStructured<TestResult>(response.text, response.structured);
    }

    logger.log(
      `round ${round}: ${testResult.passed ? "✓ PASS" : `✗ FAIL — ${testResult.failures.length} failure(s)`}`,
    );
    if (!testResult.passed && testResult.failures.length > 0) {
      logger.log(formatFailures(testResult.failures));
    }
  }

  if (!testResult.passed) {
    logger.log(`✗ build did not converge after ${maxRounds} rounds — proceeding to review anyway`);
  }

  // 4. Review
  logger.phase("Review");
  const reviewResponse = await invokeAgent(agent, logger, reviewPrompt(specPath, testResult), {
    label: "review",
    phase: "Review",
    schema: REVIEW_SCHEMA,
  });
  const review = parseStructured<ReviewResult>(reviewResponse.text, reviewResponse.structured);
  logger.log(`review: ${review.confidence}/10`);

  // 5. Commit
  logger.phase("Commit");
  const commitResponse = await invokeAgent(
    agent,
    logger,
    commitPrompt(specPath, resultPath, testResult, review, round),
    { label: "commit", phase: "Commit" },
  );
  logger.log(commitResponse.text);

  const pipelineResult: DevPipelineResult = {
    specPath,
    resultPath,
    testsPassed: testResult.passed,
    testFailures: testResult.failures,
    reviewConfidence: review.confidence,
    reviewNotes: review.notes,
    buildRounds: round,
    runDir,
  };

  logger.complete(pipelineResult);
  return pipelineResult;
}
