param(
  [string]$TestName = "etd-test",
  [string]$ReportPath = "sandbox\reports\host-virtualbox-inspection.txt"
)

$ErrorActionPreference = "Stop"
$vboxManage = Join-Path $env:ProgramFiles "Oracle\VirtualBox\VBoxManage.exe"
$reportParent = Split-Path -Parent $ReportPath

if (-not (Test-Path -LiteralPath $vboxManage -PathType Leaf)) {
  throw "VBoxManage was not found at $vboxManage."
}
if ($reportParent -and -not (Test-Path -LiteralPath $reportParent -PathType Container)) {
  throw "Report parent does not exist: $reportParent."
}

$vmInfo = & $vboxManage showvminfo $TestName --machinereadable
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect test VM $TestName." }
$snapshots = & $vboxManage snapshot $TestName list --machinereadable 2>&1
if ($LASTEXITCODE -ne 0) { $snapshots = "no_snapshots_recorded" }

$lines = @(
  "timestamp=$([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))",
  "virtualbox_version=$(& $vboxManage --version)",
  "test_vm=$TestName",
  "",
  "--- showvminfo ---",
  $vmInfo,
  "",
  "--- snapshots ---",
  $snapshots
)

$lines | Set-Content -LiteralPath $ReportPath -Encoding utf8
Write-Output "Wrote host inspection evidence to $ReportPath. Review and sign the checklist manually."
