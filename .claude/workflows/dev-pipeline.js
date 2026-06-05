export const meta = {
  name: 'dev-pipeline',
  description: 'breakdown → build → test (hard gate) → review → auto-resolve → merge-gate. Reads plans/<feature>/plan.md (written by /dev-plan) or auto-plans from a request string.',
  whenToUse: 'After /dev-plan has written plans/<feature>/plan.md, run: Workflow({ name: "dev-pipeline", args: { specPath: "plans/<feature>/plan.md" } }). Or skip interactive planning and pass a request string directly.',
  phases: [
    { title: 'Plan',       detail: 'auto-plan from request (skipped when specPath is provided)' },
    { title: 'Breakdown',  detail: 'parse existing tasks.md (skipped when specPath provided) or split spec into discrete tasks' },
    { title: 'Build',      detail: 'implement each task in order; red-check after write-tests confirms TDD state' },
    { title: 'Test',       detail: 'lint → type-check → full test suite as a hard gate; auto-fix failures before proceeding' },
    { title: 'Review',     detail: 'adversarial review per task' },
    { title: 'Resolve',    detail: 'auto-fix high-confidence review findings' },
    { title: 'Merge gate', detail: 'score readiness against the threshold' },
  ],
}

// ---------- inputs & config ----------

// Two entry points:
//   specPath mode  → { specPath: "plans/task-tracker-api/plan.md" }  (after /dev-plan)
//   auto-plan mode → "feature description"  OR  { request }            (no prior spec)
const isSpecMode  = typeof args === 'object' && args?.specPath
const specPath    = isSpecMode ? args.specPath : 'plans/feature/plan.md'
const request     = typeof args === 'string' ? args : (args?.request ?? null)
const MERGE_THRESHOLD = (typeof args === 'object' && args?.threshold) || 8

if (!isSpecMode && !request) {
  throw new Error(
    'Pass either:\n' +
    '  { specPath: "plans/<feature>/plan.md" }  — after running /dev-plan\n' +
    '  "feature description"                    — to auto-plan from scratch'
  )
}

// ---------- schemas ----------

