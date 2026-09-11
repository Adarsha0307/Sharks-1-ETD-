# Testing-Agent Verification Ledger — Email Threat Detector

Status: **SUPERSEDED IN PART by 11 September host/user observations**;
application execution remains blocked because the disconnected test VM is absent.
Date: 10 September 2026 (UTC). Agent role: testing / debugging / verification.

## 1. Revision And Working-Tree State

- Revision inspected: `e1aeae24156cd58136f469fb79baaa03125b7d8f` (`main`, HEAD == `origin/main`).
- Uncommitted modifications (preserved, not altered): `decisions.md`, `docs/phase-status.md`, `memory.md`, `sandbox/README.md`, `sandbox/reports/phase-status.md`.
- Untracked (preserved): `sandbox/virtualbox/` (fail-closed VM helper scripts).
- No `package-lock.json` exists anywhere in the tracked tree (F-01).

## 2. Environment Record

| Item | Value |
| --- | --- |
| Host | Windows 11 Home (Dell G15 5530, i7-13650HX, 14 cores / 20 threads) |
| Git | `e1aeae2`, branch `main` |
| Node (host) | v24.14.0 / npm 11.9.0 — host is NOT the mandated runtime (guest: Node 22.19.x per setup.md) |
| Python (host) | 3.14.3 — guest: Python 3.12 (`python:3.12.10-slim-bookworm`) |
| Docker (host) | CLI 29.7.2; engine daemon NOT running on host; not the test boundary |
| VirtualBox | At inspection time: 7.2.16r174877, HW virtualization `yes`, no VMs registered. Superseded 11 Sep: `etd-prepare` registered/running. |
| VM storage | `E:\ISO`, `E:\VirtualBox VMs` created (E: free ≈ 305 GiB) |
| Host network | Outbound HTTPS works (releases.ubuntu.com HTTP 200) |

At the time of this agent check, guest VMs were reported as not installed and
the ISO was in progress. Subsequent 11 September handover and direct host
inspection supersede this row: the ISO is verified, `etd-prepare` is registered
and running, and the user reports Ubuntu installation/login complete.

## 3. Checks Executed On The Host (permitted by runbook / testing.md)

| # | Check | Result |
| --- | --- | --- |
| H-01 | Revision / branch / working tree (`git log/status/rev-parse`) | PASS |
| H-02 | Repository inventory (backend, frontend, ml, api-spec, tests, fixtures, sandbox, docs) | PASS |
| H-03 | VirtualBox version + registerability (`VBoxManage --version`, `list vms`, `list hostinfo`) | PASS at inspection time — 7.2.16r174877, HW virt `yes`, no VMs; superseded 11 Sep by registered `etd-prepare` |
| H-06 | Docker daemon on host (`docker info`) | FAIL on host (expected; host not the test boundary) |
| H-07 | Lockfile presence (tracked + filesystem) | **FAIL — none present (F-01)** |
| H-08 | mailauth 4.8.2 subpath exports (npm registry metadata + tarball) | PASS — `lib/dkim/verify.js` exports `dkimVerify`; `lib/spf/index.js` exports `spf` |
| H-09 | mailauth API shapes vs `analyze.ts` adapter | PASS — signatures and result shapes match |
| H-10 | Pinned image tags exist (Docker Hub API) | PASS — digests below |
| H-11 | Ubuntu ISO canonical hash vs embedded `create-vms.ps1` value | PASS — `e907d92e…` matches |
| H-12 | Ubuntu ISO download | PASS — resumed with `curl -C -`; complete file (3405469696 bytes); SHA-256 `e907d92e…` matches Canonical |
| H-13 | Static review of all source (backend/frontend/ml/tests/sandbox) | PASS — defects in §5 |

### H-10 image digests (amd64)

