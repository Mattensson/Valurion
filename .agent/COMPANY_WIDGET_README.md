# Unternehmen Widget - Dokumentation

## Übersicht

Das Unternehmen Widget ist ein zentrales Feature der Valurion App, das drei Hauptfunktionen bietet:

1. **Unternehmensübersicht** - Verwaltung von Firmendaten
2. **Aktuelles** - KI-gestützte tägliche News-Recherche
3. **Unternehmensstrategie** - RAG-basiertes Strategie-Management

## Features

### 1. Unternehmensübersicht

Zeigt und verwaltet grundlegende Unternehmensinformationen:
- Firmenname
- Branche
- Mitarbeiteranzahl (automatisch aktualisiert)
- Gründungsdatum
- Unternehmensbeschreibung

**Admin-Funktionen:**
- Bearbeiten aller Unternehmensfelder
- Logo-Upload (geplant)

### 2. Aktuelles (News-Recherche)

**Automatische tägliche Recherche:**
- Nutzt Gemini AI für Web-Recherche
- Generiert strukturierte Zusammenfassungen
- Speichert Quellenangaben
- Wird täglich via Cron-Job ausgeführt

**Manuelle Recherche:**
- Admins können jederzeit eine neue Recherche starten
- Verhindert Duplikate (max. 1x pro Tag)

**Cron-Job Setup:**

Der Cron-Job sollte täglich ausgeführt werden:

```bash
# Beispiel: Täglich um 6:00 Uhr
curl -X POST https://your-domain.com/api/cron/daily-news \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Umgebungsvariable:**
```env
CRON_SECRET=your-secure-secret-key
```

### 3. Unternehmensstrategie (RAG-Integration)

**Strategie-Typen:**
- **GOAL** - Unternehmensziele
- **STRATEGY** - Strategien
- **INITIATIVE** - Aktuelle Initiativen
- **VALUE** - Unternehmenswerte

**RAG-Integration:**

Die Strategien werden automatisch als Kontext in folgenden Features verwendet:

#### Chat-Integration

```typescript
import { getCompanyStrategyContext } from '@/lib/companyContext';

// In deiner Chat-API:
const strategyContext = await getCompanyStrategyContext(tenantId);
const systemPrompt = `Du bist ein hilfreicher Assistent.${strategyContext}`;
```

#### Protokoll-Generierung

```typescript
import { getCompanyStrategyForProtocol } from '@/lib/companyContext';

// In deiner Protokoll-API:
const strategy = await getCompanyStrategyForProtocol(tenantId);

