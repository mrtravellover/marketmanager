export const config = { maxDuration: 20 };

const PROVIDER_URL = 'https://data.liveapi.uk/get/mcmil/index.php';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

// In-memory cache — persists across warm invocations on the same Vercel instance
let cachedData = null;
let cacheTime = null;

const DISPLAY_NAMES = {
  'Gold':        'MCX Gold',
  'Silver':      'MCX Silver',
  'Copper':      'MCX Copper',
  'Crude Oil':   'MCX Crude Oil',
  'Natural Gas': 'MCX Natural Gas',
  'Lead':        'MCX Lead',
  'Zinc':        'MCX Zinc',
  'Nickel':      'MCX Nickel',
  'Aluminium':   'MCX Aluminium',
};

function parseExpiry(str) {
  if (!str) return null;
  // Handles "05-Aug-26", "05-Aug-2026", "05Aug26", "05Aug2026"
  const clean = str.trim().replace(/-/g, ' ');
  // Try native parse first (works for "05 Aug 2026")
  let d = new Date(clean);
  if (!isNaN(d)) return d;
  // Try adding century: "05 Aug 26" → "05 Aug 2026"
  const m = clean.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})$/);
  if (m) {
    d = new Date(`${m[1]} ${m[2]} 20${m[3]}`);
    if (!isNaN(d)) return d;
  }
  return null;
}

function normalize(rawArray) {
  const now = new Date();

  // Group by symb, filter expired contracts
  const grouped = {};
  for (const item of rawArray) {
    const symb = (item.symb || '').trim();
    if (!symb) continue;
    const expiry = parseExpiry(item.expiry);
    // Keep if no expiry (spot) or expiry is today or future
    if (expiry && expiry < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;

    if (!grouped[symb]) grouped[symb] = [];
    grouped[symb].push({ ...item, _expiryDate: expiry });
  }

  // For each commodity, pick the nearest future expiry
  const result = [];
  for (const symb of Object.keys(grouped)) {
    const contracts = grouped[symb];
    // Sort by expiry ascending; null expiry (spot) goes first
    contracts.sort((a, b) => {
      if (!a._expiryDate && !b._expiryDate) return 0;
      if (!a._expiryDate) return -1;
      if (!b._expiryDate) return 1;
      return a._expiryDate - b._expiryDate;
    });

    const chosen = contracts[0];
    result.push({
      symbol:        symb,
      displayName:   DISPLAY_NAMES[symb] || symb,
      expiry:        chosen.expiry || '',
      ltp:           parseFloat(chosen.rate)    || 0,
      buy:           parseFloat(chosen.buy)     || 0,
      sell:          parseFloat(chosen.sell)    || 0,
      change:        parseFloat(chosen.chg)     || 0,
      changePercent: parseFloat(chosen.chgper)  || 0,
      open:          parseFloat(chosen.open)    || 0,
      close:         parseFloat(chosen.close)   || 0,
      high:          parseFloat(chosen.high)    || 0,
      low:           parseFloat(chosen.low)     || 0,
    });
  }

  return result;
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`Provider returned HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Provider response is not an array');
      return json;
    } catch (err) {
      lastError = err;
      console.error(`Feed attempt ${i + 1}/${retries} failed:`, err.message);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const raw = await fetchWithRetry(PROVIDER_URL, {
      method: 'GET',
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = normalize(raw);

    // Update in-memory cache on success
    cachedData = data;
    cacheTime  = new Date().toISOString();

    return res.status(200).json({ success: true, data, cachedAt: cacheTime });

  } catch (error) {
    console.error('Feed Fetch Error:', error);

    // Return last successful cache if available
    if (cachedData) {
      return res.status(200).json({
        success:  true,
        data:     cachedData,
        cached:   true,
        cachedAt: cacheTime,
        warning:  'Provider unreachable — showing last successful data',
      });
    }

    return res.status(500).json({
      success: false,
      error:   error.message,
    });
  }
}
