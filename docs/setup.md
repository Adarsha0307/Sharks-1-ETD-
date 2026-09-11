# Setup And Verification

Status: prepared, not executed

These commands are authorized only inside the Linux preparation/test VMs
described by `sandbox/README.md`. They have not been run. Exact transitive npm
and Python hash locks must be produced and reviewed in the preparation VM before
the isolated run.

## Preparation VM

1. Check out the selected Git revision and verify the worktree.
2. Resolve exact npm dependencies with Node.js 22.19.x and npm 10.x, producing
   the root `package-lock.json`.
3. Produce hash-locked Python requirements from `ml/requirements.in` using a
   pinned resolver. Replace the provisional direct-only `requirements.txt`.
4. Run dependency review/audit and record accepted exceptions; do not silently
   upgrade major versions.
5. Build `etd-backend:local`, `etd-frontend:local`, and `etd-ml:local` from the
   Dockerfiles. Cache PostgreSQL 16.9 and matching Playwright Chromium.
6. Cache the reviewed dataset, fixed splits and training dependencies, but do
   not train or evaluate a model in the connected preparation VM. `prd.md`,
   `rules.md` and `testing.md` require those executable actions to run only
   after isolation preflight passes in `etd-test`.
7. Create the empty external Docker volume `etd-model-artifacts` so offline
   Compose startup fails closed if the named volume is missing. After preflight,
   train/evaluate in `etd-test`, approve the resulting artifact, install its
   `model-manifest.json` and colocated artifact into that volume, and validate
   SHA-256. The synthetic seed corpus proves plumbing only, not accuracy.
8. Generate SHA-256 values for every fixture and update `fixtures/manifest.json`
   before cloning the test VM.

Example image-build commands, still NOT RUN:

```text
docker build -f backend/Dockerfile -t etd-backend:local .
docker build -f frontend/Dockerfile -t etd-frontend:local .
docker build -f ml/Dockerfile -t etd-ml:local .
```

## Isolated Test VM

1. Complete and sign `sandbox/hypervisor-checklist.md` from the host.
2. Create `sandbox/.env` and `sandbox/secrets/db_password.txt` with one random,
   disposable database password. Restrict the secret file to mode `0600`.
3. Run `bash sandbox/preflight.sh`. Stop if any gate fails.
4. Provision a disposable analyst after migration. Supply the password only in
   `ETD_PROVISION_PASSWORD`; do not put it in shell history or command arguments.
5. Run each test layer and record run ID, command, source/image/model/data
   versions, expected/actual result and report path in the phase-j ledger.

Commands to run only after preflight:

```text
npm run typecheck
npm test
PYTHONPATH=ml python -m pytest ml/tests
python ml/train.py
npm run schema --workspace @etd/tests
npm run e2e --workspace @etd/tests
```

Create the lab account in the API container using the documented provisioning
script after setting `ETD_PROVISION_PASSWORD` in that process environment:

```text
node backend/dist/scripts/create-user.js --username analyst
```

No public registration route exists.

## Demo Sequence

1. Open `http://127.0.0.1:8080` inside the guest browser.
2. Sign in with the disposable analyst account.
3. Upload `fixtures/eml/credential-link.eml`.
4. Observe queued/parsing/analysing/persisting and then a terminal state.
5. Inspect original hash metadata, defanged URLs, findings, authentication
   uncertainty, ML availability and limitations.
6. Reload to prove persisted job recovery, open History, and generate a
   permission-checked sanitized JSON export.
7. Upload benign fixtures and verify weak signals alone do not establish
   phishing.

## Reset

Use `bash sandbox/reset.sh --confirm-etd-lab-reset` only after checking the
project name. For resilience campaigns restore the exact powered-off baseline
snapshot, verify the marker is absent, and rerun preflight. Never use broad
Docker prune commands.
