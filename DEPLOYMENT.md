# Deployment Guide for Valurion App

**Server IP:** `138.199.206.48`
**SSH User:** `root`
**Password:** `0987`

---

## 🚀 Option 1: Automatic Deployment (Recommended)

1. **Push your changes** to GitHub (`main` branch).
2. Open PowerShell in the project root.
3. Run the deployment script:
   ```powershell
   .\deploy.ps1
   ```
4. Enter the password (`0987`) when prompted (usually 3 times).

---

## 🛠️ Option 2: Manual Deployment

If the script fails, you can run these steps manually in your terminal.

### 1. Update Code on Server
Pulls the latest code from GitHub to the server.
```powershell
ssh root@138.199.206.48 "cd /root/valurion && git pull origin main"
```

### 2. Update Configuration (Only if .env changed)
Copies your local `.env` file to the server.
```powershell
scp .\web\.env root@138.199.206.48:/root/valurion/web/.env
```

### 3. Rebuild & Restart Application
Stops the old containers, rebuilds the images, and starts the new version.
```powershell
ssh root@138.199.206.48 "cd /root/valurion && docker compose up -d --build"
```

---

## 🗄️ Database Management

### Apply Schema Changes
If you changed `schema.prisma`, you need to update the database schema:
```powershell
ssh root@138.199.206.48 "cd /root/valurion && docker compose exec web npx prisma db push"
```

### Reset Database (Destructive!)
If you ever need to completely reset the database and re-seed the admin user:
```powershell
ssh root@138.199.206.48 "cd /root/valurion && docker compose exec web npx prisma migrate reset --force"
ssh root@138.199.206.48 "cd /root/valurion && docker compose exec web node prisma/seed.js"
```
