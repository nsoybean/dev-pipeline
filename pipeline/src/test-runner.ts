import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { TestFailure, TestResult } from "./schemas.js";

type TestCommand = {
  cmd: string;
  args: string[];
  label: string;
};

function detectTestCommand(cwd: string): TestCommand {
  const pyproject = path.join(cwd, "pyproject.toml");
  const pytestIni = path.join(cwd, "pytest.ini");
  const packageJson = path.join(cwd, "package.json");

  if (fs.existsSync(pyproject) || fs.existsSync(pytestIni)) {
    const uvLock = path.join(cwd, "uv.lock");
    if (fs.existsSync(uvLock) || fs.existsSync(path.join(cwd, ".venv"))) {
      return { cmd: "uv", args: ["run", "pytest", "-q"], label: "uv run pytest" };
    }
    return { cmd: "python", args: ["-m", "pytest", "-q"], label: "python -m pytest" };
  }

  if (fs.existsSync(packageJson)) {
    const pkg = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
      scripts?: Record<string, string>;
    };
    if (pkg.scripts?.test) {
      return { cmd: "npm", args: ["test"], label: "npm test" };
    }
  }

  throw new Error(
    "Could not detect test runner. Add pytest (pyproject.toml) or npm test (package.json).",
  );
}

function parsePytestOutput(output: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const blocks = output.split(/(?=FAILED )/);

  for (const block of blocks) {
    const header = block.match(/^FAILED ([^\s]+)::([^\s]+)/);
    if (!header) continue;

    const file = header[1];
    const test = header[2];
    const errorLine =
      block
        .split("\n")
        .find((line) => line.includes("Error") || line.includes("AssertionError")) ??
      block.split("\n").slice(1, 4).join(" ").trim();

    failures.push({ test: `${file}::${test}`, file, error: errorLine || "test failed" });
  }

  if (failures.length === 0 && /ERROR|FAILED|ImportError|ModuleNotFoundError/.test(output)) {
    failures.push({
      test: "(collection/import)",
      error: output.split("\n").slice(-8).join("\n").trim(),
    });
  }

  return failures;
}

export function runTests(cwd: string): TestResult {
  const command = detectTestCommand(cwd);
  const result = spawnSync(command.cmd, command.args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const passed = result.status === 0;

  if (passed) {
    return {
      passed: true,
      summary: `${command.label}: all tests passed`,
      failures: [],
    };
  }

  const failures =
    command.label.includes("pytest")
      ? parsePytestOutput(output)
      : [
          {
            test: command.label,
            error: output.split("\n").slice(-12).join("\n").trim() || "tests failed",
          },
        ];

  return {
    passed: false,
    summary: `${command.label}: ${failures.length || "some"} failure(s)`,
    failures,
  };
}

/** Red-check semantics: failing tests = good (TDD red state). */
export function interpretRedCheck(testResult: TestResult): TestResult {
  if (!testResult.passed) {
    return {
      passed: true,
      summary: `Red state confirmed — ${testResult.failures.length} test(s) failing as expected`,
      failures: testResult.failures,
    };
  }

  return {
    passed: false,
    summary: "Tests passed unexpectedly — they may be too weak or implementation already exists",
    failures: [],
  };
}

export function formatFailures(failures: TestResult["failures"]): string {
  return failures.map((f) => `  - ${f.test}: ${f.error}`).join("\n");
}
