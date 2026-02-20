# Projekte-Widget - Dokumentation

## Übersicht

Das Projekte-Widget ermöglicht es Teams, dedizierte Projekt-Workspaces mit KI-Unterstützung, Team-Kollaboration und Dokumentenmanagement zu erstellen.

## Features

### 1. 📋 Projekt-Management
- **Projekt erstellen**: Mit oder ohne KI-Assistenten
- **Projekt-Beschreibung**: Ziele und Umfang definieren
- **Nicht-Ziele**: Scope-Grenzen festlegen
- **Übersichtsansicht**: Alle Projektdetails auf einen Blick

### 2. 🤖 KI-Assistent (Project Assistant)
- **Automatische Erstellung**: Meta-KI (Gemini 2.0 Flash Thinking) analysiert das Projekt und erstellt:
  - Optimierten System-Prompt
  - Beste Modellauswahl (OpenAI oder Gemini)
  - Optimale Temperature-Einstellung
- **Projektspezifisch**: Assistent kennt Projektziele und -kontext
- **Im Feed verfügbar**: Via `@ProjectAssistant` erwähnen

### 3. 👥 Team-Management
- **Mitglieder hinzufügen**: Per E-Mail-Adresse
- **Rollen**:
  - **Owner**: Vollzugriff, kann Mitglieder verwalten
  - **Member**: Kann am Projekt teilnehmen
- **Mitglieder entfernen**: Nur Owner können Mitglieder entfernen

### 4. 📁 Projekt-Dokumentenablage
- Separate Dokumentenablage pro Projekt
- Nur sichtbar für Projektmitglieder
- Integration mit bestehendem Dokumenten-System

### 5. 💬 Project Feed (Kollaborativer Chat)
- **Team-Chat**: Kommunikation zwischen Projektmitgliedern
- **@-Mentions für Assistenten**:
  - `@ProjectAssistant`: Projekt-spezifischer Assistent
  - `@Vertrags-Analyst`: Normale Assistenten aus der Assistant-Bibliothek
  - Assistenten geben EIN Statement ab, dann ist der Feed wieder nur für Menschen
- **Kontext-Awareness**: Assistenten kennen:
  - Projektbeschreibung und -ziele
  - Bisherige Feed-Unterhaltung
  - Projekt-Dokumente

## Technische Architektur

### Datenbank-Models

```prisma
// Projekt mit Assistant-Beziehung
model Project {
  id              String
  name            String
  description     String?
  nonGoals        String?
  assistantId     String?
  projectAssistant ProjectAssistant?
  members         ProjectMember[]
  feedMessages    ProjectFeedMessage[]
  documents       Document[]
  // ...
}

// Projekt-Mitglieder
model ProjectMember {
  id        String
  role      ProjectRole  // OWNER, MEMBER
  projectId String
  userId    String
  // ...
}

// Feed-Nachrichten
model ProjectFeedMessage {
  id                   String
  content              String
  type                 FeedMessageType  // USER, ASSISTANT_MENTION
  mentionedAssistantId String?
  projectId            String
  userId               String
  // ...
}

// Projekt-spezifischer Assistant
model ProjectAssistant {
  id                String
  name              String
  systemPrompt      String
  provider          String  // "OpenAI" oder "Gemini"
  modelId           String
  temperature       Float
  promptGeneratedBy String?  // Meta-AI Model-ID
  projectId         String
  // ...
}
```

### API-Endpunkte

#### Projekt-Verwaltung
- `GET /api/projects` - Alle Projekte des Users
- `POST /api/projects` - Neues Projekt erstellen
- `GET /api/projects/[id]` - Projekt-Details
- `PATCH /api/projects/[id]` - Projekt aktualisieren
- `DELETE /api/projects/[id]` - Projekt löschen (nur Owner)

#### Assistant-Erstellung
- `POST /api/projects/[id]/create-assistant` - KI-Assistent generieren

#### Team-Management
- `GET /api/projects/[id]/members` - Alle Mitglieder
- `POST /api/projects/[id]/members` - Mitglied hinzufügen (nur Owner)
- `DELETE /api/projects/[id]/members/[userId]` - Mitglied entfernen (nur Owner)

#### Feed
- `GET /api/projects/[id]/feed` - Feed-Messages abrufen
- `POST /api/projects/[id]/feed` - Nachricht senden (mit Auto-@mention-Erkennung)

### Meta-KI für Assistant-Generierung

Das System nutzt **Gemini 2.0 Flash Thinking** als Meta-KI:

1. **Input**: Projektbeschreibung, Ziele, Nicht-Ziele
2. **Analyse**: Meta-KI analysiert Projekt-Anforderungen
3. **Output**:
   - Optimierter System-Prompt
   - Provider-Wahl (OpenAI/Gemini)
   - Model-ID
   - Temperature
   - Reasoning (Begründung)

### @-Mention-System

#### Erkennungslogik
```typescript
const mentionRegex = /@(\w+[-\w]*)/g;
```

#### Ablauf
1. User sendet Nachricht mit `@AssistantName`
2. System erkennt Mention
3. Lädt relevanten Kontext:
   - Projektinfo
   - Bisherige Feed-Unterhaltung
   - Projekt-Dokumente (bei allgemeinen Assistenten)
