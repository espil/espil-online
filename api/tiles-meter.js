'use strict';
/*
 * GET /api/tiles-meter - INTERNAL meter readout (Architecture verdict:
 * internal/authenticated only, never public). Read-only: never
 * increments. Requires header x-internal-token == env
 * TILES_METER_INTERNAL_TOKEN; when that env is unset the endpoint
 * refuses everyone (fail-closed on the readout too).
 *
 * ADOPTED from the map room deliverable
 * (~/workspace/tiles-prototype/production/api/tiles-meter.js); the only
 * espil.online-room change is the family GET-only guard, matching
 * api/traffic.js. No allowedOrigin here by design: the internal token
 * is the authentication, and an origin gate would shut out the COO's
 * own tooling.
 */
const { createMeter, DEFAULT_LIMIT } = require('./_meter-core');
const { createKv } = require('./_kv-adapter');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  const expected = process.env.TILES_METER_INTERNAL_TOKEN || '';
  if (!expected || (req.headers['x-internal-token'] || '') !== expected) {
    return res.status(403).json({ error: 'forbidden' });
  }
  let kv;
  try { kv = createKv(); } catch (e) {
    return res.status(503).json({ error: 'kv_not_configured' });
  }
  const limit = parseInt(process.env.TILES_LIMIT || String(DEFAULT_LIMIT), 10);
  try {
    const meter = await createMeter({ kv, limit }).peek();
    return res.status(200).json({ meter });
  } catch (e) {
    return res.status(503).json({ error: 'meter_unavailable', detail: String(e && e.message || e) });
  }
};
