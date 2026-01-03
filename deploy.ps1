$ErrorActionPreference = 'Stop'
$ServerIP = "138.199.206.48"
$User = "root"
$RemotePath = "/root/valurion-app"
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

# 3. Install dependencies & Run Prisma Migration
Write-Host "`nStep 3: Installing dependencies and running migrations..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "cd $RemotePath/web && npm install && npx prisma generate && npx prisma migrate deploy"
if ($LASTEXITCODE -ne 0) { Write-Warning "Step 3 had issues, continuing..." }

# 4. Build Application
Write-Host "`nStep 4: Building application..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "cd $RemotePath/web && npm run build"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 4 failed"; exit 1 }

# 5. Restart PM2
Write-Host "`nStep 5: Restarting PM2..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "pm2 restart valurion-web"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 5 failed"; exit 1 }

# 6. Show Status
Write-Host "`nStep 6: Checking PM2 status..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "${User}@${ServerIP}" "pm2 status"

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "Application available at: http://${ServerIP}:3001" -ForegroundColor Cyan
Write-Host "`nTo view logs: ssh ${User}@${ServerIP} 'pm2 logs valurion-web'" -ForegroundColor Gray
