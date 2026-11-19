/* __espilArenaSpace v1 - the arena as a place space (Han
   2026-11-18). TAGLESS module source: lazyload.js loads it ONLY
   in an arena place-space window (the address boot shell's
   espil_store_space_v1 mark with slug 'arena') - it never arms
   on the street and never in a store child.

   What it does:
   - Asks the API for the arena descriptor (GET
     /places/<city>/arena) at entry, in the store spaces' request
     shape. The space itself stands on the code anchor
     (ESPIL_ARENA_INT, 0, 8400) either way: a failed answer leaves
     an unnamed arena with a working exit, never fake data.
   - Summons the player into the existing arena space through
     the monolith's own hook (__espilArenaEnterSpace) once this
     window stands in the map - the space's ground, rim and EXIT
     door are the monolith's set, unchanged.
   - Applies the arena globe view (design section 4): the child
     document's own globe constant ESPIL_ARENA_GLOBE_K (draft
     0.003, five times the street's 0.0006) through the shared
     __espilGlobeView.setK - the drop LAW (formula, shared
     displacement, sky exempt, cap 260) is untouched and the
     street window keeps its own document's 0.0006. Around the
     ground it builds the bowl: a subdivided ground skirt and two
     silhouette rings, all in globe-patched materials, so the
     horizon falls away on every side. Block heights follow the
     drop arithmetic at this K (a low block at 150 m sinks behind
     the curve; the rings crest it instead - measured in the
     build report).
   - Raises the follow camera's default distance to the draft
     9.5 m in this document only (__espilSetFollowDist).
   - Owns the exit contract arena.js settles into: on the
     results confirm (or leaving from the ready card) the parent
     is told ('espil-arena-close') and the window closes; with
     no opener (a direct address visit) the player returns to
     the street point in this same window. A window closed by
     its X mid-run notifies the parent on the way out - the run
     itself ends exactly as a refresh ends it today. */
