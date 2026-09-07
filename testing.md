# Testing Specification — Email Threat Detector

Version: 1.0  
Baseline: prd.md v2.1, mandatory matrix S01–S04, D01–D10, A01–A04, R01–R04, U01 and C01  
Status: Planned tests; none claimed executed

## 1. Execution Boundary

Every unit test, API test, browser test, model training/evaluation and load test runs inside the isolated Linux VM. The host performs only hypervisor setup/inspection and console access. No production endpoints, live mailboxes or public attack targets are used.

If the VM is unavailable, mark tests NOT RUN. Do not substitute execution in the ordinary coding workspace.

Prepare reviewed dependencies in the preparation VM. Cache images, models, datasets and browser binaries before disconnecting the test clone. Do not process risky samples in the connected preparation environment.

## 2. Preflight Gates

Before email processing:

- Record hypervisor, guest, source revision, image digests and model/data versions.
- Inspect all NICs: disconnected. Shared folders, clipboard, drag-and-drop and device passthrough disabled.
- Inspect actual containers: non-root application users, no privilege escalation, no Docker socket, no host networking, bounded resources.
- Verify host/LAN/Internet paths unavailable using benign controlled probes, including IPv6 where enabled and external DNS.
- Verify intended internal service-name resolution and calls work.
- Verify only intended UI/API guest-loopback publication.
- Start with cached artifacts and no downloads.
- Record a clean snapshot reference and disposable test credentials.

A guest-only command cannot prove every hypervisor setting. Retain a host-side configuration inspection record. A failed isolation gate blocks sample tests.

## 3. Test Layers

| Layer | Proposed runner | Focus |
| --- | --- | --- |
| TypeScript units | Vitest or existing equivalent | Parsers, rules, scoring and validation |
| API/database | Existing Node HTTP test tooling | Sessions, permissions, jobs, migrations and exports |
| Python | pytest | Preprocessing, inference, missing/corrupt artifact handling |
| Browser | Playwright or existing equivalent | Upload-to-export and rendering safety |
| Schema | OpenAPI validator | Detector API only |
| Resilience | Bounded scripted harness | Restarts, timeouts, quotas and deletion races |

Use existing repository tooling where suitable. These are proposed choices, not installed packages or executable commands. Add documented scripts during implementation and verify they exist before running them.

## 4. Fixtures

Maintain a manifest with fixture ID, purpose, source/license, synthetic flag, SHA-256, expected findings, expected unavailable checks and language.

Use reserved example domains and inert local files. Include:

- Benign multipart and encoded emails.
- Missing/repeated/malformed headers.
- Protected-domain impersonation and legitimate third-party senders.
- Credential requests and benign urgent notices.
- Deceptive links and legitimate tracking differences.
- Forged Authentication-Results.
- Locally signed DKIM fixture, modified body, unavailable DNS and absent SMTP context.
- Dummy attachment signatures, double extensions and type mismatches.
- Inert HTML/XSS and tracking probes.
- Duplicate and oversized input.
- Bounded deep MIME and decoded-size cases.

Fixtures must assert findings/evidence, not rely on filenames to trigger verdicts. Keep demo fixtures separate from held-out ML evaluation.

## 5. Required Assertions

### S01–S04: Environment

Prove effective isolation and cold startup; verify restoration removes a disposable marker; inspect logs and exported JSON for sensitive data. No claims of universal escape resistance.

### D01–D03: Ingestion and preservation

Check accepted/rejected statuses, bounded failure, repeated header preservation and duplicate behavior. Recompute hash independently before and after processing. Mutation of a test copy must change the hash. Failures must not leave publicly reachable or orphaned evidence indefinitely.

### D04–D07: Detection

Every rule has a positive and benign counterexample. Assert actual evidence references and limitations.

Authentication tests distinguish reported, verified and simulated results. DNS failures are not spoofing proof. URL tests assert no outbound fetch. Urgency alone must not establish phishing.

### D08: ML

Deduplicate/group before splitting, fit preprocessing on training data only, and evaluate once against a fixed held-out set after validation tuning. Record precision, recall, F1, false-positive rate, confusion matrix, sample counts, language coverage and artifact versions.

Compare rules and ML on the same examples. Missing or corrupt approved model artifacts produce explicit failure/unavailable status. Never load untrusted uploaded serialized models.

### D09–D10: Attachments and scores

Use inert attachments only; assert no execution/unpacking. Assert correlation caps and visible contributions. Missing evidence must not silently become safe. Fixed inputs/rules must reproduce deterministic output.

### A01–A04: Application security

Use two disposable users for object-access checks. Test sessions, CSRF, rate limits, escaped filenames, parameterized SQL behavior and path containment.

Instrument the browser to detect attempted remote requests even though external connectivity is blocked. A blocked network must not hide a UI that still tries to load trackers.

Test that inert XSS cannot modify a marker in the page. Do not use exploit chains or live malicious payloads.

### R01–R04: Recovery

Stop dependencies at controlled stages and verify honest partial/failure states. Expire a lease and ensure the old worker cannot finalize after a new claim. Retry delivery must not duplicate final results.

Use bounded workloads below a pre-agreed total VM budget; stop on predefined memory/disk thresholds. Never use unbounded fork bombs or disk filling.

Delete pending evidence and assert stale workers cannot recreate it. Reuse old download references and confirm denial.

### U01/C01: End to End and API

Through the actual UI: sign in, upload, poll, inspect evidence, reload, review history and export JSON. Check keyboard access, 200% zoom, narrow layouts and session expiration.

Validate actual detector responses against its OpenAPI schemas. No teammate-service contracts are included.

## 6. Performance Procedure

On a documented reference VM, run a warmed and cold analysis sample set separately. Measure p50/p95 latency, success/partial/failure counts, maximum memory and resource-limit events.

Provisional goal: p95 below 10 seconds for emails up to 1 MB, with three concurrent jobs supported. Publish actual results; do not extrapolate to unsupported laptops or larger files.

## 7. Test Record

Each result must include:

- Run ID and timestamp.
- Requirement/test ID.
- Source/image/model/data versions.
- VM resource allocation and baseline snapshot.
- Actual command and fixture IDs.
- Expected versus actual outcome.
- PASS, FAIL, BLOCKED or NOT RUN.
- Sanitized log/report location.
- Defect ID and retest reference where applicable.

Never insert invented passing examples into the completed-results section.

## 8. Release Gates

Required: all isolation, authorization, original-integrity, active-content and no-execution tests pass. Core workflow, recovery and schema tests pass. Known limitations and actual accuracy/performance are documented.

Provisional research goals are >=90% precision and >=85% recall on the declared held-out set. If unmet, report them as unmet; do not conceal results or claim target compliance.

Fixture-only authentication/reputation tests are not live-provider verification. Future live checks require a separate controlled sandbox design, not reconnection of this one.

## 9. Cleanup

Export sanitized metrics/JSON through the documented offline procedure. Exclude secrets, raw active content and unintended attachments. Preserve source before restoring the clean snapshot. Reset only named lab resources, with explicit operator action.

Initial completed-results ledger: empty. Implementation and all executable tests remain pending.
