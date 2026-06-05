# FastAPI Health Server

## Goal
A minimal FastAPI server running at the project root with a single `/health` endpoint. This gives the project a working Python HTTP server managed by `uv`, ready to extend with additional endpoints.

## User-visible behaviour

### Happy path
- `GET /health` returns HTTP `200` with JSON body `{"status": "ok"}`.

### Failure modes
- Any request to an undefined route returns HTTP `404` with FastAPI's default JSON error body `{"detail": "Not Found"}`.
- The server starts on `localhost:8000` by default (uvicorn default). No custom port logic is required.

## Test contracts

### `GET /health`
- **Endpoint:** `GET /health`
- **Handler:** `health()` function in `main.py`
- **Happy path:** `GET /health` → `200 OK`, body `{"status": "ok"}`
- **No failure modes** (endpoint has no inputs)

### Undefined route
- **Input:** `GET /does-not-exist`
- **Expected:** `404`, body contains `"detail": "Not Found"`

## Architecture & key decisions

| Decision | Chosen | Ruled out | Reason |
|---|---|---|---|
| Framework | FastAPI | Flask, Starlette bare | FastAPI gives automatic docs, typed responses, and is what the user requested |
| Package manager | uv | pip, poetry | User selected uv |
| Test runner | pytest + `httpx` via FastAPI `TestClient` | unittest | Standard for FastAPI; `TestClient` wraps httpx and talks to the app in-process |
| Server layout | Flat root | `app/` subdirectory | User selected flat root |

## Data model / contracts

```json
// GET /health — 200 OK
{ "status": "ok" }

// GET <undefined> — 404 Not Found
{ "detail": "Not Found" }
```

## Constraints from the existing codebase
- `src/` and `tsconfig.json` exist from a prior TypeScript project — do not remove them; the Python project lives alongside at the root.
- `.gitignore` already covers `dist/`, `node_modules/`, `.env` — add Python-specific ignores (`__pycache__/`, `.venv/`, `*.pyc`) to `.gitignore`.

## Out of scope
- Authentication / API keys
- Additional endpoints beyond `/health`
- Docker / containerisation
- CORS configuration
- Logging middleware

## Open questions
None.
