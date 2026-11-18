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
      state: nothing to roll back but the pause flag and the overlay.

   PLACE EXPANSION (Han 2026-11-17): the same contract now carries
   every building that owns its address slug - the monolith's
   espilEnterBuilding resolves the panel record through this
   module's tryPlace() and the building's own place space opens in
   the popup (the PLACE EXPANSION block below). The Konbiniya
   interception above is unchanged. */
(function () {
  'use strict';
  if (window.__espilStorePageLink) return;

  var STORES = [
    { slug: '1238-robson-st', name: 'Konbiniya Japan Centre', pattern: /konbiniya/i, address: /1238\s+robson/i }
  ];
  /* PLACE SPACE destination flag (Han 2026-11-16): ON (the shipped
     state) the address opens the building's own place space - the
     boot shell now living at the address hands the visit to the
     game page in place-space mode. OFF is the revert switch: the
     entry opens sample.html, the preserved standalone store page,
     and today's popup behaviour reproduces exactly. The pause /
     resume core below is untouched either way. */
  var PLACE_SPACE_DEST = true;
  function storeUrl(store) {
    var base = window.__espilStorePageBase || '/vancouver/';
    return base + store.slug + (PLACE_SPACE_DEST ? '/' : '/sample.html');
  }

  /* ===== PLACE EXPANSION (Han 2026-11-17): every enterable
     building opens its OWN place space at its own address =====
     The Konbiniya above stays the special case it already was
     (its sample.html revert target exists). Every OTHER building
     is resolved against the game's own baked places dataset -
     the same file the Worker answers from, fetched once per
     session into memory only (nothing is stored; the dataset is
     the source, answers are still composed by the API inside the
     space). A building resolves only when its address produces a
     slug AND that slug is the building's own: the Worker index
     answers the FIRST record of a shared slug, so a building
     shadowed by an earlier record with the same address string,
     and a building with no address at all, do NOT resolve here -
     presenting another building's space as theirs would be a
     false answer. Those buildings keep the pair's routed
     interior until the address-grammar question is decided
     (the design remainder, place-expansion/AUDIT.md (a)).
     PLACE_ALL_DEST is the expansion's revert switch, beside
     PLACE_SPACE_DEST: OFF restores today's entry behaviour
     exactly (Konbiniya popup + routed interiors). */
  var PLACE_ALL_DEST = true;
  var placeData = null;          /* {records, firstIdx} once ready */
  var placeDataState = 'idle';   /* idle | loading | ready | absent */
  function placeCityKey() {
    try { return window.__espilCityKey || 'vancouver'; }
    catch (e) { return 'vancouver'; }
  }
  /* The slug rule - the Worker's twin (placeSlugOf): lowercase,
     fold every run of non-alphanumerics to one '-', trim '-'. */
  function placeSlugOf(addr) {
    if (typeof addr !== 'string') return null;
    var s = addr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || null;
  }
  function loadPlaceData() {
    if (placeDataState === 'loading' || placeDataState === 'ready') return;
    placeDataState = 'loading';
    fetch('assets/osm/' + placeCityKey() + '_places.json')
      .then(function (r) { if (!r.ok) throw new Error('no bake'); return r.json(); })
      .then(function (doc) {
        var recs = (doc && Array.isArray(doc.b)) ? doc.b : [];
        var firstIdx = {};
        for (var i = 0; i < recs.length; i++) {
          var s = placeSlugOf(recs[i] && recs[i][5]);
          if (s && !(s in firstIdx)) firstIdx[s] = i;
        }
        placeData = { records: recs, firstIdx: firstIdx };
        placeDataState = 'ready';
      })
      .catch(function () { placeDataState = 'absent'; });
  }
  /* The record match - modules/baked-places.js's scoring, run
     over the raw records: an AABB fingerprint when the caller
     knows the footprint size, else the record the point sits
     deepest in, else the nearest centre within 15 m. */
  function matchPlaceRecord(pt) {
    if (!placeData) return null;
    var recs = placeData.records, best = null, bestScore = 1e9;
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i]; if (!rec) continue;
      var dx = pt.x - rec[0], dz = pt.z - rec[1];
      var dist = Math.sqrt(dx * dx + dz * dz);
      var score = -1;
      if (pt.w && pt.d && Math.abs(dx) <= 3 && Math.abs(dz) <= 3 &&
          Math.abs(pt.w - rec[2]) <= 5 && Math.abs(pt.d - rec[3]) <= 5) {
        score = dist;                    /* AABB fingerprint */
      } else if (Math.abs(dx) <= rec[2] / 2 + 3 && Math.abs(dz) <= rec[3] / 2 + 3) {
        var mx = rec[2] / 2 + 3 - Math.abs(dx);
        var mz = rec[3] / 2 + 3 - Math.abs(dz);
        score = 100 - Math.min(mx, mz) + dist * 0.001;
      } else if (dist <= 15) {
        score = 200 + dist;              /* nearest centre */
      }
      if (score >= 0 && score < bestScore) { bestScore = score; best = rec; }
    }
    return best;
  }
  /* Resolve a street point (a panel record's centre / AABB, or a
     facing wall point) to a place: {slug, name} when the building
     owns its slug, null when it honestly has none, 'pending'
     while the dataset is still loading. */
  function resolvePlace(pt) {
    if (!PLACE_ALL_DEST || !PLACE_SPACE_DEST) return null;
    if (!pt || typeof pt.x !== 'number' || typeof pt.z !== 'number') return null;
    if (placeDataState === 'idle') { loadPlaceData(); return 'pending'; }
    if (placeDataState === 'loading') return 'pending';
    if (placeDataState !== 'ready') return null;
    var rec = matchPlaceRecord(pt);
    if (!rec) return null;
    var slug = placeSlugOf(rec[5]);
    if (!slug) return null;                          /* no address */
    if (placeData.firstIdx[slug] !== placeData.records.indexOf(rec)) return null;
    return { slug: slug, name: rec[4] || rec[5] || slug };
  }
  function openPlace(place) {
    return openStore({ slug: place.slug, name: place.name });
  }
  /* Warm the dataset the moment a building panel opens, so the
     Enter press that follows resolves synchronously. */
  (function watchPanel() {
    var panel = document.getElementById('bldg-panel');
    if (!panel) { setTimeout(watchPanel, 1000); return; }
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (panel.classList.contains('open')) loadPlaceData();
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  })();

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
    if (!store) return;                       /* not the Konbiniya: let the pair enter as usual */
    e.preventDefault(); e.stopImmediatePropagation();
    openStore(store);
  }, true);
  /* PLACE EXPANSION note: non-Konbiniya buildings are deliberately
     NOT intercepted here. The pair's own Enter handler
     (espilEnterBuilding, for the button and the keyboard alike)
     owns their routing and resolves the PANEL record - the
     authoritative building - through tryPlace below; a click
     interception would have to resolve the FACING record instead,
     which can be a different building than the panel's. */

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
    /* PLACE EXPANSION: resolve + open a non-Konbiniya building's
       own place space. Returns true when the space opened, false
       when the building honestly has no place of its own (the
       caller then keeps the routed interior), 'pending' while
       the dataset is still loading (the caller polls, on the
       Konbiniya seam's pattern). */
    tryPlace: function (pt) {
      var place = resolvePlace(pt);
      if (place === 'pending') return 'pending';
      if (!place) return false;
      openPlace(place);   /* an already-open child is focused, a blocked popup toasts - either way the press is the place's */
      return true;
    },
    resolvePlace: function (pt) { return resolvePlace(pt); },
    resume: function () { resume('api'); },
    state: function () {
      return { paused: paused, heldCallbacks: held.size, childOpen: !!(childWin && !childWin.closed), acked: acked, store: activeStore ? activeStore.slug : null,
               placeAll: PLACE_ALL_DEST, placeData: placeDataState };
    }
  };
})();
