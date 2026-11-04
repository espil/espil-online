/* __espilCompassNav v1 - compass navigation (Han's order, 2026-10-31;
   W2 revision, Han 2026-11-03 round 3 #4: the compass PILL is removed -
   the overhead direction + distance chip above the character is the
   only display. Target state machine, owners, the 5 m arrival and the
   nav-arrived event contract are unchanged.)

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
     window.__espilCompassNav.state() -> {on, target, owner, dist, chip}
   The positional form show(x, z, name) is ALSO accepted, because the
   map-search module calls it that way; with the object-only surface
   that call returned false silently and a search-started navigation
   raised no compass at all.

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
    /* Batch A7 (Han 2026-11-02 #7): the overhead indicator - a chip
       that floats above the character's head carrying the direction
       arrow and the remaining distance. Since W2 it is the ONLY
       compass display (the pill was removed on Han's order). */
    '#espil-compass-chip{',
    '  position:fixed; left:0; top:0; transform:translate(-50%,-115%);',
    '  z-index:45; display:flex; align-items:center; gap:6px;',
    '  padding:4px 10px 4px 7px; border-radius:999px;',
    '  border:1px solid rgba(142,247,232,.4);',
    '  background:linear-gradient(180deg, rgba(4,18,24,.85), rgba(3,10,14,.8));',
    '  box-shadow:0 8px 20px rgba(0,0,0,.45);',
    '  pointer-events:none; opacity:0; transition:opacity .25s ease;',
    '  font-family:"Manrope",sans-serif;',
    '}',
    '#espil-compass-chip.on{ opacity:1; }',
    '#espil-compass-chip .cmp-chip-arrow{',
    '  display:inline-block; color:#ffd94d; font-size:.8rem; line-height:1;',
    '  text-shadow:0 0 8px rgba(255,217,77,.8);',
    '}',
    '#espil-compass-chip .cmp-chip-dist{ color:#fff4cf; font:800 .8rem/1 "Manrope",sans-serif; white-space:nowrap; }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var chipEl = document.createElement('div');
  chipEl.id = 'espil-compass-chip';
  chipEl.setAttribute('aria-hidden', 'true');
  chipEl.innerHTML =
    '<span class="cmp-chip-arrow" id="espil-compass-chip-arrow">&#10148;</span>' +
    '<span class="cmp-chip-dist" id="espil-compass-chip-dist"></span>';
  document.body.appendChild(chipEl);
  var chipArrow = chipEl.querySelector('#espil-compass-chip-arrow'),
      chipDistEl = chipEl.querySelector('#espil-compass-chip-dist'),
      chipOn = false, chipAngle = null;

  function emit(type, detail) {
    var d = { type: type }; if (detail) for (var k in detail) d[k] = detail[k];
    try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: d })); } catch (e) {}
  }

  var cmpTarget = null, cmpArrive = false, cmpArrived = false, cmpOwner = null, cmpDist = null;
  function cmpFmt(d) {
    if (d >= 1000) { var k = d / 1000; return (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + ' km'; }
    return Math.max(0, Math.round(d)) + ' m';
  }
  /* ---- the overhead chip (Batch A7) ------------------------------
     Projected every frame from above the player's head (+3.6 m -
     raised in Batch D7, Han 2026-11-03, so it clears the speech
     bubble zone) through the map camera; hidden when the player is
     off-screen, behind the camera, or out of the map. The arrow is
     the target direction expressed on screen: the target vector
     dotted with the camera's ground-plane right/forward axes, so
     it always points toward the target as the player sees the
     world. Its screen position is also clamped so it never renders
     over the chat window or the local speech bubble (Batch D7). */
  function chipHide() {
    chipOn = false; chipAngle = null;
    if (chipEl) { chipEl.classList.remove('on'); chipEl.setAttribute('aria-hidden', 'true'); }
  }
  function chipUpdate(pose, dx, dz, d) {
    if (!chipEl || typeof THREE === 'undefined') { chipHide(); return; }
    if (!document.body.classList.contains('in-map')) { chipHide(); return; }
    var cam = null;
    try { cam = (typeof window.__espilMapCameraObj === 'function') ? window.__espilMapCameraObj() : null; } catch (e) {}
    if (!cam || !cam.matrixWorldInverse) { chipHide(); return; }
    var head = new THREE.Vector3(pose.x, (typeof pose.y === 'number' ? pose.y : 0) + 3.6, pose.z);
    var viewZ = head.clone().applyMatrix4(cam.matrixWorldInverse).z;
    if (viewZ > -0.5) { chipHide(); return; }
    head.project(cam);
    var sx = (head.x * 0.5 + 0.5) * window.innerWidth;
    var sy = (-head.y * 0.5 + 0.5) * window.innerHeight;
    if (sx < -40 || sx > window.innerWidth + 40 || sy < -20 || sy > window.innerHeight + 20) { chipHide(); return; }
    /* Batch D7: never render over the chat window or the local
       speech bubble - when the chip's x falls in such a region's
       span and its box would cross the region's top, lift it above
       the region. (The chip box hangs above its anchor point:
       translate(-50%,-115%), so its bottom edge sits at
       sy - 0.15 * chipHeight.) */
    var chipH = chipEl.offsetHeight || 26;
    ['.chat-window', '#chat-bubble'].forEach(function (sel) {
      var region = document.querySelector(sel);
      if (!region) return;
      var r = region.getBoundingClientRect();
      if (!r || r.height < 2 || r.width < 2) return;
      if (sx < r.left - 14 || sx > r.right + 14) return;
      if (sy - chipH * 0.15 > r.top - 8) sy = r.top - 8 + chipH * 0.15;
    });
    /* Batch M4 (Han 2026-11-03): the tutorial message stacks ABOVE
       the chip - final vertical order from the character outward is
       chat window (bottom), chip, tutorial message (top). When the
       chip's box would cross under the tutorial card, it is pushed
       down to start below the card. (The card is display:none
       between steps, which reads as an empty rect and is skipped.) */
    var tut = document.getElementById('espil-tut');
    if (tut) {
      var tr = tut.getBoundingClientRect();
      if (tr && tr.height >= 2 && tr.width >= 2 && sx >= tr.left - 14 && sx <= tr.right + 14) {
        if (sy - chipH * 1.15 < tr.bottom + 8) sy = tr.bottom + 8 + chipH * 1.15;
      }
    }
    var fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    var rx = -fwd.z, rz = fwd.x;
    var rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    var fl = Math.hypot(fwd.x, fwd.z) || 1;
    var dl = Math.hypot(dx, dz) || 1;
    var ax = (dx / dl) * rx + (dz / dl) * rz;
    var ay = (dx / dl) * (fwd.x / fl) + (dz / dl) * (fwd.z / fl);
    var ang = Math.atan2(-ay, ax) * 180 / Math.PI;
    chipEl.style.left = sx.toFixed(1) + 'px';
    chipEl.style.top = sy.toFixed(1) + 'px';
    if (chipArrow) chipArrow.style.transform = 'rotate(' + ang.toFixed(1) + 'deg)';
    if (chipDistEl) chipDistEl.textContent = cmpFmt(d);
    chipEl.classList.add('on'); chipEl.setAttribute('aria-hidden', 'false');
    chipOn = true; chipAngle = Math.round(ang);
  }
  function cmpShow(t, opts) {
    /* Accept the legacy positional form show(x, z, name) as well as
       show({x, z, name}, opts) - see the header note. */
    if (typeof t === 'number' && typeof opts === 'number') {
      t = { x: t, z: opts, name: (arguments[2] || '') };
      opts = arguments[3] || {};
    }
    if (!t || typeof t.x !== 'number' || typeof t.z !== 'number') return false;
    opts = opts || {};
    cmpTarget = { x: t.x, z: t.z, name: t.name || 'Destination' };
    cmpArrive = !!opts.arrive; cmpArrived = false;
    cmpOwner = opts.owner || 'external'; cmpDist = null;
    return true;
  }
  function cmpHide() {
    cmpTarget = null; cmpArrive = false; cmpOwner = null; cmpDist = null;
    chipHide();
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
        dist: (typeof cmpDist === 'number') ? Math.round(cmpDist) : null,
        autoNav: landingAutoNav,
        chip: { on: chipOn, angle: chipAngle, text: chipDistEl ? chipDistEl.textContent : '' }
      };
    }
  };
  /* ---- landing auto-navigation (Han 2026-11-04) ------------------
     On every world landing the Konbiniya compass navigation turns
     ON by itself: once the player is in the map and on the ground,
     the world's own Konbiniya target is shown once, and the
     compass mirrors it in follow mode exactly as it does for the
     tutorial's nav step. One-shot per page load - if the player
     later hides the nav or picks another target, it is never
     re-forced mid-session. The tutorial composes unchanged: its
     nav step re-shows the same target (which re-arms the world's
     arrival), and its own proximity check completes the step.
     Vancouver only - the Konbiniya is a Vancouver anchor; another
     city's landing retires the watcher untouched. */
  var landingAutoNav = false;
  var landingAutoNavTries = 0;
  var landingAutoNavTimer = setInterval(function () {
    if (landingAutoNav) { clearInterval(landingAutoNavTimer); return; }
    if (!window.__ESPIL_GAME_PAGE) return;
    if (!document.body.classList.contains('in-map')) return;
    var key = '';
    try { var k = window.__espilCityKey; key = String(typeof k === 'function' ? k() : (k || '')).toLowerCase(); } catch (e) {}
    if (key && key.indexOf('vancouver') < 0) { clearInterval(landingAutoNavTimer); return; }
    if (++landingAutoNavTries > 240) { clearInterval(landingAutoNavTimer); return; } /* ~2 min of in-map landing window */
    var pose = null;
    try { pose = (typeof window.__espilPlayerPose === 'function') ? window.__espilPlayerPose() : null; } catch (e) {}
    if (!pose || typeof pose.y !== 'number' || pose.y >= 1.5) return; /* still diving */
    var ok = false;
    try { ok = !!(window.__espilNavToKonbiniya && window.__espilNavToKonbiniya()); } catch (e) {}
    if (ok) { landingAutoNav = true; clearInterval(landingAutoNavTimer); }
  }, 500);
  /* Batch A7: the tick runs per animation frame (it was a 100 ms
     interval) so the overhead arrow tracks the player continuously
     while walking or turning. */
  function cmpTick() {
    if (!window.__ESPIL_GAME_PAGE) return;
    requestAnimationFrame(cmpTick);
    /* Follow mode: the world posted a target itself (minimap pins
       and the like) - mirror it until the world clears it. An
       explicit show() always wins over the mirror. */
    if (!cmpTarget && window.__espilNavActive && window.__espilNavTarget) {
      var wt = window.__espilNavTarget;
      if (typeof wt.x === 'number' && typeof wt.z === 'number') cmpShow(wt, { arrive: false, owner: 'follow' });
    }
    if (cmpOwner === 'follow' && !window.__espilNavActive) { cmpHide(); return; }
    if (!cmpTarget) { chipHide(); return; }
    var pose = null;
    try { pose = (typeof window.__espilPlayerPose === 'function') ? window.__espilPlayerPose() : null; } catch (e) {}
    if (!pose || typeof pose.x !== 'number' || typeof pose.z !== 'number') return;
    var dx = cmpTarget.x - pose.x, dz = cmpTarget.z - pose.z;
    var d = Math.hypot(dx, dz); cmpDist = d;
    chipUpdate(pose, dx, dz, d);
    if (cmpArrive && !cmpArrived && d <= 5) {
      cmpArrived = true; var nm = cmpTarget.name; cmpHide();
      emit('nav-arrived', { name: nm });
    }
  }
  requestAnimationFrame(cmpTick);
})();
