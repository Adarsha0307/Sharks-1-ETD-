# Implementation Phase Status

Updated: 8 September 2026

No executable application command has been run outside the required sandbox.
Only repository, Git and host-capability inspection were executed on the host.

## Phase A - VERIFIED

- Objective: inspect governing documents, repository, gaps, layout, versions
  and host capacity.
- Implemented behavior: audit only; no detector existed initially.
- Files: `docs/phase-a-audit.md`, `memory.md`, `decisions.md`.
- Checks run: Git tree/status/log/remote, Windows hardware/disk/network and
  installed virtualization/runtime tool inspection.
- Result: clean documentation-only baseline at `a0ec3b2`; 14 cores/20 logical
  CPUs, approximately 15.7 GiB RAM and 306 GiB free were observed.
- Blocker: supported VM/hypervisor and Docker unavailable.
- Next: phase b isolation.

## Phase B - BLOCKED

- Objective: dedicated disconnected Ubuntu VM with restricted containers.
- Implemented behavior: restricted Compose source, VM runbook, host checklist,
  preflight, scoped reset and evidence ledger are prepared.
- Files: `sandbox/compose.yaml`, `sandbox/README.md`,
  `sandbox/hypervisor-checklist.md`, `sandbox/preflight.sh`, `sandbox/reset.sh`.
- Sandbox checks run: none.
- Result: IMPLEMENTED - NOT VERIFIED source only.
- Blocker: no supported VM/hypervisor CLI or elevated feature inspection.
- Next: obtain approved virtualization access, cache artifacts in preparation
  VM, detach test VM NICs, then execute S01/S02 and snapshot/reset checks.

## Phase C - IMPLEMENTED - NOT VERIFIED

- Objective: configuration, PostgreSQL entities/jobs and secure local sessions.
- Implemented behavior: validated config; SQL migration for required entities;
  scrypt password hashing; hashed expiring sessions; logout; strict origin and
  double-submit CSRF; owner-scoped queries; rate limits; structured safe errors;
  health/readiness; leased/fenced PostgreSQL jobs; local account provisioning;
  initial OpenAPI.
- Files: `backend/src/config.ts`, `backend/src/security/`, `backend/src/db/`,
  `backend/src/routes/auth.ts`, `backend/src/app.ts`, `api-spec/openapi.yaml`.
- Sandbox checks run: none.
- Blockers/untested: migration, transactions, dependency outage, CSRF, rate and
  two-user ID manipulation tests require sandbox PostgreSQL/API execution.
- Next: verify phase c after phase-b gate.

## Phase D - IMPLEMENTED - NOT VERIFIED

- Objective: bounded `.eml` ingestion, preserved bytes and observations.
- Implemented behavior: multipart streaming limit, generated paths, SHA-256
  while staging, same-owner duplicate handling, DB/filesystem cleanup, repeated
  raw-header ordering, MailParser extraction, decoded/attachment/URL/depth
  bounds, URL/attachment metadata and parser warnings.
- Files: `backend/src/ingestion/`, `backend/src/parsing/`, `fixtures/`.
- Sandbox checks run: none.
- Blockers/untested: MailParser streaming behavior, malformed MIME, all limit
  paths, crash reconciliation and independent before/after hashes are NOT RUN.
- Next: D01-D03 in sandbox.

## Phase E - IMPLEMENTED - NOT VERIFIED

- Objective: honest basic testing UI.
- Implemented behavior: sign-in, upload, genuine persisted stages, reload
  recovery, history, analysis detail, escaped text, defanged non-clickable URLs,
  attachment metadata, explicit limitations and sanitized export action.
- Files: `frontend/`.
- Sandbox checks run: none.
- Blockers/untested: build, keyboard, 360px/200% zoom, session expiry, active
  content and instrumented browser requests are NOT RUN.
- Next: U01/A02 in sandbox.

## Phase F - IMPLEMENTED - NOT VERIFIED

- Objective: evidence-backed identity, URL, content and attachment rules.
- Implemented behavior: versioned findings for mismatches, protected-name
  claims/exceptions, lookalikes, punycode, displayed/actual URL differences, IP
  hosts, user-info, combined credential/payment/social-engineering patterns,
  double extensions, executable signatures and MIME mismatches. No URL fetch,
  archive expansion or execution path exists.
- Files: `backend/src/detection/rules.ts` and unit test source.
- Sandbox checks run: none.
- Blockers/untested: positive/benign matrix needs sandbox execution and more
  fixture breadth before the exit gate can be marked VERIFIED.
- Next: D04/D06/D07/D09 in sandbox.

## Phase G - IMPLEMENTED - NOT VERIFIED

- Objective: authentication truth states.
- Implemented behavior: uploaded Authentication-Results remain untrusted;
  established `mailauth` DKIM/SPF adapters use original bytes and injected DNS;
  normal uploads keep SPF unverifiable; fixture-only SMTP context is explicit;
  alignment is based only on verified evidence; missing/lookup/unverifiable/pass/
  fail states are represented.
- Files: `backend/src/authentication/`, `fixtures/dns.json`.
- Sandbox checks run: none.
- Blockers/untested: no signed fixture/key/DNS record has been generated or run;
  DKIM/SPF import compatibility and modified-content behavior are NOT RUN.
- Next: complete and execute D05 fixtures in sandbox.

## Phase H - IMPLEMENTED - NOT VERIFIED

- Objective: reproducible TF-IDF/logistic-regression classifier and private API.
- Implemented behavior: fixed partitions, train-only fitting, validation C
  selection, held-out metrics code, seed/version/hash manifest, approved-only
  artifact loading, private FastAPI inference, explicit missing-model and
  unsupported-language outcomes.
- Files: `ml/`, `backend/src/ml/client.ts`.
- Sandbox checks run: none; model was not trained.
- Blockers/untested: corpus is synthetic and cannot support real-world metrics;
  dataset licensing/provenance, deduplication automation, model artifact and
  actual evaluation remain incomplete.
- Next: approve a redistributable dataset, lock requirements, train once in the
  sandbox and report actual D08 metrics plus rules comparison.

## Phase I - IMPLEMENTED - NOT VERIFIED

- Objective: explainable result, immutable versions, reanalysis and export.
- Implemented behavior: scoring version/weights/caps, separate ML output, risk
  band/completeness/confidence, contradictions, immutable per-email versions,
  fenced finalization, explicit reanalysis and owner/CSRF-checked redacted JSON
  export.
- Files: `backend/src/scoring/`, worker/routes/schema, `docs/scoring.md`.
- Sandbox checks run: none.
- Blockers/untested: database immutability, cap determinism, export equivalence,
  stale worker and deletion races are NOT RUN.
- Next: D10/R02/R04/C01 in sandbox.

## Phase J - IMPLEMENTED - NOT VERIFIED

Mandatory matrix execution and measurements are blocked by phase b. Test source
exists for units (including DB jobs, analyses router, and auth), schema, browser workflow and manual resilience procedures,
but no result is claimed. Execution is NOT RUN.

## Phase K - IN PROGRESS

Setup, reset, demo, limitations and phase records are prepared. Exact npm lock,
hash-locked Python requirements, image digests, fixture hashes, approved model,
fresh isolated-clone startup evidence and final PRD traceability remain blocked
or incomplete. Handoff cannot pass its exit gate yet.
