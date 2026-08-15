#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --repo <path> --report <path> [--config <path>]" >&2
  exit 2
}

repo=""
report=""
config=""

while (($#)); do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || usage
      repo="$2"
      shift 2
      ;;
    --report)
      [[ $# -ge 2 ]] || usage
      report="$2"
      shift 2
      ;;
    --config)
      [[ $# -ge 2 ]] || usage
      config="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

[[ -n "$repo" && -n "$report" ]] || usage
[[ -n "${GITLEAKS_BIN:-}" && -x "$GITLEAKS_BIN" ]] || {
  echo "GITLEAKS_BIN must point to an executable pinned Gitleaks binary." >&2
  exit 2
}

repo="$(cd "$repo" && pwd)"
mkdir -p "$(dirname "$report")"
report="$(cd "$(dirname "$report")" && pwd)/$(basename "$report")"

cd "$repo"

if [[ "$(git rev-parse --is-inside-work-tree)" != "true" ]]; then
  echo "Secret scan target is not a git working tree: $repo" >&2
  exit 2
fi

if [[ "$(git rev-parse --is-shallow-repository)" != "false" ]]; then
  echo "Secret Scan requires a non-shallow repository." >&2
  exit 2
fi

commit_count="$(git rev-list --count HEAD)"
if (( commit_count < 2 )); then
  echo "Secret Scan expected reachable history, found only ${commit_count} commit(s)." >&2
  exit 2
fi

echo "Shared history scanner: ${commit_count} commits reachable from HEAD"

args=(
  git
  --log-opts=HEAD
  --redact
  --report-format json
  --report-path "$report"
)

if [[ -n "$config" ]]; then
  config="$(cd "$(dirname "$config")" && pwd)/$(basename "$config")"
  args+=(--config "$config")
fi

args+=(.)

"$GITLEAKS_BIN" "${args[@]}"
