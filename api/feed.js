// Allow more execution time on Vercel Pro/Enterprise (ignored on Hobby, which is fixed at 10s —
// see note below). Safe to keep even if your plan doesn't honor it.
export const config = { maxDuration: 20 };

// Module-scope cache: survives across requests as long as Vercel keeps this function's
// container "warm" (typical for back-to-back polls a few seconds apart). Not guaranteed
// forever — a cold start clears it — but it means a temporary provider blip serves the
// last real prices instead of a hard error, per the "keep last successful data" requirement.
let lastGoodData = null;
let lastGoodAt = null;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'no-store'); // never let Vercel's edge cache a stale/error response

    const PROVIDER_URL = 'http://94.130.136.44:4445/getdata';

    // Instead of a fixed retry count, retry against a total time budget. Socket-closed
    // retries are cheap (~80ms) so a flapping connection gets many chances; a genuinely
    // slow/unresponsive provider burns the budget fast via real timeouts and stops
    // retrying well before Vercel's hard cap kills the function outright.
    // Hobby plan = 10s hard cap — keep a safety margin under it.
    const SAFE_BUDGET_MS = 8500;
    const HARD_MAX_ATTEMPTS = 8;
    const TIMEOUT_MS = 5000; // per provider spec — dynamic budget below still caps this safely under Vercel's limit

    async function fetchWithRetry(url, baseOptions) {
        let lastError = null;
        const startedAt = Date.now();
        let attempt = 0;

        while (attempt < HARD_MAX_ATTEMPTS) {
            const remaining = SAFE_BUDGET_MS - (Date.now() - startedAt);
            if (remaining < 400) break; // not enough budget left for a meaningful attempt
            attempt++;

            // Keep-alive on a fresh/first attempt; force a new connection right after a
            // socket-closed error, since that's specifically when a stale pooled socket
            // is the problem.
            const forceFreshConnection = lastError?.cause?.code === 'UND_ERR_SOCKET';
            const options = forceFreshConnection
                ? { ...baseOptions, headers: { ...baseOptions.headers, 'Connection': 'close' } }
                : baseOptions;

            try {
                const attemptTimeout = Math.min(TIMEOUT_MS, remaining);
                const response = await fetch(url, { ...options, signal: AbortSignal.timeout(attemptTimeout) });
                if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
                const json = await response.json();
                if (!json || !Array.isArray(json.data)) {
                    throw new Error('Provider response missing expected "data" array');
                }
                return json;
            } catch (err) {
                lastError = err;
                const socketClosed = err.cause?.code === 'UND_ERR_SOCKET';
                console.error(`Feed attempt ${attempt} failed:`, err.name, err.message, err.cause?.code || '');

                const delay = socketClosed ? 80 : 300 * attempt;
                const remainingAfter = SAFE_BUDGET_MS - (Date.now() - startedAt);
                if (remainingAfter > delay + 300) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break; // not enough budget left to usefully retry again
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
            }
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
        lastGoodData = data;
        lastGoodAt = new Date().toISOString();
    } catch (error) {
        console.error("Feed Fetch Error:", error);

        if (lastGoodData) {
            // Provider is temporarily down/flaky, but we have real data from a moment ago —
            // serve that instead of erroring out, with a flag so the frontend can show a
            // subtle "reconnecting" indicator without hard-failing to Demo Data.
            console.warn(`Serving cached data from ${lastGoodAt} due to fetch failure`);
            res.status(200).json({
                success: true,
                data: lastGoodData,
                stale: true,
                staleSince: lastGoodAt
            });
            return;
        }

        // No cache yet (e.g. cold start's very first request) — nothing to fall back to.
        // Surface enough detail in the response to diagnose without needing server log access —
        // safe to trim the `detail` field once resolved.
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
