param([ValidateSet('Probe','Visitors','Register','Run')][string]$Mode = 'Probe', [ValidateRange(2,3)][int]$AccountCount = 2)
$ErrorActionPreference = 'Stop'
$names = @('BUSCAG_STAGING_PUBLISHABLE_KEY','BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED','BUSCAG_STAGING_TEST_ACCOUNTS_JSON','BUSCAG_STAGING_TEST_APP_ORIGIN')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location (Join-Path $PSScriptRoot '..')
try {
  if (-not (Test-Path 'node_modules/@supabase/supabase-js')) { throw 'Primero instalar dependencias con npm.cmd ci.' }
  if (-not $env:BUSCAG_STAGING_PUBLISHABLE_KEY) { $env:BUSCAG_STAGING_PUBLISHABLE_KEY = Read-Host 'Clave PUBLICABLE de BuscAG-Staging (nunca service_role)' }
  if ($Mode -in @('Register','Run')) {
    Write-Host 'Solo cuentas FICTICIAS dedicadas en BuscAG-Staging. Se conservaran publicaciones e imagenes QA.'
    if (-not $env:BUSCAG_STAGING_TEST_ACCOUNTS_JSON) {
      $accounts = @()
      foreach ($number in 1..$AccountCount) {
        $email = Read-Host "Correo de cuenta ficticia $number"
        $secure = Read-Host "Contrasena de PRUEBA $number (no cuenta personal)" -AsSecureString
        $accounts += @{email=$email; password=([Net.NetworkCredential]::new('', $secure)).Password}
        $secure.Dispose()
      }
      $env:BUSCAG_STAGING_TEST_ACCOUNTS_JSON = ConvertTo-Json -InputObject $accounts -Compress
      $accounts = $null
    }
    $env:BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED = 'dedicated-test-accounts'
  }
  $argument = @{Probe='--probe';Visitors='--visitor-preflight';Register='--email-requests';Run='--run'}[$Mode]
  & node scripts/staging-live.mjs $argument
  if ($LASTEXITCODE -ne 0) { throw 'Pruebas no aprobadas; revisar el ultimo paso informado. No repetir escrituras a ciegas.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
  Pop-Location
}
