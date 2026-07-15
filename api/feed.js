export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const MAX_RETRIES = 3;
    
    // Helper to perform fetch with retry
    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return await response.json();
                throw new Error(`Provider returned ${response.status}`);
            } catch (err) {
                if (i === retries - 1) throw err; // Throw on last attempt
                // Wait 500ms before retrying (exponential backoff could be added here)
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    try {
        const json = await fetchWithRetry('http://94.130.136.44:4445/getdata', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'x-application': '64bt9cG6g0dZ2A4j985lmt1Bb6'
            },
            signal: AbortSignal.timeout(5000)
        });

        // Clean and transform data
        const cleanedData = (json.data || []).map(item => ({
            id: `${item.Symbol?.trim()}-${item['Ser/Exp']?.trim()}`,
            symbol: item.Symbol?.trim(),
            expiry: item['Ser/Exp']?.trim(),
            code: item.Code?.trim() || '',
            ltp: parseFloat(item.LTP) || 0,
            buy: parseFloat(item.BUY) || 0,
            sell: parseFloat(item.SELL) || 0,
            high: parseFloat(item.High) || 0,
            low: parseFloat(item.Low) || 0,
            open: parseFloat(item.Open) || 0,
            change: parseFloat(item.Change) || 0,
            changePercent: parseFloat(item['% Change']) || 0,
            volume: parseInt(item.Vol) || 0,
            oi: parseInt(item.OI) || 0,
            updateTime: item['Last Update Time']
        }));

        res.status(200).json(cleanedData);
    } catch (error) {
        console.error("Feed Fetch Error:", error);
        res.status(500).json({ error: error.message });
    }
}
