
const { extractPdfData } = require('../src/lib/pdf-engine');
const { readFile } = require('fs/promises');
const { join } = require('path');

async function test() {
    const filePath = join(process.cwd(), 'storage/documents/9d8adadd-f3c8-4a0f-a59f-5d586027789b.pdf');
    console.log('Reading file:', filePath);
    try {
        const buffer = await readFile(filePath);
        console.log('File read, size:', buffer.length);
        const data = await extractPdfData(buffer, { includePageNumbers: true });
        console.log('Extraction complete.');
        console.log('Text length:', data.text.length);
        console.log('First 100 chars:', data.text.substring(0, 100));
        console.log('Page count:', data.pageCount);
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
