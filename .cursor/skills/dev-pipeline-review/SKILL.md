---
name: dev-pipeline-review
description: >-
  TDD phase 4 — adversarial review of implementation against the plan spec.
  Returns confidence score 0-10. Used by dev-pipeline orchestrator.
disable-model-invocation: true
---

# Dev Pipeline — Review

Adversarially review the implementation against the plan.

## Inputs

- **specPath** — path to `plans/<feature>/plan.md` (required)
- **testsPassed** — whether the test suite is green
- **testFailureCount** — number of remaining failures (0 if green)

## Instructions

1. Read `specPath` and inspect the implementation and tests on disk.
2. Check:
   - Correctness bugs and missing edge cases from the spec
   - Security issues (injection, auth gaps, hardcoded secrets)
   - Anything in the spec that is not implemented
3. Note test status: green, or still failing with count.

## Output

End with a fenced `json` block containing ReviewResult. Schema: [schemas.md](../dev-pipeline/schemas.md).

Be adversarial — assume something is wrong until verified.
