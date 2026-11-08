'use strict';
/*
 * Upstash REST adapter (Vercel KV and Upstash Redis expose the same
 * REST API). Env: KV_REST_API_URL / KV_REST_API_TOKEN (Vercel KV) or
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Upstash direct).
 * If the pair prefers the @vercel/kv SDK, only this file changes -
 * meter-core depends on the { incr, expireat, get, setex } shape only.
 */
function createKv(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('kv_not_configured');
  async function cmd(...args) {
    const r = await fetch(url + '/' + args.map(encodeURIComponent).join('/'), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) throw new Error('kv_http_' + r.status);
    const j = await r.json();
    if (j.error) throw new Error('kv_error: ' + j.error);
    return j.result;
  }
  return {
    incr: (k) => cmd('INCR', k),
    expireat: (k, unixSeconds) => cmd('EXPIREAT', k, unixSeconds),
    get: (k) => cmd('GET', k),
    setex: (k, seconds, v) => cmd('SET', k, v, 'EX', seconds),
  };
}
module.exports = { createKv };
