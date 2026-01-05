/**
 * Test-Beispiel für die DOCX-Engine
 * 
 * Dieses Beispiel zeigt, wie Sie das docx-engine Modul verwenden können.
 * Sie können diesen Code in einer Node.js-Umgebung oder API-Route ausführen.
 */

import { extractDocxData } from '@/lib/docx-engine';
import { readFile } from 'fs/promises';

/**
 * Beispiel 1: .docx Datei extrahieren
 */
async function example1_extractDocx() {
    console.log('=== Beispiel 1: .docx Datei extrahieren ===\n');

    try {
        // Lesen Sie eine .docx Datei von Ihrem Dateisystem
        const fileBuffer = await readFile('./test-files/beispiel.docx');

        // Extrahieren Sie den Text
        const result = await extractDocxData(fileBuffer, 'beispiel.docx');

        console.log('✓ Erfolgreich extrahiert mit:', result.extractionMethod);
        console.log('Textlänge:', result.text.length, 'Zeichen');
        console.log('\nErster Ausschnitt:');
        console.log(result.text.substring(0, 500) + '...\n');

    } catch (error: any) {
        console.error('✗ Fehler:', error.message);
    }
}

/**
 * Beispiel 2: .doc Datei extrahieren (verwendet Gemini)
 */
async function example2_extractDoc() {
    console.log('=== Beispiel 2: .doc Datei extrahieren (mit Gemini) ===\n');

    try {
        const fileBuffer = await readFile('./test-files/alt-dokument.doc');

        // .doc Dateien werden automatisch mit Gemini verarbeitet
        const result = await extractDocxData(fileBuffer, 'alt-dokument.doc');

        console.log('✓ Erfolgreich extrahiert mit:', result.extractionMethod);
        console.log('Textlänge:', result.text.length, 'Zeichen');
        console.log('\nErster Ausschnitt:');
        console.log(result.text.substring(0, 500) + '...\n');

    } catch (error: any) {
        console.error('✗ Fehler:', error.message);
    }
}

/**
 * Beispiel 3: Mit Zeichenlimit
 */
async function example3_withLimit() {
    console.log('=== Beispiel 3: Mit Zeichenlimit ===\n');

    try {
        const fileBuffer = await readFile('./test-files/langes-dokument.docx');

        // Extrahieren mit maximal 1000 Zeichen
        const result = await extractDocxData(
            fileBuffer,
            'langes-dokument.docx',
            { maxCharacters: 1000 }
        );

        console.log('✓ Erfolgreich extrahiert');
        console.log('Textlänge:', result.text.length, 'Zeichen (gekürzt)');
        console.log('\nText:');
        console.log(result.text);

    } catch (error: any) {
        console.error('✗ Fehler:', error.message);
    }
}

/**
 * Beispiel 4: Gemini für .docx erzwingen
 */
async function example4_forceGemini() {
    console.log('=== Beispiel 4: Gemini für .docx erzwingen ===\n');

    try {
        const fileBuffer = await readFile('./test-files/beispiel.docx');

        // Verwenden Sie Gemini statt Mammoth
        const result = await extractDocxData(
            fileBuffer,
            'beispiel.docx',
            { useGemini: true }
        );

        console.log('✓ Erfolgreich extrahiert mit:', result.extractionMethod);
        console.log('Textlänge:', result.text.length, 'Zeichen\n');

    } catch (error: any) {
        console.error('✗ Fehler:', error.message);
    }
}

/**
 * Beispiel 5: Nutzung in einer API Route
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return Response.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
        }

        // Datei in Buffer konvertieren
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Text extrahieren
        const result = await extractDocxData(buffer, file.name, {
            maxCharacters: 50000 // Limit für API
        });

        return Response.json({
            success: true,
            filename: file.name,
            method: result.extractionMethod,
            textLength: result.text.length,
            text: result.text
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return Response.json({
            error: 'Fehler beim Verarbeiten der Datei',
            message: error.message
        }, { status: 500 });
    }
}

/**
 * Alle Beispiele ausführen
 */
async function runAllExamples() {
    console.log('\n📄 DOCX-Engine Test-Suite\n');
    console.log('='.repeat(60) + '\n');

    await example1_extractDocx();
    await example2_extractDoc();
    await example3_withLimit();
    await example4_forceGemini();

    console.log('='.repeat(60));
    console.log('\n✓ Alle Tests abgeschlossen!\n');
}

// Wenn direkt ausgeführt
if (require.main === module) {
    runAllExamples().catch(console.error);
}
