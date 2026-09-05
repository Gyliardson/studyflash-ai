from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROXY_PATH = ROOT / "frontend" / "proxy.ts"


def test_clerk_frontend_api_routes_are_always_matched() -> None:
    source = PROXY_PATH.read_text(encoding="utf-8")

    assert "'/__clerk/(.*)'" in source or '"/__clerk/(.*)"' in source
