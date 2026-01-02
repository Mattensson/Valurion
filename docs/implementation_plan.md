# Valurion V1 - Umsetzungsplan

Basierend auf dem PRD (Version 1.0) ist hier der strukturierte Umsetzungsplan für den Entwicklungszeitraum von 6–8 Wochen.

## Technologiestack (Vorschlag)
*   **Frontend**: Next.js (React) – Bietet Routing, Server-Side Rendering & API Routes für schnelle Entwicklung.
*   **Styling**: Vanilla CSS (Modern CSS Variables, Flexbox/Grid) – Für ein maßgeschneidertes, premium Look & Feel ohne Framework-Overhead.
*   **Backend / API**: Node.js (via Next.js API Routes oder separater Express Container) oder Python (FastAPI) für KI-Logik. *Empfehlung für V1: Next.js API Routes für Simplicity + Python Service für komplexe Document Parsing Tasks falls nötig, sonst reines Node.js.*
*   **Datenbank**: PostgreSQL – Relationales Modell für Mandanten, User und Logs.
*   **Container**: Docker & Docker Compose – Für Entwicklung und Hetzner-Deployment.
*   **AI**: OpenAI API & Google Gemini API (via Abstraktionslayer).

---

## Phase 1: Initiale Einrichtung & Architektur (Woche 1)

### 1.1 Projekt-Setup
*   [ ] Repository initialisieren.
*   [ ] Grundlegendes Next.js Projekt aufsetzen.
*   [ ] Docker Environment konfigurieren (App, DB, Adminer/PgAdmin).
*   [ ] CI/CD Pipeline Grundlagen (Build Check).

### 1.2 Datenbank & Datenmodellierung
*   [ ] PostgreSQL Container aufsetzen.
*   [ ] Schema Design:
    *   `Tenants` (Mandanten)
    *   `Users` (mit Rollen: User, Power User, Admin)
    *   `AuditLogs` (Use Case, Token Usage, Timestamp)
    *   `Documents` (Metadaten für RAG/Uploads)
*   [ ] Prisma oder Drizzle ORM einrichten.

### 1.3 Design System Foundation
*   [ ] `index.css` Setup mit CSS Variablen für Farben (Dark Mode primär), Typografie, Spacing.
*   [ ] Grundlegende UI-Komponenten erstellen (Button, Input, Card, Modal, ChatBubble).

---

## Phase 2: Core-Funktionalitäten & Backend (Woche 2-3)

### 2.1 Authentifizierung & Mandantenfähigkeit
*   [ ] Login-Screen implementieren.
*   [ ] Session Management (z.B. NextAuth.js oder eigener JWT Layer).
*   [ ] Middleware zur Sicherstellung der Mandantentrennung bei jedem API-Call.

### 2.2 AI Abstraktions-Layer
*   [ ] Service-Klasse erstellen, die zwischen OpenAI und Gemini wechseln kann.
*   [ ] Einheitliches Interface für Prompts definieren.
*   [ ] Error Handling & Retries implementieren.

### 2.3 Dokumenten-Verarbeitung (Basis)
*   [ ] File Upload API (PDF, Text).
*   [ ] Text-Extraktion (Parsing) aus Dokumenten für den Kontext.
*   [ ] Temporärer Storage Mechanismus (Pro Session/Request).

---

## Phase 3: Frontend & Spezifische Use Cases (Woche 4-5)

### 3.1 Chat Interface (Core UI)
*   [ ] Chat-Fenster mit History-Verlauf.
*   [ ] Umschalter: Freier Chat vs. Use-Case Modus.
*   [ ] Streaming-Response Support (für flüssiges UI-Gefühl).

### 3.2 Implementierung der Use Cases (Prompts & Logik)
*   [ ] **UC1 (Angebotsanalyse)**: Prompt-Engineering für strukturierte JSON-Ausgabe. Rendering der Analyse-Karte.
*   [ ] **UC2 (Vergleich)**: Logik für Multi-File-Handling. Rendering der Vergleichstabelle.
*   [ ] **UC3 (Entscheidung)**: Input-Formular für Kontext. Generierung der Pro/Contra Liste.
*   [ ] **UC4 (Meeting-Protokoll)**: Upload/Input für Notizen. Strukturierter Output.

---

## Phase 4: Governance, Admin & Finetuning (Woche 6)

### 4.1 Audit & Logging
*   [ ] Middleware/Hooks zum Loggen aller LLM-Anfragen (Tokens, Model, User).
*   [ ] Admin-Dashboard View für Logs (Tabelle).

### 4.2 Userverwaltung (Admin)
*   [ ] CRUD für User und Mandanten.
*   [ ] Token-Limits / Budget-Einstellungen (vorbereiten).

### 4.3 UI Polish & UX
*   [ ] Loading States & Error Messages verbessern.
*   [ ] Mobile Responsiveness prüfen (Web Client).
*   [ ] PDF Export Funktion für Ergebnisse.

---

## Offene Fragen zur Klärung vor Start
1.  Soll für das PDF-Parsing eine spezifische Library (z.B. PDF.js, Python-Lösungen) verwendet werden?
2.  Präferenz für Node.js Fullstack (Next.js) vs. Trennung Frontend/Backend? (Empfehlung: Next.js Monolith für V1 Geschwindigkeit).
