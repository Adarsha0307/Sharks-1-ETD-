# Hypervisor Inspection Record

Status: HOST POWERED-OFF INSPECTION PASSED; GUEST/RUNTIME ITEMS PENDING

- Run ID: `20260917T111025Z-phase-b-host`
- UTC time: 2026-09-17T11:10:25Z
- Inspector: OpenCode agent; user review pending
- Hypervisor and version: Oracle VirtualBox 7.2.16r174877
- Guest name/UUID: `etd-test` / `3f723306-41ef-4ce7-80de-0b0feab6c3c7`
- Guest OS/version: Ubuntu 24.04 LTS clone; in-guest confirmation pending
- Source revision: `d1544f6760fb7257558696e980fb6427efdf4466`
- Allocated vCPU/RAM/disk: 4 vCPU / 6144 MiB / 40 GiB dynamic VDI
- Powered-off baseline snapshot UUID: pending preflight

Mark each item PASS, FAIL, or BLOCKED and attach sanitized host-side evidence.

- All virtual NICs removed or disconnected: PASS - NIC1 through NIC8 are `none`.
- NAT and port forwarding absent: PASS - no NIC or forwarding entry exists.
- Bridged and host-only adapters absent: PASS.
- Shared folders absent: PASS.
- Clipboard disabled: PASS; file transfers also disabled.
- Drag-and-drop disabled: PASS.
- Host disk mappings absent: PASS - only cloned guest VDI is attached.
- USB/device passthrough disabled: PASS - OHCI/EHCI/xHCI off; no filters.
- Guest integration minimized: PASS for configured integration surfaces; console display retained.
- Temporary transfer media detached: PASS - every IDE slot is `none`.
- Production credentials and real mailbox accounts absent: PASS by project/secret inspection; disposable lab values only.
- Guest IPv4 host/LAN/Internet probes blocked: PENDING guest preflight.
- Guest IPv6 host/LAN/Internet probes blocked: PENDING guest preflight.
- Guest external DNS blocked: PENDING guest preflight.
- Intended guest-local Docker traffic succeeds: PENDING guest preflight.
- Only guest loopback port 8080 published: PENDING effective runtime inspection.
- Actual containers match non-root/restriction/resource expectations: PENDING effective runtime inspection.
- Offline cold start used no pull/build/download: PENDING guest preflight.
- Baseline snapshot restore marker check passes: PENDING baseline creation/restore.

Decision: Host-side boundary is PASS for first boot. Fixture processing remains
blocked until all guest/runtime PENDING rows pass. Evidence:
`sandbox/reports/host-virtualbox-inspection.txt`, SHA-256
`8ac6a900ae34cbe94d2a67b26f6c8f428943997fbd50623c633a6b3115e275b2`.
