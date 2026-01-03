# Environment Variables für Valurion App

## Database
DATABASE_URL="postgresql://user:password@localhost:5432/valurion_db"

## NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

## AI APIs
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="your-openai-api-key"
TAVILY_API_KEY="your-tavily-api-key"  # Für News-Recherche im Unternehmen-Widget

## Cron Jobs
# Secret token for securing cron job endpoints
# Wird verwendet für: /api/cron/daily-news
CRON_SECRET="your-secure-cron-secret-change-in-production"

## File Storage (optional)
# UPLOAD_DIR="/path/to/uploads"
# MAX_FILE_SIZE="10485760" # 10MB in bytes

## Setup Instructions

1. Kopiere diese Datei zu `.env` im web-Verzeichnis
2. Ersetze alle Platzhalter mit echten Werten
3. Generiere sichere Secrets mit: `openssl rand -base64 32`
4. Füge niemals echte Secrets zu Git hinzu!
