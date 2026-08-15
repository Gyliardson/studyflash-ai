#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path

REQUIRED_GATES = (
    (".github/workflows/e2e.yml", "browser", "browser-execution", "Public, auth and accessibility browser gates"),
    (".github/workflows/clean-room.yml", "clean-room", "clean-room-execution", "Fresh clone bootstrap and full deterministic matrix"),
)


def policy_allows(event_name: str, head_repo: str, repository: str, execution_result: str) -> bool:
    if event_name == "pull_request" and head_repo != repository:
        return False
    return execution_result == "success"


def self_test() -> int:
    repository = "Gyliardson/studyflash-ai"
    cases = [
        ("push", "", repository, "success", True),
        ("pull_request", repository, repository, "success", True),
        ("pull_request", repository, repository, "failure", False),
        ("pull_request", "someone/fork", repository, "skipped", False),
        ("pull_request", "someone/fork", repository, "success", False),
    ]
    for event_name, head_repo, repo, result, expected in cases:
        actual = policy_allows(event_name, head_repo, repo, result)
        if actual != expected:
            raise SystemExit(f"policy self-test failed: {(event_name, head_repo, result)} expected {expected}, got {actual}")
    print("Required-gate policy self-test passed, including fork-shaped fail-closed cases.")
    return 0


def parse_jobs(text: str) -> dict[str, str]:
    match = re.search(r"(?ms)^jobs:\s*\n(?P<body>.*)$", text)
    if not match:
        raise SystemExit("workflow has no jobs block")
    body = match.group("body")
    starts = list(re.finditer(r"(?m)^  (?P<id>[A-Za-z0-9_-]+):\s*$", body))
    jobs: dict[str, str] = {}
    for i, start in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(body)
        jobs[start.group("id")] = body[start.end():end]
    return jobs


def has_job_level_line(job: str, value: str) -> bool:
    return re.search(rf"(?m)^    {re.escape(value)}\s*$", job) is not None


def verify_workflows(repo_root: Path) -> int:
    same_repo_guard = "if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository"
    for relative_path, required_id, execution_id, required_name in REQUIRED_GATES:
        jobs = parse_jobs((repo_root / relative_path).read_text(encoding="utf-8"))
        required = jobs.get(required_id, "")
        execution = jobs.get(execution_id, "")
        if f"name: {required_name}" not in required:
            raise SystemExit(f"{relative_path}: required context name is not on aggregator {required_id}")
        if f"name: {required_name}" in execution:
            raise SystemExit(f"{relative_path}: required context name is attached to conditional execution")
        if not has_job_level_line(required, "if: always()"):
            raise SystemExit(f"{relative_path}: required aggregator must use job-level if: always()")
        if not has_job_level_line(required, f"needs: {execution_id}"):
            raise SystemExit(f"{relative_path}: required aggregator must depend on {execution_id}")
        if "STUDYFLASH_REQUIRED_GATE_POLICY_V1" not in required:
            raise SystemExit(f"{relative_path}: required aggregator lost fail-closed policy marker")
        if 'EXECUTION_RESULT" != "success"' not in required:
            raise SystemExit(f"{relative_path}: required aggregator does not require successful trusted execution")
        if 'HEAD_REPO" != "$REPOSITORY"' not in required:
            raise SystemExit(f"{relative_path}: required aggregator does not reject fork-shaped pull requests")
        if not has_job_level_line(execution, same_repo_guard):
            raise SystemExit(f"{relative_path}: trusted execution lost same-repository job-level secret boundary")
        if has_job_level_line(execution, "if: always()"):
            raise SystemExit(f"{relative_path}: trusted secret-bearing execution became unconditional")
    print("Workflow governance proof passed: required contexts are unconditional fail-closed aggregators.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("self-test")
    verify = subparsers.add_parser("verify-workflows")
    verify.add_argument("--repo-root", default=".")
    args = parser.parse_args()
    if args.command == "self-test":
        return self_test()
    return verify_workflows(Path(args.repo_root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
