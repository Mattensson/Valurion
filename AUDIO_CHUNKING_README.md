# Audio Chunking für Transkription

## Übersicht

Diese Implementierung ermöglicht es, Audio-Dateien über 25MB zu transkribieren, indem sie in kleinere Chunks aufgeteilt werden.

## Wie es funktioniert

1. **Datei-Check**: Wenn eine Datei über 25MB groß ist, wird sie automatisch in Chunks aufgeteilt
2. **Zeitbasiertes Splitting**: Die Datei wird zeitbasiert mit FFmpeg in ~20MB Chunks aufgeteilt
3. **Parallele Transkription**: Alle Chunks werden parallel an OpenAI Whisper gesendet
4. **Text-Zusammenführung**: Die einzelnen Transkripte werden zu einem vollständigen Text kombiniert
5. **Automatisches Cleanup**: Alle temporären Dateien werden nach der Verarbeitung gelöscht

## FFmpeg Installation

### Windows

1. **Über Chocolatey** (empfohlen):
   ```powershell
   choco install ffmpeg
   ```

2. **Manuell**:
   - Download von https://ffmpeg.org/download.html#build-windows
   - Entpacke die Dateien
   - Füge den `bin` Ordner zu deinem PATH hinzu

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
```

### macOS

```bash
brew install ffmpeg
```

### Überprüfung

Nach der Installation, teste mit:
```bash
ffmpeg -version
```

## Server Deployment

Für den Hetzner-Server musst du FFmpeg im Dockerfile installieren:

**Im `web/Dockerfile` hinzufügen:**

```dockerfile
# Vor dem npm install
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
```

## Konfiguration

- **Max. Dateigröße**: 150MB (konfigurierbar in `transcribe.ts`)
- **Chunk-Größe**: ~20MB (konfigurierbar in `audio-chunker.ts`)
- **Temp-Verzeichnis**: `web/temp/audio-chunks` (wird automatisch erstellt)

## Fehlerbehandlung

- Bei Fehlern im Chunking-Prozess werden alle temporären Dateien automatisch gelöscht
- Fehler werden geloggt und eine aussagekräftige Fehlermeldung wird zurückgegeben
- Wenn FFmpeg nicht installiert ist, erhältst du einen entsprechenden Fehler

## Leistung

- **Kleine Dateien (<25MB)**: Keine Performance-Einbußen
- **Große Dateien (>25MB)**: 
  - Chunking dauert ca. 1-3 Sekunden
  - Transkription läuft parallel → schneller als sequentiell
  - Gesamtzeit: ~10-30% langsamer als direkte Transkription einer kleinen Datei

## Dateien

- `web/src/lib/audio-chunker.ts` - Chunking-Logik
- `web/src/app/actions/transcribe.ts` - Transkriptions-Handler mit Chunking-Integration
