# FastAPI Health Server

## Goal

Build a minimal FastAPI HTTP server at the project root, managed by `uv`, with a single `GET /health` endpoint that returns `{"status": "ok"}`. The server provides a verified, runnable Python service baseline alongside the existing TypeScript source in `src/`, and is fully tested with pytest. This matters because it establishes the Python stack conventions (package manager, layout, test runner) that all future endpoints and services in this project will follow.

---

## User-visible behaviour

### Happy path

1. Developer runs `uv run uvicorn main:app --reload` from the project root.
2. Server starts and logs: `Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)`.
3. `GET http://localhost:8000/health` returns:
   - HTTP status: `200 OK`
   - Content-Type: `application/json`
   - Body:
     ```json
     { "status": "ok" }
     ```

### Failure mode 1 — undefined route

- **Request:** `GET /does-not-exist` (or any path not registered)
- **Response:**
  - HTTP status: `404 Not Found`
  - Content-Type: `application/json`
  - Body:
    ```json
    { "detail": "Not Found" }
    ```
- This is FastAPI's built-in default behaviour; no custom handler is required.

### Failure mode 2 — wrong HTTP method on /health

- **Request:** `POST /health`
- **Response:**
  - HTTP status: `405 Method Not Allowed`
  - Body:
    ```json
    { "detail": "Method Not Allowed" }
    ```
- Again, FastAPI's default; no custom handler is required.

### Failure mode 3 — server not running

- Any client request results in a connection-refused error at the OS level. Out of scope for the server itself; the operator starts the process manually or via a process manager.

---

## Architecture & key decisions

| Decision | Chosen | Ruled out | Rationale |
|---|---|---|---|
| Framework | FastAPI | Flask, Starlette bare, Django | FastAPI was explicitly requested; gives automatic OpenAPI docs, typed responses via Pydantic, and is the de-facto standard for new Python APIs |
| Package manager | uv | pip, poetry, pipenv | uv was explicitly selected; faster than pip, single-file lockfile, no separate venv activation needed for `uv run` |
| Entry point layout | Flat root (`main.py`) | `app/` package, `src/` layout | Simpler for a minimal server; avoids import path confusion; user confirmed flat root |
| Test runner | pytest with FastAPI `TestClient` | unittest, httpx standalone | `TestClient` wraps httpx and runs the ASGI app in-process — no live server needed for tests; standard FastAPI testing pattern |
| Response model | Inline dict `{"status": "ok"}` | Pydantic `BaseModel` `HealthResponse` | A single hard-coded field does not justify a Pydantic model; dict is sufficient and avoids ceremony |
| Port / host | uvicorn defaults (`127.0.0.1:8000`) | Custom config, env-var port | No port logic required per spec; uvicorn defaults are universally understood |
| Python version | 3.11+ | 3.9, 3.10 | uv resolves to the system Python; 3.11+ is assumed given the dev environment; `pyproject.toml` will pin `requires-python = ">=3.11"` |

---

## Data model / contracts

### `GET /health`

```
Request:  GET /health HTTP/1.1
Response: HTTP/1.1 200 OK
          Content-Type: application/json

          {"status": "ok"}
```

Schema (informal):
```json
{
  "status": "ok"
}
```
- `status` is always the string literal `"ok"`. No other values are produced by this endpoint.

### `GET <undefined route>`

```
Response: HTTP/1.1 404 Not Found
          Content-Type: application/json

          {"detail": "Not Found"}
```

### `POST /health` (method not allowed)

```
Response: HTTP/1.1 405 Method Not Allowed
          Content-Type: application/json

          {"detail": "Method Not Allowed"}
```

### File layout after implementation

```
<project-root>/
  main.py                  # FastAPI app, health() handler
  pyproject.toml           # uv project config, fastapi + uvicorn deps
  uv.lock                  # generated lockfile (committed)
  tests/
    __init__.py
    test_health.py         # pytest test suite
  src/                     # existing TypeScript source — untouched
  .gitignore               # modified to add Python ignores
  plans/
    fastapi-health-server/
      plan.md
      tasks.md
    feature/
      plan.md              # this file
```

---

## Constraints from the existing codebase

1. **`src/` directory exists** — contains a prior TypeScript project. Do not delete, rename, or modify anything inside `src/`. The Python server lives at the project root alongside it.
2. **`.gitignore` is TypeScript-focused** — currently covers `dist/`, `node_modules/`, `.env`, `.DS_Store`. Must append Python-specific ignores: `__pycache__/`, `.venv/`, `*.pyc`, `.pytest_cache/`, `*.egg-info/`.
3. **No existing `package.json` / `package-lock.json`** — git status shows these are deleted; do not recreate them.
4. **No existing Python files** — `main.py`, `pyproject.toml`, and `tests/` are all net-new; no migration needed.
5. **No CI/CD configuration exists** — do not add GitHub Actions or similar unless a future task specifies it.
6. **`uv` is the required package manager** — do not use `pip install` directly. All dependency commands use `uv add` / `uv run`.

---

## Out of scope

- Authentication or API keys on any endpoint
- Additional endpoints beyond `/health`
- Docker / containerisation / deployment manifests
- CORS configuration
- Logging middleware or structured logging
- Rate limiting
- OpenAPI customisation (title, version, docs URL changes)
- Environment-variable-driven configuration
- Database connectivity
- CI/CD pipeline setup
- TypeScript build changes in `src/`

---

## Open questions

None — all decisions are resolved above. Assumptions made explicit:

- **Assumption:** The developer's system Python is 3.11 or later. If not, uv can be configured with `uv python install 3.11` before setup; this is not documented in the server itself.
- **Assumption:** `uv.lock` is committed to version control so the environment is reproducible. If the team prefers not to commit it, delete from `.gitignore` is not needed but the lockfile should be gitignored instead — recommendation is to commit it.
- **Assumption:** `tests/` lives at the project root (not inside `src/`), matching the flat layout choice.
