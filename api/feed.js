export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        // Use a standard HTTP request to the target
        const response = await fetch('http://172.105.34.37:4000/api/scrips/feed', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                // Adding a host header sometimes tricks firewalls
                'Host': '172.105.34.37:4000'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Server returned ${response.status}` });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
