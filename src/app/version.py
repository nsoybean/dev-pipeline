from pathlib import Path

import tomllib


def _repo_root() -> Path:
    current = Path(__file__).resolve().parent
    for directory in (current, *current.parents):
        if (directory / "pyproject.toml").is_file():
            return directory
    return current


def _load_version() -> str:
    pyproject = _repo_root() / "pyproject.toml"
    with pyproject.open("rb") as f:
        data = tomllib.load(f)
    return data["project"]["version"]


APP_VERSION: str = _load_version()
