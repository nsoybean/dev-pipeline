# Tasks — FastAPI Health Server

## task-1: scaffold — Create project structure and type stubs

**Description:** Create `pyproject.toml` with uv-compatible config listing `fastapi` and `uvicorn` as dependencies. Create `main.py` with the FastAPI app instance and a stub `health()` function that raises `NotImplementedError`. Create `tests/__init__.py` so pytest discovers the test package. Add Python-specific entries to `.gitignore`.
**Files:**
  - `pyproject.toml` (create)
  - `main.py` (create)
  - `tests/__init__.py` (create)
  - `.gitignore` (modify — append `__pycache__/`, `.venv/`, `*.pyc`, `.pytest_cache/`)
**Depends on:** none
**Acceptance:** `uv run python -c "from main import app"` exits without ImportError; `pyproject.toml` lists fastapi and uvicorn as dependencies.

---

## task-2: write-tests — Write failing tests against the contracts

**Description:** Write the full test suite from `plan.md → Test contracts`. Import `TestClient` from `fastapi.testclient` and the `app` instance from `main`. Tests MUST fail at this stage because `health()` raises `NotImplementedError`. Do NOT write any implementation logic.
**Files:**
  - `tests/test_health.py` (create)
**Depends on:** task-1 (scaffold)
**Acceptance:** `uv run pytest tests/` exits non-zero; failures are `500 Internal Server Error` or `NotImplementedError` — not import errors or skips.

---

## task-3: implement-health — Implement the /health endpoint

**Description:** Replace the `NotImplementedError` stub in `main.py` with a real implementation: register the route `GET /health` and return `{"status": "ok"}`. Do NOT modify any test file.
**Files:**
  - `main.py` (modify)
**Depends on:** task-2 (write-tests)
**Acceptance:** `uv run pytest tests/` exits zero; all tests pass without modifying `tests/test_health.py`.
