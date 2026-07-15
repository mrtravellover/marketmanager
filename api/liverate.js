export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("http://94.130.136.44:4445/getdata", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "x-application": "64bt9cG6g0dZ2A4j985lmt1Bb6"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Provider returned HTTP ${response.status}`
      });
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      return res.status(500).json({
        success: false,
        error: "Invalid provider response."
      });
    }

    return res.status(200).json({
      success: true,
      provider: "Market Pulse",
      lastUpdated: new Date().toISOString(),
      totalContracts: json.data.length,
      data: json.data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.name === "AbortError"
        ? "Request timed out."
        : err.message
    });
  }
}
