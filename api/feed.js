export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        // Fetch with headers to mimic a real web browser
        const response = await fetch('http://172.105.34.37:4000/api/scrips/feed', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Upstream API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        res.status(200).json(data);
        
    } catch (error) {
        // Send the exact error message back to the frontend so we can see what went wrong
        console.error("Vercel Fetch Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}
