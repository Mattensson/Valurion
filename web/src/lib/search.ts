// Tavily Search Integration
export async function searchWeb(query: string): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        console.error('No Tavily API key found');
        return 'Search nicht verfügbar - kein API Key';
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 5
            })
        });

        if (!response.ok) {
            console.error('Tavily API Error:', await response.text());
            return 'Search fehlgeschlagen';
        }

        const data = await response.json();

        // Format results for LLM
        let result = '';

        if (data.answer) {
            result += `Zusammenfassung: ${data.answer}\n\n`;
        }

        result += 'Relevante Quellen:\n';
        data.results?.slice(0, 5).forEach((item: any, idx: number) => {
            result += `${idx + 1}. ${item.title}\n`;
            result += `   ${item.content}\n`;
            result += `   Quelle: ${item.url}\n\n`;
        });

        return result;
    } catch (error) {
        console.error('Tavily search error:', error);
        return 'Search fehlgeschlagen';
    }
}
