export interface DocxExtractOptions {
    maxCharacters?: number;
    useGemini?: boolean; // For .doc files or as fallback
}

export interface DocxDocumentData {
    text: string;
    metadata?: any;
    extractionMethod: 'mammoth' | 'gemini';
}

/**
 * Robust DOCX/DOC Extraction Engine
 * - Uses mammoth for .docx files (native parsing)
 * - Uses Gemini 2.0 Flash for .doc files or as fallback
 */
export async function extractDocxData(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
    fileName: string,
    options: DocxExtractOptions = {}
): Promise<DocxDocumentData> {

    const data = fileBuffer instanceof Buffer
        ? fileBuffer
        : Buffer.from(fileBuffer as ArrayBuffer);

    const fileExtension = fileName.toLowerCase().endsWith('.doc') ? 'doc' : 'docx';
    const useGemini = options.useGemini || fileExtension === 'doc';

    // Strategy 1: Use Mammoth for .docx files
    if (!useGemini && fileExtension === 'docx') {
        try {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer: data });

            let extractedText = result.value.trim();

            // Apply character limit if specified
            if (options.maxCharacters && extractedText.length > options.maxCharacters) {
                extractedText = extractedText.substring(0, options.maxCharacters) + '... (Text gekürzt)';
            }

            if (extractedText.length === 0) {
                return {
                    text: "[SYSTEM INFO: Dieses Word-Dokument enthält keinen auslesbaren Text oder ist leer.]",
                    extractionMethod: 'mammoth',
                    metadata: {}
                };
            }

            return {
                text: extractedText,
                extractionMethod: 'mammoth',
                metadata: {
                    extractedBy: 'mammoth',
                    warnings: result.messages
                }
            };
        } catch (error) {
            console.warn('Mammoth extraction failed, falling back to Gemini:', error);
            // Fall back to Gemini if mammoth fails
            return extractWithGemini(data, fileExtension, options);
        }
    }

    // Strategy 2: Use Gemini for .doc files or as fallback
    return extractWithGemini(data, fileExtension, options);
}

/**
 * Extract document text using Gemini 2.0 Flash
 * Works for both .doc and .docx files
 */
async function extractWithGemini(
    data: Buffer,
    fileExtension: 'doc' | 'docx',
    options: DocxExtractOptions
): Promise<DocxDocumentData> {

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    const base64Data = data.toString('base64');

    try {
        const model = 'gemini-2.0-flash-exp';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const prompt = "Extrahiere den gesamten Text aus diesem Word-Dokument. Bewahre die Struktur und Formatierung soweit möglich (z.B. Absätze, Listen, Überschriften). Gib NUR den extrahierten Text zurück, keine zusätzlichen Kommentare.";

        // Determine MIME type
        const mimeType = fileExtension === 'doc'
            ? 'application/msword'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const requestBody = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
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
            console.error('Gemini DOCX Engine Error:', error);
            throw new Error(`Gemini API failed: ${response.status}`);
        }

        const result = await response.json();

        // Extract text from response
        if (!result.candidates || result.candidates.length === 0) {
            console.error('Gemini returned no candidates:', result);
            return {
                text: "[SYSTEM INFO: Word-Dokument konnte nicht analysiert werden. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.]",
                extractionMethod: 'gemini',
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
                text: "[SYSTEM INFO: Dieses Word-Dokument enthält keinen auslesbaren Text oder ist leer.]",
                extractionMethod: 'gemini',
                metadata: {}
            };
        }

        return {
            text: extractedText,
            extractionMethod: 'gemini',
            metadata: { extractedBy: 'gemini-2.0-flash-exp' }
        };

    } catch (error) {
        console.error("Gemini DOCX Engine Error:", error);
        throw new Error("Failed to extract Word document content using Gemini");
    }
}
