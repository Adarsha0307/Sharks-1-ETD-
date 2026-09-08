#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="${1:-sandbox/reports/runtime}"
RUN_ID="${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
REPORT="${REPORT_DIR}/${RUN_ID}-preflight.txt"
mkdir -p "${REPORT_DIR}"
exec > >(tee "${REPORT}") 2>&1

echo "run_id=${RUN_ID}"
echo "timestamp=$(date -u +%FT%TZ)"
echo "source_revision=$(git rev-parse HEAD)"
echo "os=$(source /etc/os-release && printf '%s %s' "$NAME" "$VERSION_ID")"
echo "kernel=$(uname -srmo)"
docker version
docker compose version

mapfile -t active_nics < <(find /sys/class/net -mindepth 1 -maxdepth 1 -printf '%f\n' | grep -v '^lo$' || true)
if ((${#active_nics[@]} != 0)); then
  echo "FAIL: non-loopback guest NICs exist: ${active_nics[*]}"
  exit 1
fi

for target in "https://example.com" "http://192.0.2.1"; do
  if curl --silent --show-error --max-time 3 "$target" >/dev/null 2>&1; then
    echo "FAIL: external connectivity succeeded: $target"
    exit 1
  fi
done
if getent ahosts example.com >/dev/null 2>&1; then
  echo "FAIL: external DNS unexpectedly resolved"
  exit 1
fi

docker compose -f sandbox/compose.yaml config --quiet
if docker compose -f sandbox/compose.yaml config | grep -Eq 'privileged: true|network_mode: host|/var/run/docker.sock'; then
  echo "FAIL: prohibited Compose configuration found"
  exit 1
fi
if docker compose -f sandbox/compose.yaml config | grep -Eq '0\.0\.0\.0:|:::8080'; then
  echo "FAIL: non-loopback published port found"
  exit 1
fi

if ! docker volume inspect etd-model-artifacts >/dev/null 2>&1; then
  echo "FAIL: external approved-model volume etd-model-artifacts is not installed"
  exit 1
fi

docker compose -f sandbox/compose.yaml up -d --pull never --no-build
docker compose -f sandbox/compose.yaml ps
curl --fail --silent --max-time 5 http://127.0.0.1:8080/health
docker compose -f sandbox/compose.yaml exec -T api node -e "fetch('http://gateway:8080').then(r=>{if(!r.ok)process.exit(1)})"
docker compose -f sandbox/compose.yaml exec -T worker node -e "fetch('http://ml:8000/health').then(r=>{if(!r.ok)process.exit(1)})"

for id in $(docker compose -f sandbox/compose.yaml ps -q); do
  record=$(docker inspect --format '{{.Name}} user={{.Config.User}} privileged={{.HostConfig.Privileged}} readonly={{.HostConfig.ReadonlyRootfs}} pids={{.HostConfig.PidsLimit}} memory={{.HostConfig.Memory}} network={{.HostConfig.NetworkMode}} security={{json .HostConfig.SecurityOpt}} caps={{json .HostConfig.CapDrop}}' "$id")
  echo "$record"
  if grep -Eq 'user=($|root)|privileged=true|readonly=false|pids=(0|-1)|memory=0' <<<"$record"; then
    echo "FAIL: effective container restrictions are incomplete"
    exit 1
  fi
done

echo "PASS: guest-visible NIC, connectivity, Compose, container, internal-service, and loopback checks completed"
echo "NOTE: host-side hypervisor settings require the separate signed inspection checklist."