if (strategy.hasContext) {
  const prompt = `
    Erstelle ein Protokoll basierend auf diesem Transkript.
    
    Berücksichtige dabei folgende Unternehmensziele:
    ${strategy.goals.map(g => `- ${g.title}: ${g.description}`).join('\n')}
    
    Und diese Strategien:
    ${strategy.strategies.map(s => `- ${s.title}: ${s.description}`).join('\n')}
  `;
}
```

## API Endpoints

### Company

**GET** `/api/company`
- Holt Unternehmensdaten für aktuellen Tenant
- Erstellt automatisch Company-Eintrag falls nicht vorhanden
- Inkludiert News und Strategies

**PUT** `/api/company`
- Aktualisiert Unternehmensdaten
- Nur für Admins
- Body: `{ name, logo, industry, foundedDate, description }`

### Company News

**GET** `/api/company/news`
- Holt letzte 30 News-Einträge

**POST** `/api/company/news`
- Triggert neue News-Recherche
- Verhindert Duplikate (max. 1x pro Tag)
- Nutzt Gemini AI für Recherche

### Company Strategy

**GET** `/api/company/strategy`
- Holt alle Strategien (sortiert nach Priorität)

**POST** `/api/company/strategy`
- Erstellt neue Strategie
- Nur für Admins
- Body: `{ title, description, type, priority }`

**PUT** `/api/company/strategy/[id]`
- Aktualisiert Strategie
- Nur für Admins
- Body: `{ title?, description?, type?, priority?, isActive? }`

**DELETE** `/api/company/strategy/[id]`
- Löscht Strategie
- Nur für Admins

### Cron Job

**POST** `/api/cron/daily-news`
- Führt tägliche News-Recherche für alle Companies aus
- Benötigt Authorization Header mit CRON_SECRET
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

**GET** `/api/cron/daily-news`
- Status-Check für Cron-Job
- Zeigt letzte News-Daten für alle Companies

## Datenbank-Schema

```prisma
model Company {
  id              String   @id @default(uuid())
  name            String
  logo            String?
  industry        String?
  foundedDate     DateTime?
  employeeCount   Int      @default(0)
  description     String?  @db.Text
  
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  
  news            CompanyNews[]
  strategies      CompanyStrategy[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model CompanyNews {
  id              String   @id @default(uuid())
  title           String
  summary         String   @db.Text
  sourceUrls      String[]
  rawData         String?  @db.Text
  
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  researchDate    DateTime @default(now())
  createdAt       DateTime @default(now())
  
  @@index([companyId, researchDate])
}

model CompanyStrategy {
  id              String   @id @default(uuid())
  title           String
  description     String   @db.Text
  type            String   // "GOAL", "STRATEGY", "INITIATIVE", "VALUE"
  priority        Int      @default(0)
  isActive        Boolean  @default(true)
  
  embedding       String?  @db.Text // Für zukünftige Vektor-Suche
  
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([companyId, isActive])
}
```

## Deployment

### 1. Datenbank Migration

```bash
cd web
npx prisma migrate dev --name add_company_models
```

### 2. Umgebungsvariablen

```env
# .env
GEMINI_API_KEY=your-gemini-api-key
CRON_SECRET=your-secure-cron-secret
```

### 3. Cron-Job Setup (Vercel)

Erstelle `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-news",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Oder nutze einen externen Cron-Service wie:
- **cron-job.org**
- **EasyCron**
- **GitHub Actions**

Beispiel GitHub Action (`.github/workflows/daily-news.yml`):

```yaml
name: Daily Company News

on:
  schedule:
    - cron: '0 6 * * *'  # Täglich um 6:00 UTC
  workflow_dispatch:  # Manueller Trigger

jobs:
  trigger-news:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger News Research
        run: |
          curl -X POST https://your-domain.com/api/cron/daily-news \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Zukünftige Erweiterungen

### 1. Vektor-Embeddings für RAG
- Speichere Embeddings in `CompanyStrategy.embedding`
- Nutze Vektor-Datenbank (z.B. Pinecone, Weaviate)
- Semantische Suche in Strategien

### 2. Logo-Upload
- S3/Cloudinary Integration
- Bild-Optimierung
- Avatar-Generator als Fallback

### 3. Erweiterte News-Analyse
- Sentiment-Analyse
- Trend-Erkennung
- Wettbewerber-Monitoring

### 4. Team-Management
- Abteilungen/Teams
- Org-Chart Visualisierung
- Team-spezifische Strategien

### 5. Analytics Dashboard
- Strategie-Tracking
- KPI-Integration
- Progress-Visualisierung

## Troubleshooting

### News werden nicht generiert

1. Prüfe Gemini API Key:
   ```bash
   echo $GEMINI_API_KEY
   ```

2. Teste manuell:
   ```bash
   curl -X POST http://localhost:3000/api/company/news \
     -H "Cookie: next-auth.session-token=YOUR_SESSION"
   ```

3. Prüfe Logs in der Konsole

### Cron-Job läuft nicht

1. Prüfe CRON_SECRET:
   ```bash
   curl -X GET https://your-domain.com/api/cron/daily-news \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. Prüfe Vercel Cron Logs (bei Vercel Deployment)

3. Teste manuell mit curl

### Strategien erscheinen nicht im Chat

1. Prüfe ob Strategien aktiv sind (`isActive = true`)
2. Prüfe ob `getCompanyStrategyContext()` aufgerufen wird
3. Logge den generierten Context

## Support

Bei Fragen oder Problemen:
1. Prüfe die API-Logs
2. Teste Endpoints mit curl/Postman
3. Prüfe Datenbank-Einträge mit Prisma Studio: `npx prisma studio`
