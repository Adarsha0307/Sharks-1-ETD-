# PRD — Email Threat Detector with Sandbox-Based Testing

Version: 2.1  
Date: 7 September 2026  
Owner: Member A — Adarsha  
Context: SIH26106  
Status: Proposed requirements; implementation and verification pending

## 1. Purpose

Build A's standalone Email Threat Detector: complete backend, basic testing UI, persistent results, Docker packaging and a sandbox in which every executable test runs.

This PRD covers only the Email Threat Detector and its sandbox-based testing. It assigns no teammate-module development or cross-team integration work to A.

The sandbox is the detector's verification environment, not a malware-execution feature. This document is an engineering proposal, not an official SIH specification. Targets below are not achieved metrics.

## 2. Goals and Ownership

The detector must accept original emails, extract evidence, identify suspicious patterns, produce explainable results, preserve uncertainty and run without paid services or the other members' repositories.

| Responsibility | Owner |
| --- | --- |
| Upload, parsing, original-byte hash and detection | A |
| Detector API, model, basic UI, Docker and sandbox tests | A; QA member may independently verify |

A preserves evidence references and minimal processing events to explain and reproduce the detector's own results.

## 3. Required Scope

- Local analyst authentication and server-side authorization.
- Single .eml upload and bounded parsing.
- Original-byte preservation and SHA-256 hashing.
- Sender identity, authentication, URL, content and attachment metadata checks.
- Actual trained binary text classifier.
- Explainable rules-based risk index, initially separate from ML output.
- Asynchronous jobs, persisted results, history and JSON export.
- Basic UI for upload, progress and evidence review.
- Docker setup, sandbox runbook and automated test suite.

Later features: authorized mailbox ingestion, evaluated multilingual support, live reputation adapters and isolated static attachment scanning.

Excluded: geolocation, forensic cases/PDF reporting, live-malware detonation, arbitrary code execution, attachment execution, automatic archive extraction, arbitrary URL fetching, public deployment and automatic mailbox modification.

## 4. User Workflow

1. Analyst opens the local UI in a browser inside the VM and signs in.
2. Analyst uploads an authorized or synthetic .eml file.
3. API validates limits, preserves bytes, computes SHA-256 and creates IDs.
4. API returns HTTP 202 with emailId and jobId.
5. Worker parses a copy and runs bounded independent detection checks.
6. Risk engine combines findings and records unavailable checks.
7. A versioned analysis is persisted.
8. UI displays findings, evidence, uncertainty and recommended actions.
9. Analyst exports JSON or requests explicit reanalysis.

States: queued, parsing, analysing, completed, partial, failed and cancelled. Retries must not create duplicate final results or overwrite prior analyses.

## 5. Detection Requirements

### ETD-01 — Ingestion and parsing

- Accept structurally valid .eml files; extension alone is insufficient.
- Provisional limits: 10 MB upload, 25 attachments, 200 URLs and 20 MIME nesting levels.
- Bound decoded size, memory and processing time separately.
- Use server-generated storage names outside public web directories.
- Hash and preserve original bytes before normalization.
- Preserve repeated headers, their order and original versus normalized values.
- Detect duplicate bytes; reference an existing result or create explicit reanalysis.
- Extract subject, From/display name, recipients, Reply-To, Return-Path, Message-ID, Date, Received, Authentication-Results, DKIM signatures, bodies, URLs and attachment metadata.
- Record missing fields and parser ambiguity rather than invent values.

Acceptance: original bytes retain their hash; malformed input fails within limits; filenames cannot write outside evidence storage.

### ETD-02 — Safe email display

Show plain text by default. Any optional HTML preview must be sanitized and block scripts, forms, frames, remote images and all remote resource loading. Defang suspicious links. Bundle UI assets locally.

Acceptance: preview fixtures trigger no active content or external requests. A parser producing HTML is not proof that the HTML is safe to display.

### ETD-03 — Sender identity

Implement:
- From versus Reply-To mismatch.
- Protected-organization display-name claims.
- Sender domain outside configured authorized organization domains.
- Lookalike-domain and Unicode/punycode indicators.
- Return-Path differences as contextual evidence.

Use parsed hostnames/registrable domains, not substring matching. Support documented legitimate third-party sender exceptions.

Acceptance: positive and benign counterexamples exist for each rule. A mismatch alone does not establish phishing.

### ETD-04 — Authentication evidence

