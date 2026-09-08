# Decision Log — Email Threat Detector

Version: 1.0  
Baseline: prd.md v2.1  
Status: Documentation baseline; not implementation evidence

“Selected” below means selected for implementation, not deployed or validated. New evidence may justify revision; record the reason and preserve the previous decision.

## ADR-001 — Standalone Scope

Status: Confirmed user direction.

Only A's Email Threat Detector, basic UI, Docker and sandbox tests are in scope. Teammate modules and cross-team interfaces are excluded.

Consequence: the project must start and pass tests without other repositories.

## ADR-002 — VM Plus Docker

Status: Selected.

Use a dedicated Linux VM as the outer boundary and Docker Compose for detector components. A disconnected clone handles tests; a separate clean preparation VM obtains dependencies.

Reason: reproducible packaging plus a stronger boundary than containers alone.

Consequence: requires virtualization resources, cached artifacts and explicit reset procedures. It is not a guarantee against all escapes.

## ADR-003 — Offline Testing

Status: Confirmed user testing constraint; selected implementation method.

Run every executable test and model evaluation inside the isolated VM. Use local DNS/provider fixtures and cached assets.

Consequence: fixture tests validate behavior, not live provider correctness. Live verification needs a separately scoped controlled environment; do not reconnect the test clone.

## ADR-004 — Familiar Application Stack

Status: Selected.

React/TypeScript, Express/TypeScript API/worker, private Python ML service and PostgreSQL.

Reason: matches A's development background while allowing a Python model.

Consequence: more than one runtime, but no need for a microservice per detector.

## ADR-005 — PostgreSQL Job Queue

Status: Selected.

Use persisted jobs, leases, fencing and bounded retries before adding a separate broker.

Reason: reduce operational dependencies.

Consequence: job claim correctness, cancellation and stale-worker protection require focused tests. Revisit if measured throughput demands a dedicated queue.

## ADR-006 — Original .eml First

Status: Selected.

Require original-byte upload for the MVP; preserve before normalization.

Reason: body-only text cannot support the same authentication/evidence behavior.

Consequence: no claim that copied text offers full email analysis. Original bytes require protected storage and retention controls.

## ADR-007 — Hybrid Evidence, Separate Scores

Status: Selected.

Implement deterministic findings plus a trained TF-IDF/logistic-regression baseline. Initially show rules index and model output separately.

Reason: avoids presenting arbitrary combinations as calibrated probabilities.

Consequence: tune numeric thresholds using held-out evidence; do not publish unmeasured accuracy.

## ADR-008 — Explicit Authentication Uncertainty

Status: Selected.

Untrusted uploaded pass headers remain untrusted; insufficient SMTP/DNS context remains unverifiable.

Reason: superficial header parsing is not authentication verification.

Consequence: some uploads will have incomplete authentication analysis even when content analysis completes.

## ADR-009 — Metadata-Only Attachment Inspection

Status: Selected.

Inspect inert metadata/signatures/hashes without execution or archive extraction.

Reason: matches initial detection scope and reduces unsafe processing.

Consequence: output must state that deep malware inspection was not performed.

## ADR-010 — Basic Offline UI

Status: Selected.

Use upload, progress, evidence detail and history with bundled assets. JSON export only.

Reason: testable complete workflow without unnecessary product areas.

Consequence: no maps, forensic cases, remote tracking or decorative analytics.

## ADR-011 — Immutable Analyses

Status: Selected.

Reanalysis creates a new result; originals and previous findings are not silently rewritten.

Reason: makes detection behavior reproducible.

Consequence: storage cleanup and deletion must address all versions, pending jobs and snapshot limitations.

## ADR-012 — Safety Gates Before Quality Claims

Status: Selected.

Isolation, authorization, evidence integrity and safe rendering are mandatory gates. Timing and accuracy remain measured research targets.

Consequence: missing the precision goal is reported honestly; passing a benchmark does not excuse an access-control defect.

## ADR-013 — Initial Version and Workspace Strategy

Status: Selected for implementation on 8 September 2026; not yet resolved or
tested in the sandbox.

Use Ubuntu 24.04 LTS, Node.js 22 LTS, PostgreSQL 16 and Python 3.12 as the
runtime baseline. Use npm workspaces for `backend` and `frontend`, exact direct
dependency pins plus a shared npm lockfile, and hash-locked Python requirements
generated in the preparation VM. Keep explicit SQL migrations in `backend`.

Reason: these conservative supported runtime lines satisfy the required stack
without adding another package manager or migration service.

Consequence: exact patch compatibility, transitive locks and image digests
must be established in the connected preparation VM and then verified offline;
the current host cannot be used as substitute test evidence.

## ADR-014 — Explicit Phase Order Reconciliation

Status: Confirmed on 8 September 2026.

Follow the user's current phases a through k. In particular, implement session
security, authorization, CSRF and request limiting in phase c even though the
older `agent.md` implementation-order summary groups some hardening later.

Reason: the latest explicit instruction takes precedence and is consistent
with the PRD's required scope.

Consequence: phase c is larger, while phase j remains the full adversarial and
resilience verification gate.

## ADR-015 — Offline Parsing And No Reputation Fetch

Status: Implemented in source on 8 September 2026; not verified.

Extract and normalize HTTP(S) destinations locally using URL and registrable-
domain parsing. Do not send email-supplied URLs to any destination or reputation
provider in the baseline. Preserve originals in the immutable analysis and
defang them in the UI/export.

Consequence: URL syntax/deception rules remain available offline, while live
reputation is explicitly unavailable rather than fabricated.

## ADR-016 — Synthetic ML Seed Is Not Accuracy Evidence

Status: Confirmed on 8 September 2026.

Keep a tiny project-authored fixed corpus solely to exercise deterministic
training/inference plumbing. It must never support a quality claim. A reviewed,
redistributable real-world dataset with provenance/license and campaign-aware
deduplication is required before research metrics are accepted.

Consequence: phase-h source can be implemented, but its exit gate remains unmet
until approved data and actual sandbox evaluation exist.

## ADR-017 — Sanitized Export Uses CSRF-Protected POST

Status: Implemented in source on 8 September 2026; not verified.

Generate JSON export through an owner-authorized, CSRF-protected POST. Redact
bodies, raw headers and recipient lists; defang URL originals. Retain evidence
references, versions, findings and limitations needed to explain the result.

Consequence: a browser navigation cannot trigger export with only the session
cookie, and exported reports still require controlled analyst inspection.

## Revision Procedure

Add a dated entry with decision ID, triggering evidence, alternatives, selected change, affected requirements and required tests. User scope changes must be reflected in prd.md; do not alter scope through this log alone.
