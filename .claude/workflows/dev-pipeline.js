export const meta = {
  name: 'dev-pipeline',
  description: 'TDD pipeline: read plan → write tests → red check → build until green → review → commit.',
  whenToUse: 'Pass a spec path: Workflow({ name: "dev-pipeline", args: "plans/<feature>/plan.md" })',
  phases: [
    { title: 'Write tests',  detail: 'write full test suite from plan.md before any implementation' },
    { title: 'Red check',    detail: 'confirm tests fail (TDD red state)' },
    { title: 'Build',        detail: 'implement until tests pass; iterate up to 5 rounds' },
    { title: 'Review',       detail: 'adversarial review of the implementation' },
    { title: 'Commit',       detail: 'commit and report merge readiness' },
  ],
}

// ---------- input ----------

const specPath = typeof args === 'string'
  ? (args.endsWith('.md') ? args : `plans/${args}/plan.md`)
  : (args?.specPath ?? null)

if (!specPath) throw new Error('Pass a spec path: "plans/<feature>/plan.md" or { specPath: "..." }')

log(`plan: ${specPath}`)

// ---------- schemas ----------

const TEST_RESULT_SCHEMA = {
  type: 'object',
  required: ['passed', 'summary', 'failures'],
  properties: {
    passed:   { type: 'boolean' },
    summary:  { type: 'string' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['test', 'error'],
        properties: {
          test:  { type: 'string' },
          error: { type: 'string' },
          file:  { type: 'string' },
        },
      },
    },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['confidence', 'notes'],
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 10 },
    notes:      { type: 'string' },
  },
}

// ---------- 1. Write tests ----------

phase('Write tests')
await agent(
  `Read ${specPath} — specifically the "Test contracts" and "User-visible behaviour" sections.

Write the full test suite BEFORE any implementation exists. This is TDD — tests come first.

Rules:
- Import from the paths the implementation will use (they don't exist yet — that's correct).
- Do NOT write any implementation code.
- Cover every contract: happy path + each failure mode.
- Do NOT test headers, exit codes, or anything not in the spec.

Report the test files created and what each covers.`,
  { phase: 'Write tests' }
)

// ---------- 2. Red check ----------

phase('Red check')
const redCheck = await agent(
  `Run the test suite now. No implementation exists yet, so tests SHOULD fail.

Return passed=true if tests fail as expected (import errors, assertion errors, runtime errors) — this is the correct TDD red state.
Return passed=false only if tests somehow pass — that means tests are too weak or implementation already existed.

List the failing tests and errors.`,
  { phase: 'Red check', schema: TEST_RESULT_SCHEMA }
)

if (!redCheck.passed) {
  log(`⚠ red-check WARN: tests unexpectedly passed — ${redCheck.summary}. Tests may be too weak.`)
} else {
  log(`✓ red state confirmed — ${redCheck.failures.length} tests failing as expected`)
}

// ---------- 3. Build — iterate until green (max 5 rounds) ----------

phase('Build')
let testResult = { passed: false, summary: '', failures: [] }
let round = 0
const MAX_ROUNDS = 5

while (!testResult.passed && round < MAX_ROUNDS) {
  round++
  log(`build round ${round}/${MAX_ROUNDS}`)

  await agent(
    `Implement the feature described in ${specPath}.

Round ${round} of ${MAX_ROUNDS}. ${round > 1 ? `Previous test run failed:\n${testResult.failures.map(f => `  - ${f.test}: ${f.error}`).join('\n')}` : 'Start from scratch — read the plan and write the implementation.'}

Rules:
- Do NOT modify any test file. Tests are the contract.
- Read ${specPath} for the spec before writing code.

Report what you changed.`,
    { label: `build:round-${round}`, phase: 'Build' }
  )

  testResult = await agent(
    `Run the full test suite. Return passed=true only if all tests pass. List any failures with test name, error, and file.`,
    { phase: 'Build', schema: TEST_RESULT_SCHEMA }
  )
  log(`round ${round}: ${testResult.passed ? '✓ PASS' : `✗ FAIL — ${testResult.failures.length} failure(s)`}`)
}

if (!testResult.passed) {
  log(`✗ build did not converge after ${MAX_ROUNDS} rounds — proceeding to review anyway`)
}

// ---------- 4. Review ----------

phase('Review')
const review = await agent(
  `Adversarially review the implementation against ${specPath}.

Check:
- correctness bugs and missing edge cases
- security issues (injection, auth gaps, hardcoded secrets)
- anything in the spec that isn't implemented

Tests are ${testResult.passed ? 'green' : `still failing (${testResult.failures.length} failures)`}.

Return a confidence score 0-10 and concise review notes.`,
  { phase: 'Review', schema: REVIEW_SCHEMA }
)
log(`review: ${review.confidence}/10`)

// ---------- 5. Commit ----------

phase('Commit')
const committed = await agent(
  `The feature described in ${specPath} has been implemented.

Tests: ${testResult.passed ? 'PASS' : `FAIL — ${testResult.failures.length} remaining`}
Review confidence: ${review.confidence}/10
Review notes: ${review.notes}

If tests pass and review confidence >= 7: commit all changes with a concise commit message derived from the plan goal. Do NOT add Co-Authored-By trailers.
Otherwise: report what's blocking and do NOT commit.

Report what you did.`,
  { phase: 'Commit' }
)
log(committed)

return {
  specPath,
  testsPassed: testResult.passed,
  testFailures: testResult.failures,
  reviewConfidence: review.confidence,
  reviewNotes: review.notes,
  buildRounds: round,
}
