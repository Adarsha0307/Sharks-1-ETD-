# Known Limitations

- Sandbox isolation, startup, tests, model training, browser behavior and
  benchmarks have not been run because a supported VM/hypervisor is unavailable.
- The bundled ML corpus is tiny and synthetic. It exercises the pipeline but is
  not real-world accuracy evidence. No precision/recall target is claimed.
- Baseline ML language handling is a conservative script heuristic and supports
  English only.
- Uploaded email lacks trusted SMTP-session context, so SPF is normally
  unverifiable. Fixture SMTP/DNS results are explicitly simulated.
- DKIM source integration is prepared around `mailauth` but has not been compiled
  or exercised against signed fixtures.
- MIME depth estimation is a defensive heuristic pending fixture verification;
  MailParser does not expose an exact nesting counter through its public stream
  events.
- Attachment inspection uses names, sizes, hashes and a short signature list. It
  does not execute, unpack or malware-scan attachments.
- Links are parsed locally and never reputation-checked or fetched.
- JSON export redacts body text, raw headers and recipient lists, but findings
  and URL evidence still require analyst inspection before controlled transfer.
- Deletion removes live evidence but cannot remove copies in earlier VM snapshots
  or previously exported reports.
