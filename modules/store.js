
/* __espilStore v1 - the store batch (Han 2026-10-31): bigger
   interiors (pair-side scale floor), a white-glowing entrance/exit,
   first-person zoom inside, and Konbiniya rebuilt as a real
   convenience store from the Kenney Mini Market set (CC0) - shelf
   aisles, displays, freezers, and a serving counter with the till
   and the clerk. Browse the shelves, then pay AT THE COUNTER: the
   counter zone opens the shop, and the stocked goods (a food and
   drink catalogue for HP/MP recovery, Onigiri Leo 2) decrement the
   store's persisted stock as they are bought into the inventory.
   S4 (Han 2026-11-06): the catalogue carries the Konbiniya's
   ready food and drinks; prices follow panels.js FOOD_PRICE
   (the bag's sell price is 1/3 of these), Onigiri keeps Leo 2.
   Entry routing framework: buildings enter directly today.
   Konbiniya is one floor, so it stays direct; the routing seam
   (__espilEntryRoute) is where 2F+ buildings will first land in
   the party waiting zone (party gathers, then enters together)
   and where elevators attach by building height - that batch
   builds on this seam, per Han's staged order. */
(function () {
  'use strict';
  var STOCK_KEY = 'espil_shop_stock_v1';
  /* S4 catalogue: ready food and drinks that fit a konbini. Prices
     follow panels.js FOOD_PRICE; Onigiri keeps Leo 2. Stock is a
     per-item map under the same key as before. */
  var CATALOG = [
    { name: 'Onigiri', price: 2, color: '#f2ead8', glyph: '\uD83C\uDF59', initial: 20 },
    { name: 'Triangle Kimbap', price: 100, color: '#e8d9a0', glyph: '\uD83C\uDF58', initial: 10 },
    { name: 'Kimbap', price: 120, color: '#cfe8c0', glyph: '\uD83C\uDF71', initial: 10 },
    { name: 'Cup Ramen', price: 130, color: '#f6c177', glyph: '\uD83C\uDF5C', initial: 10 },
    { name: 'Banana Milk', price: 110, color: '#f7e38b', glyph: '\uD83C\uDF4C', initial: 10 },
    { name: 'Canned Coffee', price: 100, color: '#c8a37a', glyph: '\u2615', initial: 10 },
    { name: 'Orange Juice', price: 120, color: '#ffd9a0', glyph: '\uD83C\uDF4A', initial: 10 },
    { name: 'Water', price: 50, color: '#bcd9f5', glyph: '\uD83D\uDCA7', initial: 10 },
    { name: 'Cola', price: 120, color: '#e8b4b8', glyph: '\uD83E\uDD64', initial: 10 }
  ];
  var ONIGIRI = CATALOG[0];
  var loader = null, modelCache = {}, kenneyGroup = null, glowGroup = null;
  var activeBuilding = null, counterNear = false, fpHidden = false, lastHintAt = 0;

  function inside() { return window.__espilInside || null; }
  function isKonbiniya() {
    var i = inside(); if (!i) return false;
    if (/konbiniya/i.test(i.name || '')) return true;
    /* The Konbiniya building's displayed name is its street address
       (1238 Robson St - the baked record carries no building name),
       so position is the reliable identity: the entered building's
       anchor against the fixed Konbiniya anchor. */
    var k = window.__espilKonbiniyaPos;
    return !!(k && typeof i.x === 'number' && Math.hypot(i.x - k.x, i.z - k.z) < 40);
  }
  function leoBalance() { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); return isNaN(v) ? 1000 : v; }
  function leoSet(v) { try { localStorage.setItem('espil_leo_balance', String(v)); } catch (e) {} var p = document.getElementById('shop-purse'); if (p) p.textContent = 'Leo ' + v.toLocaleString('en-US'); }
  function defaultStock() { var m = {}; CATALOG.forEach(function (it) { m[it.name] = it.initial; }); return m; }
  function stock() {
    var parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(STOCK_KEY) || 'null'); } catch (e) {}
    var m = defaultStock();
    /* Legacy shapes migrate to the per-item map on first read: a
       bare number, or the old single-item object {Onigiri: n}
       (the pre-S4 save), keeps the stored Onigiri count and fills
       the rest with defaults. The migrated map is persisted at
       once so later reads are plain map reads. */
    if (typeof parsed === 'number' && isFinite(parsed)) {
      m.Onigiri = Math.max(0, Math.floor(parsed)); stockSet(m); return m;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      var saw = false, legacy = true;
      CATALOG.forEach(function (it) {
        if (typeof parsed[it.name] === 'number') {
          m[it.name] = Math.max(0, Math.floor(parsed[it.name])); saw = true;
          if (it.name !== 'Onigiri') legacy = false;
        }
      });
      if (saw) { if (legacy) stockSet(m); return m; }
    }
    return m;
  }
  function stockSet(s) { try { localStorage.setItem(STOCK_KEY, JSON.stringify(s)); } catch (e) {} }
  function toast(m) { if (window.__espilToast) window.__espilToast(m); }

  /* ---------- Kenney fitout ---------- */
  function loadModel(name, done) {
    if (modelCache[name]) { done(modelCache[name].clone()); return; }
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') { done(null); return; }
    if (!loader) loader = new THREE.GLTFLoader();
    loader.load('assets/kenney-mini-market/' + name + '.glb', function (gltf) {
      modelCache[name] = gltf.scene;
      done(gltf.scene.clone());
    }, undefined, function () {
      /* Batch A6 fix: never fail silently again - a missing shared
         texture (Textures/colormap.png) once 404ed every model in
         this set while kenneyReady still reported true. */
      try { console.warn('[espil-store] Kenney model failed to load: ' + name); } catch (e) {}
      done(null);
    });
  }
  function place(group, name, x, y, z, ry) {
    loadModel(name, function (obj) {
      if (!obj) return;
      obj.position.set(x, y, z);
      if (ry) obj.rotation.y = ry;
      obj.traverse(function (n) { n.frustumCulled = false; });
      group.add(obj);
    });
  }
  function buildKenney(fitout) {
    if (kenneyGroup) return;
    var g = new THREE.Group();
    kenneyGroup = g;
    function M(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; g.add(m); return m; }
    function LM(c) { return new THREE.MeshLambertMaterial({ color: c }); }
    /* serving counter across the back wall + till + clerk */
    M(new THREE.BoxGeometry(10, 1.05, 1.1), LM(0x74563a), 0, 0.53, -6.9);
    M(new THREE.BoxGeometry(10, 0.08, 1.3), LM(0xe8e2d2), 0, 1.09, -6.9);
    place(g, 'cash-register', 1.2, 1.13, -6.9, Math.PI);
    place(g, 'character-employee', 1.2, 0, -7.8, Math.PI);
    /* two shelf aisles */
    [-2.6, 1.2].forEach(function (rz) {
      var xs = [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5];
      xs.forEach(function (x, i) { place(g, i % 2 ? 'shelf-bags' : 'shelf-boxes', x, 0, rz, 0); });
      place(g, 'shelf-end', -6.9, 0, rz, Math.PI / 2);
      place(g, 'shelf-end', 6.9, 0, rz, -Math.PI / 2);
    });
    /* fresh displays by the entrance sides */
    place(g, 'display-fruit', -8.6, 0, 4.6, Math.PI / 2);
    place(g, 'display-bread', 8.6, 0, 4.6, -Math.PI / 2);
    /* cold wall west, freezer east */
    [-3.5, 0, 3.5].forEach(function (z) { place(g, 'freezers-standing', -12.1, 0, z, Math.PI / 2); });
    place(g, 'freezer', 12.1, 0, -0.5, -Math.PI / 2);
    /* baskets, a cart, and the bottle return by the door */
    place(g, 'shopping-basket', 6.9, 0, 6.2, 0.4);
    place(g, 'shopping-cart', 7.7, 0, 6.7, 0.9);
    place(g, 'bottle-return', -10.6, 0, 6.6, 0);
    fitout.add(g);
  }
  function buildGlow(fitout) {
    if (glowGroup) return;
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    function M(geo, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; g.add(m); return m; }
    M(new THREE.BoxGeometry(0.16, 2.7, 0.16), -1.85, 1.35, 8.02);
    M(new THREE.BoxGeometry(0.16, 2.7, 0.16), 1.85, 1.35, 8.02);
    M(new THREE.BoxGeometry(3.86, 0.16, 0.16), 0, 2.78, 8.02);
    var floorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), floorMat);
    fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.06, 7.55); fl.frustumCulled = false;
    g.add(fl);
    g.userData.mat = mat; g.userData.floorMat = floorMat;
    glowGroup = g;
    fitout.add(g);
  }
  function applyFitout() {
    var fitout = window.__espilFitoutGroup;
    if (!fitout) return;
    buildGlow(fitout);
    if (isKonbiniya()) {
      buildKenney(fitout);
      fitout.children.forEach(function (c) { if (c !== kenneyGroup && c !== glowGroup) c.visible = false; });
      if (kenneyGroup) kenneyGroup.visible = true;
    } else {
      fitout.children.forEach(function (c) { if (c !== kenneyGroup) c.visible = true; });
      if (kenneyGroup) kenneyGroup.visible = false;
    }
  }

  /* ---------- counter zone + catalogue stock ---------- */
  function counterDistance() {
    var fitout = window.__espilFitoutGroup, pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null;
    if (!fitout || !pose || typeof THREE === 'undefined') return 99;
    var v = fitout.localToWorld(new THREE.Vector3(0.9, 0, -6.4));
    return Math.hypot(pose.x - v.x, pose.z - v.z);
  }
  function shopOpen() { var o = document.getElementById('shop-ui'); return !!(o && o.getAttribute('aria-hidden') === 'false'); }
  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.code !== 'Space') return;
    if (e.repeat || !isKonbiniya() || !counterNear || shopOpen()) return;
    var ae = document.activeElement, at = (ae && ae.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(at)) return;
    e.preventDefault(); e.stopPropagation();
    if (window.__espilOpenShop) window.__espilOpenShop();
  }, true);

  function itemCard(it) {
    var n = stock()[it.name];
    var card = document.createElement('div');
    card.setAttribute('data-store-item', it.name);
    if (it.name === 'Onigiri') card.setAttribute('data-store-onigiri', '1');
    card.style.cssText = 'border:1px solid rgba(255,233,168,.45);border-radius:10px;padding:8px;text-align:center;';
    var tile = document.createElement('div');
    tile.style.cssText = 'height:34px;border-radius:6px;background:' + it.color + ';display:flex;align-items:center;justify-content:center;font-size:20px;';
    tile.textContent = it.glyph;
    var name = document.createElement('div'); name.textContent = it.name; name.style.cssText = 'margin-top:6px;font-size:.82rem;';
    var meta = document.createElement('div');
    meta.textContent = 'Leo ' + it.price + ' · Stock ' + n;
    meta.style.cssText = 'opacity:.75;font-size:.78rem;';
    var buy = document.createElement('button');
    buy.className = 'pill-btn'; buy.style.cssText = 'margin-top:6px;';
    buy.textContent = n > 0 ? 'Buy at counter' : 'Sold out';
    buy.disabled = n <= 0;
    buy.addEventListener('click', function () {
      var s = stock();
      if (s[it.name] <= 0) { toast(it.name + ' is sold out'); return; }
      var bal = leoBalance();
      if (bal < it.price) { toast('Not enough Leo for ' + it.name); return; }
      leoSet(bal - it.price);
      s[it.name] -= 1; stockSet(s);
      var bag = document.getElementById('shop-bag');
      if (bag) bag.textContent = (bag.textContent && bag.textContent.indexOf('Your bag:') === 0 && bag.textContent !== 'Your bag: ') ? bag.textContent + ', ' + it.name : 'Your bag: ' + it.name;
      try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: { type: 'bought', item: it.name } })); } catch (e) {}
      toast('Bought ' + it.name + ' for Leo ' + it.price + ' (' + s[it.name] + ' left)');
      var grid2 = document.getElementById('shop-grid');
      if (grid2) { var old = grid2.querySelectorAll('[data-store-item]'); for (var i = 0; i < old.length; i++) old[i].remove(); }
      injectCatalogue();
    });
    card.appendChild(tile); card.appendChild(name); card.appendChild(meta); card.appendChild(buy);
    return card;
  }
  function injectCatalogue() {
    if (!isKonbiniya() || !shopOpen()) return;
    var grid = document.getElementById('shop-grid');
    if (!grid || grid.querySelector('[data-store-item]')) return;
    /* insert at the head in reverse so the catalogue's own order
       (Onigiri first) is the visual order */
    for (var i = CATALOG.length - 1; i >= 0; i--) grid.insertBefore(itemCard(CATALOG[i]), grid.firstChild);
  }
  var gridObs = new MutationObserver(function () { setTimeout(injectCatalogue, 0); });
  function watchGrid() {
    var grid = document.getElementById('shop-grid');
    if (grid && !grid.__storeWatched) { grid.__storeWatched = true; gridObs.observe(grid, { childList: true }); }
  }

  /* ---------- first person inside ---------- */
  function fpTick() {
    var own = window.__espilOwnGroup ? window.__espilOwnGroup() : null;
    if (!own) return;
    if (!inside()) { if (fpHidden) { own.visible = true; fpHidden = false; } return; }
    var cam = window.__espilMapCameraObj ? window.__espilMapCameraObj() : null;
    var pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null;
    if (!cam || !pose || !cam.position) return;
    var d = Math.hypot(cam.position.x - pose.x, cam.position.y - (pose.y + 1.2), cam.position.z - pose.z);
    if (d < 1.7 && !fpHidden) { own.visible = false; fpHidden = true; }
    else if (d > 2.2 && fpHidden) { own.visible = true; fpHidden = false; }
  }

  /* ---------- main tick ---------- */
  setInterval(function () {
    watchGrid();
    var ins = inside();
    var name = ins ? (ins.name || '') : null;
    if (name !== activeBuilding) { activeBuilding = name; if (ins) setTimeout(applyFitout, 60); }
    if (ins && glowGroup && glowGroup.userData.mat) {
      var o = 0.68 + 0.28 * Math.sin(Date.now() / 300);
      glowGroup.userData.mat.opacity = o;
      glowGroup.userData.floorMat.opacity = 0.16 + 0.14 * Math.sin(Date.now() / 300);
    }
    if (isKonbiniya()) {
      counterNear = counterDistance() < 2.4;
      if (counterNear && !shopOpen() && Date.now() - lastHintAt > 6000) {
        lastHintAt = Date.now();
        toast('Press Space to pay at the counter');
      }
    } else counterNear = false;
    fpTick();
  }, 180);

  window.__espilEntryRoute = function (name) {
    if (/konbiniya/i.test(name || '')) return { mode: 'store-page', floors: 1, note: 'Opens the standalone store page at /vancouver/1238-robson-st/ (Batch S); the street page pauses while it is open and resumes when it closes.' };
    return { mode: 'legacy', floors: null, note: 'Direct entry today. The routing framework lands 2F+ buildings in the party waiting zone first (party enters together), with elevators by building height.' };
  };
  window.__espilStoreState = function () {
    return {
      inside: !!inside(), building: inside() ? (inside().name || null) : null,
      konbiniya: isKonbiniya(), kenneyReady: !!kenneyGroup,
      counterNear: counterNear, onigiriStock: stock().Onigiri, stock: stock(),
      doorGlow: !!glowGroup, firstPerson: fpHidden
    };
  };
})();

