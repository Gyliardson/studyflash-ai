#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_GATES = (
    (
        ".github/workflows/e2e.yml",
        "browser",
        "browser-execution",
        "Public, auth and accessibility browser gates",
    ),
    (
        ".github/workflows/clean-room.yml",
        "clean-room",
        "clean-room-execution",
        "Fresh clone bootstrap and full deterministic matrix",
    ),
)


def policy_allows(event_name: str, head_repo: str, repository: str, execution_result: str) -> bool:
    if event_name == "pull_request" and head_repo != repository:
        return False
    return execution_result == "success"


def enforce(args: argparse.Namespace) -> int:
    if args.event_name == "pull_request" and args.head_repo != args.repository:
        print(
            "Fork pull requests are not eligible to satisfy trusted release gates; "
            "repository secrets remain withheld and promotion fails closed.",
            file=sys.stderr,
        )
        return 1
    if args.execution_result != "success":
        print(
            f"Mandatory trusted execution did not succeed: {args.execution_result!r}",
            file=sys.stderr,
        )
        return 1
    print("Required release gate has successful trusted execution evidence.")
    return 0


def self_test() -> int:
    repository = "Gyliardson/studyflash-ai"
    cases = [
        ("push", "", repository, "success", True, "push success"),
        ("pull_request", repository, repository, "success", True, "same-repository PR success"),
        ("pull_request", repository, repository, "failure", False, "same-repository PR failed execution"),
        ("pull_request", "someone/fork", repository, "skipped", False, "fork PR skipped trusted execution"),
        ("pull_request", "someone/fork", repository, "success", False, "fork PR cannot claim trusted success"),
    ]
    for event_name, head_repo, repo, result, expected, label in cases:
        actual = policy_allows(event_name, head_repo, repo, result)
        if actual != expected:
            raise SystemExit(f"policy self-test failed for {label}: expected {expected}, got {actual}")
    print("Required-gate policy self-test passed, including fork-shaped fail-closed cases.")
    return 0


def parse_jobs(text: str) -> dict[str, str]:
    jobs_match = re.search(r"(?ms)^jobs:\s*\n(?P<body>.*)$", text)
    if not jobs_match:
        raise SystemExit("workflow has no jobs block")
    body = jobs_match.group("body")
    matches = list(re.finditer(r"(?m)^  (?P<id>[A-Za-z0-9_-]+):\s*$", body))
    jobs: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        jobs[match.group("id")] = body[start:end]
    return jobs


def verify_workflows(repo_root: Path) -> int:
    same_repo_guard = "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository"
    for relative_path, required_id, execution_id, required_name in REQUIRED_GATES:
        path = repo_root / relative_path
        text = path.read_text(encoding="utf-8")
        jobs = parse_jobs(text)
        if required_id not in jobs:
            raise SystemExit(f"{relative_path}: required aggregator job {required_id!r} is missing")
        if execution_id not in jobs:
            raise SystemExit(f"{relative_path}: trusted execution job {execution_id!r} is missing")

        required = jobs[required_id]
        execution = jobs[execution_id]

        if f"name: {required_name}" not in required:
            raise SystemExit(f"{relative_path}: required context name moved away from aggregator {required_id}")
        if f"name: {required_name}" in execution:
            raise SystemExit(f"{relative_path}: required context name must not be attached to conditional execution job")
        if "if: always()" not in required:
            raise SystemExit(f"{relative_path}: required aggregator must use if: always()")
        if f"needs: {execution_id}" not in required:
            raise SystemExit(f"{relative_path}: required aggregator must depend on {execution_id}")
        if "required-gate-policy.py enforce" not in required:
            raise SystemExit(f"{relative_path}: required aggregator does not call fail-closed policy enforcement")
        if same_repo_guard not in execution:
            raise SystemExit(f"{relative_path}: trusted execution must keep the same-repository secret boundary")
        if "if: always()" in execution:
            raise SystemExit(f"{relative_path}: trusted secret-bearing execution must not be unconditional")

    print("Workflow governance proof passed: required contexts are unconditional aggregators over conditional trusted executions.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    enforce_parser = subparsers.add_parser("enforce")
    enforce_parser.add_argument("--event-name", required=True)
    enforce_parser.add_argument("--head-repo", default="")
    enforce_parser.add_argument("--repository", required=True)
    enforce_parser.add_argument("--execution-result", required=True)

    subparsers.add_parser("self-test")

    verify_parser = subparsers.add_parser("verify-workflows")
    verify_parser.add_argument("--repo-root", default=".")

    args = parser.parse_args()
    if args.command == "enforce":
        return enforce(args)
    if args.command == "self-test":
        return self_test()
    if args.command == "verify-workflows":
        return verify_workflows(Path(args.repo_root).resolve())
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main())
