---
name: dev-pipeline-implement
description: >-
  TDD build phase — implement feature code from a plan spec without modifying
  tests. One round per invocation; orchestrator loops with run-tests.
disable-model-invocation: true
---

# Dev Pipeline — Implement

Implement the feature described in the plan. One build round — do not run the full test suite (orchestrator invokes run-tests next).

## Inputs

- **specPath** — path to `plans/<feature>/plan.md` (required)
- **round** — current round number (1-based)
- **maxRounds** — max iterations (default 5)
- **previousFailures** — optional TestResult.failures from the prior round

## Instructions

1. Read `specPath` fully before writing code.
2. If `round > 1`, prioritize fixing failures listed in `previousFailures`.
3. If `round === 1`, implement from scratch per the spec.

## Rules

- Do NOT modify any test file. Tests are the contract.
- Match existing codebase patterns (structure, naming, error handling).
- Do NOT commit.

## Output

Report:

- Files created or modified
- One-line summary of what changed this round

Do not return TestResult JSON — run-tests handles verification.
