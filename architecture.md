# Architecture — Standalone Email Threat Detector

Version: 1.0  
Baseline: prd.md v2.1  
Status: Selected implementation baseline; not deployed

## Components

| Component | Responsibility |
| --- | --- |
| React UI | Upload, progress, result and history |
| Express API | Sessions, authorization, validation, job creation and retrieval |
| Worker | Bounded parsing, deterministic detection, ML invocation and scoring |
| Python ML service | Approved model loading and private inference |
| PostgreSQL | Accounts, metadata, job state, analyses and findings |
| Evidence storage | Original bytes and permitted derived artifacts |

All components run inside A's Linux test VM. Docker Compose starts only this detector and its dependencies. No other team repository is required.

The UI calls the API; it never calls ML or the database. The worker calls ML privately. Expensive parsing does not run in an API request.

## Data Flow

1. API streams upload into bounded temporary storage.
2. Validate structure and limits; compute hash over original bytes.
3. Move to a generated protected evidence location.
4. Commit email metadata and a queued job.
5. Worker claims the job with a lease and attempt number.
6. Parse original evidence into versioned observations.
7. Run detectors and bounded ML inference.
8. Store final immutable analysis and findings in a transaction.
9. UI retrieves the authorized result.

Filesystem and database writes are not one atomic transaction. Use staging states and a reconciliation procedure for orphan files or failed commits. A failed upload must not return accepted.

## Processing Modules

- ingestion: streaming limits, hashing and storage.
- parsing: MIME, repeated headers, body/link/attachment extraction.
- identity: protected domains and identity discrepancies.
- authentication: provenance and verification states.
- urls: offline parsing and deception checks.
- content: semantic rule combinations.
- attachments: inert metadata inspection.
- scoring: versioned contributions and correlated-signal caps.
- jobs: leases, retries and cancellation.
- access: sessions and resource ownership.

Each detector returns observations, findings, check status and limitations. One unavailable detector must not erase successful findings.

## Job Correctness

Claim jobs atomically. Use lease expiry and a fencing token/attempt version so an expired worker cannot commit over a newer attempt. Bound retries and record failure reasons.

Enforce one finalized result per job. Reanalysis creates a new job/version. Mark an email deleted before cleanup; workers must check deletion state before committing. Reconciliation must not recreate deleted evidence.

## Data Model

Core tables:
- users, sessions
- emails, evidence_objects
- analysis_jobs, analyses
- findings, indicators
- audit_events

Use UUIDs and UTC times. References must carry ownership and foreign-key constraints. Store model/rule/scoring versions with analyses. Keep evidence out of operational logs. Use separate database permissions for application operations and migrations where practical.

Hash equality proves byte equality, not authentic sender identity. Avoid cross-user duplicate responses that reveal another user's uploads.

## API

Implement the endpoint set in prd.md section 7. Describe request/response schemas in api-spec/openapi.yaml. Authentication and authorization apply to job polling, history, exports and deletion as well as upload.

Response semantics:
- 202: accepted processing.
- 400/413: invalid/oversized request.
- 401: session required.
- 403 or non-enumerating 404: access denied.
- 429: rate limit.
- 503: dependency unavailable before acceptance.

Errors include a stable error code, safe message and requestId. Do not expose internal exceptions.

## Deployment Boundary

Run Docker Engine inside the VM, with internal networks and no host integrations. Publish only the UI/API gateway on guest loopback. Database and inference ports remain private.

Application containers are non-root, bounded and minimally privileged. Evidence mounts are read-only for consumers when feasible. Do not mount Docker's socket. Explicitly provision writable database paths rather than disabling restrictions globally.

## Offline Model and DNS

Cache approved model artifacts before isolation. Validate artifact hashes before loading. Inject a DNS resolver interface so unit tests can use deterministic records. Fixture authenticity is never conflated with real-world verification.

Live reputation and mailbox ingestion remain deferred.

## Observability

Log requestId, jobId, analysisId, stage, duration, version and sanitized error code. Do not log bodies, passwords or sensitive URLs. Track processing failures, partial results and resource usage without claiming prevented attacks.

## Verification

All executable component, API, recovery and browser checks run inside the verified sandbox as specified in testing.md. Pin actual dependency/image versions during implementation; this document does not assert compatibility for untested versions.
