Plan: Streaming-Transkription mit Fortschritt (SSE)

Ziele
- Live-Text: Bereits transkribierte Chunks fortlaufend im UI anzeigen
- Fortschritt: Prozentuale Anzeige über gesamten Audioumfang
- UX: "Transkribieren"-Button wird gelb, zeigt Progress und Status (In Progress)
- Robust: Fehler-Handling, Abbruch (optional), Cleanup temporärer Dateien

High-Level-Ansatz
- Backend: Neue SSE-Route, die die Transkription chunkweise ausführt und Ereignisse streamt
- Frontend: Öffnet EventSource auf diese Route, aktualisiert Text und Fortschritt live
- Persistenz: Nach Abschluss wird ein Transkript gespeichert und im Archiv angezeigt

Backend-Änderungen
- Neue API-Route: /api/transcribe-stream (GET, SSE)
  - Auth prüfen (Session)
  - Query: finalPath (Pfad zur hochgeladenen Datei), source (UPLOAD|RECORDING)
  - Sicherheit: Nur Pfade unter temp/upload-sessions erlauben (Path Traversal vermeiden)
  - Ablauf:
    1) Datei-Metadaten einlesen und ggf. chunken (chunkAudioAtPath)
    2) Für jeden Chunk: transcribeSingleFile(chunk.path) sequenziell aufrufen
    3) Nach jedem Chunk: SSE-Event senden
       - type: "progress", data: { completedChunks, totalChunks, percent }
       - type: "partial", data: { textDelta, aggregateText }
    4) Abschluss: Titel generieren, in DB speichern, Cleanup, SSE-Event "done" mit { transcriptionId }
    5) Fehler: SSE-Event "error" mit { message }, dann Stream schließen
  - Technisches:
    - Headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
    - Heartbeat-Kommentare alle ~15s senden, um Verbindungen aktiv zu halten

- Gemeinsame Logik entkoppeln
  - Re-use: chunkAudioAtPath, transcribeSingleFile (bestehende Sicherheitschecks beibehalten)
  - Titelgenerierung (Chat Completions) in Helper extrahieren (optional)

SSE-Event-Schema
- progress: { completedChunks: number, totalChunks: number, percent: number }  // percent 0..100 (ganzzahlig)
- partial: { textDelta: string, aggregateText: string }
- done: { transcriptionId: string, text: string, title: string }
- error: { message: string }
- ping: {} // optional heartbeat-Kommentar: ":ping\n\n"

Frontend-Änderungen (page.tsx)
- Upload (unverändert): /api/upload-chunk verwenden, finalPath empfangen
- Start Streaming:
  - EventSource auf /api/transcribe-stream?path=encodeURIComponent(finalPath)&source=UPLOAD|RECORDING
  - State:
    - isProcessing: true/false
    - progress: 0..100
    - transcription (aggregateText)
  - Button-Zustände:
    - Idle: Blau, "Transkribieren"
    - In Progress: Gelb, zeigt "In Progress – {progress}%" (Füllstand des Buttons als Progress-Bar)
  - Event-Handler:
    - onmessage: je event.type differenzieren (progress, partial, done)
    - partial: aggregateText setzen; UI sofort aktualisieren
    - progress: Fortschritt aktualisieren
    - done: aggregate finalisieren, Transkript-Archiv neu laden, Status zurücksetzen
    - error: Fehlermeldung anzeigen, Status zurücksetzen
  - Abbruch (optional v1.1):
    - Cancel-Button, der EventSource.close() aufruft und Backend (später) per Signal abbricht

UI/UX-Details
- Der Transkriptionsbereich zeigt live wachsenden Text
- Button dient als Fortschrittsanzeige (Hintergrund-Füllung proportional zu percent)
- Upload-Tab: Beim Start wechselt der Button von Blau nach Gelb
- Recording-Tab: identisches Verhalten
- Optional: Kleine Fortschrittsleiste unter dem Titel

Fehlerfälle & Edge Cases
- Whisper 413: Bereits mitigiert durch kleine Chunks und Re-Encode; falls dennoch: SSE "error"
- Verbindungsabbruch: Frontend zeigt Hinweis und behält bisherige Teilergebnisse
- Timeout/Rate Limit: Sequenzielle Verarbeitung, optional Retry mit Backoff je Chunk (v1.1)
- Cleanup: Immer nach "done" oder bei Fehlern temporäre Dateien löschen

Akzeptanzkriterien
- Live-Text erscheint sukzessive während der Verarbeitung
- Fortschritt (%) steigt nachvollziehbar bis 100%
- Button-Farbe wechselt korrekt und zeigt Prozent
- Nach Abschluss wird Eintrag im Archiv sichtbar
- Bei Fehler erscheint Meldung, bereits empfangener Text bleibt erhalten

Implementierungsschritte
1) Backend: /api/transcribe-stream (SSE) implementieren
2) Sicherheit: Pfadvalidierung auf temp/upload-sessions
3) Sequenzielles Chunk-Processing + SSE-Events (progress, partial, done, error)
4) Frontend: EventSource-Client, State-Management, Button-Progress, Live-Text
5) Archiv-Reload nach "done"
6) Tests: Klein-/Großdateien, künstliche Fehlerpfade, Browser-Refresh während Stream
7) Optional: Cancel-Unterstützung, Retry/Backoff, Heartbeat-Handling verbessern
