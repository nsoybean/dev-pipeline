---
name: dev-pipeline-write-tests
description: >-
  TDD phase 1 — write the full test suite from a plan spec before any
  implementation exists. Used by dev-pipeline orchestrator or standalone when
  writing tests from plans/*/plan.md Test contracts.
disable-model-invocation: true
---

# Dev Pipeline — Write Tests

Write the full test suite **before** any implementation exists.

## Inputs

- **specPath** — path to `plans/<feature>/plan.md` (required)

## Instructions

1. Read `specPath`. Focus on `## Test contracts` and `## User-visible behaviour`.
2. Write tests matching project conventions (framework, folder layout, naming).
3. Import from paths the implementation **will** use — those modules do not exist yet; that is correct.

## Rules

- Do NOT write implementation code.
- Do NOT run or execute tests — a later phase handles that.
- Cover every contract: happy path + each failure mode from the spec.
- Do NOT test headers, exit codes, or anything not in the spec.

## Output

Report:

- Test files created (paths)
- What each file covers (one line per file)

Do not return TestResult JSON — this phase only writes tests.
