$ErrorActionPreference = 'Stop'
$ServerIP = "138.199.206.48"
$User = "root"
$RemotePath = "/root/valurion"
$LocalEnvPath = "web\.env"

Write-Host "Starting deployment to $ServerIP..."

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
Write-Host "Step 1: Updating code on server..."
# Using single line to avoid CRLF issues
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=no "${User}@${ServerIP}" "if [ ! -d '$RemotePath' ]; then echo 'Cloning repository...'; git clone https://github.com/Mattensson/Valurion.git $RemotePath; else echo 'Pulling latest changes...'; cd $RemotePath; git pull origin main; fi"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 1 failed"; exit 1 }

# 2. Copy .env file
Write-Host "Step 2: Copying .env file..."
scp -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=no $LocalEnvPath "${User}@${ServerIP}:${RemotePath}/web/.env"
if ($LASTEXITCODE -ne 0) { Write-Error "Step 2 failed"; exit 1 }

# 3. Restart Services
Write-Host "Step 3: Restarting Docker services..."
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=no "${User}@${ServerIP}" "cd $RemotePath; docker compose down; docker compose up -d --build"

Write-Host "Deployment complete! Application should be available at http://${ServerIP}:3000"
