Write-Host "=== GuardSync Admin - Clear Cache and Login ===" -ForegroundColor Cyan
Write-Host ""

# Open browser with cache disabled
Write-Host "Opening browser in incognito mode (no cache)..." -ForegroundColor Yellow
Start-Process "chrome" "--incognito http://localhost:8080"

Write-Host ""
Write-Host "=== Login Credentials ===" -ForegroundColor Green
Write-Host "Email:    admin@guardsync.com"
Write-Host "Password: Check Docker logs for auto-generated password"
Write-Host "Run: docker-compose logs api | grep 'INITIAL CREDENTIALS'"
Write-Host ""
Write-Host "If you don't have Chrome, manually:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:8080 in an incognito/private window"
Write-Host "2. OR press F12 > Application tab > Clear storage > Clear site data"
Write-Host "3. Then refresh the page (Ctrl+Shift+R or Cmd+Shift+R)"
