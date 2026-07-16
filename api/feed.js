export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const PROVIDER_URL = 'http://94.130.136.44:4445/getdata';
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 8000; // bumped from 5000 — slow provider responses were likely aborting early

    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return await response.json();
                throw new Error(`Provider returned HTTP ${response.status}`);
            } catch (err) {
                lastError = err;
                console.error(`Feed attempt ${i + 1}/${retries} failed:`, err.name, err.message, err.cause || '');
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1))); // backoff
                }
            }
        }
        throw lastError;
    }

    try {
        const json = await fetchWithRetry(PROVIDER_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'x-application': '64bt9cG6g0dZ2A4j985lmt1Bb6'
            },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });

        const data = (json.data || []).map(item => ({
            exchange: item.Exchange || '',
            symbol: item.Symbol || '',
            expiry: item['Ser/Exp'] || '',
            code: (item.Code || '').replace(/\r?\n|\r/g, ''),
            ltp: parseFloat(item.LTP) || 0,
            buy: parseFloat(item.BUY) || 0,
            sell: parseFloat(item.SELL) || 0,
            high: parseFloat(item.High) || 0,
            low: parseFloat(item.Low) || 0,
            open: parseFloat(item.Open) || 0,
            close: parseFloat(item.Close) || 0,
            change: parseFloat(item.Change) || 0,
            changePercent: parseFloat(item['% Change']) || 0,
            tbq: parseInt(item.TBQ) || 0,
            tsq: parseInt(item.TSQ) || 0,
            oi: parseInt(item.OI) || 0,
            volume: parseInt(item.Vol) || 0,
            atp: parseFloat(item.ATP) || 0,
            dpr: item.DPR || '',
            updateTime: item['Last Update Time'] || ''
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Feed Fetch Error:", error);
        // Surface enough detail in the response to diagnose without needing
        // server log access — safe to remove the `detail` field once resolved.
        res.status(500).json({
            success: false,
            error: error.message,
            detail: {
                name: error.name,
                cause: error.cause ? String(error.cause) : undefined
            }
        });
    }
}
