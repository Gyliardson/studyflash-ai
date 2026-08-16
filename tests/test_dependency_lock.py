from __future__ import annotations

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIRECT_INPUT = ROOT / "requirements.in"
LOCK = ROOT / "requirements.txt"
EXACT_REQUIREMENT = re.compile(r"^[A-Za-z0-9_.-]+==[^\s]+$")


def _requirement_lines(path: Path) -> list[str]:
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def _name(requirement: str) -> str:
    return re.split(r"==|[<>=!~]", requirement, maxsplit=1)[0].lower().replace("_", "-")


class BackendDependencyLockTests(unittest.TestCase):
    def test_release_lock_contains_only_exact_version_requirements(self) -> None:
        locked = _requirement_lines(LOCK)
        self.assertTrue(locked, "requirements.txt must contain the resolved backend lock")
        invalid = [requirement for requirement in locked if not EXACT_REQUIREMENT.fullmatch(requirement)]
        self.assertEqual([], invalid, f"Unpinned backend lock entries: {invalid}")

    def test_every_direct_dependency_is_present_in_release_lock(self) -> None:
        direct_names = {_name(requirement) for requirement in _requirement_lines(DIRECT_INPUT)}
        locked_names = {_name(requirement) for requirement in _requirement_lines(LOCK)}
        self.assertTrue(direct_names, "requirements.in must document direct backend dependencies")
        self.assertEqual(set(), direct_names - locked_names)


if __name__ == "__main__":
    unittest.main()
