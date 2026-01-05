# Word-Dokument Modul - Architektur & Integration

## 📁 Dateien
- `web/src/lib/docx-engine.ts` - Hauptmodul für Word-Dokument Extraktion
- `web/src/app/api/chat/route.ts` - Integration in Chat API
- `web/src/app/dashboard/chat/page.tsx` - File-Upload UI (akzeptiert .docx/.doc)

## 🔄 Funktionsweise

```
┌─────────────────────────────────────────────────────────────────┐
│                         Benutzer                                │
│                            │                                    │
│                            ▼                                    │
│              ┌─────────────────────────┐                        │
│              │  Chat Interface         │                        │
│              │  (page.tsx)             │                        │
│              │  - File Upload Dialog   │                        │
│              │  - Drag & Drop          │                        │
│              └─────────────────────────┘                        │
│                            │                                    │
│                            │ Upload .docx/.doc                  │
│                            ▼                                    │
│              ┌─────────────────────────┐                        │
│              │  Chat API Route         │                        │
│              │  (route.ts)             │                        │
│              │  - processFileAttachment│                        │
│              └─────────────────────────┘                        │
│                            │                                    │
│               ┌──────────Provider?──────────┐                   │
│               │                              │                  │
│          Gemini                          OpenAI                 │
│               │                              │                  │
│               ▼                              ▼                  │
│    ┌──────────────────┐          ┌──────────────────┐          │
│    │ Native Processing│          │  Text Extraction │          │
│    │ (Base64)         │          │  (docx-engine)   │          │
│    └──────────────────┘          └──────────────────┘          │
│                                            │                    │
│                                            ▼                    │
│                              ┌──────────────────────┐           │
│                              │  docx-engine.ts      │           │
│                              └──────────────────────┘           │
│                                            │                    │
│                            ┌───────────FileType?────────────┐   │
│                            │                                 │   │
│                          .docx                             .doc  │
│                            │                                 │   │
│                            ▼                                 ▼   │
│                   ┌─────────────────┐            ┌──────────────┐
│                   │   Mammoth       │            │   Gemini AI  │
│                   │   (Native JS)   │            │   (API Call) │
│                   └─────────────────┘            └──────────────┘
│                            │                                 │   │
│                            └────────────┬────────────────────┘   │
│                                         │                        │
│                                         ▼                        │
│                            ┌─────────────────────────┐           │
│                            │  Extrahierter Text      │           │
│                            │  + Metadata             │           │
│                            └─────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Extraktionsstrategien

### 1. **Mammoth** (.docx)
- ✅ Native JavaScript Bibliothek
- ✅ Sehr schnell
- ✅ Offline-fähig
- ✅ Bewahrt Struktur (Absätze, Listen, Überschriften)
- ⚠️ Nur für .docx (Office Open XML)

### 2. **Gemini 2.0 Flash** (.doc oder Fallback)
- ✅ AI-basierte Extraktion
- ✅ Funktioniert mit alten .doc Dateien
- ✅ Fallback wenn Mammoth fehlschlägt
- ✅ OCR-fähig (für gescannte Dokumente)
- ⚠️ Erfordert API-Key
- ⚠️ Online-Verbindung erforderlich

## 🔀 Provider-spezifisches Verhalten

### Bei Gemini Provider:
```typescript
// Word-Dokument wird als Base64 an Gemini gesendet
images.push({
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    data: fileBuffer.toString('base64'),
    filename: originalFilename
});
```

### Bei OpenAI Provider:
```typescript
// Text wird serverseitig extrahiert
const docxData = await extractDocxData(fileBuffer, originalFilename, {
    maxCharacters: 50000
});
appendText(`\n\n--- INHALT DATEI '${originalFilename}' ---\n${docxData.text}\n...`);
```

## 📊 Datenfluss

```
User Upload → API Route → Provider Check
                              │
              ┌───────────────┴───────────────┐
              │                               │
           Gemini                         OpenAI
              │                               │
         Base64 send                   Extract Text
              │                               │
              │                        ┌──────┴──────┐
              │                        │             │
              │                    .docx           .doc
              │                        │             │
              │                     Mammoth       Gemini
              │                        │             │
              │                        └──────┬──────┘
              │                               │
              └───────────┬───────────────────┘
                          │
                    AI Response
```

## 🛠️ Verwendete Technologien

- **mammoth** (npm package) - .docx Parsing
- **Gemini 2.0 Flash** - AI-basierte Extraktion
- **Next.js API Routes** - Server-seitige Verarbeitung
- **Buffer/Base64** - Datei-Übertragung

## ⚙️ Konfiguration

### Erforderliche Umgebungsvariablen:
```env
GEMINI_API_KEY=your_api_key_here  # Für .doc Dateien und Fallback
```

### Installierte Pakete:
```bash
npm install mammoth  # Bereits installiert ✓
```

## 📝 Unterstützte Dateitypen

| Format | Extension | Methode | Status |
|--------|-----------|---------|--------|
| Word 2007+ | .docx | Mammoth | ✅ Aktiv |
| Word 97-2003 | .doc | Gemini | ✅ Aktiv |
| PDF | .pdf | Gemini / pdfjs | ✅ Vorhanden |
| Bilder | .png, .jpg, etc. | Base64 | ✅ Vorhanden |

## 🚀 Nächste Schritte

1. **Testen**: Word-Dokumente in Chat hochladen
2. **Validieren**: Beide Provider (Gemini & OpenAI) testen
3. **Optional**: Weitere Formate hinzufügen (z.B. .txt, .rtf)
4. **Optional**: Caching implementieren für große Dokumente

## 🔍 Debugging

Bei Problemen:
1. Console-Logs in `docx-engine.ts` prüfen
2. Extraction Method im Response überprüfen (`mammoth` vs `gemini`)
3. API-Key für Gemini validieren
4. Dateiformat bestätigen (.docx vs .doc)
