# Preparation Artifact Ledger

Status: connected preparation completed; isolated verification pending

Date: 14 September 2026 (UTC)

## Boundary

All commands recorded here ran in the connected Ubuntu `etd-prepare` VM. Image
builds and dependency/data caching are permitted preparation activities. No
application test, email fixture processing, model training or model evaluation
ran, and this record is not evidence for the phase-j test matrix.

## Directly Observed Guest Tools

- Ubuntu 24.04, kernel 6.8.0-139-generic, user `adarsha`, hostname
  `etd-prepare`.
- Node.js 22.19.0 from the upstream archive after its published SHA-256 check;
  bundled npm 10.9.3.
- Python 3.12.3.
- Docker Engine 29.1.3 (`29.1.3-0ubuntu3~24.04.2`).
- Docker Compose 2.40.3 (`2.40.3+ds1-0ubuntu1~24.04.1`).
- Docker Buildx 0.30.1 (`0.30.1-0ubuntu1~24.04.1`).
- Matching Playwright Chromium build 1161 and its Linux dependencies cached.

## Dependency Locks

- `package-lock.json`: SHA-256
  `bd704847e1e1c56a22c3b031bac3025b05747fc060856dd43d2b86b6b3e1bd3c`.
- `ml/requirements.txt`: SHA-256
  `de8209ae2cbdc68db225fdfba234b7f4502330a9316802f4cfd8efc65d9fd45b`.
- npm reported 15 advisories after resolution: 4 moderate, 9 high and 2
  critical. No `npm audit fix --force` was used; advisories require separate
  impact review and must not trigger silent major-version upgrades.
- The Python lock resolves the same serving/training versions for joblib 1.4.2,
  scikit-learn 1.6.1 and numpy 2.2.6. This removes the suspected manifest-level
  version drift but does not substitute for isolated train-load testing.

## Packaging Build

The initial backend and frontend builds failed at TypeScript compilation. The
reproduced errors were corrected without running tests, then all three image
builds completed successfully:

- `etd-backend:local`:
  `sha256:f3e688494e0074778fcab244dd1a3047c91f44cb9804c67b18559dc0dd2ebe8d`.
- `etd-frontend:local`:
  `sha256:b12fe7fef79e276770ca70a1f5541c571233a77146a7ff7b36f218ce8794edbe`.
- `etd-ml:local`:
  `sha256:ba833cd8a28344783a72dad609c20d363482d640b0d76ec37522a71dc69780f3`.
- `postgres:16.9-bookworm` cached digest:
  `sha256:253815cf7579ffa05e1673d92e78d37273e61be0e4414e9a1449337d7925be94`.
- `nginxinc/nginx-unprivileged:1.27.5-alpine` cached digest:
  `sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0`.

Successful image construction proves packaging only. Compose cold startup,
migration, health/readiness, runtime behavior and security restrictions remain
NOT RUN until `etd-test` passes isolation preflight.

Network-disabled version probes confirmed Python 3.12.10 in `etd-ml:local` and
Node.js 22.19.0 in `etd-backend:local`. A standalone `nginx -t` probe could not
resolve the expected Compose-only `api` upstream and therefore is not recorded
as a configuration pass; gateway startup must be checked on the internal
Compose network after isolation.

## Dataset Preparation

The user-provided Kaggle and Hugging Face candidates were downloaded and
hash-checked. The Kaggle CSV-only ZIP passed archive integrity checks and was
extracted for inert aggregate inspection. Findings and cleaning gates are in
`docs/dataset-candidate-review.md`. Raw data remains outside Git at
`/home/adarsha/etd-datasets/` and no candidate is approved as-is.

## Remaining Preparation Gates

- Review npm advisories and accepted exceptions.
- Generate and verify fixture-manifest hashes.
- Decide and produce a privacy-cleaned, provenance-preserving fixed corpus.
- Remove the temporary SSH public key, NAT forwarding and preparation-only
  passwordless sudo rule before powering off and cloning.
- Clone and harden `etd-test`, complete host inspection, and pass preflight
  before any executable test, fixture processing, training or evaluation.