- Uploaded Authentication-Results are untrusted without independently established provenance.
- A header naming a familiar provider does not establish trust.
- Verify DKIM using original bytes and an established implementation when required DNS evidence exists.
- SPF requires reliable SMTP connecting-IP and envelope identity; visible From is insufficient.
- Evaluate DMARC alignment only when underlying verification evidence supports it.
- Separate current verification from historical receiver observations.
- Authentication success never forces a benign verdict.

States: pass, fail, missing, unverifiable, untrusted_reported_result, lookup_error and not_applicable.

Acceptance: forged pass headers are not authoritative; local signed fixtures and injected DNS responses are clearly simulated; absent offline DNS or SMTP context does not become an authentication failure.

### ETD-05 — URL analysis

Extract destinations without visiting them. Inspect visible-text/destination mismatch, lookalike domains, IP hosts, user-info tricks and obfuscation. Preserve original and normalized URLs.

HTTPS, an unfamiliar domain or a tracking redirect alone does not establish safety or maliciousness. Optional reputation results require provider, timestamp, status and evidence. Provider failure means unavailable. Do not transmit sensitive full URLs by default.

Acceptance: deceptive and benign tracking fixtures are tested; email-supplied destinations receive no direct requests.

### ETD-06 — Content rules and ML

Rules identify combinations such as:
- Credential request plus deceptive link.
- Payment-account change plus impersonation evidence.
- Urgency plus secrecy plus financial instruction.

Urgency alone carries little weight.

Baseline model: TF-IDF and logistic regression over subject/body, predicting benign versus phishing-related content. Rule-generated threat categories must be identified as rule outputs.

Requirements:
- Document dataset provenance, licenses and initial language support.
- Deduplicate before splitting; prevent near-duplicate/campaign leakage.
- Fit preprocessing only on training data.
- Record split, seed, model version and artifact hash.
- Load only approved, integrity-checked model artifacts; never user-uploaded serialized models.
- Missing model produces unavailable, never fabricated predictions.
- Unsupported language produces a coverage limitation.

Acceptance: reproduce training and evaluation inside the sandbox; report precision, recall, F1, false-positive rate and confusion matrix. Evaluate rules and ML on the same held-out examples. Synthetic demos are not accuracy evidence.

### ETD-07 — Attachment metadata

Inspect filenames, extensions, declared MIME type, safely detectable signatures, sizes and hashes. Flag suspicious double extensions, executable/script types and type mismatches.

Do not execute files, expand archives or claim metadata inspection is a malware scan.

Acceptance: inert dummy fixtures test suspicious filenames/signatures; no attachment executes or unpacks.

### ETD-08 — Findings and scoring

Each finding includes findingId, ruleId, ruleVersion, category, severity, evidenceRefs, explanation, limitations and recommendedAction.

- Use documented, versioned weights and thresholds.
- Cap correlated signals to avoid repeated counting.
- Initially display ML output separately from the rules score.
- Return risk index 0–100, band, completeness and evidence confidence separately.
- Permit null score/inconclusive when evidence is insufficient.
- Never label a rules score as a calibrated percentage probability.
- Low risk is not guaranteed safe.
- Include skipped checks and contradictory evidence.

Acceptance: fixed inputs/versions reproduce deterministic findings; score contributions are inspectable; reanalysis creates a new immutable version.

### ETD-09 — Access, persistence and deletion

Provision local lab users; disable public registration. Hash passwords, expire sessions and enforce authorization per resource. Apply cookie/CSRF controls appropriate to the environment; do not store session secrets in localStorage.

Persist history with pagination. Log minimal processing/access events without raw bodies or credentials. Permit authorized deletion and cancel pending jobs. Prevent workers recreating deleted data. Document that earlier VM snapshots can retain deleted content.

Acceptance: ID manipulation does not expose another user's evidence; live deleted files and old downloads are unavailable.

## 6. Backend Architecture

Proposed components:
- React/TypeScript basic UI.
- Express/TypeScript API and background worker.
- Private Python ML inference service.
- PostgreSQL for metadata, jobs and findings.
- Protected guest-local evidence storage.

The browser contacts only the API. The API creates jobs; a worker performs parsing and detection. Use database-backed jobs with leases, bounded retries and duplicate-work prevention before introducing a separate broker.

Core entities: users, sessions, emails, evidence_objects, analysis_jobs, analyses, findings, indicators and audit_events. Use migrations, foreign keys, indexes and parameterized queries.

Suggested repository areas:
- frontend/
- backend/
- ml/
- api-spec/
- fixtures/
- tests/
- sandbox/
- docs/

