/* __espilLazyLoad v1 - Batch W (2026-11-03): first-use loader for
   the post-entry feature modules. The pair no longer ships eager
   script tags for social / stall2 / tutorial / panels / store /
   map-search; this loader dynamic-imports each at the seam that
   first needs it:
   - tutorial: the espil-dive-start event when the flow emits it,
     and in any case the arrival bundle below. Its own boot watcher
     starts the flow only once the player has landed in the map,
     per Han's rule that the tutorial never runs inside the entry
     sequence.
   - social + stall2 + tutorial + panels: arrival in a city
     (espil-guide 'arrival', the first espil-party-frame, or the
     loader's in-map poll). Their inputs are live presence events,
     so the earliest safe seam is the join moment itself. After
     stall2 lands, a DOMContentLoaded is re-dispatched on window:
     stall2 registers its context-menu observer on that event
     unconditionally. panels rides this bundle (not only the
     later first-use seams below) because it owns the purchase
     mirror: the espil-guide 'bought' listener that writes bought
     items into the inventory. A stall purchase happens outdoors
     with no interior event, key press or context menu before it,
     so a panels-less session would drop the bought item -
     found by probe_stall2 on the freeze candidate and fixed
     here; the bundle still lands after entry, so panels stays
     out of the entry-critical set.
   - social (auth half): the sign-in modal opening - the login
     gate (game page) and the landing flow's login step present
     social.js's sign-in form BEFORE any arrival can fire, so
     the modal becoming visible is its first-need seam for the
     auth wiring; only social.js arms there (GAP-1, 2026-11-10).
   - store: the building panel being clicked, the interior event,
     or __espilInside appearing (poll). The store's own tick then
     applies the fitout for the building already entered.
   - store-page-link: companion of store (Batch S integration,
     2026-11-03). Its capture-phase click listener intercepts the
     Konbiniya building-panel Enter click and opens the standalone
     store page instead, so it must be RESIDENT before that click
     can happen. store's own click seam can fire ON the Enter click
     itself - too late for a same-click import - so the link module
     rides every store seam AND arms earlier from the backstop
     poll: a building panel standing open, or a building being
     faced (__espilFacingBuilding), both of which always precede
     an Enter click. The pair files themselves carry no new tag.
   - panels: the inventory/profile keys, the HUD CHAR menu button,
     a right-click (the self-profile menu item lives in the social
     context menu), or the interior event (the purchase mirror
     must exist before the first buy).
     After it lands, an already-open panel is nudged (aria-hidden
     flip) so the module's open-watchers render it.
   - map-search: the map key or a click on the minimap wrap; the
     module's own build poll creates the search form from there.
   - npcs: arrival in a city or the in-map backstop poll - the
     walking pedestrians are a world feature, so they arm with the
     same seams as the arrival bundle; the module self-gates on
     being in the map and on the Vancouver city key.
   - monsters: the same seams as npcs (arrival + in-map backstop) -
     the survival-game monster layer is a world feature too; it
     self-gates identically, so the pairing keeps their population
     systems armed together.
   - tiles3d: the same seams as npcs - the Google 3D Tiles layer is
     a world feature; the module itself is the LIGHT decision entry
     (the heavy renderer loads only on a tilesEnabled:true decision).
   - cashshop: the same seams as npcs - the cash shop (Han decision
     round 3, 2026-11-09) is reachable from anywhere in the map
     (its floating button self-gates on body.in-map), so it arms
     with the arrival bundle like the other world features.
   Every import is fire-and-forget with a console warning on
   failure; a failed lazy load never breaks the page.
   __espilLazyState() reports what has landed (rig probes). */