- `postgres:16.9-bookworm` → `sha256:ef463f9f754e6d381d27513b032ace3607532c752427423d344e9fbfd852257a`
- `node:22.19.0-bookworm-slim` → `sha256:cff78eb5aa1cf27dc2b6aeea9d31366415a43e9a9ea0ddec00d780b2b66fad0f`
- `nginxinc/nginx-unprivileged:1.27.5-alpine` → `sha256:28d91bdce70ad09025ea901458fdd149259d8e05982ade79d4ef2c0d9470eb48`
- `python:3.12.10-slim-bookworm` → `sha256:97983fa8cc88343512862c62307159a82261c3528dc025f79e5a3f7af43e50b4`

## 4. Static Inspection Results By Task Area

### 4A Build and configuration
- zod config bounds: upload ≤10 MB (default 10), decoded ≤100 MB (default 25), attachments ≤100 (25), URLs ≤1000 (200), depth ≤50 (20); lease 10–900 s, attempts ≤10, parse timeout 1–120 s. PRD provisional limits enforced.
- Compose: 3 internal networks, loopback-only publication, `pull_policy: never`, `cap_drop: [ALL]`, no-new-privileges, read-only roots, tmpfs scratch, pids/mem/CPU limits, scoped reset; consistent with `preflight.sh`.
- **BLOCKER F-01**: no root `package-lock.json` ⇒ `npm ci` in both Dockerfiles fails; must be produced in the connected preparation VM.
- No lint script exists (only typecheck/build/test). `docker compose` execution NOT RUN (requires guest engine + cached images).

### 4B Existing automated tests (source inspection)
- Backend Vitest units: config, password, tokens, upload (path containment only), headers, links, rules, scoring, analyze (1 test), jobs (mocked SQL), analyses (smoke).
- Frontend: `defangUrl` only (no component tests). Python: 2 `model_store` tests.
- `tests/schema/openapi.test.ts`: structure + live `/health`,`/ready` only ⇒ **C01 gap (F-07)**.
- `tests/e2e/workflow.spec.ts`: external-request instrumentation + full UI flow; requires creds + stack.
- `tests/resilience/`: manual procedures only. **Nothing executed** (prohibited on host).

### 4C Database and worker integration (static)
- Atomic claim via `FOR UPDATE SKIP LOCKED`; fencing on `lease_token` + `status='processing'` in renew/complete/fail; `persistAnalysis` re-validates token in-transaction.
- Version: `pg_advisory_xact_lock(email)` + `UNIQUE(email_id, version)`.
- Deletion source path removes the file before committing database soft-delete
  and job cancellation updates; the worker re-checks `deleted_at` and fencing.
  Atomicity and crash behavior are unverified and covered only by the plans
  below.
- NOT RUN / gaps: no real-PG concurrency test (jobs.test.ts is mocked); migration repeat behavior untested; no worker-interruption harness.
- **Deletion failure/crash test plan (DEL-01…DEL-04)** — filesystem deletion is NOT rolled back by a PostgreSQL transaction (`routes/emails.ts:126-138` removes the file before the DB updates, then COMMITs; `architecture.md` "Data Flow" requires a reconciliation procedure):
  - DEL-01: force `rm` failure (read-only/removed evidence dir) → API 500 `evidence_delete_failed`, transaction rolled back, email still `ready`, file still present.
  - DEL-02: file removed OK, inject a DB failure before COMMIT → transaction rolls back (email still `ready`) but the file is already gone; assert a subsequent worker claim does NOT recreate, terminates with `evidence_integrity_failed`/`evidence_unavailable`, and reconciliation marks the orphaned evidence.
  - DEL-03: kill the process mid-deletion (between `rm` and COMMIT) → on restart the DB references a missing file; assert no analysis is created, no duplicate final record, and reconciliation handles the orphan.
  - DEL-04: delete while a worker holds a lease → email cancelled, file removed, job set `cancelled`; stale-worker finalization must fail fencing (`persistAnalysis` re-validates `lease_token` + `deleted_at`); assert final analyses count is unchanged.

### 4D One complete browser workflow (static)
- Login → upload → job polling → analysis → history → export → logout; reload recovery via `sessionStorage.etd.pendingJob`; 401/failed/cancelled handling present; export is CSRF-protected POST with redacted, defanged payload.
- NOT RUN: no browser or running stack.

