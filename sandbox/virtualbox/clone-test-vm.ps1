param(
  [string]$VmRoot = "E:\VirtualBox VMs",
  [string]$PrepareName = "etd-prepare",
  [string]$TestName = "etd-test"
)

$ErrorActionPreference = "Stop"
$vboxManage = Join-Path $env:ProgramFiles "Oracle\VirtualBox\VBoxManage.exe"

if (-not (Test-Path -LiteralPath $vboxManage -PathType Leaf)) {
  throw "VBoxManage was not found at $vboxManage."
}
if (-not (Test-Path -LiteralPath $VmRoot -PathType Container)) {
  throw "VM root does not exist: $VmRoot."
}

$prepareInfo = & $vboxManage showvminfo $PrepareName --machinereadable
if ($LASTEXITCODE -ne 0) { throw "Preparation VM $PrepareName does not exist." }
if ($prepareInfo -notmatch 'VMState="poweroff"') {
  throw "$PrepareName must be powered off before cloning."
}

$existing = & $vboxManage list vms
if ($existing -match ('"' + [regex]::Escape($TestName) + '"')) {
  throw "Test VM $TestName already exists. Refusing to modify it."
}

& $vboxManage clonevm $PrepareName --name $TestName --basefolder $VmRoot --mode machine --register
if ($LASTEXITCODE -ne 0) { throw "Failed to clone $PrepareName." }

try {
  & $vboxManage modifyvm $TestName `
    --nic1 none --nic2 none --nic3 none --nic4 none `
    --nic5 none --nic6 none --nic7 none --nic8 none `
    --clipboard-mode disabled --drag-and-drop disabled `
    --audio-enabled off --usb-ohci off --usb-ehci off --usb-xhci off `
    --recording off --accelerate-3d off
  if ($LASTEXITCODE -ne 0) { throw "Failed to harden $TestName." }

  $testInfo = & $vboxManage showvminfo $TestName --machinereadable
  $prohibited = @(
    '^nic[1-8]="(?!none)',
    '^SharedFolderNameMachineMapping',
    '^clipboard="(?!disabled)',
    '^draganddrop="(?!disabled)',
    '^audio="(?!none)',
    '^usb="on"',
    '^ehci="on"',
    '^xhci="on"',
    '^vrde="on"',
    '^recording_enabled="on"'
  )
  foreach ($pattern in $prohibited) {
    if ($testInfo -match $pattern) {
      throw "Test VM inspection failed for prohibited pattern: $pattern"
    }
  }
} catch {
  & $vboxManage unregistervm $TestName --delete | Out-Null
  throw
}

Write-Output "Created powered-off $TestName with all eight virtual NIC slots disabled."
Write-Output "Inspect VBoxManage showvminfo output and complete sandbox/hypervisor-checklist.md before first boot."
