'use strict';
/*
 * Google 3D Tiles - monthly root meter CORE (map room deliverable,
 * Architecture verdict 2026-11-07).
 *
 * Pure decision logic + PT month math, shared by /api/tiles-session
 * and /api/tiles-meter. No framework, no storage of its own: the KV
 * adapter is injected ({ incr, expireat, get, setex }).
 *
 * Semantics (binding): INCR FIRST, then judge. Every attempt
 * increments the Pacific-Time month counter; a result over the cap
 * (500) is DENIED and the denied attempt still consumes budget.
 * No rollback anywhere. The month key carries a TTL to the next PT
 * month start. Counting unit = one session handshake (root request).
 */
const PT_TZ = 'America/Los_Angeles';
const DEFAULT_LIMIT = 500; // Han 2026-11-07: 500 of the 1,000/month free tier
const SESSION_CACHE_KEY = 'tiles:session-url';
const SESSION_CACHE_TTL_S = 45 * 60; // verdict: same store, separate key

function ptWallParts(date) {
  const parts = {};
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: PT_TZ, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return parts;
}
function monthKeyOf(date) {
  const p = ptWallParts(date);
  return p.year + '-' + p.month;
}
function ptOffsetMs(utcMs) {
  const p = ptWallParts(new Date(utcMs));
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}
function nextResetUtcMs(date) {
  const p = ptWallParts(date);
  let y = +p.year, m = +p.month + 1;
  if (m > 12) { m = 1; y++; }
  let guess = Date.UTC(y, m - 1, 1, 8, 0, 0);
  for (let i = 0; i < 3; i++) guess = Date.UTC(y, m - 1, 1, 0, 0, 0) - ptOffsetMs(guess);
  return guess;
}
function meterKey(monthKey) { return 'tiles:meter:' + monthKey; }

function meterView(count, limit, at) {
  return {
    count, limit,
    monthKey: monthKeyOf(at),
    resetsAt: new Date(nextResetUtcMs(at)).toISOString(),
    exhausted: count >= limit, // cap reached: the NEXT attempt is denied
  };
}

function createMeter({ kv, limit = DEFAULT_LIMIT, now = () => new Date() }) {
  if (!kv) throw new Error('createMeter: kv adapter required');
  return {
    /* One session handshake attempt. Increments first; admitted iff
       the resulting count is within the cap. Denied attempts consume. */
    async attempt() {
      const at = now();
      const key = meterKey(monthKeyOf(at));
      const count = await kv.incr(key);
      if (count === 1) {
        await kv.expireat(key, Math.floor(nextResetUtcMs(at) / 1000));
      }
      return { admitted: count <= limit, meter: meterView(count, limit, at) };
    },
    /* Read-only view for the internal meter endpoint. Never increments. */
    async peek() {
      const at = now();
      const raw = await kv.get(meterKey(monthKeyOf(at)));
      const count = raw ? parseInt(raw, 10) || 0 : 0;
      return meterView(count, limit, at);
    },
  };
}

module.exports = { createMeter, meterView, monthKeyOf, nextResetUtcMs,
                   meterKey, SESSION_CACHE_KEY, SESSION_CACHE_TTL_S, DEFAULT_LIMIT };
