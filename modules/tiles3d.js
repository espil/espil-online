/* __espilTiles3d v1 - Google Photorealistic 3D Tiles, LIGHT entry
   (espil.online room, 2026-11-07; scope INTEGRATION-SCOPE-v1.md v3.1,
   Architecture verdict section G binding).
   This file is an ES module loaded by modules/lazyload.js through
   import() at the in-map arrival seam (the npcs/monsters family). It
   carries NO renderer bytes. Its whole job:
     1. Fire the ONE session decision fetch, GET /api/tiles-session,
        under a 10 s budget (AbortController). Entry/dive NEVER wait
        for it - this module itself only loads after arrival, and the
        fetch resolves in parallel with play. (Budget raised from
        2.5 s on 2026-11-18: the endpoint's KV meter round trip alone
        takes 0.5-1.5 s, and the old budget silently discarded good
        answers under post-dive main-thread load - tiles-diag.)
     2. tilesEnabled:true -> dynamic-import the heavy core
        (./tiles3d-core.js). That import is the ONLY path by which the
        renderer/decoders/vendor bytes can load, so a denied, errored,
        timed-out or device-gated session downloads 0 tile-renderer
        bytes (gate: landing/off baseline stays untouched).
     3. Anything else -> record the decision and stop. Fail-closed:
        no local token, no direct-ion path. A timeout or transport
        failure gets ONE retry under a fresh budget (a timed-out
        attempt may still have incremented the server meter - the
        function runs to completion - so the cost is at most one
        extra count per page load); a definitive answer
        (tilesEnabled true/false, monthly_root_quota) is NEVER
        retried. The base map is already running and simply
        continues.
   Session decision is made ONCE, here; a running session is never
   revisited (prototype-proven semantics, kept).
   Device/network gate (prototype behaviour, scope section A): tiles
   stay off by default on mobile UA / save-data / 2G; a manual
   override exists as window.__espilTilesOverride() for a future UI
   button and for the rig.
   Rig/ops surface: window.__espilTilesState() merges this entry's
   state with the core's (once loaded).
   Module sources are TAGLESS (house rule) - no script tags here. */
(function () {
  'use strict';
  if (window.__espilTilesState) return; /* once per page */

  var DECISION_BUDGET_MS = 10000;
  var DECISION_RETRY_DELAY_MS = 3000; /* one retry, timeouts only */
  var state = {
    phase: 'idle',          /* idle|deciding|off|gated|loading-core|core|error */
    decision: null,         /* 'on' | 'off' */
    reason: null,           /* monthly_root_quota | handshake_failed | timeout |
                               not_enabled | core_load_failed | city */
    meter: null,            /* meter view echoed by the endpoint */
    deviceGate: null,       /* null | 'mobile' | 'save-data' | 'slow-net' */
    override: false,
    decisionMs: null,
    coreLoaded: false
  };

  window.__espilTilesState = function () {
    var out = {};
    for (var k in state) out[k] = state[k];
    if (window.__espilTilesCoreState) {
      var core = null;
      try { core = window.__espilTilesCoreState(); } catch (e) { core = null; }
      if (core) out.core = core;
    }
    return out;
  };
  window.__espilTilesOverride = function () {
    state.override = true;
    if (state.phase === 'gated') startCore(lastSession);
  };

  var toastShown = {};
  function toast(msg, key) {
    if (key && toastShown[key]) return;
    if (key) toastShown[key] = true;
    try {
      var el = document.createElement('div');
      el.textContent = msg;
      el.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);'
        + 'z-index:9999;background:rgba(16,22,30,.92);color:#e8eef4;font:13px/1.45 system-ui,sans-serif;'
        + 'padding:8px 14px;border-radius:8px;pointer-events:none;max-width:82vw;text-align:center;';
      document.body.appendChild(el);
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 4200);
    } catch (e) {}
  }

  /* Prototype gate (index.html tilesAllowedByDevice, verbatim rule):
     off when saveData, a 2G-class effectiveType, or a mobile UA. */
  function deviceGateReason() {
    var conn = navigator.connection || {};
    if (conn.saveData) return 'save-data';
    if (/2g/.test(conn.effectiveType || '')) return 'slow-net';
    if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '')) return 'mobile';
    return null;
  }

  var lastSession = null;
  function startCore(session) {
    lastSession = session;
    state.phase = 'loading-core';
    import('./tiles3d-core.js').then(function (m) {
      state.coreLoaded = true;
      state.phase = 'core';
      try { m.start(session, { toast: toast }); }
      catch (e) { state.phase = 'error'; state.reason = 'core_start_failed'; }
    }).catch(function () {
      state.phase = 'off';
      state.reason = 'core_load_failed';
    });
  }

  function decide() {
    /* Tiles are a Vancouver feature: the boundary polygon, the anchor
       and the rig landmarks are all Vancouver. Other cities keep the
       base map only (their own tiles scope is a later decision). */
    var city = null;
    try { city = window.__espilLoadedCityKey || null; } catch (e) { city = null; }
    if (city && city !== 'vancouver') {
      state.phase = 'off'; state.decision = 'off'; state.reason = 'city';
      return;
    }
    state.phase = 'deciding';
    attemptDecision(0);
  }

  /* One decision attempt under a fresh budget. A received answer -
     enabled, disabled or quota - is definitive and final. Only a
     timeout or transport failure (no answer at all) earns the single
     retry; the decision still resolves exactly once per page load. */
  function attemptDecision(attempt) {
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      if (ctl) { try { ctl.abort(); } catch (e) {} }
    }, DECISION_BUDGET_MS);
    var opts = ctl ? { signal: ctl.signal } : undefined;
    fetch('/api/tiles-session', opts).then(function (r) {
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    }).then(function (s) {
      clearTimeout(timer);
      state.decisionMs = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
      if (s && s.meter) state.meter = s.meter;
      if (s && s.tilesEnabled === true && s.tilesetUrl) {
        state.decision = 'on';
        var gate = deviceGateReason();
        if (gate && !state.override) {
          state.deviceGate = gate;
          state.phase = 'gated';
          lastSession = s;
          toast('3D tiles are off for this device/network - the regular city is shown.', 'device-gate');
          return;
        }
        startCore(s);
        return;
      }
      state.decision = 'off';
      state.phase = 'off';
      state.reason = (s && s.reason) || 'not_enabled';
      if (state.reason === 'monthly_root_quota') {
        toast('3D tiles paused - monthly free limit reached. Showing the regular city.', 'quota');
      }
    }).catch(function () {
      clearTimeout(timer);
      state.decisionMs = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
      if (attempt < 1) {
        /* No answer arrived (timeout or transport failure): retry
           ONCE under a fresh budget. Phase stays 'deciding' and no
           decision is recorded until the retry resolves. */
        setTimeout(function () { attemptDecision(attempt + 1); }, DECISION_RETRY_DELAY_MS);
        return;
      }
      state.decision = 'off';
      state.phase = 'off';
      state.reason = timedOut ? 'timeout' : 'handshake_failed';
      /* fail-closed is silent by design: base map only, no modal */
    });
  }

  decide();
})();
