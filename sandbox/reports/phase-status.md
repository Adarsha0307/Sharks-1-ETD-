# Sandbox Verification Ledger

Phase b status: IN PROGRESS

Host prerequisites were re-inspected on 10 September 2026. Docker Desktop
4.90.0 through WSL 2 with Linux engine 29.7.2 was verified operational during
host preparation. VirtualBox 7.2.16 is installed, its drivers are running, and
`VBoxManage list hostinfo` reports
hardware virtualization support. On 11 September, host inspection directly
confirmed the Canonical ISO hash/size and a running registered `etd-prepare` VM
with UUID `0bf12794-55af-4ee9-ba6d-50379827ac6a`, 4 vCPUs, 6144 MiB RAM, a
40 GiB disk and NAT only on NIC1. SSH was installed by the user and host port
2222 is temporarily forwarded to guest port 22 for preparation access. Direct
SSH inspection confirmed Ubuntu 24.04, hostname `etd-prepare`, user `adarsha`,
the guest filesystem and the installed preparation tool versions. Clipboard,
file clipboard and drag-and-drop were directly returned to disabled state.

The source was transferred as a complete Git bundle at revision `16d2380`, and
the guest generated an npm lock and hash-locked Python requirements in an
unpublished guest-only commit. The first image build reproduced TypeScript
compile failures; after minimal fixes, all three local application images built
successfully in `etd-prepare`. The user-provided Kaggle and Hugging Face dataset
candidates were downloaded and hash-verified; the CSV-only Kaggle ZIP was
extracted and both candidates received aggregate structural, privacy and
overlap inspection. No model was trained or evaluated, and neither dataset is
approved as-is. `etd-test` does not exist, so no isolation preflight,
application test or fixture processing has run.

Populate `sandbox/reports/runtime/` only from the isolated Ubuntu test VM after
host-side hypervisor inspection passes.
