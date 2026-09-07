# Project Memory — Email Threat Detector

Updated: 7 September 2026  
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

- Product requirements and supporting documentation have been prepared.
- No detector application repository has been inspected for this document task.
- No application implementation is established by these documents.
- No VM setup or container isolation has been verified.
- No model has been trained or evaluated in this task.
- No application tests or benchmarks have been executed.
- No public deployment, provider connection or mailbox access has been performed.

Do not convert a design statement into a completed-work claim.

## Selected Design Baseline

React/TypeScript UI; Express/TypeScript API and worker; private Python inference; PostgreSQL; protected evidence storage; Docker inside an isolated Linux VM.

These are proposed implementation decisions recorded in decisions.md, not evidence that packages are installed or services are working.

## Open Implementation Details

- Actual repository path and source-control state.
- Available RAM, CPU, disk and supported hypervisor.
- Exact guest, runtime and library versions.
- Dataset sources, licenses, language coverage and split manifest.
- Model artifact and measured performance.
- Numeric scoring weights and validated thresholds.
- Actual parser/resource budgets and benchmark results.
- Approved baseline snapshot identifier and isolation-check evidence.

Resolve routine details through inspection during implementation. Do not invent values.

## Next Work

1. Read all governing documents.
2. Inspect repository and host capabilities without exposing secrets.
3. Prepare and verify the test VM.
4. Implement the smallest upload-to-findings workflow.
5. Add detector layers and meaningful sandbox tests.
6. Update this memory using verified outcomes.

## Update Template

For each implementation session record:

- Date and milestone:
- Changed source revision:
- Implemented behavior:
- Sandbox/run identifiers:
- Commands actually executed:
- Results and artifact references:
- Known failures or untested behavior:
- Decisions changed:
- Next concrete task:

Store no passwords, tokens, raw sensitive emails or invented success metrics here. Replace stale status explicitly while preserving important decision history in decisions.md.
