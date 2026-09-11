# Sandbox Verification Ledger

Phase b status: IN PROGRESS

Host prerequisites were re-inspected on 10 September 2026. Docker Desktop
4.90.0 through WSL 2 with Linux engine 29.7.2 was verified operational during
host preparation. VirtualBox 7.2.16 is installed, its drivers are running, and
`VBoxManage list hostinfo` reports
hardware virtualization support. On 11 September, host inspection directly
confirmed the Canonical ISO hash/size and a running registered `etd-prepare` VM
with UUID `0bf12794-55af-4ee9-ba6d-50379827ac6a`, 4 vCPUs, 6144 MiB RAM, a
40 GiB disk, NAT only on NIC1, disabled integration features and ejected ISO.
The user reports Ubuntu 24.04.4 installation and successful console login as
`adarsha`; automated guest access is not available to independently observe
those facts. `etd-test` does not exist, so no isolation preflight, application
test, model training/evaluation or fixture processing has run.

Populate `sandbox/reports/runtime/` only from the isolated Ubuntu test VM after
host-side hypervisor inspection passes.
