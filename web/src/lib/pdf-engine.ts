import { join } from 'path';

// Polyfills for pdfjs-dist in Node.js environment
// These are required because pdfjs-dist assumes a browser environment with Canvas/DOM support
if (typeof (global as any).DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix { };
}
if (typeof (global as any).ImageData === 'undefined') {
    (global as any).ImageData = class ImageData { };
}
if (typeof (global as any).Path2D === 'undefined') {
    (global as any).Path2D = class Path2D { };
}

export interface PdfExtractOptions {
    maxPages?: number;
    maxCharacters?: number;
    includePageNumbers?: boolean;
}

export interface PdfDocumentData {
    text: string;
    pageCount: number;
    metadata?: any;
    pages: string[]; // text per page
}

/**
 * Robust PDF Extraction Engine
 * Uses Gemini 2.5 Flash internally for maximum quality and OCR support
 * Works independently of the user's selected chat model
 */
export async function extractPdfData(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
    options: PdfExtractOptions = {}
): Promise<PdfDocumentData> {

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    // Convert to base64
    const data = fileBuffer instanceof Buffer
        ? fileBuffer
        : Buffer.from(fileBuffer as ArrayBuffer);

    const base64Data = data.toString('base64');

    try {
        // Use Gemini 2.5 Flash for PDF extraction
        const model = 'gemini-2.0-flash-exp';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const prompt = options.includePageNumbers
            ? "Extrahiere den gesamten Text aus diesem PDF-Dokument. Gib die Seitennummern an (Format: '--- Seite X ---'). Bewahre die Struktur und Formatierung soweit möglich. Gib NUR den extrahierten Text zurück, keine zusätzlichen Kommentare."
            : "Extrahiere den gesamten Text aus diesem PDF-Dokument. Bewahre die Struktur und Formatierung soweit möglich. Gib NUR den extrahierten Text zurück, keine zusätzlichen Kommentare.";

        const requestBody = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: base64Data
                        }
                    }
                ]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini PDF Engine Error:', error);
            throw new Error(`Gemini API failed: ${response.status}`);
        }

        const result = await response.json();

        // Extract text from response
        if (!result.candidates || result.candidates.length === 0) {
            console.error('Gemini returned no candidates:', result);
            return {
                text: "[SYSTEM INFO: PDF konnte nicht analysiert werden. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.]",
                pageCount: 0,
                pages: [],
                metadata: {}
            };
        }

        const textParts = result.candidates[0].content.parts
            .filter((p: any) => p.text)
            .map((p: any) => p.text)
            .join('\n');

        let extractedText = textParts.trim();

        // Apply character limit if specified
        if (options.maxCharacters && extractedText.length > options.maxCharacters) {
            extractedText = extractedText.substring(0, options.maxCharacters) + '... (Text gekürzt)';
        }

        // Check if empty
        if (extractedText.length === 0) {
            return {
                text: "[SYSTEM INFO: Diese PDF enthält keinen auslesbaren Text oder ist leer.]",
                pageCount: 0,
                pages: [],
                metadata: {}
            };
        }

        // Parse pages if page markers exist
        const pages: string[] = [];
        const pageMatches = extractedText.match(/--- Seite \d+ ---/g);
        const pageCount = pageMatches ? pageMatches.length : 1;

        if (pageMatches) {
            const pageSplit = extractedText.split(/--- Seite \d+ ---/);
            pageSplit.slice(1).forEach((page: string) => pages.push(page.trim()));
        } else {
            pages.push(extractedText);
        }

        return {
            text: extractedText,
            pageCount: pageCount,
            pages: pages,
            metadata: { extractedBy: 'gemini-2.0-flash-exp' }
        };

    } catch (error) {
        console.error("PDF Engine Error:", error);
        throw new Error("Failed to extract PDF content using Gemini");
    }
}
