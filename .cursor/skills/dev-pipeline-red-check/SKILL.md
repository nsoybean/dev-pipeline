---
name: dev-pipeline-red-check
description: >-
  TDD phase 2 — run the test suite and confirm correct red state (tests fail
  before implementation). Used by dev-pipeline orchestrator after write-tests.
disable-model-invocation: true
---

# Dev Pipeline — Red Check

Run the test suite. No implementation should exist yet — tests **should** fail.

## Inputs

- **specPath** — for context only; do not modify the plan

## Instructions

1. Run the full test suite using the project's test command (discover from README, package.json, pyproject.toml, etc.).
2. Interpret results for TDD red state.

## Semantics

Return TestResult JSON where:

- **`passed: true`** — tests fail as expected (import errors, assertion errors, runtime errors). This is the **correct** red state.
- **`passed: false`** — tests somehow pass. Tests may be too weak or implementation already existed.

List every failing test in `failures`.

## Output

End with a fenced `json` block containing TestResult. Schema: [schemas.md](../dev-pipeline/schemas.md).

Use `subagent_type: shell` when launched via Task if the subagent only needs to run tests.
