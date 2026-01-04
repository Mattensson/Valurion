$ErrorActionPreference = 'Stop'
$ServerIP = "138.199.206.48"
$User = "root"
$RemotePath = "/root/valurion"
$LocalEnvPath = "web\.env"

Write-Host "Starting deployment to $ServerIP..." -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path "$PSScriptRoot\$LocalEnvPath")) {
    Write-Warning ".env file not found at $PSScriptRoot\$LocalEnvPath. Trying relative path..."
    if (-not (Test-Path "web\.env")) {
        Write-Error "Error: .env file not found."
        exit 1
    }
    else {
        $LocalEnvPath = "web\.env"
    }
}
else {
    $LocalEnvPath = "$PSScriptRoot\$LocalEnvPath"
}

# 1. Update Code on Server
Write-Host "`nStep 1: Updating code on server..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "cd $RemotePath && git pull origin main"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 1 failed"; exit 1 }

# 2. Copy .env file
Write-Host "`nStep 2: Copying .env file..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no $LocalEnvPath "${User}@${ServerIP}:${RemotePath}/web/.env"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 2 failed"; exit 1 }

# 2b. Copy Caddyfile
Write-Host "`nStep 2b: Copying Caddyfile..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no "$PSScriptRoot\Caddyfile" "${User}@${ServerIP}:${RemotePath}/Caddyfile"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 2b failed"; exit 1 }

# 3. Rebuild and Restart Docker Containers
Write-Host "`nStep 3: Rebuilding and restarting Docker containers..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "cd $RemotePath && docker compose down && docker compose up -d --build"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 3 failed"; exit 1 }

# 4. Show Docker Status
Write-Host "`nStep 4: Checking Docker status..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "cd $RemotePath && docker compose ps"

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "Application available at: http://${ServerIP}:3000" -ForegroundColor Cyan
Write-Host "`nTo view logs: ssh ${User}@${ServerIP} 'cd $RemotePath && docker compose logs -f web'" -ForegroundColor Gray
