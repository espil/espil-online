
/* __espilEntryPopup v1 - building entry popup instance (live feedback
   item 7, prototype): entering a building presents the shop as a popup
   whose background is the character's current-position screen, blurred.
   The world script is closure-wrapped, so this rides public surfaces
   only: while the building panel (#bldg-panel) is open the player is
   standing at the building - keep a fresh snapshot of the map canvas
   from that spot; once window.__espilInside is set (the world's own
   entry), place the snapshot, blurred, directly under the shop layer
   (z 49, below .skill-tree's 50) for as long as the player is inside.
   The interior logic, stock and Leave flow stay the world's own.
   __espilEntryPopup END */
(function () {
  'use strict';
  var lastSnap = null, backdrop = null, rafOn = false, lastErr = '';
  function mapCanvas() { return document.querySelector('canvas.mapboxgl-canvas') || document.querySelector('#map canvas') || document.querySelector('canvas'); }
  function panelOpen() { var p = document.getElementById('bldg-panel'); return p && p.getAttribute('aria-hidden') === 'false'; }
  function captureLoop() {
    if (!panelOpen()) { rafOn = false; return; }
    var frames = 0;
    function tick() {
      if (!panelOpen()) { rafOn = false; return; }
      frames++;
      if (frames === 2 || frames % 15 === 0) {
        var cv = mapCanvas();
        if (cv) { try { var url = cv.toDataURL('image/jpeg', 0.62); if (url && url.length > 5000 && (!lastSnap || url.length >= lastSnap.length * 0.5)) lastSnap = url; else lastErr = 'short:' + (url ? url.length : 0); } catch (e) { lastErr = String(e && e.message || e); } }
        else lastErr = 'no-canvas';
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  setInterval(function () { if (panelOpen() && !rafOn) { rafOn = true; captureLoop(); } }, 400);
  function ensureBackdrop() {
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'espil-entry-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:49;display:none;background-size:cover;background-position:center;filter:blur(12px) brightness(.72) saturate(.92);transform:scale(1.07);pointer-events:none;';
    (document.querySelector('main.earth-frame')||document.body).appendChild(backdrop); /* inside the frame: the frame is an isolated stacking context, a body-level layer paints over the whole frame */
    return backdrop;
  }
  setInterval(function () {
    var inside = !!window.__espilInside;
    var bd = ensureBackdrop();
    /* Interior-first (Han 2026-10-26): while the player walks the 3D
       interior the backdrop must stay hidden or the room is invisible
       behind the blur; it returns only under an open shop surface. */
    var shopOpen = false;
    var su = document.getElementById('shop-ui'); if (su && su.classList.contains('open')) shopOpen = true;
    var kb = document.getElementById('kb-screen'); if (kb && kb.classList.contains('open')) shopOpen = true;
    if (inside && shopOpen && lastSnap) {
      if (bd.style.display === 'none') { bd.style.backgroundImage = 'url(' + lastSnap + ')'; bd.style.display = 'block'; }
    } else if (bd.style.display !== 'none') bd.style.display = 'none';
  }, 400);
  window.__espilEntryPopupState = function () {
    return { hasSnap: !!lastSnap, snapBytes: lastSnap ? lastSnap.length : 0,
             shown: !!(backdrop && backdrop.style.display !== 'none'), lastErr: lastErr };
  };
})();
/* __espilEntryPopup END */

