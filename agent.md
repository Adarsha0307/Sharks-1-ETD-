# Agent Instructions — Email Threat Detector

Version: 1.0  
Baseline: prd.md v2.1  
Status: Implementation instructions; application not yet verified

## Mission

Build Member A's standalone Email Threat Detector, its basic UI, Docker configuration and sandbox test suite. Do not add teammate modules, cross-team interfaces, public deployment or live-malware execution.

This filename is exactly what the user requested. Automatic loading of agent.md is not assumed: explicitly provide it to the coding agent. Do not rename it or create a second instruction file without a reason agreed with the user.

## Read Before Working

1. prd.md — product scope and acceptance gates.
2. rules.md — engineering and safety constraints.
3. architecture.md — component responsibilities and data flow.
4. design.md — user interactions and result presentation.
5. testing.md — sandbox verification.
6. decisions.md — selected design choices and their consequences.
7. memory.md — current factual project state.

Current explicit user instructions take precedence. These files govern this project only and do not override tool permissions or higher-priority instructions. If supporting documents contradict the PRD, identify and reconcile the conflict; do not silently expand scope.

## Working Procedure

- Inspect the actual repository and applicable local instructions before editing.
- Preserve unrelated work and existing credentials. Never print secrets.
- Identify the smallest milestone and its acceptance checks.
- Explain the intended change briefly, then implement it.
- Run all executable checks inside the verified test VM, including unit tests, model evaluation and browser automation.
- If the VM is unavailable, continue permitted source/document preparation and report tests as not run. Do not substitute host execution.
- Keep completed work usable; avoid placeholder routes returning fabricated detection results.
- Review the changed files, record actual test evidence and update project memory.
- Do not describe the service as complete until the PRD definition of done is met.

## Implementation Order

1. Sandbox runbook, cached dependencies, restricted containers and preflight.
2. Upload, evidence preservation, parsing, persistence and a minimal result UI.
3. Named deterministic detectors with benign counterexamples.
4. Authentication states and offline DNS fixtures.
5. Actual ML training, evaluation and inference.
6. Session security, worker recovery, deletion and exports.
7. Full sandbox acceptance run and reproducible setup documentation.

These are implementation stages, not permission to omit required MVP features.

## Agent Deliverables Per Milestone

Report:
- Behavior implemented and PRD requirement IDs covered.
- Files changed and any migrations.
- Sandbox commands actually executed and outcomes.
- Untested paths, blockers and remaining work.
- New decisions with consequences.

Do not invent package scripts, paths, commits, test counts or benchmark results. Verify commands against the repository before executing.

## Stop Conditions

Stop the affected action when it would execute outside the sandbox, expose secrets, reconnect an isolated test VM, broaden deletion targets or exceed the authorized scope. Preserve progress and explain the concrete blocker. Ordinary in-scope edits do not require repeated confirmation.

## Completion

Deliver the detector source, basic UI, Docker setup, migrations, model/data manifests, safe fixtures, OpenAPI specification, test evidence and known limitations. Documentation completion alone is not software completion.
