$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$desktop = 'C:\Users\MSI\Desktop'
$archive = Join-Path $desktop 'alasas-backup-20261011.zip.aes'
$wrapped = Join-Path $desktop 'alasas-backup-20261011.key.dpapi'
$tmp = Join-Path $env:TEMP ('alasas-decrypt-verify-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null

try {
  $key = [Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes($wrapped), $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $read = [IO.File]::ReadAllBytes($archive)
  $magic = [Text.Encoding]::ASCII.GetBytes("ALASAS-AESGCM-1`n")
  $offset = $magic.Length
  $magicMatches = $true
  for ($index = 0; $index -lt $offset; $index++) {
    if ($read[$index] -ne $magic[$index]) { $magicMatches = $false; break }
  }
  if (-not $magicMatches) {
    throw 'archive magic mismatch'
  }
  $nonce = $read[$offset..($offset + 11)]
  $tag = $read[($offset + 12)..($offset + 27)]
  $cipher = $read[($offset + 28)..($read.Length - 1)]
  $plain = New-Object byte[] $cipher.Length
  $aes = [Security.Cryptography.AesGcm]::new($key, 16)
  $aes.Decrypt($nonce, $cipher, $tag, $plain, $null)
  $zip = Join-Path $tmp 'backup.zip'
  [IO.File]::WriteAllBytes($zip, $plain)
  $out = Join-Path $tmp 'out'
  Expand-Archive -LiteralPath $zip -DestinationPath $out -Force
  $manifest = Get-Content (Join-Path $out 'manifest.json') -Raw | ConvertFrom-Json
  $verified = 0
  foreach ($entry in @($manifest)) {
    $entryName = [string]$entry.file
    $candidate = Join-Path $out ([IO.Path]::GetFileName($entryName))
    if (-not (Test-Path $candidate)) { throw "manifest file missing: $entryName" }
    $hash = (Get-FileHash $candidate -Algorithm SHA256).Hash
    if ($hash -ne $entry.sha256) { throw "hash mismatch: $entryName" }
    $verified++
  }
  [pscustomobject]@{ Result = 'PASS'; Scope = 'Current Windows account only'; FilesVerified = $verified; DataPrinted = $false } | ConvertTo-Json -Compress
}
finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
