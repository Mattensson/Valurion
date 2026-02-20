# Projekte-Widget - Implementierungsplan

## Übersicht
Das Projekte-Widget ermöglicht es Teams, dedizierte Projekt-Workspaces mit KI-Assistenten, Dokumentenablage und Kollaborations-Feed zu erstellen.

## Features

### 1. Projekt-Erstellung mit KI-Assistant
- Benutzer beschreibt das Projekt (Ziel, Umfang, etc.)
- Button "Create Project Assistant" erstellt automatisch:
  - Projekt-spezifischen KI-Assistenten
  - Optimierten System-Prompt (durch Meta-KI generiert)
  - Optimale Modellauswahl (durch Meta-KI bestimmt)

### 2. Team-Management
- Projektersteller kann Mitarbeiter hinzufügen
- Mitarbeiter sehen nur Projekte, zu denen sie zugewiesen sind
- Rollen: Owner, Member

### 3. Projekt-Dokumentenablage
- Separate Dokumentenablage pro Projekt
- Nur sichtbar für Projektmitglieder
- Re-use der bestehenden Document-Infrastruktur

### 4. Project-Feed (Kollaborativer Chat)
- Team-Chat für Projektmitarbeiter
- @-Mentions für Assistenten:
  - `@ProjectAssistant` - Projekt-spezifischer Assistant gibt ONE Statement ab
  - `@Vertrags-Analyst` - Normale Assistenten können eingebunden werden
- Assistenten geben nur EIN Statement ab, danach ist der Feed wieder für Menschen

## Datenbankschema

### Neue Models

```prisma
// Erweitert bestehende Project Model
model Project {
  id                String              @id @default(uuid())
  name              String
  description       String?             @db.Text
  nonGoals          String?             @db.Text
  
  // NEU für Projekt-Assistant
  assistantId       String?
  assistant         ProjectAssistant?   @relation(fields: [assistantId], references: [id])
  
  userId            String
  user              User                @relation(fields: [userId], references: [id])
  
  tenantId          String
  tenant            Tenant              @relation(fields: [tenantId], references: [id])
  
  // Beziehungen
  chats             Chat[]
  documents         Document[]
  members           ProjectMember[]     // NEU
  feedMessages      ProjectFeedMessage[] // NEU
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}

// NEU: Projekt-Mitglieder
model ProjectMember {
  id          String   @id @default(uuid())
  role        ProjectRole @default(MEMBER) // OWNER, MEMBER
  
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  addedAt     DateTime @default(now())
  
  @@unique([projectId, userId])
}

enum ProjectRole {
  OWNER
  MEMBER
}

// NEU: Project Feed Messages
model ProjectFeedMessage {
  id          String   @id @default(uuid())
  content     String   @db.Text
  type        MessageType @default(USER) // USER, ASSISTANT_MENTION
  
  // Wenn type = ASSISTANT_MENTION
  mentionedAssistantId String?
  assistant            Assistant? @relation(fields: [mentionedAssistantId], references: [id])
  
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  createdAt   DateTime @default(now())
}

enum MessageType {
  USER
  ASSISTANT_MENTION
}

// NEU: Projekt-spezifischer Assistant
model ProjectAssistant {
  id              String   @id @default(uuid())
  name            String   // z.B. "Marketing Campaign Q1 Assistant"
  systemPrompt    String   @db.Text
  provider        String   // Optimiert durch Meta-KI
  modelId         String   // Optimiert durch Meta-KI
  temperature     Float    @default(0.7)
  
  // Metadaten der KI-Generierung
  promptGeneratedBy String? // Model-ID der Meta-KI
  promptGeneratedAt DateTime?
  
  projectId       String   @unique
  project         Project?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## API Endpunkte

### Projekt-Management
- `POST /api/projects` - Neues Projekt erstellen
- `GET /api/projects` - Alle Projekte des Users abrufen
- `GET /api/projects/[id]` - Projekt-Details
- `PATCH /api/projects/[id]` - Projekt aktualisieren
- `DELETE /api/projects/[id]` - Projekt löschen

### Projekt-Assistant
- `POST /api/projects/[id]/create-assistant` - KI-Assistant für Projekt generieren
  - Input: Projektbeschreibung, Ziele
  - Output: Optimierter Prompt, Modellauswahl
  
### Team-Management
- `POST /api/projects/[id]/members` - Mitglied hinzufügen
- `DELETE /api/projects/[id]/members/[userId]` - Mitglied entfernen
- `GET /api/projects/[id]/members` - Alle Mitglieder abrufen

### Dokumenten-Management
- `POST /api/projects/[id]/documents` - Dokument hochladen
- `GET /api/projects/[id]/documents` - Projekt-Dokumente abrufen
- `DELETE /api/projects/[id]/documents/[docId]` - Dokument löschen

### Project-Feed
- `GET /api/projects/[id]/feed` - Feed-Messages abrufen
- `POST /api/projects/[id]/feed` - Neue Nachricht senden
  - Erkennt @-Mentions automatisch
  - Triggert Assistant-Antwort wenn @mention

## UI-Komponenten

### 1. Projekte-Übersicht (`/dashboard/projects`)
```
┌─────────────────────────────────────────┐
│  Projekte                     + Neu     │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 🚀 Projekt  │  │ 📊 Projekt  │      │
│  │    Alpha    │  │    Beta     │      │
│  │             │  │             │      │
│  │ 3 Mitgl.    │  │ 5 Mitgl.    │      │
│  │ 12 Docs     │  │ 8 Docs      │      │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

