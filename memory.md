# Project Memory — Email Threat Detector

Updated: 8 September 2026
Purpose: factual continuity for future coding sessions

## Confirmed User Requirements

- Project context is SIH26106.
- The team has six members and three primary builders.
- Member A (Adarsha) builds Email Threat Detector.
- This repository/document set covers only A's work.
- Deliver a complete detector backend and a basic UI for testing.
- Package the detector using Docker.
- Execute all detector testing inside a sandbox.
- Do not assign teammate modules or cross-team integration interfaces to A.
- Baseline budget is no mandatory paid API or cloud dependency.

## Current Artifacts

| File | Purpose |
| --- | --- |
| prd.md | Product scope and mandatory sandbox acceptance matrix |
| agent.md | Instructions for the implementing coding agent |
| design.md | Basic UI flows and presentation |
| architecture.md | Detector components, persistence and processing |
| rules.md | Scope, security and engineering constraints |
| memory.md | Current factual state |
| decisions.md | Design choices and tradeoffs |
| testing.md | Executable verification specification |

The PRD baseline is v2.1. Supporting files are v1.0.

## Actual Implementation State

- The canonical repository was inspected at revision `a0ec3b2`; it initially
  contained only the eight governing Markdown files and had a clean worktree.
- Phase-a findings, requirement gaps, proposed versions and host capacity are
  recorded in `docs/phase-a-audit.md`.
- No application implementation was present at the start of phase a. Source has
  since been prepared for the React UI, Express API/worker, PostgreSQL migration,
  evidence ingestion/parsing, deterministic rules, authentication adapters,
  explainable scoring, FastAPI ML service, Dockerfiles and restricted Compose.
- Detailed honest status for phases a-k is recorded in
  `docs/phase-status.md`. Phases b-i are not verified merely because source
  exists.
- No VM setup or container isolation has been verified. Hyper-V tooling, WSL,
  Docker, VirtualBox, VMware CLI, QEMU and Multipass are unavailable from the
  current unelevated host session.
- No model has been trained or evaluated. The included corpus is synthetic and
  is only for pipeline verification, not accuracy evidence.
- No application tests, builds, migrations, fixture processing or benchmarks
  have been executed because testing outside the verified sandbox is forbidden.
- No public deployment, provider connection or mailbox access has been performed.

Do not convert a design statement into a completed-work claim.

## Selected Design Baseline

React/TypeScript UI; Express/TypeScript API and worker; private Python inference; PostgreSQL; protected evidence storage; Docker inside an isolated Linux VM.

These are proposed implementation decisions recorded in decisions.md, not evidence that packages are installed or services are working.

## Open Implementation Details

- Exact resolved dependency versions, image digests and supported hypervisor.
- Dataset sources, licenses, language coverage and split manifest.
- Model artifact and measured performance.
- Validation/evaluation of the initial numeric scoring weights and thresholds.
- Actual parser/resource budgets and benchmark results.
- Approved baseline snapshot identifier and isolation-check evidence.

Resolve routine details through inspection during implementation. Do not invent values.

## Next Work

1. Obtain elevated access to a supported hypervisor and prepare Ubuntu VMs.
2. Verify sandbox isolation before processing any fixture.
3. Resolve lockfiles/build images in the preparation VM and cache them.
4. Execute phases c-i tests and fix observed failures in the isolated test VM.
5. Complete the phase-j matrix, actual metrics and clean-clone phase-k handoff.

## Update Template

## Update Log

- Date and milestone: 8 September 2026, Static Implementations (Phases C-I, J partial)
- Changed source revision: `2601016` (pushed to origin/main)
- Implemented behavior: Committed Express API routes, PostgreSQL jobs/migrations, React UI components, rule detection logic, ML FastAPI backend setup, and added static unit tests (`jobs.test.ts`, `analyses.test.ts`).
- Sandbox/run identifiers: NONE
- Commands actually executed: `git commit`, `git push`. No tests, builds, or server executions were performed on the host.
- Results and artifact references: Commits `ec2a81c` and `2601016`.
- Known failures or untested behavior: All code is unverified and untested due to Phase B sandbox blocker.
- Decisions changed: None.
- Next concrete task: Obtain elevated access to a supported hypervisor, resolve the Phase B Sandbox Blocker, and begin executing the test matrix.
