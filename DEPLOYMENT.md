# Valurion Deployment Guide

## Standard Deployment Prozess
Der User führt das Deployment **immer manuell** im Terminal aus.
Der Agent (Antigravity) bereitet den Code vor (Commit & Push), aber führt `deploy.ps1` **NICHT** automatisch aus.

### Schritte für manuelles Deployment:

1.  **Code vorbereiten (Agent)**:
    - Änderungen committen und pushen: `git push origin main`

2.  **Deployment starten (User)**:
    - Im Terminal (`c:\DEV\Valurion App`):
      ```powershell
      .\deploy.ps1
      ```
    - Dies aktualisiert den Code auf dem Server, kopiert `.env` und `Caddyfile`, und startet Docker neu.

3.  **Datenbank Migration (falls Schema geändert)**:
    - Wenn `prisma/schema.prisma` geändert wurde:
      ```powershell
      ssh root@138.199.206.48 "cd /root/valurion && docker compose exec web npx prisma db push"
      ```

## Server Infos
- **IP**: 138.199.206.48
- **Domain**: https://valurion.mss-consulting.net
- **Technik**: Docker Compose, Caddy (Reverse Proxy & HTTPS), Next.js
- **Pfad am Server**: `/root/valurion`

## Troubleshooting
- **Logs ansehen**: `ssh root@138.199.206.48 "cd /root/valurion && docker compose logs -f web"`
- **Caddy Status**: `ssh root@138.199.206.48 "cd /root/valurion && docker compose logs -f caddy"`
