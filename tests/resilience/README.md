# Resilience Harness Status

Status: IMPLEMENTED - NOT VERIFIED (manual procedures only)

Run only after sandbox preflight:

1. Stop `ml` during an active job and verify an immutable partial analysis with
   explicit ML error, not a fabricated prediction.
2. Stop `postgres` before upload and verify readiness returns 503 and acceptance
   does not occur.
3. Pause a worker beyond its lease, start a second worker, and verify only the
   current fencing token can create the job's unique analysis.
4. Restart a worker after claim and verify bounded retry count and no duplicate
   final result.
5. Delete a queued email and verify job cancellation, missing evidence and no
   stale-worker recreation.
6. Run three bounded <=1 MB analyses, capture p50/p95 and `docker stats
   --no-stream`, and stop if guest free memory falls below 1 GiB or free disk
   below 5 GiB.

Automating failure timing safely requires the running sandbox and is still a
phase-j gap. Record every command/run ID in the mandatory matrix ledger.
