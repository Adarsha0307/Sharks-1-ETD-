# SIH26106 Email Threat Detector

Standalone Member A detector for original `.eml` evidence. It provides a local
React testing UI, Express API and worker, PostgreSQL persistence, deterministic
rules, offline-aware authentication states, a private FastAPI classifier, and
restricted Docker Compose packaging.

The detector never fetches email URLs, executes attachments, expands archives,
or treats an uploaded authentication header as verified. A rules risk index is
a ranking, not a probability. Low risk does not guarantee safety.

## Current Status

Phase-a repository/host audit is verified. Source increments for phases b-i are
implemented but not verified. Phase b is blocked because this machine has no
available supported VM/hypervisor tooling; therefore all application tests,
model training, image builds and fixture processing remain NOT RUN as required
by `testing.md`. See `docs/phase-status.md` and `docs/limitations.md`.

## Layout

- `frontend/`: React, TypeScript and Tailwind testing UI.
- `backend/`: Express API, PostgreSQL migrations, worker and detector logic.
- `ml/`: FastAPI service and reproducible TF-IDF/logistic regression pipeline.
- `api-spec/`: detector-only OpenAPI 3.1 specification.
- `fixtures/`: synthetic inert email and DNS fixtures.
- `tests/`: Playwright, OpenAPI and resilience harnesses.
- `sandbox/`: restricted Compose stack, preflight, reset and VM runbook.
- `docs/`: audit, scoring, phase status and known limitations.

## Required Workflow

Do not run detector commands in the host workspace. Follow
`sandbox/README.md` to prepare/cache dependencies in a clean connected VM,
clone the isolated test VM, detach all NICs, and pass preflight. Once that gate
passes, setup and test commands are documented in `docs/setup.md`.
