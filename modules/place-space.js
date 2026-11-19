/* __espilPlaceSpace v1 - building (place) spaces (Han 2026-11-16,
   DESIGN-v3 as amended). TAGLESS module source: lazyload.js loads
   it ONLY in a place-space window (the address boot shell's
   espil_store_space_v1 mark in sessionStorage) - it never arms on
   the street, and it disarms itself without the mark.

   What it does:
   - Derives the building's instance slot in the store band
     (z >= 12000) from the identity string "<city>/<slug>" (FNV-1a,
     design section 4) and builds the building's LOBBY there from
     code primitives: a rectangular hall at the building's own
     footprint (each side clamped 24..48 m), walls 4 m, a ceiling,
     the exit door in the south wall, and one bay per store along
     the north / east / west walls.
   - Summons the player into the lobby through the monolith's
     place entry hook (__espilPlaceEnterSpace), which sets the
     interior-form entry record - the visit is true first-person
     on the existing interior machinery (eye 1.6 m, avatar hidden,
     A/D turn, attack inputs inert) with no new camera code.
   - Asks the API for the building's stores at entry and for a
     store's goods when its book opens. NOTHING about stores or
     goods is hardcoded here: before the answer the lobby stands
     with bare walls and a status board, the exit always works,
     and a failed answer leaves a retry board, never fake data.
     (The building's own geometry - centre and footprint - is read
     from the game's baked data by slug, or from the API answer;
     store lists and goods come from the API alone.)
   - The lobby's store list is a button-style panel in the
     landing city-list form (Han 2026-11-18): one row per bay in
     a text container, rows in normal flow so they can never
     overlap, a long name ellipsised inside its own row (the full
     name rides the row's title attribute and the book's left
     page). It replaces the wall-fixed projected DOM label per
     bay, whose constant-pixel signs piled onto each other under
     perspective - side-wall anchors converge toward the
     vanishing point while the text keeps its size, and a long
     name overflowed its bay outright. A store is selected by
     clicking its row or by aiming (the FPV crosshair) at its
     bay and pressing the Use key - both paths run the one
     select function, and the aim highlight lights the row.
   - The storybook: left page the store (name, type, a one-line
     intro, the player's Leo balance), right page its goods as
     cards, six to a spread. A purchase completes inside the book
     through the existing pipeline - Leo debit, stock decrement
     (espil_shop_stock_v1, keyed by item name as always), the
     espil-guide 'bought' event the bag grant listens to, and the
     purchase bridge emit in the popup's exact two-channel shape -
     so the parent window's story module advances Q2 unchanged. A
     store with no registered goods opens the book in its empty
     state; goods are never invented for a real store name.
   - Exit: the door closes this window and the parent resumes
     under the store-page-link contract; with no opener (a direct
     address visit) the door returns the player to the street in
     this same window. */
