param(
  [Parameter(Mandatory = $true)]
  [string]$IsoPath,
  [string]$VmRoot = "E:\VirtualBox VMs",
  [int]$MemoryMb = 6144,
  [int]$CpuCount = 4,
  [int]$DiskSizeMb = 40960
)

$ErrorActionPreference = "Stop"
$vboxManage = Join-Path $env:ProgramFiles "Oracle\VirtualBox\VBoxManage.exe"
$prepareName = "etd-prepare"
$testName = "etd-test"

if (-not (Test-Path -LiteralPath $vboxManage -PathType Leaf)) {
  throw "VBoxManage was not found at $vboxManage."
}
if (-not (Test-Path -LiteralPath $IsoPath -PathType Leaf)) {
  throw "Ubuntu ISO was not found at $IsoPath."
}
if (-not (Test-Path -LiteralPath $VmRoot -PathType Container)) {
  throw "VM root does not exist: $VmRoot. Create and inspect it before rerunning."
}

$isoHash = (Get-FileHash -LiteralPath $IsoPath -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedHash = "e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433"
if ((Split-Path -Leaf $IsoPath) -eq "ubuntu-24.04.4-live-server-amd64.iso" -and $isoHash -ne $expectedHash) {
  throw "Ubuntu 24.04.4 ISO SHA-256 did not match Canonical's published value."
}

$existing = & $vboxManage list vms
if ($LASTEXITCODE -ne 0) { throw "Unable to list VirtualBox VMs." }
if ($existing -match ('"' + [regex]::Escape($prepareName) + '"') -or $existing -match ('"' + [regex]::Escape($testName) + '"')) {
  throw "A VM named $prepareName or $testName already exists. Refusing to modify it."
}

$vmFolder = Join-Path $VmRoot $prepareName
$diskPath = Join-Path $vmFolder "$prepareName.vdi"
& $vboxManage createvm --name $prepareName --ostype Ubuntu24_LTS_64 --basefolder $VmRoot --register
if ($LASTEXITCODE -ne 0) { throw "Failed to create $prepareName." }

try {
  & $vboxManage modifyvm $prepareName `
    --memory $MemoryMb --cpus $CpuCount --vram 16 `
    --graphicscontroller vmsvga --accelerate-3d off `
    --firmware efi --ioapic on --pae on --paravirt-provider default `
    --clipboard-mode disabled --drag-and-drop disabled `
    --audio-enabled off --usb-ohci off --usb-ehci off --usb-xhci off `
    --recording off `
    --nic1 nat --nic2 none --nic3 none --nic4 none `
    --nic5 none --nic6 none --nic7 none --nic8 none
  if ($LASTEXITCODE -ne 0) { throw "Failed to configure $prepareName." }

  & $vboxManage createmedium disk --filename $diskPath --size $DiskSizeMb --format VDI --variant Standard
  if ($LASTEXITCODE -ne 0) { throw "Failed to create the VM disk." }
  & $vboxManage storagectl $prepareName --name "SATA" --add sata --controller IntelAhci --portcount 2 --bootable on
  & $vboxManage storageattach $prepareName --storagectl "SATA" --port 0 --device 0 --type hdd --medium $diskPath
  & $vboxManage storagectl $prepareName --name "IDE" --add ide
  & $vboxManage storageattach $prepareName --storagectl "IDE" --port 0 --device 0 --type dvddrive --medium $IsoPath
  & $vboxManage modifyvm $prepareName --boot1 dvd --boot2 disk --boot3 none --boot4 none
  if ($LASTEXITCODE -ne 0) { throw "Failed to attach storage to $prepareName." }
} catch {
  & $vboxManage unregistervm $prepareName --delete | Out-Null
  throw
}

[pscustomobject]@{
  PreparationVm = $prepareName
  TestVm = "not created until preparation is complete"
  Iso = (Resolve-Path -LiteralPath $IsoPath).Path
  IsoSha256 = $isoHash
  VmRoot = (Resolve-Path -LiteralPath $VmRoot).Path
  MemoryMb = $MemoryMb
  CpuCount = $CpuCount
  DiskSizeMb = $DiskSizeMb
} | Format-List

Write-Output "Created $prepareName with NAT for reviewed dependency preparation only."
Write-Output "Install and prepare Ubuntu, power it off, then run clone-test-vm.ps1."
