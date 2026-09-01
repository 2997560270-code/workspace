# Free port 3000 if a stale dev server holds it.
$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
  $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    Write-Host "[Product Drill] Stopping stale dev server (PID $p)..."
    try {
      Stop-Process -Id $p -Force -ErrorAction Stop
    } catch {
      Write-Host "[Product Drill] Could not stop PID $p automatically."
    }
  }
  Start-Sleep -Seconds 1
  $left = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($left) {
    $bp = $left | Select-Object -ExpandProperty OwningProcess -Unique
    Write-Host "[Product Drill] Port 3000 still in use by PID $bp. Close it, or run: taskkill /F /PID $bp"
    exit 1
  }
}