The sandbox directory owns restricted Compose configuration, preflight/reset procedures and the VM runbook. The api-spec directory documents only the detector's own API.

## 7. Detector API

| Endpoint | Purpose |
| --- | --- |
| POST /api/auth/login | Create local session |
| POST /api/auth/logout | Revoke session |
| POST /api/emails | Upload; return 202 with email/job IDs |
| GET /api/jobs/:jobId | Progress and failures |
| GET /api/emails | Permitted paginated history |
| GET /api/analyses/:analysisId | Result and evidence references |
| POST /api/emails/:emailId/analyses | Reanalysis |
| GET /api/analyses/:analysisId/export | Permission-checked JSON |
| DELETE /api/emails/:emailId | Authorized deletion |
| GET /health and GET /ready | Liveness/readiness without secrets |

Validate all input, rate-limit expensive operations, and use structured errors with requestId.

Detector identifiers: emailId, analysisId, evidenceId and requestId; timestamps use UTC. Document request/response schemas with OpenAPI and validate the detector's own API responses in tests. Do not expose guest filesystem paths as evidence URLs.

## 8. Sandbox Policy: Every Test Runs Here

All test commands, model training/evaluation, email processing, API tests, UI automation and load tests execute inside the dedicated test VM. Nothing runs against production systems. The physical host supplies only the hypervisor and console.

### Preparation

Use a separate clean preparation VM to fetch reviewed dependencies and build images. It may have outbound connectivity but must not process risky samples. Prepare a clean test clone with cached images, models, fixtures and UI assets, then disconnect every virtual network adapter before testing.

### Runtime

The test VM contains only A's detector, its database, model service and local test doubles. Internal Docker networking supports these components while hypervisor NICs remain disconnected. Use a browser inside the VM; no host-only adapter or NAT port forwarding is needed.

Required controls:
- Disable shared folders, clipboard, drag-and-drop and device passthrough.
- No host disks, Docker socket, production credentials or sensitive host directories.
- No privileged containers or host networking.
- Non-root application containers, minimal capabilities, no-new-privileges and default syscall restrictions.
- Read-only application roots where compatible, narrowly scoped writable volumes/tmpfs.
- Enforced CPU, memory, process, storage and log limits.
- Internal networks; only the gateway/UI published on guest loopback.
- Inspect hypervisor settings and run benign host/LAN/Internet connectivity checks.
- Check IPv4, IPv6 where enabled and DNS; Compose configuration alone is not proof.
- Use disposable test-only accounts and database contents.

Provisional sizing: 16 GB host RAM, 6–8 GB guest RAM and approximately four vCPUs, subject to actual hardware and benchmark results. Reduce concurrency on smaller laptops.

Docker is packaging and defense in depth, not the sole boundary for hostile code. No sandbox guarantees containment. Live malware execution is outside this PRD.

### Recovery and export

Maintain a powered-off clean baseline after isolation checks. Record each run's ID, source commit, image digests and model/dataset versions. Restore the baseline after destabilizing campaigns.

Reset tools must identify exact lab resources and require explicit action; do not broadly prune Docker or delete unrelated resources. Preserve trusted code in version control before restoring snapshots.

Export only inspected sanitized reports/metrics through a documented controlled offline transfer procedure. Do not create permanent shared host folders. Snapshots are reset points, not independent backups.

## 9. Mandatory Sandbox Test Matrix

Every row executes inside the isolated VM. Use synthetic emails, inert payloads, local provider/DNS fixtures and bounded load generators.

