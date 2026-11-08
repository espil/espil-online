'use strict';
/*
 * GET /api/tiles-session - Google 3D Tiles session decision + monthly
 * root meter (Vercel Node function, pair /api house style).
 *
 * DIRECT GOOGLE PATH (Han decision 2026-11-08; map room memo
 * tiles-prototype/DIRECT-PATH-GATE-INPUTS.md; Architecture revised
 * conditions same day). This endpoint no longer performs an upstream
 * handshake: there is no Cesium ion token and NO session-URL cache
 * (the 45-min KV cache retired with the ion path - there is no
 * upstream session to cache; Google generates the streaming session
 * inside the tileset itself). An admitted response carries the
 * Google root tileset URL built from the server-side key:
 *   https://tile.googleapis.com/v1/3dtiles/root.json?key=<key>
 * The key therefore reaches the client BY DESIGN of this path (it
 * travels in the root URL the browser fetches) - it must be a
 * RESTRICTED key (HTTP referrer: espil.online; API: Map Tiles API
 * only). The key appears in NO source file, only in server env.
 *
 * Flow (unchanged metering semantics):
 *  1. INCR the PT month counter FIRST. Over the 500 cap -> HTTP 200
 *     { tilesEnabled:false, reason:'monthly_root_quota', meter } and
 *     the denied attempt still consumes budget. No rollback anywhere.
 *     One admitted decision = one root request, which is also
 *     Google's billable unit - the counting maps 1:1.
 *  2. Admitted: answer the root URL. Streaming is client -> Google
 *     direct; the renderer attaches key + session to child requests.
 * Fail-closed lives on the CLIENT: any non-200 / timeout here means
 * the tiles module simply never loads and the base map continues.
 * If the KV env is absent the endpoint answers 503
 * { error:'kv_not_configured' }; if the Google key env is absent it
 * answers 503 { error:'no_key_on_server' } - fail-closed either way,
 * and there is NO local-counter fallback anywhere in this file.
 *
 * Env: GOOGLE_MAP_TILES_API_KEY (server-side only), KV_REST_API_URL,
 * KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*). TILES_LIMIT optional
 * override for testing environments (default 500).
 *
 * Response contract (stable - keep this shape if the store migrates):
 *   200 admitted { tilesetUrl, attributions, tilesEnabled:true,
 *                  meter:{ count, limit, monthKey, resetsAt, exhausted } }
 *   200 denied   { tilesEnabled:false, reason:'monthly_root_quota', meter }
 *   errors       { error:'snake_case', status?, detail? } (house shape)
 * (attributions stays in the shape as an empty list: on the direct
 * path attribution is aggregated client-side from the tiles' own
 * asset.copyright by the renderer - see modules/tiles3d-core.js.)
 */
const { createMeter, DEFAULT_LIMIT } = require('./_meter-core');
const { createKv } = require('./_kv-adapter');

const GOOGLE_ROOT_URL = 'https://tile.googleapis.com/v1/3dtiles/root.json';

/* The /api family helper, verbatim from api/traffic.js. */
function allowedOrigin(req) {
  var ref = (req.headers && (req.headers.referer || req.headers.origin)) || '';
  if (!ref) return true;
  return /espil\.online/.test(ref) || /\.vercel\.app/.test(ref) || /localhost/.test(ref);
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

  const key = (process.env.GOOGLE_MAP_TILES_API_KEY || '').trim();
  if (!key) return res.status(503).json({ error: 'no_key_on_server' });
  const tilesetUrl = GOOGLE_ROOT_URL + '?key=' + encodeURIComponent(key);
  return res.status(200).json({ tilesetUrl, attributions: [], tilesEnabled: true, meter: attempt.meter });
};