### 4E Security and evidence handling (static)
- Owner-scoped queries everywhere; UUID validation; non-owner ⇒ 404/403; duplicate detection owner-scoped (no cross-user leak).
- Sessions: hashed server-side tokens, scrypt, expiry, revocation, `HttpOnly` + `SameSite=strict`, double-submit CSRF, origin + `Sec-Fetch-Site` enforcement on non-GET.
- Upload: busboy limits, sanitized filename, generated paths with containment check, staged-then-renamed with DB reconciliation, cleanup on failure, 10 MB cap.
- Parsing bounds: decoded bytes, attachment count, URL count, MIME depth heuristic, 256 KB header cap — fail closed with stable codes.
- Evidence: SHA-256 at upload and re-measured by worker before analysis; mismatch ⇒ `evidence_integrity_failed`.
- Rendering: React text escaping, no dangerouslySetInnerHTML, defanged URLs, helmet + nginx CSP (no unsafe-inline scripts, frame-ancestors none).
- Export redaction: textBody/htmlText/headers/recipients removed, links defanged, findings/indicators/scores retained.
- No code path executes attachments, unpacks archives, or fetches URLs.
- **Gap F-02**: parse timeout races but does not abort the in-flight parse stream (R03).
- No automated A01–A04/R03/R04 tests exist.

### 4F Detection / authentication / scoring (static)
- Versioned deterministic rules (`2026.09.1`), evidence-referenced, sorted; benign/fixture expectations in manifest match config defaults.
- Auth: uploaded `Authentication-Results` => `untrusted_reported_result`; DKIM
  only via injected offline DNS (`fixtures/dns.json` empty => all lookups yield
  no record); SPF requires explicit fixture SMTP context. The current source
  does not claim a DMARC pass without evaluating policy: verified From-aligned
  DKIM/SPF is reported as fixture-scoped alignment evidence while DMARC remains
  `unverifiable`. This source change has not been runtime-tested.
- Scoring: category caps (25/30/40/30), separate ML output, contradictory evidence notice, null score when no evidence.
- Note (by design): ordinary uploads ⇒ SPF+DMARC `unverifiable` ⇒ `completeness: partial` ⇒ job `partial` — a normal terminal state; e2e asserts on visible risk index, consistent with this.
- Unverified: real DKIM/SPF behavior; band calibration quality.

### 4G ML behavior (static)
- Missing/corrupt/unapproved artifact ⇒ fail closed (`ModelUnavailable` → 503 → explicit `error`/`unavailable` status); backend validates manifest hash + service response.
- Unsupported language ⇒ `unsupported_language` before any call.
- **Training location (policy correction):** this report originally interpreted
  setup/runbook text as allowing training in `etd-prepare`. That conflicts with
  the explicit, stricter requirements in `prd.md` section 8, `rules.md` Sandbox
  rule 1 and `testing.md` section 1. Dependencies/data may be cached in
  `etd-prepare`, but model training and evaluation run only after preflight in
  disconnected `etd-test`. `docs/setup.md` and `sandbox/README.md` now reflect
  that precedence.
- `train.py`: fixed splits, split-overlap rejection, train-only fitting, validation C selection, held-out metrics, artifact manifest with SHA-256.
- NOT RUN: no artifact (`ml/artifacts/.gitkeep` only); corpus synthetic, not accuracy evidence; no evaluation numbers.

### 4H Final regression / handoff (static)
- `reset.sh` scoped to `etd-lab`; `preflight.sh` covers NICs, connectivity, Compose restrictions, model volume, internal calls, container restrictions.
- `hypervisor-checklist.md` NOT RUN. A preparation guest now exists, but no
  disconnected test guest or isolation evidence exists. S01–S04/D01–D10/
  A01–A04/R01–R04/U01/C01 still have no execution evidence.

## 5. Defect / Gap Registry

