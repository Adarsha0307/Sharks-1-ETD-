# Phase A Repository Audit

Status: VERIFIED (repository and host inspection only)
Date: 8 September 2026
Source revision: `a0ec3b2`

## Existing Repository

The initial repository contains only the eight governing documents: `prd.md`,
`agent.md`, `design.md`, `architecture.md`, `rules.md`, `memory.md`,
`decisions.md`, and `testing.md`. There is no application source, dependency
manifest, lockfile, migration, fixture, container definition, model, or test
result to reuse. The worktree was clean when this audit began.

The configured canonical remote is
`https://github.com/Adarsha0307/Sharks-1-ETD-.git`.

## Scope Reconciliation

The documents consistently limit this repository to Member A's standalone
email detector, basic local UI, PostgreSQL-backed jobs and history, private ML
inference service, Docker packaging, and isolated-VM verification. Geolocation,
forensic case tooling, teammate modules, mailbox access, URL fetching,
attachment execution, archive expansion, and malware detonation remain out of
scope.

The staged order in `agent.md` places some session-security work later than the
user's explicit phase c. The newer explicit phase sequence controls, so
password hashing, expiring server sessions, CSRF, authorization, and request
limits are part of phase c. This changes ordering, not product scope.

## Requirement Gap Assessment

| Area | PRD references | State at audit | Planned phase |
| --- | --- | --- | --- |
| Sandbox boundary and offline verification | Sections 8-9, S01-S04 | Missing; host tooling unavailable | b, j, k |
| Configuration, database, sessions, jobs, API | ETD-09, section 7, A01/A04/R01/R02/C01 | Missing | c |
| Original upload, storage, parsing | ETD-01, D01-D03 | Missing | d |
| Testing UI and safe rendering | ETD-02, U01/A02 | Missing | e |
| Deterministic rules | ETD-03/05/06/07, D04/D06/D07/D09 | Missing | f |
| Authentication verification and uncertainty | ETD-04, D05 | Missing | g |
| Trained classifier and inference | ETD-06, D08 | Missing | h |
| Explainable scoring, versioning and export | ETD-08, D10 | Missing | i |
| Full resilience/security matrix and measurements | Section 9, A01-A04/R01-R04 | Missing | j |
| Reproducible installation and handoff | Definition of Done | Missing | k |

No prior implementation claims can be carried forward. Each area starts as
NOT STARTED unless later phase records state otherwise.

## Repository Strategy

The selected layout follows the PRD without introducing teammate interfaces:

- `frontend/`: React, TypeScript, Tailwind CSS, and browser tests.
- `backend/`: Express API, worker, shared detector modules, migrations, and
  Vitest tests.
- `ml/`: FastAPI inference, deterministic training/evaluation code, manifests,
  and pytest tests.
- `api-spec/`: the detector-only OpenAPI document.
- `fixtures/`: synthetic inert emails, local DNS data, and fixture manifest.
- `tests/`: cross-component schema, resilience, and end-to-end harnesses.
- `sandbox/`: restricted Compose file, VM runbook, preflight, and reset tools.
- `docs/`: decisions, audit records, reports, setup, and limitations.

Use npm workspaces for the two TypeScript packages, one shared root lockfile,
and a hash-locked Python requirements file produced in the preparation VM.
Backend SQL migrations remain explicit files and run under a narrowly scoped
migration command. Evidence bytes live in a named guest-local volume, never a
web root. PostgreSQL is the sole queue and metadata store.

## Proposed Compatibility Baseline

These conservative major/minor lines are selected for implementation and must
be resolved to exact lockfile versions in the connected preparation VM before
the isolated test clone is created:

- Ubuntu Server 24.04 LTS guest.
- Node.js 22.19 LTS and npm 10.
- TypeScript 5.8; React 19; Vite 6; Tailwind CSS 3.4.
- Express 5.1 and MailParser through `mailparser` 3.7.
- PostgreSQL 16.
- Python 3.12; FastAPI 0.115; scikit-learn 1.6.
- Vitest 3, pytest 8, and Playwright 1.51.
- A maintained Docker Engine/Compose release available for Ubuntu 24.04, pinned
  to exact package versions in the preparation VM rather than the originally
  proposed Engine 27 line.

Exact application packages are pinned in manifests rather than ranges. Image
digests and transitive lockfiles remain unverified until the preparation VM can
download and resolve them. No version is described as tested before the
sandbox run.

## Inspected Host Capacity

- Host: Dell G15 5530, Windows 11 Home Single Language, x64.
- CPU: Intel Core i7-13650HX, 14 physical cores and 20 logical processors.
- RAM: 16,849,256,448 bytes (approximately 15.7 GiB).
- Workspace volume: NTFS, 372,243,427,328 bytes total and 328,902,832,128 bytes
  free at inspection time.
- Windows reports a hypervisor present, but firmware virtualization properties
  were not exposed as enabled to the unelevated inspection process.
- Hyper-V PowerShell tooling, WSL, Docker, VirtualBox, VMware CLI, QEMU, and
  Multipass were unavailable. Windows optional-feature state required
  elevation and could not be inspected.

The hardware is adequate for the provisional four-vCPU, 6 GiB guest if the
host workload is kept modest. A 6 GiB allocation is preferred over 8 GiB on
this 16 GiB host. Actual VM support, resource behavior, and isolation are not
verified.

## Phase Checklist

- a: audit documents/tree/git/capacity; settle layout and dependency strategy.
- b: create preparation and isolated Ubuntu VMs; cache artifacts; verify NIC,
  hypervisor, container, internal-network, loopback, and snapshot controls.
- c: configuration, migrations, local users, sessions, authorization, CSRF,
  rate limits, errors, health/readiness, jobs, and initial OpenAPI.
- d: bounded upload, original-byte hash/storage, duplicate handling, parsing,
  observations, cleanup, and ingestion fixtures.
- e: real sign-in/upload/progress/detail/history UI with safe presentation.
- f: versioned identity, URL, content, and attachment rules with positive and
  benign tests.
- g: untrusted reported results, established DKIM verification, SMTP-context
  SPF semantics, supported DMARC alignment, and injected offline DNS.
- h: licensed English dataset manifest, grouped fixed splits, TF-IDF/logistic
  regression training, measured evaluation, approved artifact, and FastAPI.
- i: versioned deterministic score, caps, confidence/completeness, separate ML
  output, immutable reanalysis, and authorized export.
- j: execute and record the complete mandatory matrix plus bounded benchmarks.
- k: lock digests/dependencies, prove fresh offline clone startup, complete
  setup/reset/demo documentation, and close the PRD traceability matrix.

## Exit Assessment

Repository scope and the next implementation work are unambiguous. Phase b is
blocked on obtaining and configuring a supported VM/hypervisor with elevated
host access. Source and documentation preparation may continue, but no
application, training, or test command may run in this host workspace as a
substitute for the sandbox.
