# Engineering Rules — Email Threat Detector

Version: 1.0  
Baseline: prd.md v2.1

## Scope

Build only A's detector, basic UI, Docker setup and sandbox testing. Do not add teammate features or cross-team interfaces. Do not introduce public hosting, paid dependencies or real mailbox access as prerequisites.

## Sandbox

1. All executable tests and model training/evaluation run inside the verified test VM.
2. Keep test VM virtual NICs disconnected.
3. Disable shared folders, clipboard, drag-and-drop and unnecessary device access.
4. Use only disposable lab data and credentials.
5. Never use privileged containers, host networking or the Docker socket.
6. Enforce measured CPU, memory, process, temporary-storage and log limits.
7. If preflight fails, stop sample processing and fix isolation first.
8. Do not reconnect the isolated VM to make a failing dependency work.
9. Live malware and attachment execution are outside scope.
10. Reset only explicitly identified lab resources; no broad pruning.

Offline source editing and document review are not application test execution. The physical host may perform hypervisor configuration inspection, but must not process email samples or run the detector's tests.

## Evidence and Detection

- Preserve original bytes; hash before normalization.
- Never trust uploaded authentication claims solely because they look official.
- Missing SMTP context or DNS produces unknown/unverifiable states.
- Do not infer benign content from authentication success.
- Do not infer phishing from urgency, unfamiliarity or a mismatch alone.
- Findings must reference actual evidence and identify their rule version.
- Keep incomplete analysis, evidence confidence and risk distinct.
- Do not call a score a probability without validated calibration.
- Do not invent ML output, provider matches, metrics or passed tests.
- Metadata-only attachment checks must be labelled accurately.

## Input and UI

- Validate on the server; client checks are supplementary.
- Enforce decoded limits as well as upload limits.
- Never invoke shell commands from email-controlled strings.
- Never execute attachments, expand archives or fetch arbitrary links.
- Escape text; block active and remote content in any HTML preview.
- Avoid automatic external navigation from suspicious links.
- Use parameterized database queries and object-level access checks.

## Secrets and Privacy

- Never commit or print secrets.
- Use test-only credentials; prohibit production connection strings.
- Do not retain raw bodies in logs.
- Keep evidence storage outside public paths.
- Revoke access to deleted evidence and cancel associated work.
- Document that snapshots and exported copies have separate retention.
- No public LLM receives confidential email by default.

## Implementation Discipline

Use small modules and maintained libraries. Preserve lockfiles and migrations. Do not hand-roll authentication protocols or cryptographic verification. Avoid unnecessary queues, graph databases or autonomous agents.

Every mock must be confined to test fixtures or clearly labelled demo behavior. Production code must report unavailable instead of silently using a mock.

Do not weaken tests, change evaluation splits or remove assertions solely to make results pass. Fix behavior or document the unresolved defect.

## Claims and Changes

Record decisions and their consequences in decisions.md. Record verified facts in memory.md. Distinguish planned, implemented, tested and blocked.

If these files conflict with the current user instruction or PRD, resolve explicitly. Do not turn a proposed implementation choice into an invented user requirement.
