# Dev pipeline — structured outputs

Phase subagents return JSON in a fenced `json` block as the **last** thing in their response.

## TestResult

Used by **red-check** and **build** (run-tests step).

```json
{
  "passed": true,
  "summary": "one-line summary of the run",
  "failures": [
    {
      "test": "test name or node id",
      "error": "error message",
      "file": "optional/path/to/test/file"
    }
  ]
}
```

| Phase | `passed` meaning |
|---|---|
| Red check | `true` = tests fail as expected (correct TDD red state) |
| Build | `true` = all tests pass (green) |

## ReviewResult

Used by **review**.

```json
{
  "confidence": 8,
  "notes": "concise adversarial review notes"
}
```

`confidence` is 0–10. Commit gate: tests green **and** confidence ≥ 7.

## BuildRoundReport

Used by **implement** (optional, prose + bullet list is fine).

Return what files changed and a one-line summary of the approach.