const TASKS_SCHEMA = {
  type: 'object',
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'description', 'files'],
        properties: {
          id:          { type: 'string' },
          title:       { type: 'string' },
          description: { type: 'string' },
          files:       { type: 'array', items: { type: 'string' } },
          dependsOn:   { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const TEST_RESULT_SCHEMA = {
  type: 'object',
  required: ['passed', 'summary', 'failures'],
  properties: {
    passed:  { type: 'boolean' },
    summary: { type: 'string' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['test', 'error', 'autoFixable'],
        properties: {
          test:        { type: 'string' },
          error:       { type: 'string' },
          file:        { type: 'string' },
          autoFixable: { type: 'boolean' },
        },
      },
    },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['confidence', 'findings'],
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 10 },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'title', 'detail', 'autoFixable'],
        properties: {
          severity:    { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          title:       { type: 'string' },
          detail:      { type: 'string' },
          file:        { type: 'string' },
          autoFixable: { type: 'boolean' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['confidence', 'rationale', 'blockers'],
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 10 },
    rationale:  { type: 'string' },
    blockers:   { type: 'array', items: { type: 'string' } },
  },
}

// ---------- 1. Plan (skipped in specPath mode) ----------

if (isSpecMode) {
  log(`using existing plan: ${specPath}`)
} else {
  phase('Plan')
  await agent(
    `You are a senior engineer planning this feature:

"${request}"

Read the existing codebase first (directory structure, README, package files, existing patterns) so the plan reflects what's already there.

Then create or overwrite ${specPath} with these sections:
- Goal — one paragraph on what this is and why it matters
- User-visible behaviour — concrete walk-through for the happy path, then each failure mode. Be specific: name API response shapes, error messages, UI text. This section is the source of truth for what tests will cover.
- Architecture & key decisions — with rationale for each choice
- Data model / contracts — schemas, types, API shapes
- Constraints from the existing codebase — patterns, deps, conventions to respect
- Out of scope — explicit list
- Open questions — anything unresolved (state your recommendation)

Be decisive. State assumptions rather than leaving blanks. Return the file path you wrote.`,
    { phase: 'Plan' }
  )
  log(`plan written → ${specPath}`)
}

// ---------- 2. Breakdown ----------
// specPath is e.g. "plans/task-tracker-api/plan.md"
// tasksPath sits alongside it:  "plans/task-tracker-api/tasks.md"
const tasksPath = specPath.replace(/\/[^/]+$/, '/tasks.md')

phase('Breakdown')
const { tasks } = await agent(
  isSpecMode
    ? `Read ${tasksPath}. This file was written by the interactive /dev-plan step and already contains the full task list — do not re-derive or reorder tasks.

Parse it into the schema below, extracting each task's id, title, description, files, and dependsOn exactly as written.

If the file does not exist, fall back to reading ${specPath} and producing a task breakdown from scratch, including a final "write-tests" task.`
    : `Break the spec at ${specPath} into discrete, independently buildable tasks. This is a TDD workflow — task order matters.

Required ordering:
1. task-1: scaffold — create directory structure and type stubs (no logic, no tests)
2. task-2: write-tests — write the FULL test suite from plan.md → Test contracts, BEFORE any implementation. Tests will fail until the implementation tasks run.
3. task-3..N: implement each component — make the tests pass. Each task must NOT modify test files.

For each task:
- id: kebab-case identifier
- title: short imperative phrase
- description: 1-3 sentences on what to do; for implementation tasks, include "Do NOT modify test files."
- files: exact paths to create or edit (no test files in implementation tasks)
- dependsOn: earlier task ids this must follow (empty array if none)

Order so dependencies come before dependents. Tasks must be small enough for one focused agent in one pass.`,
  { phase: 'Breakdown', schema: TASKS_SCHEMA }
)
log(`${isSpecMode ? 'parsed' : 'broke into'} ${tasks.length} tasks`)

// ---------- 3. Build — sequential ----------
// Sequential keeps the working tree consistent — task N sees what 1..N-1 produced.
// TDD flow: write-tests task runs early (task-2) and is followed by a red-check to confirm
// tests fail as expected before implementation. Subsequent tasks make those tests pass.

const built = []
for (const task of tasks) {
  phase('Build')

  const isTestTask = task.id === 'write-tests'
  const buildSummary = await agent(
    isTestTask
      ? `Write the test suite for this feature. This is a TDD workflow — you are writing tests BEFORE any implementation exists.

Task: ${task.title}
Description: ${task.description}
Files to create: ${task.files.join(', ')}
Plan: ${specPath} — read the "Test contracts" and "User-visible behaviour" sections. These are your sole source of truth.

Rules:
- Import from the exact file paths that later tasks will implement (they don't exist yet — that's correct).
- Do NOT mock away missing implementations. Let the failures be real import/runtime errors.
- Do NOT write any implementation code.
- Cover every contract in plan.md → Test contracts: happy path + each failure mode.
- Follow the test hierarchy: unit (pure logic) → integration (wired components) → E2E (HTTP against real server).
- Do NOT test: headers, exit codes, signal handling, process lifecycle, or edge cases not in the spec.

Report the test files you created and what each test covers.`
      : `Implement task "${task.title}".

Description: ${task.description}
Files to touch: ${task.files.join(', ')}
Plan: ${specPath} — read the relevant sections before writing any code.

Rules:
- Do NOT modify any test file. Tests are the contract — your job is to make them pass.
- Run the type-checker if configured (do NOT run tests yet — a dedicated test step follows).

Report what you changed and any deviations from the spec.`,
    { label: `build:${task.id}`, phase: 'Build' }
  )
  built.push({ task, buildSummary })

  // TDD red-check: after write-tests is built, confirm tests fail (no implementation exists yet).
  // A passing suite at this point means tests are trivially wrong or implementation pre-existed.
  if (isTestTask) {
    phase('Build')
    const redCheck = await agent(
      `Run the test suite. This is a TDD red-check: no implementation exists yet, so tests SHOULD fail.

Return passed=true if tests fail as expected (import errors, assertion failures, not-found errors) — this is the correct TDD "red" state.
Return passed=false if tests unexpectedly pass — that indicates tests are trivially wrong (always-true assertions, empty test bodies) or implementation already exists.

List the failing tests and their errors so we can confirm they map to real missing implementations.`,
      { label: 'red-check', phase: 'Build', schema: TEST_RESULT_SCHEMA }
    )
    if (!redCheck.passed) {
      log(`⚠ red-check WARN: tests passed before implementation — ${redCheck.summary}. Tests may be too weak.`)
    } else {
      log(`✓ red-check: ${redCheck.failures.length} tests failing as expected (TDD red state confirmed)`)
    }
  }
}

// ---------- 4. Test — hard gate, runs once after all tasks are built ----------
// Tests run after the full build because E2E and integration tests span multiple tasks.
// Runs in order: lint → type-check → unit → integration → E2E.
// Failures trigger auto-fix attempts before proceeding. Review does NOT run on broken tests.

phase('Test')
let testResult = await agent(
  `Run the full verification suite for this feature in this order:

1. Lint — run the linter (eslint, ruff, golangci-lint, etc.) if configured. Lint failures are test failures.
2. Type-check — run the type checker (tsc --noEmit, mypy, etc.) if configured. Type errors are test failures.
3. Unit tests — pure functions, business logic, data transformations. Fast, no I/O.
4. Integration tests — components wired together. Use real local deps; mock only external boundaries.
5. E2E tests — start the actual server, hit real endpoints with HTTP, assert on response body and status code. One test per behaviour in the spec's "User-visible behaviour" section.

Plan: ${specPath}
The "User-visible behaviour" section is the sole source of truth for what should be tested. Do not test anything not described there.
Do NOT test: headers, exit codes, signal handling, process lifecycle, or edge cases not in the spec.

Steps:
1. Discover the lint/type-check/test commands from package.json scripts, Makefile, pyproject.toml, etc.
2. Run each step and capture output.
3. Return passed=true only if ALL steps exit 0 with zero failures.
4. For each failure: quote the test/rule name, the error, the file, and whether a follow-up agent could fix the implementation (autoFixable=true) without ambiguity. Never mark autoFixable=true for a test assertion that should be relaxed — the test is the contract.`,
  { phase: 'Test', schema: TEST_RESULT_SCHEMA }
)
log(`tests: ${testResult.passed ? '✓ PASS' : '✗ FAIL'} — ${testResult.failures.length} failure(s)`)

// Auto-fix test failures, then re-run once
if (!testResult.passed) {
  const fixable = testResult.failures.filter(f => f.autoFixable)
  if (fixable.length) {
    phase('Test')
    await parallel(fixable.map(f => () =>
      agent(
        `Fix the implementation so this test passes:

Test: ${f.test}
Error: ${f.error}
File: ${f.file ?? '(locate it)'}

Fix the implementation code — do NOT relax the test assertion. The test is the contract. Report what you changed.`,
        { label: `test-fix:${f.test.slice(0, 40)}`, phase: 'Test' }
      )
    ))

    // Re-run after fixes
    testResult = await agent(
      `Re-run the full test suite. Return the same schema as before — passed, summary, and any remaining failures.`,
      { phase: 'Test', schema: TEST_RESULT_SCHEMA }
    )
    log(`re-run: ${testResult.passed ? '✓ PASS' : '✗ FAIL'} — ${testResult.failures.length} remaining`)
  }
}

// ---------- 5. Review — adversarial, per task ----------
// Runs regardless of test outcome so we surface all issues, but merge gate weighs test failures heavily.

const reviewed = []
for (const { task, buildSummary } of built) {
  phase('Review')
  const review = await agent(
    `Adversarially review the implementation of "${task.title}".

The implementing agent reported: ${buildSummary}

Read the actual changes on disk — do not trust the summary alone. Check:
- correctness bugs and missing edge cases
- security issues (injection, auth gaps, secrets in code)
- contract violations against ${specPath} (the plan)
- dead, duplicated, or misplaced code

Do NOT flag issues that are already caught by failing tests — those are tracked separately.

Default to skepticism. Mark autoFixable=true only when a follow-up agent can resolve it unambiguously from your description alone. Rate overall confidence 0-10.`,
    { label: `review:${task.id}`, phase: 'Review', schema: REVIEW_SCHEMA }
  )

  let resolved = []
  const fixable = review.findings.filter(f => f.autoFixable && f.severity !== 'low')
  if (fixable.length) {
    phase('Resolve')
    resolved = await parallel(fixable.map(f => () =>
      agent(
        `Resolve this review finding in task "${task.title}":

Title: ${f.title}
Detail: ${f.detail}
File: ${f.file ?? '(locate it)'}

Make the fix. Report what you changed in one paragraph.`,
        { label: `resolve:${task.id}:${f.title.slice(0, 30)}`, phase: 'Resolve' }
      )
    ))
    resolved = resolved.filter(Boolean)
  }

  reviewed.push({ task, buildSummary, review, resolved })
  log(`${task.id}: ${review.confidence}/10, ${review.findings.length} findings, ${resolved.length} auto-resolved`)
}

// ---------- 6. Merge gate ----------

phase('Merge gate')
const specLabel = isSpecMode ? `plan at ${specPath}` : `request: "${request}"`
const verdict = await agent(
  `You are the merge gate. Decide whether this change is ready to land.

Source: ${specLabel}

Test result: ${testResult.passed ? 'PASS — all tests green' : `FAIL — ${testResult.failures.length} test(s) still failing after auto-fix attempt`}
${!testResult.passed ? `Failing tests:\n${testResult.failures.map(f => `  - ${f.test}: ${f.error}`).join('\n')}` : ''}

Per-task review outcomes:
${reviewed.map(r => `- ${r.task.id} ("${r.task.title}"): ${r.review.confidence}/10, ${r.review.findings.length} findings, ${r.resolved.length} auto-resolved`).join('\n')}

Read the working tree and ${specPath} (the plan). Weigh:
- Failing tests are hard blockers — they represent unmet spec contracts. A MERGE verdict with failing tests is only valid if the failures are provably environment-related (missing env var, port conflict), not logic errors.
- Unresolved review findings at medium/high/critical severity are soft blockers.
- Gap between spec and code (unimplemented behaviour) is a hard blocker.

Output confidence 0-10, a paragraph rationale, and a list of remaining blockers (empty if none).`,
  { phase: 'Merge gate', schema: VERDICT_SCHEMA }
)

const decision = verdict.confidence >= MERGE_THRESHOLD ? 'MERGE' : 'HOLD'
log(`${verdict.confidence}/10 vs threshold ${MERGE_THRESHOLD} → ${decision}`)

return {
  specPath,
  threshold: MERGE_THRESHOLD,
  decision,
  testsPassed: testResult.passed,
  testFailures: testResult.failures,
  verdict,
  tasks: reviewed.map(r => ({
    id: r.task.id,
    title: r.task.title,
    reviewConfidence: r.review.confidence,
    findings: r.review.findings,
    autoResolved: r.resolved.length,
  })),
}
