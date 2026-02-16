# Restart and Rebuild Docker Containers
Write-Host "Stopping all containers..." -ForegroundColor Yellow
docker-compose down

Write-Host "`nRemoving old images..." -ForegroundColor Yellow
docker-compose rm -f

Write-Host "`nRebuilding and starting containers..." -ForegroundColor Cyan
docker-compose up --build -d

Write-Host "`nWaiting 10 seconds for containers to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host "`nChecking container status..." -ForegroundColor Cyan
docker-compose ps

Write-Host "`nTesting connectivity..." -ForegroundColor Cyan
Write-Host "API (port 4000): " -NoNewline
try { 
    Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 3 -UseBasicParsing | Out-Null
    Write-Host "✓" -ForegroundColor Green 
} catch { Write-Host "✗" -ForegroundColor Red }

Write-Host "Admin (port 8080): " -NoNewline
try { 
    Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 5 -UseBasicParsing | Out-Null
    Write-Host "✓" -ForegroundColor Green 
} catch { Write-Host "✗" -ForegroundColor Red }

Write-Host "`nOpening Admin Dashboard..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process "http://localhost:8080"
