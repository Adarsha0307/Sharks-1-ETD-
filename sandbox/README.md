# Isolated Test VM Runbook

Status: preparation VM installed; test VM and isolation verification pending

This runbook establishes the verification boundary required by `prd.md`. The
sandbox is for testing the detector with synthetic or authorized email, not for
malware detonation. Do not process fixtures until every phase-b gate is recorded
as PASS.

## 1. Host And Hypervisor

Use a maintained hypervisor that supports Ubuntu Server 24.04 LTS, powered-off
snapshots, complete virtual-NIC detachment, and disabled guest integration.
VirtualBox is the selected hypervisor on this Windows 11 Home host. Version
7.2.16 is installed and `VBoxManage list hostinfo` reports hardware
virtualization support. Docker Desktop 4.90.0 with WSL 2 was also verified
operational during host preparation, but it is not the outer test boundary.

Create two separate VMs:

- `etd-prepare`: connected only while downloading reviewed packages, browser
  binaries and images. It never processes email fixtures.
- `etd-test`: cloned from a clean preparation point, with every virtual NIC
  removed or marked disconnected before any fixture enters it.

Host-side helper scripts are available under `sandbox/virtualbox/`. Download and
verify the Ubuntu Server ISO first, create an inspected VM storage directory,
then run `create-vms.ps1` to create only `etd-prepare`. After preparation is
complete and that VM is powered off, `clone-test-vm.ps1` creates and hardens
`etd-test`. The scripts refuse to replace existing VMs and do not silently
delete unrelated VirtualBox resources.

Example host commands, from the repository root in PowerShell:

```powershell
New-Item -ItemType Directory -Path "E:\VirtualBox VMs"
.\sandbox\virtualbox\create-vms.ps1 -IsoPath "E:\ISO\ubuntu-24.04.4-live-server-amd64.iso"
```

The script verifies Canonical's published SHA-256 when that exact ISO filename
is supplied. Do not create `etd-test` until the preparation VM is complete and
powered off.

Allocate `etd-test` four vCPUs, 6 GiB RAM, a dynamically allocated 40 GiB disk,
and no virtual GPU acceleration. The inspected host has approximately 15.7 GiB
RAM, so do not allocate the provisional 8 GiB while normal host workloads run.

In the hypervisor settings, disable shared folders, bidirectional clipboard,
drag-and-drop, USB, webcam, audio, serial/parallel ports and host disk mappings.
Do not configure NAT forwarding, bridged, host-only, internal hypervisor, or
other virtual adapters on `etd-test`. Disable guest integration services not
needed for console display. Record screenshots or exported configuration while
the VM is powered off; an in-guest command cannot prove these settings.

## 2. Preparation VM

Install Ubuntu Server 24.04 LTS from a verified ISO and record its SHA-256.
Install a minimal graphical session plus a supported Chromium package only if
browser UI verification requires it. Install Docker Engine from reviewed,
version-pinned `.deb` packages for Ubuntu Noble; do not use the convenience
installation script. Record package versions with `dpkg-query`.

Obtain the source at the selected Git revision. Resolve and review the exact
npm/Python dependency locks. Build `etd-backend:local`, `etd-frontend:local`,
and `etd-ml:local` from source. Pull the pinned PostgreSQL image and record every
image ID and repository digest. Because `pull_policy: never` is set, a missing
cache will fail closed in the test VM. Cache Playwright's matching Chromium
binary and OS dependencies once browser tests are added. Cache reviewed model
training inputs and dependencies, but do not train or evaluate in this connected
VM. `prd.md`, `rules.md` and `testing.md` require training and evaluation after
isolation preflight in `etd-test`. Verify every fixture manifest hash.

Create an offline bundle containing only the Git source archive, reviewed
package caches/locks, saved OCI images, browser cache, model artifact/manifest,
and synthetic fixtures. Inspect the bundle before transfer. Never include a
real mailbox, production credentials, SSH agent, host home directory or Docker
socket.

Clone `etd-prepare` to `etd-test` while both are powered off, or attach a
temporary removable virtual disk containing the inspected bundle. Detach that
disk permanently before the isolation gate. A permanent shared folder is not
an acceptable transfer mechanism.

## 3. Test VM Isolation

