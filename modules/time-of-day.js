/* Time-of-day (Han 2026-10-21; W2 rework 2026-11-03, round 3 #8).
   What the world already owns: the map scene runs its own
   astronomical day/night - updateMapSky() in the world script
   drives the sky dome, the sun/moon light, the hemisphere light
   and the fog colour from the real solar position over the city,
   every frame. This module must not fight that system (an earlier
   draft of this rework dimmed the lights and fog itself and was
   overwritten by the owner every frame), and it must not bring
   back the old full-screen black overlay, which also dimmed UI
   panels - the overlay element and its CSS are gone, so the HUD
   stays fully readable at all hours.
   What this module adds (round 3 #8): the slight BUILDING GLOW at
   night. Building wall materials (the shared vertex-coloured
   Lambert wall pool of the OSM world, plus the core-city facade
   pools) gain a warm emissive lift in proportion to how dark the
   world itself currently is: the factor is DERIVED from the
   scene's own hemisphere light (intensity .18 + .8 * daylight in
   the world's cycle), so the glow tracks the rendered darkness
   exactly, whatever the player's local clock says.
   FIX-7 item 5 (Han 2026-11-12, renewing his 2026-10-21 max-z
   dark-screen order): the W2 removal of the screen overlay is
   superseded for the SCREEN - at night only the character was
   darkening while the screen did not. #espil-daynight is back as
   a plain black screen at the maximum z-index (2147483647),
   pointer-events none, opacity on the unchanged local-clock
   curve (opacityFor below). It is Han's specified simple screen,
   not the purged day/night filter system: no colour grading, no
   per-layer dimming - the glow system above is untouched.
   Interiors are EXEMPT (round 3 #7: interiors always bright):
   while window.__espilInside is set the factor is forced to 0,
   so no glow is applied while the player is inside, and interior
   materials are never in the wall set to begin with.
   Performance rule: nothing runs per frame. State is applied on
   the 30 s tick, on inside/outside transitions (1 s check), and
   on __espilNightForce() test calls - and only when the factor
   actually changed. The local-clock curve below is kept only as
   the __espilDayNightOpacity compatibility export (its original
   public face) and as the force seam's date mapping. */
