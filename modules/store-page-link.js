/* __espilStorePageLink v1 - store page link + parent pause (Batch S,
   Han 2026-11-03 items 9-10). TAGLESS module source: the integrator
   loads it in the pair AFTER modules/store.js.

   What it does, with ZERO pair edits:
   1. Intercepts the Konbiniya building-panel Enter click (#bldg-enter)
      in the capture phase. If the panel's building is the Konbiniya
      (name match, 1238 Robson address match, or anchor within 40 m of
      __espilKonbiniyaPos - the same identity rule as modules/store.js),
      the in-world entry is suppressed and the standalone store page
      opens instead: /vancouver/<slug>/ in a popup window.
   2. PAUSES the parent world while the store page is open: the world
      (and all rendering) is rAF-driven, so this module wraps
      window.requestAnimationFrame and HOLDS every callback registered
      while paused. The loops simply never advance; on resume the held
      callbacks are re-registered and the world continues from the
      exact frozen frame. setTimeout/setInterval logic (e.g. the
      presence heartbeat) deliberately keeps running - the session
      stays alive while the world is stopped.
      window.__espilStorePaused mirrors the state for the optional
      native tick gate documented in INTEGRATION.md.
   3. Shows a lightweight overlay ("store is open - close it to
      return") and resumes when the child posts 'espil-store-close'
      OR when the child window handle polls closed, whichever first.
      The player never entered the in-world interior (the click was
      intercepted first), so resume restores the exact pre-entry
      state: nothing to roll back but the pause flag and the overlay. */
(function () {
  'use strict';
  if (window.__espilStorePageLink) return;

  var STORES = [
    { slug: '1238-robson-st', name: 'Konbiniya Japan Centre', pattern: /konbiniya/i, address: /1238\s+robson/i }
  ];
  function storeUrl(store) {
    var base = window.__espilStorePageBase || '/vancouver/';
    return base + store.slug + '/';
  }

  /* ---------------- pause core: hold rAF while paused ---------------- */
  var origRAF = window.requestAnimationFrame.bind(window);
  var origCancel = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null;
  var held = new Map();        /* synthetic id -> callback */
  var nextId = 1 << 20;        /* synthetic ids live far above native ones */
  var paused = false;
  window.__espilStorePaused = false;

  window.requestAnimationFrame = function (cb) {
    if (paused) { var id = nextId++; held.set(id, cb); return id; }
    return origRAF(cb);
  };
  if (origCancel) {
    window.cancelAnimationFrame = function (id) {
      if (held.has(id)) { held.delete(id); return; }
      return origCancel(id);
    };
  }
  function setPaused(on) {
    paused = on; window.__espilStorePaused = on;
    if (!on) {
      var cbs = Array.from(held.values()); held.clear();
      cbs.forEach(function (cb) { origRAF(cb); });  /* loops re-register themselves from here */
    }
  }

  /* ---------------- overlay ---------------- */
  var overlay = null;
  function showOverlay(store) {
    hideOverlay();
    overlay = document.createElement('div');
    overlay.id = 'espil-store-paused-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(5,12,15,.72);' +
      'display:flex;align-items:center;justify-content:center;font-family:Manrope,sans-serif;';
    overlay.innerHTML = '<div style="text-align:center;color:#eafffd;max-width:420px;padding:24px;">' +
      '<div style="font-weight:900;letter-spacing:.14em;font-size:1rem;color:#8ef7e8;">' +
      store.name.toUpperCase() + ' IS OPEN</div>' +
      '<p style="font-size:.86rem;line-height:1.6;opacity:.9;">The street world is paused while the store page is open.<br/>Close the store page to return - the world resumes exactly where it stopped.</p></div>';
    document.body.appendChild(overlay);
  }
  function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }

  /* ---------------- open / resume ---------------- */
  var childWin = null, pollTimer = null, activeStore = null, acked = false;

  function openStore(store) {
    if (childWin && !childWin.closed) { try { childWin.focus(); } catch (e) {} return false; }
    activeStore = store; acked = false;
    childWin = window.open(storeUrl(store), 'espil-store-' + store.slug, 'popup,width=1280,height=820');
    if (!childWin) {
      if (window.__espilToast) window.__espilToast('Popup blocked - allow popups to enter ' + store.name);
      return false;
    }
    setPaused(true);
    showOverlay(store);
    clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      if (!childWin || childWin.closed) resume('poll');
    }, 500);
    return true;
  }
  function resume(how) {
    if (!activeStore && !childWin) return;
    clearInterval(pollTimer); pollTimer = null;
    childWin = null; activeStore = null;
    hideOverlay();
    setPaused(false);
    if (window.__espilToast && how) window.__espilToast('Welcome back - the world resumed.');
  }
  window.addEventListener('message', function (e) {
    if (!childWin || e.source !== childWin) return;
    var d = e.data || {};
    if (d.type === 'espil-store-open') acked = true;
    else if (d.type === 'espil-store-close') resume('message');
  });

  /* ---------------- entry interception ---------------- */
  function isStoreRecord(store, rec, nameText) {
    if (nameText && (store.pattern.test(nameText) || store.address.test(nameText))) return true;
    if (!rec) return false;
    var nm = rec.name || rec.title || '';
    if (store.pattern.test(nm) || store.address.test(nm)) return true;
    var k = window.__espilKonbiniyaPos;
    var x = (typeof rec.cx === 'number') ? rec.cx : rec.x;
    var z = (typeof rec.cz === 'number') ? rec.cz : rec.z;
    return !!(k && typeof x === 'number' && Math.hypot(x - k.x, z - k.z) < 40);
  }
  function matchStore(rec, nameText) {
    for (var i = 0; i < STORES.length; i++) if (isStoreRecord(STORES[i], rec, nameText)) return STORES[i];
    return null;
  }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#bldg-enter') : null;
    if (!btn) return;
    var rec = null;
    try { rec = window.__espilFacingBuilding ? window.__espilFacingBuilding() : null; } catch (err) {}
    var nameEl = document.getElementById('bldg-name');
    var store = matchStore(rec, nameEl ? nameEl.textContent : '');
    if (!store) return;                       /* not a store building: let the pair enter as usual */
    e.preventDefault(); e.stopImmediatePropagation();
    openStore(store);
  }, true);

  window.__espilStorePageLink = {
    open: function (slug) {
      var s = STORES.filter(function (x) { return x.slug === slug; })[0] || STORES[0];
      return openStore(s);
    },
    openKonbiniya: function () { return openStore(STORES[0]); },
    tryIntercept: function (rec) {           /* for the optional native seam (INTEGRATION.md) */
      var s = matchStore(rec, '');
      if (s) { openStore(s); return true; }
      return false;
    },
    resume: function () { resume('api'); },
    state: function () {
      return { paused: paused, heldCallbacks: held.size, childOpen: !!(childWin && !childWin.closed), acked: acked, store: activeStore ? activeStore.slug : null };
    }
  };
})();