4. Ruft AI-API auf
5. Speichert Assistant-Antwort als `ASSISTANT_MENTION`-Message
6. Zeigt Antwort im Feed an

## UI-Komponenten

### Projekt-Übersicht (`/dashboard/projects`)
- Grid-Layout mit Projekt-Karten
- "Neues Projekt" Button
- Empty State für neue User
- Projekt-Statistiken (Mitglieder, Dokumente)

### Projekt-Detail (`/dashboard/projects/[id]`)
- **Tab: Übersicht** - Beschreibung, Nicht-Ziele, Assistant-Info
- **Tab: Team** - Mitglieder-Liste, Hinzufügen/Entfernen
- **Tab: Dokumente** - Projekt-Dokumentenablage
- **Tab: Feed** - Kollaborativer Chat mit @-Mentions

### Modal: Projekt erstellen
- Projektname (erforderlich)
- Beschreibung & Ziele
- Nicht-Ziele
- Zwei Buttons:
  - "Nur Projekt erstellen"
  - "Mit KI-Assistent erstellen" (🤖)

## Zugriffskontrolle

### Projektmitglied
Kann:
- Projekt sehen
- Im Feed schreiben
- Dokumente sehen/hochladen

### Projekt-Owner
Kann zusätzlich:
- Mitglieder hinzufügen/entfernen
- Projekt bearbeiten/löschen
- KI-Assistenten erstellen

### Middleware-Check
```typescript
async function checkProjectAccess(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId }
  });
  return membership;
}
```

## Verwendungsbeispiele

### 1. Marketing-Kampagne
```
Name: Marketing Campaign Q1 2026
Beschreibung: Launch der neuen Produktlinie mit Focus auf Social Media
Nicht-Ziele: Keine TV-Werbung, kein Print
```
→ Meta-KI erstellt Marketing-spezifischen Assistenten

### 2. Softwareentwicklung
```
Name: Mobile App Redesign
Beschreibung: Komplettes UI/UX Redesign der iOS/Android App
Nicht-Ziele: Keine neuen Features, nur Design
```
→ Meta-KI erstellt Design/Development-Assistenten

### 3. Vertragsverhandlung
```
Name: Lieferantenvertrag Renewals
Beschreibung: Verhandlung der Jahresverträge mit Top-5 Lieferanten
Nicht-Ziele: Keine neuen Lieferanten
```
→ Meta-KI erstellt Legal/Contract-Assistenten

## Feed-Beispiel

```
Max M. (10:30)
Wie sollen wir das Budget aufteilen?

Anna K. (10:32)
@ProjectAssistant was ist deine Empfehlung?

🤖 Project Assistant (10:32)
Basierend auf euren Projektzielen empfehle ich eine 60/30/10 
Aufteilung: 60% für Content Creation, 30% für Paid Ads, 10% 
für Analytics. Dies entspricht eurer Strategie für organisches 
Wachstum mit gezielter Paid-Unterstützung.

Max M. (10:35)
Gut! @Vertrags-Analyst kannst du die Lieferantenverträge prüfen?

🤖 Vertrags-Analyst (10:35)
Ich habe die drei hochgeladenen Verträge analysiert. Alle enthalten 
Standard-Klauseln. Vertrag #2 hat eine ungewöhnlich lange 
Kündigungsfrist von 6 Monaten - empfehle Verhandlung auf 3 Monate.
```

## Nächste Schritte / V2 Features

### Priorität Hoch
- [ ] Dokument-Upload-Integration in Projekt-Tab
- [ ] Real-time Feed Updates (WebSocket)
- [ ] Assistant-Nachtraining mit Projekt-Feedback

### Priorität Mittel
- [ ] Projekt-Templates
- [ ] Projekt-Archivierung
- [ ] Aufgaben/Tasks im Projekt
- [ ] Projekt-Timeline/Milestones

### Priorität Niedrig
- [ ] Projekt-Export (PDF)
- [ ] Projekt-Statistiken/Analytics
- [ ] Integration mit externen Tools (Jira, Slack)

## Troubleshooting

### Problem: Assistant wird nicht erstellt
**Lösung**: Prüfe Gemini API Key in `.env`

### Problem: @mention funktioniert nicht
**Lösung**: 
1. Prüfe Assistant-Namen (case-insensitive)
2. Für ProjectAssistant erst Assistant erstellen
3. Feed-API Logs prüfen

### Problem: Mitglied kann nicht hinzugefügt werden
**Lösung**:
1. Prüfe dass User im selben Tenant ist
2. Prüfe dass User Owner-Rechte hat
3. E-Mail-Adresse muss exakt übereinstimmen

## Performance

- **Feed**: Max 100 Messages pro Load
- **Projekte**: Pagination bei >50 Projekten
- **Dokumente**: Lazy Loading bei >20 Dokumenten
- **Caching**: Project-Details werden gecacht

## Deployment

1. Prisma Schema pushen: `npx prisma db push`
2. Prisma Client generieren: `npx prisma generate`
3. Next.js Build: `npm run build`
4. Start: `npm run start` oder Deploy to Production

## Support

Bei Fragen oder Problemen:
- Dokumentation: `/docs/projects_widget_implementation.md`
- API Tests: Postman Collection erstellen
- Logs: Browser Console + Server Logs prüfen
