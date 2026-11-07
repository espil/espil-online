/*
 * GET /api/traffic - the game's live traffic level for the Vancouver
 * Art Gallery area, polled SERVER-SIDE from TomTom Traffic Flow.
 *
 * The TomTom key lives ONLY in the Vercel env var TOMTOM_API_KEY
 * (Han rotated it 2026-11-06 and entered it in the project settings
 * as a Secret - briefly under the name TomTom_Key, renamed the same
 * day to TOMTOM_API_KEY; it is never committed and never reaches the
 * client - the game polls this endpoint, never TomTom). This follows
 * the same server-side env pattern as /api/mapbox-token
 * (MAPBOX_TOKEN). The legacy TomTom_Key is still checked second, in
 * case the rename ever leaves both behind, but TOMTOM_API_KEY is the
 * configured name.
 *
 * Sampling: TomTom flowSegmentData (absolute, KMPH) at baked probe
 * points on the real streets around the Art Gallery anchor
 * (49.2864, -123.1279; the game's gallery-front spawn (3, 33)):
 *   1. 49.28640,-123.12790  Robson St & Hornby St (gallery front, ~0 m)
 *   2. 49.28570,-123.12620  Robson St, Hornby-Burrard block (~145 m)
 *   3. 49.28730,-123.12980  Robson St, Howe block (~170 m)
 *   4. 49.28520,-123.12660  Hornby St, toward W Georgia (~165 m)
 *   5. 49.28760,-123.12930  Hornby St, toward Smithe (~170 m)
 *   6. 49.28500,-123.12630  W Georgia St & Hornby St (~195 m)
 *   7. 49.28480,-123.12880  W Georgia St & Granville St (~190 m)
 *   8. 49.28550,-123.13050  Granville St, Robson-Georgia block (~215 m)
 *   9. 49.28470,-123.12390  Burrard St & Robson St (~345 m, closest
 *                           Burrard St point to the gallery)
 *  10. 49.28550,-123.11830  Dunsmuir St & Burrard St (~690 m, the
 *                           closest Dunsmuir St point; Dunsmuir runs
 *                           one corridor north-east of W Georgia, so
 *                           its nearest segment is outside the 200 m
 *                           core - included once, labelled honestly)
 * Per point, ratio r = currentSpeed / freeFlowSpeed; the prevailing
 * ratio is the MEDIAN of the successful points, banded as:
 *   r >= 0.85 green, >= 0.65 yellow, >= 0.40 orange, else red -
 * the colour vocabulary modules/npcs.js consumes.
 *
 * Responses: 200 {level, ratio, sampled, updatedAt}; 500
 * {error:'tomtom_key_missing'} when no key is configured; 502
 * {error:'tomtom_upstream', status, detail} when every point call
 * fails (a key whose TomTom side is still blocked presents exactly
 * this way - status/detail carry TomTom's own error, never the key
 * or the request URL). A module-scope memo (~600 s) plus a shared
 * cache header keep TomTom calls bounded: at most POINTS x
 * (3600/600) upstream calls per hour per warm function instance.
 */

var POINTS = [
  [49.28640, -123.12790],
  [49.28570, -123.12620],
  [49.28730, -123.12980],
  [49.28520, -123.12660],
  [49.28760, -123.12930],
  [49.28500, -123.12630],
  [49.28480, -123.12880],
  [49.28550, -123.13050],
  [49.28470, -123.12390],
  [49.28550, -123.11830]
];
var MEMO_MS = 600000;
var FETCH_TIMEOUT_MS = 5000;

var memo = { at: 0, status: 0, body: null };

function allowedOrigin(req) {
  var ref = (req.headers && (req.headers.referer || req.headers.origin)) || '';
  if (!ref) return true;
  return /espil\.online/.test(ref) || /\.vercel\.app/.test(ref) || /localhost/.test(ref);
}

function bandOf(r) {
  if (r >= 0.85) return 'green';
  if (r >= 0.65) return 'yellow';
  if (r >= 0.40) return 'orange';
  return 'red';
}

async function fetchPoint(key, lat, lng) {
  var url = 'https://api.traffic.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json'
    + '?point=' + lat + ',' + lng + '&unit=KMPH&openLr=false&key=' + encodeURIComponent(key);
  var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, FETCH_TIMEOUT_MS) : null;
  try {
    var resp = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    var text = await resp.text();
    var json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    if (!resp.ok) {
      var detail = null;
      if (json && json.error && json.error.description) detail = String(json.error.description);
      else if (json && json.detailedError && json.detailedError.message) detail = String(json.detailedError.message);
      else if (text) detail = text.slice(0, 200);
      return { ok: false, status: resp.status, detail: detail };
    }
    var fsd = json && json.flowSegmentData;
    if (!fsd || typeof fsd.currentSpeed !== 'number' || typeof fsd.freeFlowSpeed !== 'number'
        || !(fsd.freeFlowSpeed > 0)) {
      return { ok: false, status: resp.status, detail: 'flow fields missing' };
    }
    return { ok: true, ratio: fsd.currentSpeed / fsd.freeFlowSpeed };
  } catch (e) {
    return { ok: false, status: null, detail: 'fetch failed' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function computeLevel(key) {
  var results = await Promise.all(POINTS.map(function (p) { return fetchPoint(key, p[0], p[1]); }));
  var ratios = [];
  var firstFail = null;
  for (var i = 0; i < results.length; i++) {
    if (results[i].ok) ratios.push(results[i].ratio);
    else if (!firstFail) firstFail = results[i];
  }
  if (!ratios.length) {
    return {
      status: 502,
      body: {
        error: 'tomtom_upstream',
        status: firstFail ? firstFail.status : null,
        detail: firstFail ? firstFail.detail : null
      }
    };
  }
  ratios.sort(function (a, b) { return a - b; });
  var mid = Math.floor(ratios.length / 2);
  var median = (ratios.length % 2) ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return {
    status: 200,
    body: {
      level: bandOf(median),
      ratio: Math.round(median * 1000) / 1000,
      sampled: ratios.length,
      updatedAt: new Date().toISOString()
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  if (!allowedOrigin(req)) { res.status(403).json({ error: 'forbidden origin' }); return; }
  var key = process.env.TOMTOM_API_KEY || process.env.TomTom_Key || '';
  if (!key) { res.status(500).json({ error: 'tomtom_key_missing' }); return; }

  var now = Date.now();
  if (memo.body && now - memo.at < MEMO_MS) {
    if (memo.status === 200) res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=120');
    else res.setHeader('Cache-Control', 'no-store');
    res.status(memo.status).json(memo.body);
    return;
  }
  var out = await computeLevel(key);
  memo = { at: Date.now(), status: out.status, body: out.body };
  if (out.status === 200) res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=120');
  else res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.body);
};
