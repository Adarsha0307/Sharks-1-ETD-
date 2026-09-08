#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--confirm-etd-lab-reset" ]]; then
  echo "Refusing reset. Re-run with --confirm-etd-lab-reset after verifying the Compose project is etd-lab." >&2
  exit 2
fi

project=$(docker compose -f sandbox/compose.yaml config --format json | grep -o '"name":"[^"]*"' | head -n1 || true)
if [[ "$project" != '"name":"etd-lab"' ]]; then
  echo "Refusing reset: Compose project identity was not etd-lab." >&2
  exit 1
fi

docker compose -f sandbox/compose.yaml down --volumes --remove-orphans
echo "Removed only Compose-managed etd-lab resources. The external approved-model volume is retained; restore the approved powered-off VM snapshot for a complete baseline reset."
