import type { ReviewResult, TestResult } from "./schemas.js";

export function writeTestsPrompt(specPath: string): string {
  return `Read ${specPath} — specifically the "Test contracts" and "User-visible behaviour" sections.

Write the full test suite BEFORE any implementation exists. This is TDD — tests come first.

Rules:
- Import from the paths the implementation will use (they don't exist yet — that's correct).
- Do NOT write any implementation code.
- Cover every contract: happy path + each failure mode.
- Do NOT test headers, exit codes, or anything not in the spec.

Report the test files created and what each covers.`;
}

export function redCheckPrompt(): string {
  return `Run the test suite now. No implementation exists yet, so tests SHOULD fail.

Return passed=true if tests fail as expected (import errors, assertion errors, runtime errors) — this is the correct TDD red state.
Return passed=false only if tests somehow pass — that means tests are too weak or implementation already existed.

List the failing tests and errors.`;
}

export function buildPrompt(
  specPath: string,
  round: number,
  maxRounds: number,
  previousFailures: TestResult["failures"],
): string {
  const failureBlock =
    round > 1
      ? `Previous test run failed:\n${previousFailures.map((f) => `  - ${f.test}: ${f.error}`).join("\n")}`
      : "Start from scratch — read the plan and write the implementation.";

  return `Implement the feature described in ${specPath}.

Round ${round} of ${maxRounds}. ${failureBlock}

Rules:
- Do NOT modify any test file. Tests are the contract.
- Read ${specPath} for the spec before writing code.

Report what you changed.`;
}

export function reviewPrompt(
  specPath: string,
  testResult: TestResult,
): string {
  const testStatus = testResult.passed
    ? "green"
    : `still failing (${testResult.failures.length} failures)`;

  return `Adversarially review the implementation against ${specPath}.

Check:
- correctness bugs and missing edge cases
- security issues (injection, auth gaps, hardcoded secrets)
- anything in the spec that isn't implemented

Tests are ${testStatus}.

Return a confidence score 0-10 and concise review notes.`;
}

export function commitPrompt(
  specPath: string,
  resultPath: string,
  testResult: TestResult,
  review: ReviewResult,
  round: number,
): string {
  const failureLines = testResult.failures
    .map((f) => `- **${f.test}** (${f.file ?? "unknown"}): ${f.error}`)
    .join("\n");

  return `The feature described in ${specPath} has been implemented.

Tests: ${testResult.passed ? "PASS" : `FAIL — ${testResult.failures.length} remaining`}
Review confidence: ${review.confidence}/10
Review notes: ${review.notes}

If tests pass and review confidence >= 7: commit all changes with a concise commit message derived from the plan goal. Do NOT add Co-Authored-By trailers.
Otherwise: report what's blocking and do NOT commit.

Also write a result summary to ${resultPath} with this exact content (create the file):

---
# Result: ${specPath}

## Status

| | |
|---|---|
| Tests | ${testResult.passed ? "✓ PASS" : `✗ FAIL (${testResult.failures.length} remaining)`} |
| Build rounds | ${round} |
| Review confidence | ${review.confidence}/10 |

## Review notes

${review.notes}
${testResult.failures.length > 0 ? `\n## Remaining test failures\n\n${failureLines}` : ""}

## Commit

<fill in what you did re: commit>
---

Report what you did.`;
}
