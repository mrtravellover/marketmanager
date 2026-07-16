// Allow more execution time on Vercel Pro/Enterprise (ignored on Hobby, which is fixed at 10s —
// see note below). Safe to keep even if your plan doesn't honor it.
export const config = { maxDuration: 20 };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'no-store'); // never let Vercel's edge cache a stale/error response

    const PROVIDER_URL = 'http://94.130.136.44:4445/getdata';

    // IMPORTANT: retries * timeout must stay comfortably under your serverless function's
    // execution cap, or Vercel kills the function mid-retry and the frontend sees a hard
    // failure regardless of how much retry logic you write. Hobby plan = 10s hard cap.
    // Worst case here: 2 attempts * 4s timeout + 1 backoff of 600ms ≈ 8.6s — safe under 10s.
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 4000;

    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
                const json = await response.json();
                if (!json || !Array.isArray(json.data)) {
                    throw new Error('Provider response missing expected "data" array');
                }
                return json;
            } catch (err) {
                lastError = err;
                console.error(`Feed attempt ${i + 1}/${retries} failed:`, err.name, err.message, err.cause || '');
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300 * (i + 1))); // backoff
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
