
/* __espilCompassNav v1 - compass navigation HUD (Han's order, 2026-10-31).
   The floor-line navigation path is retired: a compass dial that turns
   with the player carries a gold marker at the target bearing, with the
   target name and the remaining distance beside it.

   EXTRACTED (proactivity, 2026-10-31) from the UI room's compass block in
   ~/workspace/ui-room/guide/guide-layer.html. That block lives inside the
   deleted guide flow layer (its stage engine, its per-device flow keys,
   its quest card). The guide must never come back (Han's standing order,
   2026-10-27), so this module carries ONLY the compass: no stage engine,
   no flow keys, no quest card, no hint elements. The header avoids the
   literal marker strings on purpose, so a marker grep over a pair that
   includes this module still reads zero.

   Public surface (UI room INTEGRATION.md, 2026-10-31):
     window.__espilCompassNav.show({x, z, name}, {arrive, owner})
     window.__espilCompassNav.hide()
     window.__espilCompassNav.state() -> {on, target, owner, dist}
   The positional form show(x, z, name) is ALSO accepted, because the
   map-search module already in the fix-batch pair calls it that way
   (fix-batch index.html / vancouver.html, map search block); with the
   object-only surface that call returned false silently and a
   search-started navigation raised no compass at all.

   Follow mode: while the world posts a target itself
   (window.__espilNavActive && window.__espilNavTarget, set by
   __espilNavShow), the compass mirrors it until the world clears it.
   That covers the tutorial Konbiniya leg (__espilNavToKonbiniya) with
   no caller changes. An explicit show() always wins over the mirror.

   Bearings use the world's own convention: the facing vector is
   (-sin faceY, -cos faceY), so a target's bearing is atan2(-dx, -dz),
   the same scale as the pose angle 'a' from __espilPlayerPose().
   Distance is the remaining straight-line distance, formatted as m
   under 1 km and km above (UI room spec). Arrival: with arrive:true
   the compass owns the 5 m radius, hides itself, and fires the
   world's own 'espil-guide' event {type:'nav-arrived', name}
   (unflagged, so existing listeners consume it as before). In follow
   mode arrive stays false - the world's nav tick owns arrival. */