| ID | Sev | Evidence (file:line) | Description | Recommended fix | Regression test |
| --- | --- | --- | --- | --- | --- |
| F-01 | BLOCKER | `backend/Dockerfile:3,6,16`; `frontend/Dockerfile:3,6` | No `package-lock.json` ⇒ `npm ci` fails | In `etd-prepare`, `npm install --package-lock-only` + `npm ci`, review locks, commit | Image builds succeed; fresh VM `npm ci` succeeds |
| F-02 | HIGH (suspected) | `backend/src/worker.ts:217-229` | `withTimeout` races but does not terminate the in-flight `parseEmailFile` stream (R03: "a timeout response alone does not prove parsing was terminated") | Cooperative cancellation (destroy parser + read stream) or hard-kill subprocess; record fd/thread/mem baseline | Oversized-MIME fixture → assert `parse_timeout`; then assert process fds/threads/memory/CPU return to baseline; then enqueue a fresh benign fixture and assert it reaches a terminal analysis (proves termination, cleanup, continued operation) |
| F-03 | SUSPECTED | `ml/train.py:81-101`; `ml/Dockerfile` | Possible joblib dump/load version drift breaks `joblib.load` | Establishing condition: compare resolved `joblib`/`scikit-learn` versions in the prepared Python lockfile vs the ML runtime image; only then fix (pin identical versions) | Train → hash → load succeeds |
| F-04 | SUSPECTED | `frontend/src/components/AnalysisView.tsx:123`; `frontend/nginx.conf` | Possible inline `style` blocked by CSP `style-src 'self'` | Establishing condition: run the real served page in the isolated browser and check the finding border renders and console CSP violations; only then fix (CSS classes) | Browser check: severity-colored left border renders |
| F-05 | LOW | `001_initial.sql` | No retention/cleanup for expired sessions / audit rows | Optional purge or documented policy | Purge keeps live sessions |
| F-06 | LOW | `backend/src/routes/emails.ts:44-60` | Cursor pagination ties on equal `created_at` can skip/duplicate | Stable secondary sort key | Boundary test with equal timestamps |
| F-07 | MED | `tests/schema/openapi.test.ts:13-23` | Live schema validation covers only `/health`,`/ready` | Extend AJV to all routes | C01 passes on live stack |
| F-08 | NOT A DEFECT (resolved) | `backend/src/parsing/email.ts:144` | `bodyTruncated` always `false` | Confirmed consistent: oversize decoded content triggers `parser.destroy` → AppError 413 (fail-fast), so a truncated body is never produced; `bodyTruncated=false` always holds. Optional: remove dead field from contract | NA / docs cleanup |
| F-09 | NOT RUN | `fixtures/dns.json:1` (empty) | No signed-DKIM fixture, DNS records, or SMTP-context fixture | Add inert signed fixtures + records per D05 | D05 states incl. modified-body |
| F-10 | NOT RUN | `tests/resilience/README.md` | Lease expiry + second worker + stale-finalization + delete races only documented | Real-PG two-worker harness with short leases | R02/R04 single final analysis |
| F-11 | PLANNED | `routes/emails.ts:126-138` | No automated coverage of FS-delete-then-DB-fail rollback reconciliation (FS+DB non-atomic; `architecture.md` requires reconciliation) | Add DEL-01…DEL-04 harness in the isolated VM | R04 rows pass |

## 6. Mandatory Matrix Status

All rows require the isolated Linux VM ⇒ **NOT RUN (BLOCKED)**. Static support notes shown.

