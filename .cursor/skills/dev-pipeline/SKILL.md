---
name: dev-pipeline
description: >-
  Orchestrates the TDD build pipeline: read plan → write tests → red check →
  build until green → review → commit. Launches phase subagents via Task.
  Use when building from plans/<feature>/plan.md, running dev-pipeline, or
  implementing a spec after dev-plan.
disable-model-invocation: true
---

# Dev Pipeline

Headless TDD pipeline driven by a plan spec. **You orchestrate; phase work runs in subagents.**

Read phase skills from `.cursor/skills/dev-pipeline-*/SKILL.md`. Shared JSON schemas: [schemas.md](schemas.md).

## Resolve inputs

From the user's message, determine **specPath**:

- `plans/<feature>/plan.md` if they pass a full path
- `plans/<feature>/plan.md` if they pass a folder or feature name only

**resultPath** = specPath with `/plan.md` replaced by `/result.md`

Verify `specPath` exists before starting. Tell the user the plan and result paths.

## Subagent pattern

Launch each phase with the **Task** tool. Each prompt must:

1. Name the phase skill path to follow
2. Pass all inputs listed in that skill
3. Require structured JSON output where the phase skill specifies it

| Phase | Skill | Task `subagent_type` | Structured output |
|---|---|---|---|
| Write tests | `dev-pipeline-write-tests` | `generalPurpose` | prose report |
| Red check | `dev-pipeline-red-check` | `shell` | TestResult |
| Implement (per round) | `dev-pipeline-implement` | `generalPurpose` | prose report |
| Run tests (per round) | `dev-pipeline-run-tests` | `shell` | TestResult |
| Review | `dev-pipeline-review` | `generalPurpose` | ReviewResult |
| Commit | `dev-pipeline-commit` | `generalPurpose` | prose report |

Parse JSON from the last ` ```json ` block in each subagent response. If parsing fails, re-run that phase once with "return valid JSON only".

**Do not do phase work in the orchestrator** — delegate to Task subagents.

## Pipeline

Run phases **sequentially**. Pass outputs forward.

```
Write tests → Red check → Build loop → Review → Commit
```

### 1. Write tests

```
Task prompt template:
Follow .cursor/skills/dev-pipeline-write-tests/SKILL.md

specPath: {specPath}

Write the full test suite. Report files created.
```

### 2. Red check

```
Task prompt template:
Follow .cursor/skills/dev-pipeline-red-check/SKILL.md

specPath: {specPath}

Run tests. Return TestResult JSON (passed=true means correct red state).
```

If `passed === false`: log a warning — tests may be too weak — but **continue** the pipeline.

### 3. Build loop

`MAX_ROUNDS = 5`. Initialize `round = 0`, `testResult = { passed: false, failures: [] }`.

While `!testResult.passed && round < MAX_ROUNDS`:

1. Increment `round`
2. **Implement** — Task with `dev-pipeline-implement`, pass `round`, `maxRounds: 5`, `previousFailures` (from `testResult.failures` or `[]`)
3. **Run tests** — Task with `dev-pipeline-run-tests`
4. Parse TestResult. Log `round N: PASS/FAIL`.

After loop, `buildRounds = round` (rounds actually executed).

If still failing after 5 rounds: log that build did not converge — **continue** to review.

### 4. Review

```
Task prompt template:
Follow .cursor/skills/dev-pipeline-review/SKILL.md

specPath: {specPath}
testsPassed: {testResult.passed}
testFailureCount: {testResult.failures.length}

Return ReviewResult JSON.
```

### 5. Commit

```
Task prompt template:
Follow .cursor/skills/dev-pipeline-commit/SKILL.md

specPath: {specPath}
resultPath: {resultPath}
testsPassed: {testResult.passed}
testFailures: {JSON.stringify(testResult.failures)}
reviewConfidence: {review.confidence}
reviewNotes: {review.notes}
buildRounds: {round}
```

Commit subagent decides commit vs block per its skill gate.

## Final report

After all phases, tell the user:

| Field | Value |
|---|---|
| Plan | specPath |
| Result | resultPath |
| Tests | pass/fail + failure count |
| Build rounds | rounds run |
| Review | confidence/10 |
| Commit | committed or blocked + reason |

## Contract

- Tests written in phase 1 are the source of truth — implement subagents must not modify them.
- Do not skip phases.
- Do not parallelize phases that depend on prior output (write-tests before red-check, etc.). Implement + run-tests within a round are sequential.

## Example invocation

User: `dev-pipeline plans/address-geocode-endpoint/plan.md`

Or: `dev-pipeline address-geocode-endpoint`