Before boot, remove all `etd-test` virtual NICs and re-check every integration
setting listed above. Boot through the hypervisor console. Confirm only `lo`
exists under `/sys/class/net`; a disconnected but still-present adapter fails
the strict preflight until the host-side configuration is reconciled.

Docker bridge networks remain guest-local and do not require a VM NIC. The
Compose networks are all `internal: true`: `gateway` connects gateway to API,
`data` connects API/worker/migration to PostgreSQL, and `inference` connects the
worker to the private ML service.

Only `127.0.0.1:8080` is published in the guest. PostgreSQL, API and ML ports
are never published. Containers drop all capabilities, prohibit privilege
escalation, use read-only roots where compatible, use bounded tmpfs storage,
have CPU/RAM/PID/log limits, and do not mount devices or the Docker socket.
Docker remains defense in depth; the detached VM is the outer boundary.

Create `sandbox/secrets/db_password.txt` inside the guest with mode `0600` and
a random disposable value. Put the same disposable value in `sandbox/.env` as
`DB_PASSWORD` only because the application connection URL currently requires
it; both files remain ignored by Git and must contain no reused credential.
Provision analyst passwords through `ETD_PROVISION_PASSWORD` without command
line arguments or logs.

Create the named external volume `etd-model-artifacts` before preflight;
preflight fails closed if it is absent. It may be empty during the isolation
gate because `/health` does not claim model readiness. After preflight passes,
train/evaluate with cached inputs inside `etd-test`, review the result, and
install `model-manifest.json` plus its colocated artifact into this volume.
Restart the ML service and require `/ready` to pass before ML workflow tests.
The volume is retained by application-only reset and is replaced only through
the controlled model-install procedure.

## 4. Phase-B Preflight

Record a run ID and execute from the repository root in `etd-test`:

```text
bash sandbox/preflight.sh
```

The script fails if a non-loopback guest NIC exists, benign Internet/LAN probes
or public DNS unexpectedly work, Compose contains common prohibited settings,
publication is not loopback-only, cached startup fails, internal service calls
fail, or actual container settings lack declared restrictions. Additionally:

1. From the hypervisor host, inspect the powered-off and running VM configuration
   and sign `sandbox/hypervisor-checklist.md`.
2. Probe the host default gateway and one controlled LAN address from the guest;
   expected result is no route. Never probe an unrelated public target.
3. Check IPv6 routes, external DNS, and each container's effective networks.
4. Confirm `ss -lntup` shows no non-loopback detector listener.
5. Start with `--pull never --no-build` and inspect logs for remote requests.
6. Instrument browser requests during UI tests. Network failure alone does not
   prove that the UI avoided tracker requests.

Do not process even synthetic `.eml` fixtures if any isolation row fails.

## 5. Baseline And Reset

After preflight passes, stop Compose, clear disposable application data, power
off the VM, and create immutable snapshot `etd-test-baseline-<UTC>-<commit>`.
Record the snapshot UUID, source revision, guest version, image IDs,
model/dataset versions and preflight report together. Snapshots are reset points,
not independent backups.

For an application-only reset, inspect the project name and run:

```text
bash sandbox/reset.sh --confirm-etd-lab-reset
```

This removes only resources in the named `etd-lab` Compose project and does not
run a global prune. For a destabilizing campaign, power off the VM and restore
the exact baseline snapshot through the host hypervisor. Verify a pre-created
disposable marker and campaign data are absent, then rerun preflight.

## 6. Controlled Export

Stop processing before export. Generate JSON only through the authorized API,
inspect it in the guest for raw bodies, secrets, active HTML, unintended URLs
and attachments, and copy only an approved sanitized report onto a temporary
offline virtual disk. Power off before attaching or detaching transfer media.
Never establish a permanent host share. Record report hash, reviewer, run ID
and transfer time.

## Current State

Host virtualization prerequisites are present, and the Ubuntu 24.04.4
`etd-prepare` VM is registered and running with its installation medium ejected.
The user reports successful console login as `adarsha`, hostname `etd-prepare`,
and approximately 30 GiB free on `/`; these guest facts have not been observed
through an automated guest channel. The only confirmed access mechanism is the
VirtualBox GUI console. Project transfer and dependency preparation are not
confirmed. `etd-test`, isolation preflight, application tests, model training,
fixture processing and browser automation remain NOT RUN.