(function () {
  'use strict';
  if (window.__espilArenaSpace) return;
  var mark = null;
  try { mark = JSON.parse(sessionStorage.getItem('espil_store_space_v1') || 'null'); } catch (e) {}
  if (!mark || !mark.city || mark.slug !== 'arena') return;

  /* ===== CHILD MUSIC SILENCE (Han 2026-11-18) =====
     The same block as modules/place-space.js, for the same
     reason: no song plays in a place-space child window. The
     child loads the same game page, whose landing-auth module
     starts its BGM set (the one <audio id="bgm"> element) on
     the first gesture in the window. Pause the element now and
     block play() on THIS ELEMENT INSTANCE for the life of the
     window. Sound effects are different objects and are not
     touched. */
  (function silenceBgm() {
    var a = document.getElementById('bgm');
    if (!a) return;
    try { a.pause(); } catch (e) {}
    if (!a.__espilChildSilenced) {
      a.__espilChildSilenced = true;
      a.play = function () { return Promise.resolve(); };
    }
  })();
  /* ===== end CHILD MUSIC SILENCE ===== */

  var CITY = String(mark.city), SLUG = 'arena';
  var API_BASE = (typeof window.__espilPlacesApiBase === 'string' && window.__espilPlacesApiBase) || 'https://api.espil.online';
  var ANCHOR = { x: 0, z: 8400 };            /* ESPIL_ARENA_INT - the monolith's own anchor, read from its arena seam */
  var ESPIL_ARENA_GLOBE_K = 0.003;           /* DRAFT (Han's eye verdict sets the number): 5x the street k, this window only */
  var ESPIL_ARENA_CAM_DIST = 9.5;            /* DRAFT: follow distance inside the arena window (street default 7.0) */
  var HANDOFF_KEY = 'espil_arena_handoff_v1';

  var state = {
    phase: 'boot',           /* boot -> in -> closing / exited */
    entered: false,
    api: 'idle',             /* idle | loading | ok | error */
    place: null,             /* the API descriptor */
    kApplied: null,
    camDist: null,
    bowl: false
  };

  /* ---------------- helpers (the pair's own idioms) ---------------- */
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

  /* ---------------- the descriptor (name + street point) -------- */
  function loadPlace() {
    state.api = 'loading';
    fetchJson(API_BASE + '/places/' + encodeURIComponent(CITY) + '/' + encodeURIComponent(SLUG)).then(function (d) {
      state.place = d.place || null;
      state.api = 'ok';
    }, function () {
      state.api = 'error';   /* the space stands on the code anchor regardless; the exit always works */
    });
  }

  /* ---------------- the bowl (globe view, layer 2) --------------- */
  var bowlGroup = null;
  function buildBowl() {
    if (bowlGroup || typeof THREE === 'undefined') return state.bowl;
    var scene = sceneRoot(); if (!scene) return false;
    var g = new THREE.Group(); g.position.set(ANCHOR.x, 0, ANCHOR.z);
    function LM(c) { return new THREE.MeshLambertMaterial({ color: c }); }
    /* the ground skirt: a radially subdivided ring under and
       around the arena disc, in a globe-patched material, so the
       ground itself falls away with the same law the shader
       applies to everything else in the scene. */
    var skirt = new THREE.Mesh(new THREE.RingGeometry(25.6, 470, 128, 40), LM(0x2b2f36));
    skirt.rotation.x = -Math.PI / 2; skirt.position.y = -0.02; skirt.frustumCulled = false;
    g.add(skirt);
    /* the silhouette rings: deterministic placement (one LCG),
       dark matte blocks with no collision and no labels. Heights
       are set by the drop arithmetic at ESPIL_ARENA_GLOBE_K -
       ring A crests the curve a little, ring B's spires crest it
       a little farther out, so the horizon reads in layers. */
    var seed = 20261118;
    function rnd() { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var shades = [0x22262e, 0x272c35, 0x1f232b, 0x2a3038];
    function block(r, ang, w, h, d) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), LM(shades[Math.floor(rnd() * shades.length)]));
      m.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r);
      m.rotation.y = -ang + Math.PI / 2;
      m.frustumCulled = false;
      g.add(m);
    }
    var i, ang;
    for (i = 0; i < 18; i++) {           /* ring A: 120-190 m, heights 30-95 m */
      ang = (i / 18) * Math.PI * 2 + rnd() * 0.2;
      block(120 + rnd() * 70, ang, 20 + rnd() * 22, 30 + rnd() * 65, 14 + rnd() * 10);
    }
    for (i = 0; i < 8; i++) {            /* ring B: 220-290 m, spires 120-175 m */
      ang = (i / 8) * Math.PI * 2 + 0.3 + rnd() * 0.25;
      block(220 + rnd() * 70, ang, 16 + rnd() * 14, 120 + rnd() * 55, 14 + rnd() * 8);
    }
    scene.add(g);
    bowlGroup = g;
    state.bowl = true;
    /* layer 3 (the boundary illusion): deepen this window's fog
       if the scene carries one, so the skirt's far edge melts
       into the dark instead of ending on a line. Child document
       only - the street window's scene is a different document. */
    try {
      if (scene.fog && typeof scene.fog.far === 'number') scene.fog.far = Math.min(scene.fog.far, 620);
      if (scene.fog && typeof scene.fog.near === 'number') scene.fog.near = Math.min(scene.fog.near, 60);
    } catch (e) {}
    return true;
  }

  /* ---------------- entry ---------------------------------------- */
  function maybeEnter() {
    if (state.entered) return;
    if (typeof window.__espilArenaEnterSpace !== 'function') return;
    if (!document.body.classList.contains('in-map')) return;
    var pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null;
    if (!pose) return;
    var c = window.__espilArenaEnterSpace();
    if (!c || !isFinite(c.x)) return;
    state.entered = true; state.phase = 'in';
    /* the arena globe strength: this document's k only, through
       the shared live tunable - the law itself is not touched. */
    try { if (window.__espilGlobeView) state.kApplied = window.__espilGlobeView.setK(ESPIL_ARENA_GLOBE_K); } catch (e) {}
    buildBowl();
    /* the camera default lands after the entry fade settles;
       applied twice so neither the fade nor a late framing reset
       can leave the street default standing. */
    var applyCam = function () {
      try { if (window.__espilSetFollowDist) state.camDist = window.__espilSetFollowDist(ESPIL_ARENA_CAM_DIST); } catch (e) {}
    };
    setTimeout(applyCam, 350); setTimeout(applyCam, 1400);
    notifyParent('espil-arena-open');
  }

  /* ---------------- exit (the place-space contract) -------------- */
  function notifyParent(type) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: type, store: SLUG }, location.origin);
      }
    } catch (e) {}
  }
  function exitToStreet() {
    state.phase = 'exited';
    try { sessionStorage.removeItem('espil_store_space_v1'); } catch (e) {}
    if (window.__espilArenaExitSpace) window.__espilArenaExitSpace();
  }
  function closeContract() {
    if (state.phase === 'closing' || state.phase === 'exited') return;
    if (window.opener && !window.opener.closed) {
      state.phase = 'closing';
      notifyParent('espil-arena-close');
      window.close();
      /* a refused close falls back to the same-window street return */
      setTimeout(function () { if (state.phase === 'closing') exitToStreet(); }, 700);
      return;
    }
    exitToStreet();
  }
  /* arena.js calls these: the results confirm, and leaving from
     the ready card before a run. One contract for both. */
  window.__espilArenaChildConfirmClose = closeContract;
  window.__espilArenaChildLeave = closeContract;
  window.addEventListener('beforeunload', function () {
    if (state.phase === 'in') notifyParent('espil-arena-close');
  });

  /* ---------------- state hook (rig probes) ----------------------- */
  window.__espilArenaSpace = {
    state: function () {
      var handoff = null;
      try { handoff = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null'); } catch (e) {}
      return {
        armed: true, phase: state.phase, city: CITY, slug: SLUG,
        anchor: { x: ANCHOR.x, z: ANCHOR.z },
        api: state.api,
        place: state.place ? { name: state.place.name, center: state.place.center, size: state.place.size } : null,
        globeK: state.kApplied, globeKDraft: ESPIL_ARENA_GLOBE_K,
        camDist: state.camDist, camDistDraft: ESPIL_ARENA_CAM_DIST,
        bowl: state.bowl,
        handoff: handoff ? { size: handoff.size, members: handoff.members, ageMs: Date.now() - (handoff.at || 0) } : null,
        inside: !!(window.__espilInside && window.__espilInside.arena)
      };
    }
  };

  /* ---------------- boot ------------------------------------------ */
  loadPlace();
  setInterval(maybeEnter, 250);
  maybeEnter();
})();
