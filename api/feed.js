export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const response = await fetch('http://172.105.34.37:4000/api/scrips/feed', {
            method: 'GET',
            headers: {
                // These headers mimic a standard browser request
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'http://172.105.34.37/', 
                'Origin': 'http://172.105.34.37'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upstream API returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        res.status(200).json(data);
        
    } catch (error) {
        console.error("Vercel Detailed Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}