(function () {
  'use strict';
  var loaded = {}, loading = {};
  var pendingProfile = false;
  function load(name) {
    if (loaded[name] || loading[name]) return;
    loading[name] = true;
    import('./' + name).then(function () {
      loaded[name] = true;
      if (name === 'stall2.js' && document.readyState !== 'loading') {
        try { window.dispatchEvent(new Event('DOMContentLoaded')); } catch (e) {}
      }
      if (name === 'panels.js') {
        nudgePanels();
        /* A P press or CHAR click that arrived while panels.js
           was still loading expressed the intent to OPEN the
           profile; fulfil it now that the module is resident
           (its own key binding serves every later press). */
        if (pendingProfile) {
          pendingProfile = false;
          if (window.__espilOpenSelfProfile) window.__espilOpenSelfProfile();
        }
      }
    }).catch(function (err) {
      loading[name] = false;
      if (window.console && console.warn) console.warn('[espil-lazy] failed to load ' + name, err);
    });
  }
  function nudgePanels() {
    ['inventory-panel', 'character-panel'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p && p.getAttribute('aria-hidden') === 'false') {
        p.setAttribute('aria-hidden', 'true');
        p.setAttribute('aria-hidden', 'false');
      }
    });
  }
  function socialBundle() { load('social.js'); load('stall2.js'); load('tutorial.js'); load('panels.js'); }
  function storePair() { load('store.js'); load('store-page-link.js'); }
  /* The city-switch dive dispatches espil-dive-start on window;
     the standard gate entry does not, so the tutorial also rides
     the arrival bundle above - its own boot watcher only starts
     the flow once the player has landed in the map. */
  window.addEventListener('espil-dive-start', function () { load('tutorial.js'); });
  window.addEventListener('espil-guide', function (e) {
    var d = e && e.detail; if (!d) return;
    if (d.type === 'arrival') { socialBundle(); load('npcs.js'); load('monsters.js'); load('tiles3d.js'); load('cashshop.js'); load('arena.js'); }
    if (d.type === 'interior') { storePair(); load('panels.js'); }
  });
  window.addEventListener('espil-party-frame', socialBundle);
  /* The login gate's seam (GAP-1, 2026-11-10): the game-page
     login gate and the landing flow's login step both present
     the sign-in modal before any arrival can fire, and the
     flipped pair's form handlers live in social.js alone - so
     the modal becoming visible arms social.js. Only social.js
     arms here: stall2 / tutorial / panels keep their arrival
     seams (the tutorial must never arm inside the entry
     sequence), and the arrival bundle still lands the rest at
     the join moment. If the modal is already open when this
     loader boots, arm immediately. */
  (function armSocialAtGate() {
    var m = document.getElementById('signin-modal');
    if (!m) { setTimeout(armSocialAtGate, 800); return; }
    if (m.getAttribute('aria-hidden') === 'false') load('social.js');
    new MutationObserver(function () {
      if (m.getAttribute('aria-hidden') === 'false') load('social.js');
    }).observe(m, { attributes: true, attributeFilter: ['aria-hidden'] });
  })();
  document.addEventListener('keydown', function (e) {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'i') load('panels.js');
    if (k === 'p') { if (!loaded['panels.js']) pendingProfile = true; load('panels.js'); }
    if (k === 'o') socialBundle();
    if (k === 'm') load('map-search.js');
  }, true);
  document.addEventListener('contextmenu', function () { load('panels.js'); }, true);
  /* The HUD menu's CHAR button opens the self profile (panels.js).
     Its pointerdown is the earliest seam: start the import in the
     capture phase, before the HUD's own handler falls back to the
     P key, so the profile renders with the least delay. */
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var slot = t.closest('#kb-menu .move-slot');
    if (!slot) return;
    var mn = slot.querySelector('.mn');
    if (mn && mn.textContent === 'CHAR') {
      if (!loaded['panels.js']) pendingProfile = true;
      load('panels.js');
    }
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#minimap-wrap')) load('map-search.js');
    if (t.closest('#bldg-panel, #bldg-opts')) storePair();
  }, true);
  /* Backstop poll: being in the map arms the presence-adjacent
     bundle by any arrival path; being inside a building arms the
     store. The store page link arms earlier still - a building
     panel standing open or a building being faced - because its
     interception must be resident before the Enter click. 600 ms,
     and each arm is a no-op once loaded. */
  setInterval(function () {
    if (document.body && document.body.classList.contains('in-map')) { socialBundle(); load('npcs.js'); load('monsters.js'); load('tiles3d.js'); load('cashshop.js'); load('arena.js'); }
    if (window.__espilInside) storePair();
    var bp = document.getElementById('bldg-panel');
    if (bp && bp.getAttribute('aria-hidden') === 'false') load('store-page-link.js');
    else if (window.__espilFacingBuilding) {
      try { if (window.__espilFacingBuilding()) load('store-page-link.js'); } catch (e) {}
    }
  }, 600);
  window.__espilLazyState = function () {
    var out = {};
    Object.keys(loaded).forEach(function (k) { out[k] = true; });
    return {
      loaded: out,
      loading: Object.keys(loading).filter(function (k) { return !loaded[k]; })
    };
  };
})();
