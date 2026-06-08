---
name: dev-pipeline-commit
description: >-
  TDD phase 5 — commit if tests pass and review confidence >= 7, write
  result.md summary. Used by dev-pipeline orchestrator.
disable-model-invocation: true
---

# Dev Pipeline — Commit

Commit if quality gates pass; always write the result summary.

## Inputs

- **specPath** — path to `plans/<feature>/plan.md`
- **resultPath** — `plans/<feature>/result.md` (same folder as plan, replace `plan.md` → `result.md`)
- **testsPassed** — boolean
- **testFailures** — array of `{ test, error, file? }`
- **reviewConfidence** — 0–10
- **reviewNotes** — string
- **buildRounds** — number of implement/run-tests iterations

## Commit gate

Commit **only if**:

- `testsPassed === true`, **and**
- `reviewConfidence >= 7`

Otherwise: report what is blocking. Do **not** commit.

When committing:

- Message derived from the plan's `## Goal` — concise, focus on why
- Do NOT add Co-Authored-By trailers
- Follow project git safety rules (no force push, no skip hooks)

## Result file

Always write `resultPath` with this structure (fill in Commit section honestly):

```markdown
# Result: {specPath}

## Status

| | |
|---|---|
| Tests | ✓ PASS or ✗ FAIL (N remaining) |
| Build rounds | {buildRounds} |
| Review confidence | {reviewConfidence}/10 |

## Review notes

{reviewNotes}

## Remaining test failures

(only if failures exist — bullet list)

## Commit

(what you did: committed with message "…" / did not commit because …)
```

## Output

Report what you did: committed or blocked, and confirm `resultPath` was written.
