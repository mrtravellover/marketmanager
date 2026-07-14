export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        console.log("Attempting to fetch upstream API...");
        
        // Add a timeout signal just in case the server is ignoring Vercel
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch('http://172.105.34.37:4000/api/scrips/feed', {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
        
        const data = await response.json();
        res.status(200).json(data);
        
    } catch (error) {
        console.error("Vercel Detailed Error:", error.toString());
        // This will print the EXACT technical error to your screen
        res.status(500).json({ 
            fatal_error: error.message,
            name: error.name,
            cause: error.cause ? error.cause.toString() : "Unknown"
        });
    }
}