(function () {
  'use strict';
  if (window.__espilPlaceSpace) return;
  var mark = null;
  try { mark = JSON.parse(sessionStorage.getItem('espil_store_space_v1') || 'null'); } catch (e) {}
  if (!mark || !mark.city || !mark.slug) return;

  var API_BASE = (typeof window.__espilPlacesApiBase === 'string' && window.__espilPlacesApiBase) || 'https://api.espil.online';
  var CITY = String(mark.city), SLUG = String(mark.slug);
  var STOCK_KEY = 'espil_shop_stock_v1';
  var PURCHASE_KEY = 'espil_store_purchase_v1';

  /* ---------------- helpers (the pair's own idioms) ---------------- */
  function toast(m) { if (window.__espilToast) window.__espilToast(m); }
  function lang() { try { return window.__espilLang ? window.__espilLang() : 'en'; } catch (e) { return 'en'; } }
  function leoBalance() { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); return isNaN(v) ? 1000 : v; }
  function leoSet(v) { try { localStorage.setItem('espil_leo_balance', String(v)); } catch (e) {} }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  /* The slug rule, the Worker's twin (design section 2) - used
     only to find this building's geometry in the game's own baked
     data. Store lists and goods never come from anywhere but the
     API. */
  function slugOf(addr) {
    if (typeof addr !== 'string') return null;
    var s = addr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || null;
  }
  /* PLACE EXPANSION REMAINDER (2026-11-18): canonical bake lookup.
     The visit's SLUG is the building's CANONICAL slug (the
     Worker's placeCanonicalSlugs, Han 2026-11-18): an address
     slug claimed bare by its first record and suffixed for the
     records it shadows, a name slug for an addressless building,
     a "place-<index>" token for a building with neither string.
     The bake holds raw records, so this building's geometry is
     the record whose canonical slug equals SLUG - an address
     match alone would hand a shadowed building the FIRST
     record's geometry, and a suffixed or stringless building no
     geometry at all (it would then read as "unknown" and bail
     whenever the API is unreachable, breaking the known-building
     guarantee below). Identical algorithm, identical file. */
  function canonicalSlugsOf(recs) {
    var assigned = {};
    var out = new Array(recs.length);
    for (var i = 0; i < recs.length; i++) out[i] = null;
    for (var pass = 0; pass < 3; pass++) {
      for (var j = 0; j < recs.length; j++) {
        if (out[j] !== null) continue;
        var rec = recs[j];
        var base = null;
        if (pass === 0) base = slugOf(rec && rec[5]);
        else if (pass === 1) base = slugOf(rec && rec[4]);
        else base = 'place-' + j;
        if (!base) continue;
        var slug = base, n = 1;
        while (assigned[slug]) { n += 1; slug = base + '-' + n; }
        assigned[slug] = true;
        out[j] = slug;
      }
    }
    return out;
  }
  /* end PLACE EXPANSION REMAINDER canonical bake lookup */
  function fnv1a(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function slotAnchor(city, slug) {
    var h = fnv1a(city + '/' + slug);
    var col = h % 32, row = Math.floor(h / 32) % 32;
    return { x: (col - 16) * 320, z: 12000 + row * 320 };
  }
  function sceneRoot() {
    try {
      var own = window.__espilOwnGroup ? window.__espilOwnGroup() : null;
      var n = own; while (n && n.parent) n = n.parent;
      if (n && n.isScene) return n;
      var dm = window.__espilDistrictMeshes || [];
      for (var i = 0; i < dm.length; i++) { var m = dm[i]; while (m && m.parent) m = m.parent; if (m && m.isScene) return m; }
    } catch (e) {}
    return null;
  }
  function fetchJson(url) {
    return new Promise(function (resolve, reject) {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); reject(new Error('timeout')); }, 8000);
      fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
        if (!r.ok) { clearTimeout(to); reject(new Error('http ' + r.status)); return null; }
        return r.json();
      }).then(function (d) { clearTimeout(to); if (d) resolve(d); }, function (e) { clearTimeout(to); reject(e); });
    });
  }

  /* ---------------- state ---------------- */
  var anchor = slotAnchor(CITY, SLUG);
  var state = {
    phase: 'boot',           /* boot -> in -> closing / exited */
    entered: false,
    geom: null,              /* {cx, cz, w, d, name, addr} */
    place: null,             /* the API place record */
    stores: [],
    api: 'idle',             /* idle | loading | ok | error */
    overflow: 0,
    aimed: null,
    book: { open: false, store: null, data: null, spread: 0, pageIdx: 0, failed: false }
  };
  var lobby = null;          /* {group, W, D} */
  var bays = [];             /* {store, ax, ay, az, el} */
  var itemsCache = {};       /* store id -> items answer (this visit only) */
  var preSummon = null;

  /* ---------------- styling ---------------- */
  var css = document.createElement('style');
  css.textContent =
    '#ps-layer{position:fixed;inset:0;z-index:11000;pointer-events:none;overflow:hidden;}' +
    '#ps-list{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:min(300px,80vw);' +
      'max-height:72vh;display:none;flex-direction:column;pointer-events:auto;overflow:hidden;' +
      'background:rgba(9,16,22,.88);border:1px solid rgba(142,247,232,.4);border-radius:10px;' +
      'font-family:"Avenir Next","Segoe UI",Manrope,sans-serif;color:#eaf6ff;}' +
    '#ps-list.show{display:flex;}' +
    '.ps-list-head{padding:10px 14px 8px;font-size:12px;font-weight:700;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#8ef7e8;border-bottom:1px solid rgba(142,247,232,.25);' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#ps-list-rows{overflow-y:auto;overflow-x:hidden;padding:6px;display:flex;flex-direction:column;gap:4px;}' +
    '.ps-row{display:flex;align-items:center;width:100%;min-height:38px;padding:7px 10px;cursor:pointer;' +
      'background:rgba(255,255,255,.05);border:1px solid rgba(142,247,232,.22);border-radius:8px;' +
      'color:#eaf6ff;font:600 14px "Avenir Next","Segoe UI",Manrope,sans-serif;text-align:left;}' +
    '.ps-row:hover{background:rgba(142,247,232,.14);}' +
    '.ps-row.aimed{border-color:#f2b63c;color:#ffe9a8;background:rgba(30,24,8,.9);}' +
    '.ps-row-name{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '@media (max-width:680px){ #ps-list{left:8px;right:8px;width:auto;top:auto;bottom:10px;transform:none;max-height:42vh;} }' +
    '#ps-board{position:absolute;transform:translate(-50%,-50%);pointer-events:none;text-align:center;' +
      'font:600 15px "Avenir Next","Segoe UI",Manrope,sans-serif;color:#eaf6ff;white-space:pre-line;' +
      'background:rgba(9,16,22,.85);border:1px solid rgba(142,247,232,.4);border-radius:10px;padding:10px 16px;max-width:70vw;}' +
    '#ps-board .ps-retry{pointer-events:auto;margin-top:8px;cursor:pointer;font:600 13px inherit;color:#0b1116;' +
      'background:#8ef7e8;border:0;border-radius:999px;padding:6px 16px;}' +
    '#ps-cross{position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;' +
      'background:rgba(234,246,255,.9);box-shadow:0 0 4px rgba(0,0,0,.8);z-index:11001;pointer-events:none;}' +
    '#ps-book{position:fixed;inset:0;z-index:12000;display:none;align-items:center;justify-content:center;' +
      'background:rgba(4,8,11,.45);font-family:"Avenir Next","Segoe UI",Manrope,sans-serif;}' +
    '#ps-book.open{display:flex;}' +
    '.ps-frame{position:relative;display:flex;gap:0;width:min(88vw,860px);height:min(76vh,560px);' +
      'background:linear-gradient(90deg,#f3ead2 0%,#efe3c8 49.6%,#d9c9a3 50%,#efe3c8 50.4%,#f3ead2 100%);' +
      'border-radius:10px;box-shadow:0 24px 70px rgba(0,0,0,.6);color:#2c2417;overflow:hidden;}' +
    '.ps-page{flex:1 1 0;padding:26px 28px;overflow:hidden;display:flex;flex-direction:column;}' +
    '.ps-page h3{margin:0 0 4px;font-size:clamp(17px,2.6vw,24px);letter-spacing:.02em;}' +
    '.ps-type{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a6d2f;}' +
    '.ps-intro{margin:12px 0;font-size:14px;line-height:1.65;color:#4c4130;}' +
    '.ps-bal{margin-top:auto;font-size:15px;font-weight:700;}' +
    '.ps-bal span{color:#8a6d2f;}' +
    '.ps-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start;}' +
    '.ps-card{border:1px solid rgba(120,95,40,.35);border-radius:10px;padding:9px;text-align:center;background:rgba(255,252,244,.65);}' +
    '.ps-tile{height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:21px;}' +
    '.ps-cname{margin-top:6px;font-size:13.5px;font-weight:600;}' +
    '.ps-cmeta{font-size:12px;color:#6d5c39;margin-top:2px;}' +
    '.ps-buy{margin-top:7px;cursor:pointer;font:600 12.5px inherit;color:#fff8e6;background:#7a5c1e;border:0;' +
      'border-radius:999px;padding:6px 14px;}' +
    '.ps-buy:disabled{background:#a2936f;cursor:default;}' +
    '.ps-refuse{font-size:11.5px;color:#b03a1e;min-height:14px;margin-top:4px;font-weight:600;}' +
    '.ps-empty{margin:auto;text-align:center;font-size:15px;line-height:1.7;color:#4c4130;padding:0 12px;}' +
    '.ps-x{position:absolute;top:8px;right:10px;z-index:3;width:36px;height:36px;border-radius:50%;border:0;cursor:pointer;' +
      'background:rgba(44,36,23,.12);color:#2c2417;font-size:20px;line-height:1;}' +
    '.ps-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:38px;height:52px;border:0;cursor:pointer;' +
      'background:rgba(44,36,23,.10);color:#2c2417;font-size:26px;border-radius:8px;}' +
    '.ps-prev{left:6px;}.ps-next{right:6px;}' +
    '.ps-pageno{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:12px;color:#8a6d2f;font-weight:700;}' +
    '@media (max-width:680px){ .ps-frame{width:94vw;height:82vh;} .ps-page{padding:20px 18px;} ' +
      '.ps-frame[data-show="intro"] .ps-right{display:none;} .ps-frame[data-show="items"] .ps-left{display:none;} }';
  document.head.appendChild(css);

  /* ---------------- DOM scaffolding ---------------- */
  var layer = document.createElement('div');
  layer.id = 'ps-layer'; layer.style.display = 'none';
  document.body.appendChild(layer);
  var boardEl = document.createElement('div');
  boardEl.id = 'ps-board'; boardEl.style.display = 'none';
  layer.appendChild(boardEl);
  /* the lobby store list (Han 2026-11-18): a city-list-form
     panel inside the layer - it hides with the layer while the
     book is open and returns with it, like the signs did. */
  var listEl = document.createElement('div');
  listEl.id = 'ps-list';
  var listHead = document.createElement('div');
  listHead.className = 'ps-list-head';
  listEl.appendChild(listHead);
  var listRows = document.createElement('div');
  listRows.id = 'ps-list-rows';
  listEl.appendChild(listRows);
  layer.appendChild(listEl);
  var cross = document.createElement('div');
  cross.id = 'ps-cross'; cross.style.display = 'none';
  document.body.appendChild(cross);
  var bookEl = document.createElement('div');
  bookEl.id = 'ps-book'; bookEl.setAttribute('aria-hidden', 'true');
  bookEl.innerHTML =
    '<div class="ps-frame" data-show="intro">' +
      '<button type="button" class="ps-x" aria-label="Close">&times;</button>' +
      '<div class="ps-page ps-left"></div>' +
      '<div class="ps-page ps-right"></div>' +
      '<button type="button" class="ps-nav ps-prev" aria-label="Previous page">&#8249;</button>' +
      '<button type="button" class="ps-nav ps-next" aria-label="Next page">&#8250;</button>' +
      '<div class="ps-pageno"></div>' +
    '</div>';
  document.body.appendChild(bookEl);
  var frameEl = bookEl.querySelector('.ps-frame');
  var leftEl = bookEl.querySelector('.ps-left');
  var rightEl = bookEl.querySelector('.ps-right');
  var pagenoEl = bookEl.querySelector('.ps-pageno');
  bookEl.querySelector('.ps-x').addEventListener('click', closeBook);
  bookEl.querySelector('.ps-prev').addEventListener('click', function () { turn(-1); });
  bookEl.querySelector('.ps-next').addEventListener('click', function () { turn(1); });
  /* page turns by drag / swipe on the book */
  (function () {
    var pid = null, sx = 0;
    frameEl.addEventListener('pointerdown', function (e) { pid = e.pointerId; sx = e.clientX; });
    frameEl.addEventListener('pointerup', function (e) {
      if (pid !== e.pointerId) return; pid = null;
      var dx = e.clientX - sx;
      if (dx > 48) turn(-1); else if (dx < -48) turn(1);
    });
    frameEl.addEventListener('pointercancel', function () { pid = null; });
  })();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.book.open) { e.preventDefault(); e.stopPropagation(); closeBook(); }
  }, true);
  window.addEventListener('resize', function () { if (state.book.open) renderBook(); });

  /* ---------------- geometry (the building's own record) -------- */
  /* PLACE EXPANSION (Han 2026-11-17): the address catch-all means
     a well-formed but unknown slug also lands in this module. If
     NEITHER the game's baked data nor the API knows the slug,
     there is no building to summon anyone into: clear the mark
     and return to the city page as a plain street visit, instead
     of stranding the visitor in a spaceless child session (the
     mark would otherwise hold the window in the place-child
     allowlist with no space and no door). A KNOWN building whose
     API is merely unreachable never bails: its geometry resolves
     from the bake and the retry board shows, exactly as before.
     A known building missing from a stale bake still enters on
     the API's geometry. */
  var bakeChecked = false;
  var bailedOut = false;
  function maybeBailUnknown() {
    if (bailedOut || state.entered) return;
    if (state.api !== 'error' || !bakeChecked || state.geom) return;
    bailedOut = true;
    try { sessionStorage.removeItem('espil_store_space_v1'); } catch (e) {}
    location.replace('/' + CITY + '.html');
  }
  function resolveGeomFromBake() {
    fetch('assets/osm/' + CITY + '_places.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
      bakeChecked = true;
      if (state.geom || !doc || !Array.isArray(doc.b)) { maybeBailUnknown(); return; }
      var canon = canonicalSlugsOf(doc.b);   /* PLACE EXPANSION REMAINDER: match by canonical slug, not address */
      for (var i = 0; i < doc.b.length; i++) {
        var rec = doc.b[i];
        if (rec && canon[i] === SLUG) {
          state.geom = { cx: rec[0], cz: rec[1], w: rec[2], d: rec[3], name: rec[4] || null, addr: rec[5] || null };
          maybeEnter();
          return;
        }
      }
      maybeBailUnknown();
    }).catch(function () { bakeChecked = true; maybeBailUnknown(); });
  }

  /* ---------------- the API (the only store/goods source) -------- */
  function loadPlace() {
    state.api = 'loading'; paintBoard();
    fetchJson(API_BASE + '/places/' + encodeURIComponent(CITY) + '/' + encodeURIComponent(SLUG)).then(function (d) {
      state.place = d.place || null;
      state.stores = Array.isArray(d.stores) ? d.stores : [];
      state.api = 'ok';
      if (!state.geom && d.place && d.place.center && d.place.size) {
        state.geom = { cx: d.place.center.x, cz: d.place.center.z, w: d.place.size.w, d: d.place.size.d, name: d.place.name, addr: d.place.address };
        maybeEnter();
      }
      if (state.place && window.__espilInside && window.__espilInside.placeSpace && state.place.name) {
        window.__espilInside.name = state.place.name;
      }
      buildBays(); paintBoard();
    }, function () {
      state.api = 'error'; paintBoard();
      maybeBailUnknown();   /* PLACE EXPANSION: an unknown slug bails to the street (see resolveGeomFromBake) */
    });
  }
  function loadItems(store, done) {
    if (itemsCache[store.id]) { done(itemsCache[store.id]); return; }
    fetchJson(API_BASE + '/places/' + encodeURIComponent(CITY) + '/' + encodeURIComponent(SLUG) +
      '/stores/' + encodeURIComponent(store.id) + '/items').then(function (d) {
      itemsCache[store.id] = d; done(d);
    }, function () { done(null); });
  }

  /* ---------------- the lobby ---------------- */
  function buildLobby() {
    if (lobby || !state.geom || typeof THREE === 'undefined') return false;
    var scene = sceneRoot(); if (!scene) return false;
    var W = clamp(state.geom.w, 24, 48), D = clamp(state.geom.d, 24, 48);
    var g = new THREE.Group(); g.position.set(anchor.x, 0, anchor.z);
    function M(geo, mat, x, y, z, ry) {
      var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      if (ry) m.rotation.y = ry; m.frustumCulled = false; g.add(m); return m;
    }
    function LM(c) { return new THREE.MeshLambertMaterial({ color: c }); }
    var fl = M(new THREE.PlaneGeometry(W, D), LM(0x59534a), 0, 0.01, 0); fl.rotation.x = -Math.PI / 2;
    var ce = M(new THREE.PlaneGeometry(W, D), LM(0xcfc9bb), 0, 4, 0); ce.rotation.x = Math.PI / 2;
    var wallMat = LM(0xbdb4a2);
    M(new THREE.BoxGeometry(W, 4, 0.4), wallMat, 0, 2, -D / 2);              /* north */
    var segW = (W - 2.4) / 2;                                                /* south, with the door gap */
    M(new THREE.BoxGeometry(segW, 4, 0.4), wallMat, -(1.2 + segW / 2), 2, D / 2);
    M(new THREE.BoxGeometry(segW, 4, 0.4), wallMat, (1.2 + segW / 2), 2, D / 2);
    M(new THREE.BoxGeometry(2.4, 1.0, 0.4), wallMat, 0, 3.5, D / 2);         /* lintel */
    M(new THREE.BoxGeometry(0.4, 4, D), wallMat, -W / 2, 2, 0);              /* west */
    M(new THREE.BoxGeometry(0.4, 4, D), wallMat, W / 2, 2, 0);               /* east */
    /* the door frame + EXIT sign, in the arena exit grammar */
    var postMat = LM(0x6d5a41);
    M(new THREE.BoxGeometry(0.3, 3.0, 0.3), postMat, -1.2, 1.5, D / 2 - 0.1);
    M(new THREE.BoxGeometry(0.3, 3.0, 0.3), postMat, 1.2, 1.5, D / 2 - 0.1);
    var exitCvs = document.createElement('canvas'); exitCvs.width = 256; exitCvs.height = 96;
    var ectx = exitCvs.getContext('2d');
    ectx.fillStyle = '#20242c'; ectx.fillRect(0, 0, 256, 96);
    ectx.fillStyle = '#f2b63c'; ectx.font = '700 56px "Avenir Next","Segoe UI",sans-serif';
    ectx.textAlign = 'center'; ectx.textBaseline = 'middle'; ectx.fillText('EXIT', 128, 50);
    var ex = M(new THREE.PlaneGeometry(1.5, 0.56), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(exitCvs) }), 0, 2.6, D / 2 - 0.25);
    ex.rotation.y = Math.PI;
    var rug = M(new THREE.PlaneGeometry(4.4, 3), LM(0x74353a), 0, 0.03, D / 2 - 2.4); rug.rotation.x = -Math.PI / 2;
    scene.add(g);
    lobby = { group: g, W: W, D: D };
    window.__espilPlaceSpaceRect = { x0: anchor.x - W / 2, z0: anchor.z - D / 2, x1: anchor.x + W / 2, z1: anchor.z + D / 2 };
    return true;
  }

  /* Bays: the API's stores, in answer order, along the north, east
     and west walls. A bay is a counter + frame on the wall; its
     entry in the lobby store list is one .ps-row (same order).
     Stores that cannot fit the wall perimeter are cut in order
     and counted on the board. */
  function buildBays() {
    if (!lobby || state.api !== 'ok' || bays.length) return;
    var W = lobby.W, D = lobby.D;
    var runs = [
      { wall: 'N', len: W - 2 }, { wall: 'E', len: D - 2 }, { wall: 'W', len: D - 2 }
    ];
    var caps = runs.map(function (r) { return Math.floor(r.len / 3.5); });
    var totalCap = caps[0] + caps[1] + caps[2];
    var placedStores = state.stores.slice(0, totalCap);
    state.overflow = state.stores.length - placedStores.length;
    var perRun = [[], [], []];
    var idx = 0;
    for (var ri = 0; ri < 3; ri++) {
      while (perRun[ri].length < caps[ri] && idx < placedStores.length) perRun[ri].push(placedStores[idx++]);
    }
    function LM(c) { return new THREE.MeshLambertMaterial({ color: c }); }
    var frameMat = LM(0x6d5a41), counterMat = LM(0x74563a), topMat = LM(0xe8e2d2), boardMat = LM(0x2c313a);
    perRun.forEach(function (list, r) {
      if (!list.length) return;
      var run = runs[r], bw = run.len / list.length;
      list.forEach(function (store, i) {
        var off = -run.len / 2 + bw * (i + 0.5);
        var bg = new THREE.Group();
        var cw = Math.min(bw * 0.82, 6);
        function M(geo, mat, x, y, z) {
          var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; bg.add(m); return m;
        }
        M(new THREE.BoxGeometry(cw, 1.05, 1.0), counterMat, 0, 0.53, 0.9);
        M(new THREE.BoxGeometry(cw, 0.08, 1.2), topMat, 0, 1.09, 0.9);
        M(new THREE.BoxGeometry(0.18, 2.9, 0.18), frameMat, -cw / 2, 1.45, 0.1);
        M(new THREE.BoxGeometry(0.18, 2.9, 0.18), frameMat, cw / 2, 1.45, 0.1);
        M(new THREE.BoxGeometry(cw + 0.3, 0.16, 0.18), frameMat, 0, 2.95, 0.1);
        M(new THREE.PlaneGeometry(Math.max(cw - 0.4, 1), 0.62), boardMat, 0, 2.55, 0.12);
        var ax, az;
        if (run.wall === 'N') { bg.position.set(off, 0, -D / 2 + 0.25); ax = anchor.x + off; az = anchor.z - D / 2 + 0.22; }
        else if (run.wall === 'E') { bg.rotation.y = -Math.PI / 2; bg.position.set(W / 2 - 0.25, 0, off); ax = anchor.x + W / 2 - 0.22; az = anchor.z + off; }
        else { bg.rotation.y = Math.PI / 2; bg.position.set(-W / 2 + 0.25, 0, off); ax = anchor.x - W / 2 + 0.22; az = anchor.z + off; }
        lobby.group.add(bg);
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'ps-row';
        el.setAttribute('data-store-id', store.id);
        el.setAttribute('data-store-name', store.name);
        var nm = document.createElement('span');
        nm.className = 'ps-row-name'; nm.textContent = store.name;
        nm.setAttribute('title', store.name);
        el.appendChild(nm);
        el.addEventListener('click', function () { selectStore(store); });
        listRows.appendChild(el);
        bays.push({ store: store, ax: ax, ay: 2.55, az: az, el: el });
      });
    });
    if (bays.length) listEl.classList.add('show');
    paintBoard();
  }

  /* ---------------- the status board (signage wall) -------------- */
  function paintBoard() {
    if (!lobby) { boardEl.style.display = 'none'; return; }
    boardEl.style.display = '';
    boardEl.setAttribute('data-ax', anchor.x);
    boardEl.setAttribute('data-az', anchor.z - lobby.D / 2 + 0.22);
    if (state.api === 'loading' || state.api === 'idle') {
      boardEl.textContent = 'Loading the building\u2019s stores\u2026';
    } else if (state.api === 'error') {
      boardEl.textContent = 'The store list could not be loaded.\nThe exit door still works.';
      var rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'ps-retry'; rb.textContent = 'Retry';
      rb.addEventListener('click', function () { loadPlace(); });
      boardEl.appendChild(document.createElement('br'));
      boardEl.appendChild(rb);
    } else {
      var title = (state.place && (state.place.name || state.place.address)) ||
                  (state.geom && (state.geom.name || state.geom.addr)) || 'Building';
      listHead.textContent = title;
      listHead.setAttribute('title', title);
      var line = title + '\n' + state.stores.length + (state.stores.length === 1 ? ' store' : ' stores');
      if (state.overflow > 0) line += ' \u00B7 +' + state.overflow + ' more';
      boardEl.textContent = line;
    }
  }

  /* ---------------- board projection + aim ---------------------- */
  var _v = null;
  function project(el, ax, ay, az, cam) {
    if (!_v) _v = new THREE.Vector3();
    _v.set(ax, ay, az).project(cam);
    if (_v.z > 1 || _v.z < -1) { el.style.display = 'none'; return false; }
    el.style.display = '';
    el.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    el.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    return true;
  }
  function labelTick() {
    if (state.phase !== 'in') return;
    requestAnimationFrame(labelTick);
    if (state.book.open) return;
    var cam = window.__espilMapCameraObj ? window.__espilMapCameraObj() : null;
    if (!cam || typeof THREE === 'undefined') return;
    if (lobby) project(boardEl, anchor.x, 3.1, anchor.z - lobby.D / 2 + 0.22, cam);
    /* aim: the bay closest to the view centre line; its list
       row carries the highlight (the .aimed toggle below). */
    var fpv = window.__espilKbFpvState ? window.__espilKbFpvState() : null;
    var pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null;
    var best = null, bestAng = 0.22;
    if (fpv && pose) {
      var dx = -Math.sin(fpv.yaw), dz = -Math.cos(fpv.yaw);
      for (var j = 0; j < bays.length; j++) {
        var tx = bays[j].ax - pose.x, tz = bays[j].az - pose.z;
        var dist = Math.sqrt(tx * tx + tz * tz);
        if (dist < 0.01 || dist > 60) continue;
        var cos = (tx * dx + tz * dz) / dist;
        var ang = Math.acos(Math.max(-1, Math.min(1, cos)));
        if (ang < bestAng) { bestAng = ang; best = bays[j].store; }
      }
    }
    if (best !== state.aimed) {
      state.aimed = best;
      bays.forEach(function (b) { b.el.classList.toggle('aimed', !!best && b.store === best); });
    }
  }

  /* ---------------- the storybook -------------------------------- */
  function typeLabel(t) {
    var map = {
      convenience_store: 'Convenience store', restaurant: 'Restaurant',
      fast_food_restaurant: 'Fast food restaurant', sporting_goods_store: 'Sporting goods store',
      cafe: 'Caf\u00E9', bakery: 'Bakery', grocery_or_supermarket: 'Grocery store',
      clothing_store: 'Clothing store', book_store: 'Book store', pharmacy: 'Pharmacy',
      bar: 'Bar', meal_takeaway: 'Takeaway', store: 'Store', point_of_interest: 'Place'
    };
    if (map[t]) return map[t];
    var s = String(t || 'store').replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function spreadsOf(items) {
    var out = [];
    for (var i = 0; i < items.length; i += 6) out.push(items.slice(i, i + 6));
    return out;
  }
  function stockMap() {
    var parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(STOCK_KEY) || 'null'); } catch (e) {}
    /* The shared key's current shape is the per-item map, keyed by
       item name - read exactly as modules/store.js reads it. (The
       pre-catalogue bare-number shape is deliberately NOT read
       here: naming its one item would put a goods-name literal in
       this module, which the design forbids; that shape has been
       migrated on read by store.js since the catalogue landed, and
       an unmigrated remnant simply reads as defaults here.) */
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      var m = {};
      Object.keys(parsed).forEach(function (k) { if (typeof parsed[k] === 'number') m[k] = Math.max(0, Math.floor(parsed[k])); });
      return m;
    }
    return {};
  }
  function stockSet(m) { try { localStorage.setItem(STOCK_KEY, JSON.stringify(m)); } catch (e) {} }
  function stockOf(item) {
    var s = stockMap();
    return (typeof s[item.name] === 'number') ? s[item.name] : item.initialStock;
  }

  function selectStore(store) {
    if (state.phase !== 'in') return;
    state.book.open = true; state.book.store = store; state.book.data = null;
    state.book.spread = 0; state.book.pageIdx = 0; state.book.failed = false;
    bookEl.classList.add('open'); bookEl.setAttribute('aria-hidden', 'false');
    layer.style.display = 'none'; cross.style.display = 'none';
    renderBookLoading();
    loadItems(store, function (d) {
      if (!state.book.open || state.book.store !== store) return;
      if (!d) { state.book.failed = true; renderBook(); return; }
      state.book.data = d; renderBook();
    });
  }
  function closeBook() {
    if (!state.book.open) return;
    state.book.open = false; state.book.store = null; state.book.data = null;
    bookEl.classList.remove('open'); bookEl.setAttribute('aria-hidden', 'true');
    if (state.phase === 'in') { layer.style.display = ''; cross.style.display = ''; }
  }
  function isSingle() { return window.innerWidth < 680; }
  function pageCount() {
    var d = state.book.data;
    if (!d || d.goodsState !== 'registered') return 1;
    return spreadsOf(d.items).length;
  }
  function turn(dir) {
    if (!state.book.open || !state.book.data) return;
    if (isSingle()) {
      var total = 1 + pageCount();
      state.book.pageIdx = Math.max(0, Math.min(total - 1, state.book.pageIdx + dir));
      state.book.spread = Math.max(0, state.book.pageIdx - 1);
    } else {
      state.book.spread = Math.max(0, Math.min(pageCount() - 1, state.book.spread + dir));
    }
    renderBook();
  }
  function renderBookLoading() {
    leftEl.innerHTML = ''; rightEl.innerHTML = '';
    var p = document.createElement('div'); p.className = 'ps-empty'; p.textContent = 'Opening the book\u2026';
    rightEl.appendChild(p); pagenoEl.textContent = '';
    frameEl.setAttribute('data-show', 'items');
  }
  function renderBook() {
    var store = state.book.store; if (!store) return;
    var d = state.book.data;
    if (!d && !state.book.failed) { renderBookLoading(); return; }
    /* left page: the store itself */
    leftEl.innerHTML = '';
    var ty = document.createElement('div'); ty.className = 'ps-type'; ty.textContent = typeLabel(store.type);
    var h = document.createElement('h3'); h.textContent = store.name;
    var intro = document.createElement('p'); intro.className = 'ps-intro';
    intro.textContent = typeLabel(store.type) + ' \u00B7 ' +
      ((state.place && state.place.address) || (state.geom && state.geom.addr) || '');
    var bal = document.createElement('div'); bal.className = 'ps-bal';
    bal.innerHTML = 'Your Leo \u00B7 <span></span>';
    bal.querySelector('span').textContent = 'Leo ' + leoBalance().toLocaleString('en-US');
    leftEl.appendChild(ty); leftEl.appendChild(h); leftEl.appendChild(intro); leftEl.appendChild(bal);
    /* right page: goods, the empty state, or the failure page */
    rightEl.innerHTML = '';
    if (state.book.failed) {
      var f = document.createElement('div'); f.className = 'ps-empty';
      f.textContent = 'The goods could not be loaded.';
      var rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'ps-buy'; rb.textContent = 'Retry'; rb.disabled = false;
      rb.addEventListener('click', function () {
        state.book.failed = false; renderBookLoading();
        loadItems(store, function (dd) {
          if (!state.book.open || state.book.store !== store) return;
          if (!dd) { state.book.failed = true; renderBook(); return; }
          state.book.data = dd; renderBook();
        });
      });
      f.appendChild(document.createElement('br')); f.appendChild(rb);
      rightEl.appendChild(f);
      pagenoEl.textContent = '';
    } else if (!d) {
      var e2 = document.createElement('div'); e2.className = 'ps-empty'; e2.textContent = 'Opening the book\u2026';
      rightEl.appendChild(e2); pagenoEl.textContent = '';
    } else if (d.goodsState !== 'registered' || !d.items.length) {
      var e = document.createElement('div'); e.className = 'ps-empty';
      e.textContent = (lang() === 'ko')
        ? '\uC544\uC9C1 \uBB3C\uAC74\uC774 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC740 \uAC00\uAC8C\uC785\uB2C8\uB2E4'
        : 'This store has no goods registered yet.';
      rightEl.appendChild(e);
      pagenoEl.textContent = '';
    } else {
      var spreads = spreadsOf(d.items);
      var sp = spreads[Math.min(state.book.spread, spreads.length - 1)];
      var grid = document.createElement('div'); grid.className = 'ps-grid';
      sp.forEach(function (item) { grid.appendChild(itemCard(store, item)); });
      rightEl.appendChild(grid);
      pagenoEl.textContent = isSingle()
        ? (state.book.pageIdx === 0 ? 'Cover' : (state.book.spread + 1) + ' / ' + spreads.length)
        : (state.book.spread + 1) + ' / ' + spreads.length;
    }
    frameEl.setAttribute('data-show', isSingle() && state.book.pageIdx > 0 ? 'items' : 'intro');
    if (!isSingle()) frameEl.setAttribute('data-show', 'both');
  }
  function itemCard(store, item) {
    var n = stockOf(item);
    var card = document.createElement('div'); card.className = 'ps-card';
    var tile = document.createElement('div'); tile.className = 'ps-tile';
    tile.style.background = item.color || '#e8e2d2'; tile.textContent = item.glyph || '';
    var nm = document.createElement('div'); nm.className = 'ps-cname'; nm.textContent = item.name;
    var meta = document.createElement('div'); meta.className = 'ps-cmeta';
    meta.textContent = 'Leo ' + item.priceLeo + ' \u00B7 Stock ' + n;
    var buy = document.createElement('button');
    buy.type = 'button'; buy.className = 'ps-buy';
    buy.textContent = n > 0 ? 'Buy' : 'Sold out'; buy.disabled = n <= 0;
    var refuse = document.createElement('div'); refuse.className = 'ps-refuse';
    buy.addEventListener('click', function () { doBuy(store, item, meta, buy, refuse); });
    card.appendChild(tile); card.appendChild(nm); card.appendChild(meta); card.appendChild(buy); card.appendChild(refuse);
    return card;
  }
  function refuseLine(el, msg) {
    el.textContent = msg;
    setTimeout(function () { if (el.textContent === msg) el.textContent = ''; }, 2600);
  }
  /* One purchase, inside the book, through the existing pipeline:
     Leo debit -> stock decrement -> the espil-guide 'bought' event
     (the bag grant in panels.js listens for it) -> the purchase
     bridge emit. On a refusal NOTHING moves. */
  function doBuy(store, item, metaEl, buyEl, refuseEl) {
    var s = stockMap();
    var cur = (typeof s[item.name] === 'number') ? s[item.name] : item.initialStock;
    if (cur <= 0) { refuseLine(refuseEl, 'Sold out'); return; }
    var bal = leoBalance();
    if (bal < item.priceLeo) { refuseLine(refuseEl, 'Not enough Leo'); return; }
    leoSet(bal - item.priceLeo);
    s[item.name] = cur - 1; stockSet(s);
    try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: { type: 'bought', item: item.name } })); } catch (e) {}
    bridgeEmit(store, item);
    metaEl.textContent = 'Leo ' + item.priceLeo + ' \u00B7 Stock ' + (cur - 1);
    if (cur - 1 <= 0) { buyEl.textContent = 'Sold out'; buyEl.disabled = true; }
    var balEl = leftEl.querySelector('.ps-bal span');
    if (balEl) balEl.textContent = 'Leo ' + leoBalance().toLocaleString('en-US');
    toast('Bought ' + item.name + ' for Leo ' + item.priceLeo);
  }
  /* The purchase bridge, in the popup's exact two-channel shape
     (design 9-4): the opener message with targetOrigin pinned to
     this origin, and the append-only shared record. The store
     field carries the store NAME - the parent's step gate judges
     by item name, and in a multi-store building the name is what
     identifies the store. */
  function bridgeEmit(store, item) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: 'espil-store-purchase', store: store.name, item: item.name, qty: 1, price: item.priceLeo },
          location.origin);
      }
    } catch (e) {}
    try {
      var a = JSON.parse(localStorage.getItem(PURCHASE_KEY) || '[]');
      if (!Array.isArray(a)) a = [];
      a.push({ item: item.name, qty: 1, price: item.priceLeo, store: store.name, at: Date.now() });
      if (a.length > 20) a = a.slice(a.length - 20);
      localStorage.setItem(PURCHASE_KEY, JSON.stringify(a));
    } catch (e) {}
  }

  /* ---------------- entry / exit --------------------------------- */
  function notifyParent(type) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: type, store: SLUG }, location.origin);
      }
    } catch (e) {}
  }
  function maybeEnter() {
    if (state.entered || !state.geom) return;
    if (!window.__espilPlaceSpaceReady) return;
    if (!document.body.classList.contains('in-map')) return;
    var pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null;
    if (!pose) return;
    if (!buildLobby()) return;
    state.entered = true; state.phase = 'in';
    preSummon = { x: pose.x, z: pose.z };
    var street = { x: state.geom.cx, z: state.geom.cz };
    window.__espilPlaceEnterSpace({
      city: CITY, slug: SLUG,
      name: state.geom.name || null, address: state.geom.addr || null,
      anchor: anchor, street: street,
      door: { x: anchor.x, z: anchor.z + lobby.D / 2 },
      spawn: { x: anchor.x, z: anchor.z + lobby.D / 2 - 2.4 },
      yaw: 0
    });
    layer.style.display = ''; cross.style.display = '';
    notifyParent('espil-store-open');
    paintBoard(); buildBays();
    requestAnimationFrame(labelTick);
  }
  function exitToStreet() {
    state.phase = 'exited';
    closeBook();
    layer.style.display = 'none'; cross.style.display = 'none';
    if (lobby && lobby.group && lobby.group.parent) lobby.group.parent.remove(lobby.group);
    try { sessionStorage.removeItem('espil_store_space_v1'); } catch (e) {}
    if (window.__espilPlaceExitSpace) window.__espilPlaceExitSpace();
  }
  function exitSpace() {
    if (state.phase !== 'in') return;
    if (window.opener && !window.opener.closed) {
      state.phase = 'closing';
      notifyParent('espil-store-close');
      window.close();
      /* a refused close falls back to the same-window street return */
      setTimeout(function () { if (state.phase === 'closing') exitToStreet(); }, 700);
      return;
    }
    exitToStreet();
  }
  window.addEventListener('beforeunload', function () {
    if (state.phase === 'in') notifyParent('espil-store-close');
  });

  /* hooks the monolith's interact path calls (door + Use key) */
  window.__espilPlaceSpaceExit = exitSpace;
  window.__espilPlaceSpaceUse = function () {
    if (state.phase !== 'in' || state.book.open) return;
    if (state.aimed) selectStore(state.aimed);
    else toast('Look at a store, then press Space - or click its name in the store list.');
  };
  window.__espilPlaceSpace = {
    state: function () {
      return {
        armed: true, phase: state.phase, city: CITY, slug: SLUG,
        anchor: { x: anchor.x, z: anchor.z },
        rect: window.__espilPlaceSpaceRect || null,
        api: state.api,
        stores: state.stores.map(function (s) { return s.name; }),
        bays: bays.length, overflow: state.overflow,
        bookOpen: state.book.open,
        bookStore: state.book.store ? state.book.store.name : null,
        aimed: state.aimed ? state.aimed.name : null,
        inside: !!(window.__espilInside && window.__espilInside.placeSpace),
        fpv: window.__espilKbFpvState ? window.__espilKbFpvState() : null
      };
    },
    select: function (name) {
      var s = state.stores.filter(function (x) { return x.name === name; })[0];
      if (s) selectStore(s);
    },
    closeBook: closeBook,
    exit: exitSpace
  };

  /* ---------------- boot ------------------------------------------ */
  resolveGeomFromBake();
  loadPlace();
  setInterval(maybeEnter, 250);
  maybeEnter();
})();
