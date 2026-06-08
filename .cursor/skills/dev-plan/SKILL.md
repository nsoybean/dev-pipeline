---
name: dev-plan
description: >-
  Interactive planning: explore the codebase, ask clarifying questions, and write
  an unambiguous spec to plans/<feature>/plan.md. Use when planning a new
  feature, writing a build spec, or running dev-plan.
disable-model-invocation: true
---

# Dev Plan

Interactive planning session. Produce a complete, unambiguous spec that a headless build agent can implement without follow-up questions.

**Planning philosophy:** Write the best plan *you* know how to write. Use native planning strengths — research, comparisons, diagrams, tables, sequence charts, code sketches, file-layout maps. Do not flatten a rich plan into a generic template. The sections below are a **contract with the build pipeline**, not a cap on structure or depth.

**Do not overplan execution.** Your job is the *what* and *why* — behaviour, contracts, architecture. Leave *how* to slice work to the build pipeline. A short todo list (3–6 items) is enough; do not write per-task file lists, acceptance criteria, or dependency graphs.

The user's message is the feature request (what Claude Code passes as `$ARGUMENTS` to `/dev-plan`).

## Phase 1 — Understand what exists

Before asking the user anything, read the codebase to understand what's already there. Use Task (`subagent_type: explore`), SemanticSearch, Grep, Shell, or Read:

1. Find the top-level directory structure (`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*'`)
2. Read project-level docs only: `ARCHITECTURE.md`, `CLAUDE.md`, `README.md`, `docs/`. Do NOT read `plans/` at this stage — other features' plans are irrelevant and will confuse the plan.
3. Identify the tech stack (package.json, pyproject.toml, go.mod, Cargo.toml, etc.)
4. Look at existing patterns that will constrain the implementation (file naming, folder conventions, test patterns, CI config)

Summarise what you found in 3-5 bullet points before asking questions.

## Phase 2 — Identify gaps

Given the user's feature request and what you found in Phase 1, identify the questions you cannot answer from the codebase alone. Good questions cover:

- Scope boundaries ("should this replace X or live alongside it?")
- User-visible behaviour in failure/edge cases
- Data model decisions where multiple choices are valid
- Performance or scale requirements that would change architecture
- Auth / permission model implications

Bad questions:
- Anything you can already infer from the codebase
- Implementation details the agent can decide
- Open-ended product strategy ("what do you want in the future?")

Use the AskQuestion tool with 1–4 focused questions (max 4 options each). Ask only what you genuinely can't infer. If you need more than 4 questions, run two rounds.

## Phase 3 — Write the spec

Derive a kebab-case folder name from the feature name (e.g. "User Profile Page" → `user-profile-page`, "Task Tracker API" → `task-tracker-api`). Write a single file:

**`plans/<feature-name>/plan.md`**

---

### Structure — flexible body, fixed contracts

Organise the document however reads best for this feature. **Section order, grouping, and extra sections are yours to decide.**

#### Required

These headings must appear — exact spelling, `##` level:

| Heading | Purpose |
|---|---|
| `## Goal` | One paragraph: what this delivers and why it matters. |
| `## User-visible behaviour` | **Source of truth for the test suite.** Precise happy path, then each failure mode: HTTP status codes, response shapes, error messages, UI copy. If a behaviour is not here, it will not be tested. |
| `## Test contracts` | For each behaviour above: function/endpoint under test, happy-path input → output, and each failure input → error. No implementation code — precise enough to write tests against interfaces that do not exist yet. |
| `## Out of scope` | Explicit list of what this spec does NOT cover. |

You may merge content across sections when it reduces duplication, but all four headings must still exist.

#### TDD (required note — one short paragraph or bullet list)

State explicitly that this feature follows **test-driven development**:

1. **Red** — write tests from `Test contracts` first; they must fail (missing implementation).
2. **Green** — implement only enough to make those tests pass.
3. Tests are the contract — implementation must not weaken or rewrite them.

Place this under `## Test contracts`, as `## TDD approach`, or in frontmatter — wherever fits. Keep it brief; the build pipeline enforces the order.

#### Todos (lightweight execution hints)

Include a simple checklist so humans and agents know the rough sequence. **Do not decompose further.**

Use YAML frontmatter if your environment supports it (Cursor plan mode, etc.):

```yaml
---
name: Feature Name
overview: One-line summary
todos:
  - id: write-tests
    content: Write failing tests from Test contracts
    status: pending
  - id: implement
    content: Implement until tests pass
    status: pending
---
```

Or a markdown checklist in the body:

```markdown
## Todos
- [ ] Write failing tests from Test contracts
- [ ] Implement feature until tests pass
```

Rules for todos:
- 3–6 items max; high-level milestones only
- `write-tests` (or equivalent) must come **before** any implementation todo
- No per-task Files / Depends on / Acceptance blocks — the build agent figures that out

#### Recommended (include when they add clarity)

- Current codebase snapshot, library/tech choice, API design, architecture diagrams
- Architecture & key decisions, data model, constraints, files to add/modify
- Open questions with your recommendation

#### Encouraged

- Comparison tables, mermaid diagrams, code sketches, links to existing files

**Anti-patterns:** Boilerplate padding, invented edge cases, forced sections for trivial features, detailed task breakdowns with file lists and acceptance criteria.

## Phase 4 — Confirm

After writing the file, tell the user:

- The plan path (clickable)
- A 2-3 sentence summary of the design

If the user wants to tweak the plan before building, they can edit `plans/<feature-name>/plan.md` directly.
