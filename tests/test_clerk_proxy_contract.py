from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROXY_PATH = ROOT / "frontend" / "proxy.ts"
LAYOUT_PATH = ROOT / "frontend" / "app" / "layout.tsx"
SIGN_IN_PAGE = ROOT / "frontend" / "app" / "sign-in" / "[[...sign-in]]" / "page.tsx"
SIGN_UP_PAGE = ROOT / "frontend" / "app" / "sign-up" / "[[...sign-up]]" / "page.tsx"


def test_clerk_frontend_api_routes_are_always_matched() -> None:
    source = PROXY_PATH.read_text(encoding="utf-8")

    assert "'/__clerk/(.*)'" in source or '"/__clerk/(.*)"' in source


def test_clerk_middleware_redirects_to_local_auth_routes() -> None:
    source = PROXY_PATH.read_text(encoding="utf-8")

    assert 'signInUrl: "/sign-in"' in source
    assert 'signUpUrl: "/sign-up"' in source


def test_clerk_provider_uses_local_auth_routes() -> None:
    source = LAYOUT_PATH.read_text(encoding="utf-8")

    assert 'signInUrl="/sign-in"' in source
    assert 'signUpUrl="/sign-up"' in source


def test_local_clerk_auth_pages_exist() -> None:
    sign_in = SIGN_IN_PAGE.read_text(encoding="utf-8")
    sign_up = SIGN_UP_PAGE.read_text(encoding="utf-8")

    assert 'import { SignIn } from "@clerk/nextjs"' in sign_in
    assert "<SignIn />" in sign_in
    assert 'import { SignUp } from "@clerk/nextjs"' in sign_up
    assert "<SignUp />" in sign_up