| ID | Area | Test | Required result |
| --- | --- | --- | --- |
| S01 | Isolation | Inspect settings; benign connectivity probes | Host/LAN/Internet blocked; intended internal calls work |
| S02 | Cold start | Start with NICs disconnected | No image pulls, CDN assets or public API dependency |
| D01 | Upload | Valid, duplicate, oversized and invalid files | Correct statuses; no overwrite or storage escape |
| D02 | Parser | Multipart, encodings, missing/repeated headers, malformed MIME | Correct extraction or bounded explicit failure |
| D03 | Evidence | Hash before/after; alter a test copy | Original unchanged; modification detected |
| D04 | Identity | Lookalikes, impersonation and benign third-party senders | Named evidence-backed findings; benign cases considered |
| D05 | Authentication | Forged pass, signed fixture, changed body, DNS error, absent SMTP context | Correct trust states; fixture results labelled |
| D06 | URLs | Display mismatch, user-info, Unicode and benign tracking | Correct signals; no destination fetch |
| D07 | Content | Credential/payment scams and benign urgency | Combined rules work; urgency alone insufficient |
| D08 | ML | Held-out evaluation and unsupported language | Reproducible metrics and explicit limitations |
| D09 | Attachments | Inert signatures, double extensions, type mismatch | Metadata findings; no execution/unpacking |
| D10 | Scoring | Overlapping, contradictory and missing signals | Caps, inspectable contributions and honest incompleteness |
| A01 | Authorization | Missing sessions, changed IDs, malformed payloads | Access denied and consistent safe errors |
| A02 | Preview | Inert XSS probes and tracking HTML | No script execution or remote resources |
| A03 | Input abuse | SQL, path traversal and shell-metacharacter probes | No unintended SQL effects, writes or command execution |
| A04 | CSRF/rate limiting | Cross-origin requests and bounded repeated actions | Policy enforced |
| R01 | Dependency failures | Stop ML/database; inject timeouts | Partial/failure output; no fake verdict |
| R02 | Job recovery | Restart worker and duplicate delivery | Bounded recovery; no duplicate final records |
| R03 | Resource limits | Bounded nesting, decoded size, CPU/memory/disk pressure | Limits enforced; host usable; explicit errors |
| R04 | Deletion | Delete queued evidence; reuse old download | Evidence stays unavailable; no worker recreation |
| U01 | Complete UI | Login, upload, poll, evidence, history, export | Real persisted result end to end |
| C01 | Detector API schema | Validate actual responses against OpenAPI | Required fields, stable IDs and consistent errors |
| S03 | Reset | Create marker/data, restore baseline | Disposable changes absent; clean versions restored |
| S04 | Logs/export | Inspect artifacts | No secrets, active HTML or unintended attachments |

Record expected/actual results, commands, versions and run IDs. Failed required isolation gates block sample testing. These tests reduce risk; they do not prove universal exploit resistance.

## 10. Quality Targets and Honest Limitations

- Provisional core-analysis target: p95 under 10 seconds for <=1 MB emails on a documented reference VM.
- Provisional load: three concurrent analyses without API unresponsiveness.
- Benchmark actual configured resource limits and report measured timing/memory/failures.
- Research goals: >=90% phishing precision and >=85% recall on a defined held-out set. Report actual results if unmet; never adjust test splits to hide poor performance.
- Security, evidence-integrity and safe-rendering gates must pass before broader sample testing.
- Offline authentication and reputation fixtures verify logic, not live provider correctness.
- Defer live-provider verification to a separately specified controlled sandbox with explicit egress policy. Never temporarily reconnect the disconnected test VM.
- Initial tests do not establish performance on unsupported languages, unseen campaigns or real production mail streams.

## 11. Milestones

1. Sandbox: cached tools, restrictions, offline startup and tested reset.
2. First workflow: upload -> preserve -> parse -> named findings -> UI.
3. Detection depth: five layers with uncertainty and negative test cases.
4. ML: reproducible training, held-out evaluation and actual inference.
5. Hardening: permissions, job recovery, resource limits and deletion.
6. Completion: JSON export, detector API documentation and complete sandbox test report.

## 12. Definition of Done

- A fresh test VM starts the standalone detector without teammate services, paid services or Internet.
- Real .eml input produces actual persisted findings.
- All included layers implement their stated behavior and uncertainty.
- Model output comes from the recorded artifact.
- Every required test has recorded sandbox results.
- Failed quality targets and unsupported capabilities are disclosed.
- Setup, migrations, Docker, fixtures, APIs, resets and test commands are documented.
- Another teammate repeats the upload-to-export workflow using the runbook.

Deliver A's repository, basic UI, Docker configuration, sandbox guide, model/data manifests, tests, measured evaluation and detector API documentation. This PRD does not claim that implementation or testing has already occurred.

## 13. Implementation References

- MailParser: https://nodemailer.com/extras/mailparser
- Authentication-Results trust: https://www.rfc-editor.org/rfc/rfc8601.html
- SPF: https://www.rfc-editor.org/rfc/rfc7208.html
- DKIM: https://www.rfc-editor.org/rfc/rfc6376.html
- Text classification: https://scikit-learn.org/stable/auto_examples/text/plot_document_classification_20newsgroups.html
- Compose networks: https://docs.docker.com/reference/compose-file/networks/
- Compose services: https://docs.docker.com/reference/compose-file/services/
- Upload safety: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- SSRF prevention: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

Use maintained implementations and check current platform guidance when coding.
