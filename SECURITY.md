# Security Policy

## Reporting a vulnerability

If you believe you found a security vulnerability in StudyFlash, please report it privately to the repository maintainer rather than opening a public issue with exploit details, credentials, personal data or reproducible attack payloads.

Use the maintainer's public GitHub profile/contact channels to establish a private reporting channel. Include the affected component, impact, reproduction conditions and any evidence needed to validate the issue, while minimizing exposure of sensitive data.

## Scope

Security reports are particularly useful for authentication/session handling, authorization and cross-user isolation, server-only secrets, the Next.js → FastAPI trust boundary, AI/PDF input handling, PostgreSQL data integrity, PWA cache behavior and dependency/supply-chain risk.

Do not test against real user data, production credentials or third-party accounts without explicit authorization. Use synthetic data and development environments whenever possible.

## Disclosure

Please allow reasonable time for triage and remediation before public disclosure. Repository visibility does not imply that a reported issue is accepted, fixed or release-certified; validated findings are tracked and remediated according to project severity and release gates.
