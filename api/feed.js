export default async function handler(req, res) {
    // 1. Standard CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. We use a more complete set of headers to bypass security filters
        const response = await fetch('http://172.105.34.37:4000/api/scrips/feed', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'http://172.105.34.37/',
                'Origin': 'http://172.105.34.37',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            // Log what the server actually told us so we can see the exact error
            const errorText = await response.text();
            throw new Error(`API status ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        res.status(200).json(data);
        
    } catch (error) {
        console.error("PROXY ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
}
