# Cross-Component Tests

All commands in this directory must run inside the isolated Linux test VM after
phase-b preflight passes. Host execution is prohibited by `testing.md`.

Planned/implemented layers:

- Backend Vitest units for config, evidence containment, raw headers, URLs,
  rule combinations, authentication trust and score caps.
- Python pytest for approved-artifact failure handling.
- `tests/e2e/` for Playwright's real sign-in-to-export workflow.
- `tests/schema/` for OpenAPI validation against actual responses.
- `tests/resilience/` for leases, retries, dependency outage and deletion races.

The latter three suites remain source-preparation gaps until the sandbox and
locked browser/runtime artifacts are available. No test result is recorded here.
