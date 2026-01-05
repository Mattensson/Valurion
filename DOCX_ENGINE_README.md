# Word Document Engine (.docx / .doc)

Dieses Modul ermöglicht das Extrahieren von Text aus Word-Dokumenten (.docx und .doc).

## Installation

```bash
npm install mammoth
```

## Verwendung

### Import

```typescript
import { extractDocxData } from '@/lib/docx-engine';
```

### Beispiel 1: .docx Datei extrahieren (mit Mammoth)

```typescript
import { readFile } from 'fs/promises';
import { extractDocxData } from '@/lib/docx-engine';

async function processWordFile() {
    const fileBuffer = await readFile('./example.docx');
    
    const result = await extractDocxData(
        fileBuffer,
        'example.docx',
        {
            maxCharacters: 50000, // Optional: Zeichenlimit
            useGemini: false      // Standardmäßig wird Mammoth verwendet
        }
    );
    
    console.log('Extrahierter Text:', result.text);
    console.log('Extraktionsmethode:', result.extractionMethod); // 'mammoth' oder 'gemini'
}
```

### Beispiel 2: .doc Datei extrahieren (mit Gemini)

```typescript
async function processOldWordFile() {
    const fileBuffer = await readFile('./example.doc');
    
    // .doc Dateien werden automatisch mit Gemini verarbeitet
    const result = await extractDocxData(
        fileBuffer,
        'example.doc'
    );
    
    console.log('Extrahierter Text:', result.text);
    console.log('Verwendet Gemini:', result.extractionMethod === 'gemini');
}
```

### Beispiel 3: Gemini als Fallback für .docx erzwingen

```typescript
async function processWithGemini() {
    const fileBuffer = await readFile('./example.docx');
    
    const result = await extractDocxData(
        fileBuffer,
        'example.docx',
        { useGemini: true } // Erzwingt Gemini statt Mammoth
    );
    
    console.log('Extrahierter Text:', result.text);
}
```

## Eigenschaften

### `DocxExtractOptions`

```typescript
interface DocxExtractOptions {
    maxCharacters?: number;  // Maximale Anzahl Zeichen (optional)
    useGemini?: boolean;     // Erzwingt Gemini-Extraktion (optional)
}
```

### `DocxDocumentData`

```typescript
interface DocxDocumentData {
    text: string;                           // Extrahierter Text
    metadata?: any;                         // Zusätzliche Metadaten
    extractionMethod: 'mammoth' | 'gemini'; // Verwendete Extraktionsmethode
}
```

## Strategien

1. **Mammoth** (für .docx):
   - Native JavaScript-Bibliothek
   - Sehr schnell und zuverlässig
   - Unterstützt moderne .docx-Dateien
   - Bewahrt Struktur (Absätze, Listen, Überschriften)

2. **Gemini 2.0 Flash** (für .doc oder als Fallback):
   - Verwendet AI für Extraktion
   - Funktioniert mit alten .doc-Dateien
   - Fallback wenn Mammoth fehlschlägt
   - Erfordert `GEMINI_API_KEY` in `.env`

## Integration in Chat-API

Die Integration ist bereits abgeschlossen! Word-Dokumente (.docx und .doc) werden automatisch verarbeitet:

- **Bei Gemini-Provider**: Das komplette Dokument wird als Base64 an Gemini gesendet (native Verarbeitung)
- **Bei OpenAI-Provider**: Der Text wird serverseitig extrahiert und als Text an OpenAI gesendet

## Fehlerbehandlung

```typescript
try {
    const result = await extractDocxData(buffer, filename);
    console.log(result.text);
} catch (error) {
    console.error('Fehler beim Extrahieren:', error.message);
}
```

## Umgebungsvariablen

Für die Verwendung von Gemini (bei .doc-Dateien):

```env
GEMINI_API_KEY=your_api_key_here
```

## Akzeptierte Dateiformate

- `.docx` - Microsoft Word 2007+ (Office Open XML)
- `.doc` - Microsoft Word 97-2003