| ID | Static support | Status |
| --- | --- | --- |
| S01 | `preflight.sh` NIC/connectivity checks; host checklist prepared | NOT RUN (no `etd-test`) |
| S02 | `pull_policy: never`; requires cached images | NOT RUN |
| S03 | `reset.sh` scoped to `etd-lab` | NOT RUN |
| S04 | Redaction reviewed; no artifact inspection | NOT RUN |
| D01 | `upload.ts` + path-containment unit | NOT RUN |
| D02 | headers/links units; malformed-MIME untested | NOT RUN |
| D03 | Worker re-hash present; no test | NOT RUN |
| D04 | Sender rule units; fixture expectations declared | NOT RUN |
| D05 | One auth unit; no signed fixtures | NOT RUN |
| D06 | links units | NOT RUN |
| D07 | content rule units | NOT RUN |
| D08 | train.py + 2 pytest; no artifact/accuracy | NOT RUN |
| D09 | double-extension unit | NOT RUN |
| D10 | scoring units | NOT RUN |
| A01 | Owner-scoped SQL reviewed; two-user test absent | NOT RUN |
| A02 | Escaping reviewed; no XSS-marker browser test | NOT RUN |
| A03 | Parameterized SQL reviewed; probes untested | NOT RUN |
| A04 | Origin+CSRF+limiter reviewed; tests absent | NOT RUN |
| R01 | Manual procedure only | NOT RUN |
| R02 | Mocked jobs unit; no real-PG concurrency | NOT RUN |
| R03 | Bounds present; F-02; no pressure tests | NOT RUN |
| R04 | Delete path reviewed; DEL-01…04 planned (F-11); no race test | NOT RUN |
| U01 | E2E spec present; needs creds + stack | NOT RUN |
| C01 | Spec structurally valid; live validation incomplete (F-07) | NOT RUN |

## 7. Performance And ML Results

**Not measured.** No application workload has been executed. A preparation VM
now exists, but the disconnected test VM does not. Provisional targets (p95 <
10 s on <=1 MB; >=90% precision / >=85% recall) remain unverified and are not
claimed.

## 8. Blockers And Exact Next Commands

1. **ISO verified PASS (10 Sep 2026):** first attempt was reset mid-stream (`curl: (56)`) leaving a partial file (hash `99a060ed…` ≠ canonical `e907d92e…`); it was NOT used. Resumed with `curl.exe -L -C -`; final size 3405469696 bytes; SHA-256 `e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433` **matches Canonical**.
2. **`etd-prepare` created PASS (10 Sep 2026; installation update 11 Sep):**
   `VBoxManage list vms` reports `"etd-prepare"`
   `{0bf12794-55af-4ee9-ba6d-50379827ac6a}` with 6144 MiB RAM, 4 CPUs,
   preparation-only NAT on NIC1, remaining NICs disabled, clipboard disabled
   and a 40 GiB VDI. The verified ISO was used and is now ejected. Direct host
   inspection sees the VM running; the user reports Ubuntu installation and
   console login successful.
3. In `etd-prepare` (CONNECTED — dependency/image preparation only; **no
   application tests, fixture processing, model training or evaluation here**):
   install reviewed tool versions; resolve locks; cache dependencies, images,
   browser and approved data inputs. Build packaging images as permitted by the
   preparation runbook. Model artifact production occurs only in `etd-test`
   after preflight under the corrected policy above.
4. Power off and clone: `.\sandbox\virtualbox\clone-test-vm.ps1`; complete `sandbox/hypervisor-checklist.md` from the host; boot; `RUN_ID=… bash sandbox/preflight.sh`.
5. Only after preflight passes, in `etd-test` (DISCONNECTED): `npm run typecheck`, `npm test`, `PYTHONPATH=ml python -m pytest ml/tests`, `npm run schema --workspace @etd/tests`, `npm run e2e --workspace @etd/tests`; re-run `python ml/train.py` with cached deps as the D08 reproducibility/held-out check; provision analyst with `ETD_PROVISION_PASSWORD`; execute and record the full matrix (incl. DEL-01…04 and F-02 proof) in this ledger.

## 9. Honesty Statement

All checks in §3 and §4 are host-side inspection/dependency-verification
results. **None is application-execution evidence.** Subsequent handover reports
Ubuntu preparation installation/login, but no build, migration, test, fixture
processing, model training/evaluation or browser automation. The required
disconnected `etd-test` still does not exist; application execution remains
blocked pending preparation, cloning and isolation preflight.
