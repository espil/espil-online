'use strict';
/*
 * GET /api/tiles-session - Google 3D Tiles session handshake + monthly
 * root meter (Vercel Node function, pair /api house style).
 *
 * ADOPTED from the map room deliverable
 * (~/workspace/tiles-prototype/production/api/tiles-session.js) with
 * exactly two espil.online-room changes, per the adoption brief:
 *   1. allowedOrigin() below is the pair's REAL family helper, copied
 *      verbatim from api/traffic.js (the draft mirrored its behaviour
 *      with a hostname-parsing variant).
 *   2. The family GET-only guard (api/traffic.js) is applied.
 * Everything else - flow, response contract, error shapes - is the
 * map room's delivered code unchanged.
 *
 * Flow (Architecture verdict 2026-11-07):
 *  1. INCR the PT month counter FIRST. Over the 500 cap -> HTTP 200
 *     { tilesEnabled:false, reason:'monthly_root_quota', meter } and
 *     the denied attempt still consumes budget. No rollback anywhere.
 *  2. Admitted: serve the ion session tileset URL - from the shared
 *     45-min cache (same KV store, key tiles:session-url) when warm,
 *     else a fresh server-side ion handshake (master token in env
 *     ONLY), then cache it. Streaming is client -> Google direct.
 * Fail-closed lives on the CLIENT: any non-200 / timeout here means
 * the tiles module simply never loads and the base map continues.
 * If the KV env is absent the endpoint answers 503
 * { error:'kv_not_configured' } - still fail-closed end to end, and
 * there is NO local-counter fallback anywhere in this file.
 *
 * Env: CESIUM_ION_TOKEN (ion master token), KV_REST_API_URL,
 * KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*). TILES_LIMIT optional
 * override for testing environments (default 500).
 *
 * Response contract (stable - keep this shape if the store migrates):
 *   200 admitted { tilesetUrl, attributions, cached, tilesEnabled:true,
 *                  meter:{ count, limit, monthKey, resetsAt, exhausted } }
 *   200 denied   { tilesEnabled:false, reason:'monthly_root_quota', meter }
 *   errors       { error:'snake_case', status?, detail? } (house shape)
 */
const { createMeter, SESSION_CACHE_KEY, SESSION_CACHE_TTL_S, DEFAULT_LIMIT } = require('./_meter-core');
const { createKv } = require('./_kv-adapter');

const ASSET_ID = '2275207'; // Google Photorealistic 3D Tiles on Cesium ion

/* The /api family helper, verbatim from api/traffic.js. */
function allowedOrigin(req) {
  var ref = (req.headers && (req.headers.referer || req.headers.origin)) || '';
  if (!ref) return true;
  return /espil\.online/.test(ref) || /\.vercel\.app/.test(ref) || /localhost/.test(ref);
}

async function fetchIonEndpoint(token) {
  const r = await fetch('https://api.cesium.com/v1/assets/' + ASSET_ID + '/endpoint', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!r.ok) throw new Error('ion endpoint HTTP ' + r.status);
  return r.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  if (!allowedOrigin(req)) { res.status(403).json({ error: 'forbidden origin' }); return; }
  let kv;
  try { kv = createKv(); } catch (e) {
    return res.status(503).json({ error: 'kv_not_configured' });
  }
  const limit = parseInt(process.env.TILES_LIMIT || String(DEFAULT_LIMIT), 10);
  const meter = createMeter({ kv, limit });

  let attempt;
  try { attempt = await meter.attempt(); } catch (e) {
    return res.status(503).json({ error: 'meter_unavailable', detail: String(e && e.message || e) });
  }
  if (!attempt.admitted) {
    return res.status(200).json({ tilesEnabled: false, reason: 'monthly_root_quota', meter: attempt.meter });
  }

  try {
    const cachedRaw = await kv.get(SESSION_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      return res.status(200).json({ ...cached, cached: true, tilesEnabled: true, meter: attempt.meter });
    }
  } catch (e) { /* cache read failure: fall through to a fresh handshake */ }

  const token = (process.env.CESIUM_ION_TOKEN || '').trim();
  if (!token) return res.status(503).json({ error: 'no_token_on_server' });
  try {
    const json = await fetchIonEndpoint(token);
    let tilesetUrl = null, attributions = [];
    if ('externalType' in json) tilesetUrl = json.options.url;
    else if (json.url) { tilesetUrl = json.url; attributions = (json.attributions || []).map(a => a.html); }
    const session = { tilesetUrl, attributions };
    try { await kv.setex(SESSION_CACHE_KEY, SESSION_CACHE_TTL_S, JSON.stringify(session)); } catch (e) {}
    return res.status(200).json({ ...session, cached: false, tilesEnabled: true, meter: attempt.meter });
  } catch (e) {
    // the attempt already consumed budget (verdict: no rollback)
    return res.status(502).json({ error: 'handshake_failed', detail: String(e && e.message || e) });
  }
};