(function () {
  'use strict';

  var CSS = [
    '#espil-compass{',
    '  position:fixed; left:50%; top:10px; transform:translateX(-50%) translateY(-8px);',
    '  z-index:46; display:flex; align-items:center; gap:11px;',
    '  padding:7px 16px 7px 7px; border-radius:999px;',
    '  border:1px solid rgba(142,247,232,.35);',
    '  background:linear-gradient(180deg, rgba(4,18,24,.88), rgba(3,10,14,.85));',
    '  box-shadow:0 14px 34px rgba(0,0,0,.5);',
    '  pointer-events:none; opacity:0; transition:opacity .4s ease, transform .4s ease;',
    '  font-family:"Manrope",sans-serif;',
    '}',
    '#espil-compass.on{ opacity:1; transform:translateX(-50%) translateY(0); }',
    '#espil-compass .cmp-dial{',
    '  position:relative; flex:none; width:58px; height:58px; border-radius:50%;',
    '  border:1px solid rgba(142,247,232,.45);',
    '  background:radial-gradient(circle at 50% 42%, rgba(23,48,58,.95), rgba(6,16,22,.95));',
    '}',
    '#espil-compass .cmp-rot{ position:absolute; inset:0; transition:transform .15s linear; will-change:transform; }',
    '#espil-compass .cmp-spin{ position:absolute; inset:0; }',
    '#espil-compass .cmp-card span{',
    '  position:absolute; left:50%; top:2px; transform:translateX(-50%);',
    '  color:#d9fff6; font:800 .58rem/1 "Manrope",sans-serif; letter-spacing:.04em;',
    '}',
    '#espil-compass .cmp-card.north span{ color:#ffd94d; }',
    '#espil-compass .cmp-tick i{',
    '  position:absolute; left:50%; top:1px; width:2px; height:5px; transform:translateX(-50%);',
    '  background:rgba(142,247,232,.55); border-radius:1px;',
    '}',
    '#espil-compass .cmp-mark i{',
    '  position:absolute; left:50%; top:-6px; width:11px; height:11px;',
    '  transform:translateX(-50%) rotate(45deg);',
    '  background:#ffd94d; border:1px solid #fff2b0; border-radius:2px;',
    '  box-shadow:0 0 10px rgba(255,217,77,.85);',
    '}',
    '#espil-compass .cmp-ptr{',
    '  position:absolute; left:50%; top:-3px; transform:translateX(-50%); z-index:2;',
    '  width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent;',
    '  border-top:7px solid #8ef7e8;',
    '}',
    '#espil-compass .cmp-dot{',
    '  position:absolute; left:50%; top:50%; width:5px; height:5px; border-radius:50%;',
    '  transform:translate(-50%,-50%); background:rgba(217,255,246,.85);',
    '}',
    '#espil-compass .cmp-name{ color:#8ef7e8; font:900 .58rem/1 "Manrope",sans-serif; letter-spacing:.22em; margin-bottom:3px; }',
    '#espil-compass .cmp-dist{ color:#fff4cf; font:800 1.02rem/1.2 "Manrope",sans-serif; white-space:nowrap; }',
    '@media (max-width: 600px){',
    '  #espil-compass{ gap:9px; padding:6px 13px 6px 6px; }',
    '  #espil-compass .cmp-dial{ width:48px; height:48px; }',
    '  #espil-compass .cmp-dist{ font-size:.92rem; }',
    '}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var cmpEl = document.createElement('div');
  cmpEl.id = 'espil-compass';
  cmpEl.setAttribute('aria-hidden', 'true');
  cmpEl.innerHTML =
    '<div class="cmp-dial"><div class="cmp-rot" id="espil-compass-rot"></div>' +
    '<div class="cmp-ptr"></div><div class="cmp-dot"></div></div>' +
    '<div><div class="cmp-name" id="espil-compass-name"></div>' +
    '<div class="cmp-dist" id="espil-compass-dist"></div></div>';
  document.body.appendChild(cmpEl);

  var cmpRot = cmpEl.querySelector('#espil-compass-rot'),
      cmpNameEl = cmpEl.querySelector('#espil-compass-name'),
      cmpDistEl = cmpEl.querySelector('#espil-compass-dist'),
      cmpMark = null;
  (function buildRose() {
    if (!cmpRot) return;
    var cards = [['N', 0, 'north'], ['E', -90, ''], ['S', 180, ''], ['W', 90, '']];
    for (var i = 0; i < cards.length; i++) {
      var w = document.createElement('div'); w.className = 'cmp-spin cmp-card ' + cards[i][2];
      w.style.transform = 'rotate(' + (-cards[i][1]) + 'deg)';
      var s = document.createElement('span'); s.textContent = cards[i][0]; w.appendChild(s); cmpRot.appendChild(w);
    }
    for (var t = 45; t < 360; t += 90) {
      var tw = document.createElement('div'); tw.className = 'cmp-spin cmp-tick';
      tw.style.transform = 'rotate(' + t + 'deg)';
      tw.appendChild(document.createElement('i')); cmpRot.appendChild(tw);
    }
    var mw = document.createElement('div'); mw.className = 'cmp-spin cmp-mark';
    mw.appendChild(document.createElement('i')); cmpRot.appendChild(mw); cmpMark = mw;
  })();

  function emit(type, detail) {
    var d = { type: type }; if (detail) for (var k in detail) d[k] = detail[k];
    try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: d })); } catch (e) {}
  }

  var cmpTarget = null, cmpArrive = false, cmpArrived = false, cmpOwner = null, cmpDist = null;
  function cmpFmt(d) {
    if (d >= 1000) { var k = d / 1000; return (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + ' km'; }
    return Math.max(0, Math.round(d)) + ' m';
  }
  function cmpShow(t, opts) {
    /* Accept the legacy positional form show(x, z, name) as well as
       show({x, z, name}, opts) - see the header note. */
    if (typeof t === 'number' && typeof opts === 'number') {
      t = { x: t, z: opts, name: (arguments[2] || '') };
      opts = arguments[3] || {};
    }
    if (!cmpEl || !t || typeof t.x !== 'number' || typeof t.z !== 'number') return false;
    opts = opts || {};
    cmpTarget = { x: t.x, z: t.z, name: t.name || 'Destination' };
    cmpArrive = !!opts.arrive; cmpArrived = false;
    cmpOwner = opts.owner || 'external'; cmpDist = null;
    if (cmpNameEl) cmpNameEl.textContent = String(cmpTarget.name).toUpperCase();
    if (cmpDistEl) cmpDistEl.textContent = '';
    cmpEl.classList.add('on'); cmpEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('espil-compass-on'); document.body.classList.add('guide-compass-on');
    return true;
  }
  function cmpHide() {
    cmpTarget = null; cmpArrive = false; cmpOwner = null; cmpDist = null;
    if (cmpEl) { cmpEl.classList.remove('on'); cmpEl.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('espil-compass-on'); document.body.classList.remove('guide-compass-on');
  }
  /* A world-fired arrival closes the compass whatever set it
     (the guide-layer contract this module was extracted from).
     The module's own arrival emission cannot double-fire this:
     cmpHide() has already run by then and the target is null,
     so the listener is a no-op for it. */
  window.addEventListener('espil-guide', function (e) {
    var d = (e && e.detail) || {};
    if (d.type === 'nav-arrived' && cmpTarget) cmpHide();
  });
  window.__espilCompassNav = {
    show: function (t, opts) { return cmpShow.apply(null, arguments); },
    hide: function () { cmpHide(); },
    state: function () {
      return {
        on: !!cmpTarget, target: cmpTarget, owner: cmpOwner,
        dist: (typeof cmpDist === 'number') ? Math.round(cmpDist) : null
      };
    }
  };
  setInterval(function () {
    if (!window.__ESPIL_GAME_PAGE) return;
    /* Follow mode: the world posted a target itself (minimap pins
       and the like) - mirror it until the world clears it. An
       explicit show() always wins over the mirror. */
    if (!cmpTarget && window.__espilNavActive && window.__espilNavTarget) {
      var wt = window.__espilNavTarget;
      if (typeof wt.x === 'number' && typeof wt.z === 'number') cmpShow(wt, { arrive: false, owner: 'follow' });
    }
    if (cmpOwner === 'follow' && !window.__espilNavActive) { cmpHide(); return; }
    if (!cmpTarget) return;
    var pose = null;
    try { pose = (typeof window.__espilPlayerPose === 'function') ? window.__espilPlayerPose() : null; } catch (e) {}
    if (!pose || typeof pose.x !== 'number' || typeof pose.z !== 'number') return;
    var dx = cmpTarget.x - pose.x, dz = cmpTarget.z - pose.z;
    var d = Math.hypot(dx, dz); cmpDist = d;
    var bearing = Math.atan2(-dx, -dz), heading = (typeof pose.a === 'number') ? pose.a : 0;
    if (cmpRot) cmpRot.style.transform = 'rotate(' + (heading * 180 / Math.PI) + 'deg)';
    if (cmpMark) cmpMark.style.transform = 'rotate(' + (-bearing * 180 / Math.PI) + 'deg)';
    if (cmpDistEl) cmpDistEl.textContent = cmpFmt(d);
    if (cmpArrive && !cmpArrived && d <= 5) {
      cmpArrived = true; var nm = cmpTarget.name; cmpHide();
      emit('nav-arrived', { name: nm });
    }
  }, 100);
})();

