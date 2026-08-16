#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REQUIRED_GATES = (
    (".github/workflows/e2e.yml", "browser", "browser-execution", "Public, auth and accessibility browser gates"),
    (".github/workflows/clean-room.yml", "clean-room", "clean-room-execution", "Fresh clone bootstrap and full deterministic matrix"),
)

POLICY_CASES = (
    ("push", "", "Gyliardson/studyflash-ai", "success", True),
    ("pull_request", "Gyliardson/studyflash-ai", "Gyliardson/studyflash-ai", "success", True),
    ("pull_request", "Gyliardson/studyflash-ai", "Gyliardson/studyflash-ai", "failure", False),
    ("pull_request", "Gyliardson/studyflash-ai", "Gyliardson/studyflash-ai", "skipped", False),
    ("pull_request", "Gyliardson/studyflash-ai", "Gyliardson/studyflash-ai", "neutral", False),
    ("pull_request", "Gyliardson/studyflash-ai", "Gyliardson/studyflash-ai", "cancelled", False),
    ("pull_request", "someone/fork", "Gyliardson/studyflash-ai", "success", False),
    ("pull_request", "someone/fork", "Gyliardson/studyflash-ai", "skipped", False),
)


def policy_allows(event_name: str, head_repo: str, repository: str, execution_result: str) -> bool:
    if event_name == "pull_request" and head_repo != repository:
        return False
    return execution_result == "success"


def evaluate(event_name: str, head_repo: str, repository: str, execution_result: str) -> int:
    if policy_allows(event_name, head_repo, repository, execution_result):
        print("Required release gate is backed by successful trusted execution evidence.")
        return 0
    if event_name == "pull_request" and head_repo != repository:
        print(
            "Fork pull requests are not eligible to satisfy trusted release gates; secrets remain withheld and promotion fails closed.",
            file=sys.stderr,
        )
    else:
        print(
            f"Mandatory trusted execution did not succeed: {execution_result}",
            file=sys.stderr,
        )
    return 1


def run_policy_script(
    policy_script: Path,
    event_name: str,
    head_repo: str,
    repository: str,
    execution_result: str,
) -> bool:
    completed = subprocess.run(
        [
            sys.executable,
            str(policy_script),
            "evaluate",
            "--event-name",
            event_name,
            "--head-repo",
            head_repo,
            "--repository",
            repository,
            "--execution-result",
            execution_result,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    return completed.returncode == 0


def self_test(policy_script: Path) -> int:
    for event_name, head_repo, repository, result, expected in POLICY_CASES:
        actual = run_policy_script(policy_script, event_name, head_repo, repository, result)
        if actual != expected:
            raise SystemExit(
                f"policy executable self-test failed: {(event_name, head_repo, result)} expected {expected}, got {actual}"
            )
    print("Required-gate executable policy self-test passed for success/failure/skipped/neutral/cancelled and fork cases.")
    return 0


def mutation_test(policy_script: Path) -> int:
    original = policy_script.read_text(encoding="utf-8")
    mutations = (
        (
            "accept skipped/neutral trusted execution",
            'return execution_result == "success"',
            'return execution_result in {"success", "skipped", "neutral"}',
        ),
        (
            "disable fork rejection",
            'if event_name == "pull_request" and head_repo != repository:',
            'if event_name == "pull_request" and head_repo != repository and False:',
        ),
    )

    with tempfile.TemporaryDirectory(prefix="studyflash-required-gate-") as temp_dir:
        for index, (label, needle, replacement) in enumerate(mutations):
            if needle not in original:
                raise SystemExit(f"mutation target missing for {label}")
            mutant = Path(temp_dir) / f"required-gate-policy-mutant-{index}.py"
            mutant.write_text(original.replace(needle, replacement, 1), encoding="utf-8")
            completed = subprocess.run(
                [sys.executable, str(mutant), "self-test", "--policy-script", str(mutant)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            if completed.returncode == 0:
                raise SystemExit(f"mutation proof failed: vulnerable mutant passed self-test: {label}")
            print(f"Mutation rejected as expected: {label}")

    print("Required-gate mutation proof passed: semantic bypass regressions make the governance proof red.")
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
    policy_invocation = "python3 .github/scripts/required-gate-policy.py evaluate"
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
        if "STUDYFLASH_REQUIRED_GATE_POLICY_V2" not in required:
            raise SystemExit(f"{relative_path}: required aggregator lost shared executable policy marker")
        if policy_invocation not in required:
            raise SystemExit(f"{relative_path}: required aggregator does not execute the shared production policy")
        if "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09" not in required:
            raise SystemExit(f"{relative_path}: required aggregator must check out the policy implementation with pinned checkout")
        if not has_job_level_line(execution, same_repo_guard):
            raise SystemExit(f"{relative_path}: trusted execution lost same-repository job-level secret boundary")
        if has_job_level_line(execution, "if: always()"):
            raise SystemExit(f"{relative_path}: trusted secret-bearing execution became unconditional")
    print("Workflow governance proof passed: required contexts execute the shared fail-closed policy and trusted jobs preserve secret isolation.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    evaluate_parser = subparsers.add_parser("evaluate")
    evaluate_parser.add_argument("--event-name", required=True)
    evaluate_parser.add_argument("--head-repo", default="")
    evaluate_parser.add_argument("--repository", required=True)
    evaluate_parser.add_argument("--execution-result", required=True)

    self_test_parser = subparsers.add_parser("self-test")
    self_test_parser.add_argument("--policy-script", default=str(Path(__file__).resolve()))

    mutation_parser = subparsers.add_parser("mutation-test")
    mutation_parser.add_argument("--policy-script", default=str(Path(__file__).resolve()))

    verify = subparsers.add_parser("verify-workflows")
    verify.add_argument("--repo-root", default=".")

    args = parser.parse_args()
    if args.command == "evaluate":
        return evaluate(args.event_name, args.head_repo, args.repository, args.execution_result)
    if args.command == "self-test":
        return self_test(Path(args.policy_script).resolve())
    if args.command == "mutation-test":
        return mutation_test(Path(args.policy_script).resolve())
    return verify_workflows(Path(args.repo_root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
