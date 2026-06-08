---
name: dev-pipeline-run-tests
description: >-
  Run the project test suite and return structured TestResult JSON. Used by
  dev-pipeline build loop and standalone test verification.
disable-model-invocation: true
---

# Dev Pipeline — Run Tests

Run the full test suite and return structured results.

## Inputs

None required — discover and run the project's test command.

## Instructions

1. Find the test command (README, `package.json` scripts, `pytest`, `go test`, etc.).
2. Run the **full** suite.
3. Parse output into TestResult.

## Semantics

Standard meaning: **`passed: true`** only if **all** tests pass (green).

## Output

End with a fenced `json` block containing TestResult. Schema: [schemas.md](../dev-pipeline/schemas.md).

Include every failure with test name, error message, and file when available.

Use `subagent_type: shell` when launched via Task.
