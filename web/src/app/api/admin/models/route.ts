import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const models: { openai: string[], gemini: string[] } = {
            openai: [],
            gemini: []
        };

        // Fetch OpenAI models
        if (process.env.OPENAI_API_KEY) {
            console.log('OpenAI API Key found, fetching models...');
            try {
                const openaiResponse = await fetch('https://api.openai.com/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                    }
                });

                console.log('OpenAI Response Status:', openaiResponse.status);
                if (openaiResponse.ok) {
                    const data = await openaiResponse.json();
                    console.log('OpenAI Response Data:', data);
                    models.openai = data.data
                        .filter((m: any) => m.id.includes('gpt'))
                        .map((m: any) => m.id)
                        .sort();
                    console.log('Filtered OpenAI models:', models.openai);
                } else {
                    const errorText = await openaiResponse.text();
                    console.error('OpenAI API Error:', openaiResponse.status, errorText);
                }
            } catch (err) {
                console.error('Failed to fetch OpenAI models:', err);
            }
        } else {
            console.log('No OpenAI API Key found');
        }

        // Fetch Gemini models
        if (process.env.GEMINI_API_KEY) {
            try {
                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);

                if (geminiResponse.ok) {
                    const data = await geminiResponse.json();

                    // Only include models that support function calling (1.5+, 2.0+, 2.5+)
                    const FUNCTION_CALLING_MODELS = [
                        'gemini-1.5-pro',
                        'gemini-1.5-flash',
                        'gemini-2.0-flash',
                        'gemini-2.0-pro',
                        'gemini-2.5-flash',
                        'gemini-2.5-pro',
                        'gemini-3-',  // Future versions
                    ];

                    models.gemini = data.models
                        .filter((m: any) => {
                            const modelName = m.name.replace('models/', '');
                            // Check if model name starts with any supported version
                            return FUNCTION_CALLING_MODELS.some(supported =>
                                modelName.startsWith(supported)
                            ) && m.supportedGenerationMethods?.includes('generateContent');
                        })
                        .map((m: any) => m.name.replace('models/', ''))
                        .sort();
                }
            } catch (err) {
                console.error('Failed to fetch Gemini models:', err);
            }
        }

        return NextResponse.json(models);
    } catch (error) {
        console.error('Failed to fetch models:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
}
