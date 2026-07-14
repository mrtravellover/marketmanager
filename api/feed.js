export default async function handler(req, res) {
    // Enable CORS so your frontend can read the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        // Vercel's server fetches the insecure HTTP API
        const response = await fetch('http://172.105.34.37:4000/api/scrips/feed');
        
        if (!response.ok) {
            throw new Error(`Upstream API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Vercel securely sends the data back to your HTTPS frontend
        res.status(200).json(data);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch live market data' });
    }
}
