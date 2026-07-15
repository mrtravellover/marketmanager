export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const response = await fetch('http://94.130.136.44:4445/getdata', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'x-application': '64bt9cG6g0dZ2A4j985lmt1Bb6' }
        });
        if (!response.ok) throw new Error('Upstream Error');
        const json = await response.json();
        res.status(200).json(json.data.map(item => ({
            code: item.Code?.trim(),
            symbol: item.Symbol?.trim(),
            expiry: item['Ser/Exp']?.trim(),
            ltp: item.LTP,
            change: item.Change
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