(function () {
  'use strict';
  function opacityFor(d) {
    var h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 18) return 0;
    if (h >= 21 || h < 5) return 0.5;
    if (h >= 18) return 0.5 * (h - 18) / 3;
    return 0.5 * (1 - (h - 5) / 2);
  }
  window.__espilDayNightOpacity = opacityFor;
  var forcedF = null; /* 0..1 override (probe seam) */

  /* FIX-7 item 5: the dark screen itself. Created once, kept at
     the maximum z-index so every layer of UI sits under it and
     the whole screen darkens uniformly; pointer-events none so
     it never intercepts input. Opacity is written only when it
     moves (>= 0.01) - the 1 s tick below keeps dawn/dusk ramps
     smooth without per-frame work. */
  var dnEl = null, dnOp = -1;
  function dayNightScreen() {
    if (!document.body) return;
    if (!dnEl || !dnEl.isConnected) {
      dnEl = document.getElementById('espil-daynight');
      if (!dnEl) {
        dnEl = document.createElement('div');
        dnEl.id = 'espil-daynight';
        document.body.appendChild(dnEl);
      }
      dnEl.style.cssText = 'position:fixed;inset:0;background:#000;' +
        'pointer-events:none;z-index:2147483647;opacity:0;';
      dnOp = -1;
    }
    var op = opacityFor(new Date());
    if (Math.abs(op - dnOp) >= 0.01) {
      dnOp = op;
      dnEl.style.opacity = String(op);
    }
  }

  var GLOW = null; /* THREE.Color, built lazily */
  var world = null;      /* { scene, hemi, walls:Map } */
  var appliedF = -1, appliedInside = null, appliedScene = null;

  function resolveWorld() {
    try {
      var g = window.__espilOwnGroup && window.__espilOwnGroup();
      var sc = g;
      while (sc && sc.type !== 'Scene') sc = sc.parent;
      if (!sc) return world;
      if (world && world.scene === sc) return world;
      /* The avatar's scene changes across the entry flow, so the
         record is rebuilt on scene change. Only the hemisphere
         light is read (as the daylight sensor) - never written. */
      var hemi = null;
      sc.traverse(function (o) {
        if (!hemi && o && o.isHemisphereLight) hemi = o;
      });
      world = { scene: sc, hemi: hemi, walls: new Map() };
      GLOW = null;
      return world;
    } catch (_) { return world; }
  }
  /* Building wall materials only: the OSM world shares one
     vertex-coloured Lambert wall material (transparent-flagged by
     the chunk fade-in system, so transparency is no
     discriminator), and the core-city builder pools facade wall
     materials in 6-material box arrays (indices 0,1,4,5).
     Interior furniture and fittings use their own materials -
     never matched. */
  function collectWalls(w) {
    w.scene.traverse(function (o) {
      if (!o || !o.material) return;
      if (Array.isArray(o.material)) {
        if (o.material.length === 6) {
          [0, 1, 4, 5].forEach(function (i) {
            var m = o.material[i];
            if (m && m.isMeshLambertMaterial && !w.walls.has(m)) {
              w.walls.set(m, { e: m.emissive ? m.emissive.clone() : null, i: m.emissiveIntensity });
            }
          });
        }
        return;
      }
      var m = o.material;
      if (m && m.isMeshLambertMaterial && m.vertexColors && !m.map && !w.walls.has(m)) {
        w.walls.set(m, { e: m.emissive ? m.emissive.clone() : null, i: m.emissiveIntensity });
      }
    });
  }
  function insideNow() { try { return !!window.__espilInside; } catch (_) { return false; } }
  function daylightOf(w) {
    if (!w || !w.hemi) return null;
    var dl = (w.hemi.intensity - 0.18) / 0.8;
    return Math.max(0, Math.min(1, dl));
  }
  function apply() {
    dayNightScreen(); /* FIX-7 item 5: independent of the glow early-return below */
    var ins = insideNow();
    var w = resolveWorld();
    var f;
    if (ins) f = 0;
    else if (forcedF != null) f = forcedF;
    else {
      var dl = daylightOf(w);
      f = (dl == null) ? Math.max(0, Math.min(1, opacityFor(new Date()) / 0.5)) : 1 - dl;
    }
    if (w && w.scene === appliedScene && Math.abs(f - appliedF) < 0.02 && ins === appliedInside) return;
    appliedInside = ins;
    appliedF = f;
    if (!w) return;
    appliedScene = w.scene;
    collectWalls(w);
    if (!GLOW) {
      var anyWall = w.walls.values().next().value;
      if (anyWall && anyWall.e) GLOW = anyWall.e.clone().setHex(0xffb45e);
    }
    if (GLOW) {
      w.walls.forEach(function (base, m) {
        if (!m.emissive || !base.e) return;
        m.emissive.copy(base.e).lerp(GLOW, f * 0.85);
        m.emissiveIntensity = base.i + 0.38 * f;
      });
    }
  }
  /* Probe/diagnostic surface. __espilNightForce accepts a Date
     (mapped through the clock curve), a number (raw factor), or
     null (back to the world's own daylight). */
  window.__espilNightState = function () {
    return {
      factor: appliedF, inside: insideNow(),
      daylight: daylightOf(world),
      sceneFound: !!world,
      wallMats: world ? world.walls.size : 0
    };
  };
  window.__espilNightForce = function (d) {
    if (d == null) forcedF = null;
    else if (typeof d === 'number') forcedF = Math.max(0, Math.min(1, d));
    else forcedF = Math.max(0, Math.min(1, opacityFor(new Date(d)) / 0.5));
    appliedF = -1; /* force re-apply */
    apply();
    return window.__espilNightState();
  };
  apply();
  setInterval(apply, 30000);
  setInterval(function () {
    dayNightScreen(); /* FIX-7 item 5: 1 s screen tick (cheap, change-gated) */
    if (insideNow() !== appliedInside) apply();
  }, 1000);
})();
