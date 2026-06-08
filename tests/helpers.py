from pathlib import Path

import tomllib

_REPO_ROOT = Path(__file__).resolve().parent.parent
_PYPROJECT = _REPO_ROOT / "pyproject.toml"


def expected_project_version() -> str:
    """Return [project].version from repo-root pyproject.toml."""
    with _PYPROJECT.open("rb") as f:
        data = tomllib.load(f)
    return data["project"]["version"]