### 2. Projekt-Detail-Ansicht (`/dashboard/projects/[id]`)
```
┌─────────────────────────────────────────┐
│  📋 Projekt Alpha                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                         │
│  📝 Übersicht  👥 Team  📁 Docs  💬 Feed│
│  ─────────────────────────────────────  │
│                                         │
│  [Aktueller Tab Content]                │
│                                         │
└─────────────────────────────────────────┘
```

### 3. Projekt-Erstellung Dialog
```
┌─────────────────────────────────────────┐
│  Neues Projekt erstellen                │
├─────────────────────────────────────────┤
│  Projektname:                           │
│  [___________________________________]  │
│                                         │
│  Beschreibung & Ziele:                  │
│  [___________________________________]  │
│  [___________________________________]  │
│  [___________________________________]  │
│                                         │
│  Was ist NICHT Teil des Projekts:       │
│  [___________________________________]  │
│                                         │
│  [ Erstellen ]  [ Create with Assistant]│
└─────────────────────────────────────────┘
```

### 4. Project Feed
```
┌─────────────────────────────────────────┐
│  💬 Project Feed                        │
├─────────────────────────────────────────┤
│  Max M. (10:30)                         │
│  Wie sollen wir das Feature X angehen?  │
│                                         │
│  Anna K. (10:32)                        │
│  @ProjectAssistant was denkst du?       │
│                                         │
│  🤖 Project Assistant (10:32)           │
│  [Basierend auf euren Projektzielen...] │
│                                         │
│  [Nachricht eingeben... @mention]       │
└─────────────────────────────────────────┘
```

## Implementierungs-Schritte

### Phase 1: Datenbankschema (Tag 1)
1. ✅ Schema erweitern (ProjectMember, ProjectFeedMessage, ProjectAssistant)
2. ✅ Migrationen erstellen
3. ✅ User Model um ProjectMember Relation erweitern

### Phase 2: Backend APIs (Tag 2-3)
1. Projekt CRUD APIs
2. Team-Management APIs
3. Meta-KI API für Assistant-Generierung
4. Feed-APIs mit @-Mention Parsing

### Phase 3: UI Komponenten (Tag 4-6)
1. Projekt-Übersichtsseite
2. Projekt-Erstellungsdialog
3. Projekt-Detail-Tabs (Übersicht, Team, Docs)
4. Project-Feed Komponente
5. @-Mention Autocomplete

### Phase 4: Integration (Tag 7)
1. Navigation/Sidebar erweitern
2. Dokumenten-Upload an Projekt binden
3. Assistant-Integration in Feed
4. Testing & Bug Fixes

## Meta-KI Prompt für Assistant-Generierung

```typescript
const META_PROMPT = `Du bist ein KI-Experte, der optimale System-Prompts für Projekt-Assistenten erstellt.

PROJEKT-INFORMATIONEN:
Name: ${projectName}
Beschreibung: ${projectDescription}
Ziele: ${projectGoals}
Nicht-Ziele: ${projectNonGoals}

AUFGABE:
1. Analysiere das Projekt
2. Erstelle einen optimalen System-Prompt für einen KI-Assistenten
3. Wähle das beste Modell (OpenAI oder Gemini) und spezifische Model-ID
4. Setze optimale Temperature

AUSGABE (JSON):
{
  "systemPrompt": "...",
  "provider": "OpenAI|Gemini",
  "modelId": "gpt-4|gemini-2.0-flash-exp|...",
  "temperature": 0.7,
  "reasoning": "Warum diese Konfiguration optimal ist"
}`;
```

## Sicherheit & Berechtigungen

### Zugriffskontrolle
- Nur Projektmitglieder können:
  - Projekt-Details sehen
  - Dokumente sehen/hochladen
  - Feed lesen/schreiben
  
- Nur Projekt-Owner kann:
  - Mitglieder hinzufügen/entfernen
  - Projekt löschen
  - Projekt-Assistant erstellen/ändern

### Middleware Check
```typescript
async function checkProjectAccess(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId }
    }
  });
  
  if (!membership) {
    throw new Error('Access denied');
  }
  
  return membership;
}
```

## Performance-Überlegungen

1. **Feed Pagination**: Max 50 Messages pro Load
2. **Dokument-Liste**: Lazy Loading bei >20 Dokumenten
3. **Projekt-Liste**: Pagination bei >50 Projekten
4. **Real-time Updates**: Optional WebSocket für Feed (V2)

## Testing-Checklist

- [ ] Projekt erstellen
- [ ] Assistant generieren
- [ ] Mitglied hinzufügen
- [ ] Dokument hochladen
- [ ] Feed-Nachricht senden
- [ ] @ProjectAssistant erwähnen
- [ ] @normaler-Assistant erwähnen
- [ ] Zugriffsrechte (nicht-Mitglied)
- [ ] Projekt löschen (CASCADE)
