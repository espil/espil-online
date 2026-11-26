/* __espilFishing v1 - fishing: a rod, a shore, and the water that
   is already there (espil.online room, Han 2026-11-25: priority 2,
   "낚시기는 추가. 낚시게임 하나 가져와서 제작해"; the reference
   decided by Han 2026-11-25 15:30 is candidate 2 - the Stardew
   Valley tracking-bar mini-game). Design: espil-online-room/
   fishing/DESIGN.md (base design 2026-11-24 + Amendment A, boat
   fishing under boat ownership + Amendment B, the Stardew
   tracking game). This module owns the whole loop:

   idle -> casting (0.8 s) -> waiting (4-11 s, false dips)
   -> bite (0.9 s window) -> TRACKING (the mini-game)
   -> landing (1.2 s) -> idle.

   WHAT THIS MODULE OWNS
   - The cast test: standable land underfoot (not swimming /
     flying / driving / inside) and water inside cast range
     ahead, read through the monolith's exported collision
     probe - the fan at 3 / 5 / 7 m along the player's FACING
     (the avatar's a, forward = (-sin a, -cos a), the monolith's
     own convention), each point with two lateral offsets at
     +/-1.2 m; the cast point is the NEAREST fan point that
     reads water. Aboard the player's own boat the same fan
     runs from the craft's position along the craft's heading.
   - The Use press: on shore the cast claims Space ONLY at the
     end of tryInteract's chain (the monolith's too-far branch
     calls window.__espilFishing.tryUse() - if a building, the
     arena portal, a kiosk or the boat claimed the press,
     fishing never sees it; if the cast test also fails, the
     too-far notice shows exactly as before). Aboard, the
     chain's other claimants are absent by construction and the
     boat's own bail-out is the only neighbour, so the split is
     by posture (Amendment A2): while the boat is stationary
     and the fishing prompt is up, Space fishes (this module
     claims the press in a window capture listener, ahead of
     the boat's document capture listener); while the boat is
     moving, Space remains the boat's bail-out and this module
     never touches it. WHILE THE TRACKING GAME IS OPEN, SPACE
     BELONGS TO FISHING ENTIRELY (Amendment B7): hold/release
     drive the catch zone, and no Space press, hold or release
     can bail the boat, cast again, or mean any boat verb.
   - The rod: 'Bamboo Rod', a panels DB entry of kind 'tool'
     (the kind the boat-ownership build introduced; bound the
     same way - stall2.js refuses kind 'tool', it is never
     equippable and never consumed), granted FREE the first
     time a player with no rod passes a cast test: the cast
     proceeds, the rod is simply there, a one-line toast says
     so. Not a weapon: no atk, no tier, no forge path.
   - The catch: rolled ONCE at the bite press from the table
     below with its rates exactly as designed, then FIXED -
     the rolled species' difficulty row drives the tracking
     game, winning lands that species (size rolled at
     landing), escaping loses that rolled fish and nothing
     else. The species is HIDDEN during the game (the glyph is
     the generic fish shape; junk shows its own shape) and
     revealed by the landing toast. The item enters the bag
     through the monster-drop branch of panels' espil-guide
     seam - the same seam monster drops use. The fishing log
     (espil_fishing_log_v1, this module's own key) records
     per species { count, bestCm, firstAt } on the device.
   - Presentation, all module-owned primitives (the boat's
     buildPrimitivesBoat precedent - no new asset files): a
     tapered rod from the hand, a two-segment line, a two-tone
     bobber on WATER_Y, a small splash pool (rings + droplets),
     the catch as a canvas sprite drawn by panels' icon
     painter (__espilItemIconSVG), and two synthesised plips.
     Peers see none of it in v1 (the presence relay carries
     position frames only): a peer sees a player standing at
     a shore, which is true.
   - The tracking panel: a DOM panel owned by this module at
     the RIGHT-CENTRE of the viewport - the vertical rail, the
     catch-zone band (the game's accent), the fish glyph on a
     small canvas (panels' painter again), the meter bar
     beside the rail, and one caption line in the prompt
     grammar. The 3D world stays fully visible behind it; the
     rod, line and bobber stay live in the world for the whole
     game (the bobber sits plunged, the line stays taut-ish).

   CANCELS (DESIGN 5.3 + Amendment B8 - one rule: every quit
   is an escape without a catch; the rolled fish is lost and
   NOTHING else is - no item, currency or cooldown cost ever):
   movement input (ashore the first step ends the cast;
   aboard, any helm input - movement keys or a joystick drag -
   starts the boat and cancels), jump, damage taken, death,
   entering the water, opening any panel (bag, character,
   store modal, shop UI, sign-in), boarding the boat or
   starting a drive, ESC (a quit in every phase), city leave /
   session end. Chat typing never reaches the key handlers
   (the typing guard the boat module also reads). While
   fishing, the pure skill-row keys (Q/E/R/F) are swallowed in
   the capture phase - a fisher cannot fight with a rod out;
   attack input is a movement-family press in this build's
   reading (WASD/arrows cancel per the movement row).

   Worker: NO change. D1: none. localStorage: one new key
   (espil_fishing_log_v1), this module's own.

   Hooks: window.__espilFishing = { state(), debug(), tryUse(),
   cast(), cancel(), guide(), log(), _seed(), _pin() }.
   debug() is the rig read seam (Amendment B9): { phase,
   species, meter, fishPos, zoneSpan, zoneH, held, posture,
   tGame, castPoint } - _seed({wait, roll}) rig-seeds the next
   wait (seconds) and the next bite-press roll (species name);
   _pin('in'|'out'|null) pins the fish inside / outside the
   zone for the meter legs. Module sources are TAGLESS (house
   rule) - no script tags. */
(function () {
  'use strict';
  if (window.__espilFishing) return;

  /* ================= TUNING - every draft number lives here
     (DESIGN sections 5-6 + Amendment B2/B4: tuning drafts for
     Han to retune, in ONE place, not structure) ================= */
  var TUNE = {
    castTime: 0.8,          /* s - the cast beat */
    waitMin: 4, waitMax: 11,/* s - the wait roll (uniform) */
    falseDipChance: 0.40,   /* one false dip per wait at ~40% */
    biteWindow: 0.9,        /* s - the bite press window */
    landTime: 1.2,          /* s - the landing presentation */
    /* tracking game (Amendment B2/B4 base constants) */
    zoneBase: 0.22,         /* catch-zone height, track fraction */
    fillBase: 0.115,        /* meter fill rate /s before the row's x */
    drainBase: 0.085,       /* meter drain rate /s before the row's x */
    meterStart: 0.35,       /* the meter's opening value */
    zoneAccelUp: 2.2,       /* track/s^2 while the input is HELD */
    zoneGravity: 2.6,       /* track/s^2 while RELEASED */
    zoneSpeedCap: 1.1,      /* track/s */
    zoneEndReflect: -0.25,  /* zone velocity reflect at the ends */
    fishEndReflect: -0.4,   /* fish velocity reflect at the ends */
    /* boat posture (Amendment A2 draft) */
    stillSecs: 0.5,         /* s under the speed cap = stationary */
    stillSpeed: 0.2         /* m/s - the boat speed cap for "still" */
  };
  var ROD_ITEM = 'Bamboo Rod';
  var LOG_KEY = 'espil_fishing_log_v1';
  var OWN_KEY = 'espil_owned_items';
  var WATER_Y = 0.25;       /* the monolith's swim boundary level */

  /* The catch table (DESIGN section 6 rates + Amendment B4
     difficulty rows + size bands). rate: % of the roll. band:
     the length roll in cm at landing. beh: the Stardew
     behaviour family. speed: the pattern's max vertical speed
     (track fractions /s). ci: the re-pick / rest interval range
     (s). zoneX / fillX / drainX multiply the base constants. */
  var TABLE = [
    { name: 'Old Boot',       rate: 6,   band: [24, 32],  beh: 'calm',        speed: 0.15, ci: [0.8, 1.4], zoneX: 1.30, fillX: 1.30, drainX: 0.70 },
    { name: 'Rusty Can',      rate: 4,   band: [9, 14],   beh: 'calm',        speed: 0.15, ci: [0.8, 1.4], zoneX: 1.30, fillX: 1.30, drainX: 0.70 },
    { name: 'Small Sardine',  rate: 26,  band: [8, 16],   beh: 'smooth',      speed: 0.35, ci: [0.6, 1.1], zoneX: 1.15, fillX: 1.10, drainX: 0.90 },
    { name: 'Harbour Perch',  rate: 22,  band: [18, 34],  beh: 'mixed',       speed: 0.40, ci: [0.5, 1.0], zoneX: 1.15, fillX: 1.10, drainX: 0.90 },
    { name: 'Rockfish',       rate: 16,  band: [20, 38],  beh: 'mixed',       speed: 0.50, ci: [0.45, 0.9], zoneX: 1.00, fillX: 1.00, drainX: 1.00 },
    { name: 'Mackerel',       rate: 11,  band: [25, 45],  beh: 'floater',     speed: 0.55, ci: [0.45, 0.9], zoneX: 1.00, fillX: 1.00, drainX: 1.00 },
    { name: 'Salmon',         rate: 7,   band: [30, 58],  beh: 'dart-lite',   speed: 0.70, ci: [1.8, 3.0], zoneX: 0.90, fillX: 0.90, drainX: 1.10 },
    { name: 'Halibut',        rate: 4,   band: [40, 90],  beh: 'sinker',      speed: 0.50, ci: [0.5, 1.0], zoneX: 0.90, fillX: 0.90, drainX: 1.10 },
    { name: 'Golden Koi',     rate: 2.5, band: [25, 45],  beh: 'floater-dart', speed: 0.75, ci: [1.5, 2.6], zoneX: 0.80, fillX: 0.80, drainX: 1.25 },
    { name: 'Moonlit Eel',    rate: 1.2, band: [50, 110], beh: 'sinker-dart', speed: 0.80, ci: [1.4, 2.4], zoneX: 0.80, fillX: 0.80, drainX: 1.25 },
    { name: 'Lunaris Minnow', rate: 0.3, band: [4, 9],    beh: 'dart',        speed: 1.00, ci: [1.2, 2.2], zoneX: 0.65, fillX: 0.65, drainX: 1.50 }
  ];
  /* Per-city and at-sea override slots (DESIGN section 6 + A2):
     both EMPTY in v1 - one table everywhere, ashore and at sea.
     A later line fills a slot without touching the machine. */
  var TABLE_BY_CITY = {};
  var TABLE_SEA = null;
  var JUNK = { 'Old Boot': 1, 'Rusty Can': 1 };

  /* ================= small readers (the boat module's shapes) == */
  function inMap() { return !!(document.body && document.body.classList.contains('in-map')); }
  function typingNow() {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    return /INPUT|TEXTAREA|SELECT/.test(tag) || !!(ae && ae.isContentEditable);
  }
  function keybinds() {
    var kb = { jump: 'Shift', interact: ' ', stall: 'y' };
    try { var s = JSON.parse(localStorage.getItem('espil_keybinds') || 'null'); if (s && s.jump && s.interact && s.stall) kb = s; } catch (e) {}
    return kb;
  }
  function playerPos() {
    try { var p = window.__espilPlayerPose && window.__espilPlayerPose(); if (p && isFinite(p.x)) return p; } catch (e) {}
    return null;
  }
  function probe(x, z) {
    try { return window.__espilCollisionProbe ? window.__espilCollisionProbe(x, z) : null; } catch (e) { return null; }
  }
  function isWater(x, z) { var r = probe(x, z); return !!(r && (r.cls === 'water' || r.swimmable)); }
  function boatState() {
    try { return window.__espilBoat && window.__espilBoat.state ? window.__espilBoat.state() : null; } catch (e) { return null; }
  }
  function skillsHp() {
    try { var ss = window.__espilSkills && window.__espilSkills.state; return (ss && typeof ss.hp === 'number') ? ss.hp : null; } catch (e) { return null; }
  }
  function toast(msg) { try { if (window.__espilToast) { window.__espilToast(msg); return; } } catch (e) {} }
  function itemOf(name) {
    try { if (window.__espilGearWindow && window.__espilGearWindow.itemOf) return window.__espilGearWindow.itemOf(name); } catch (e) {}
    return null;
  }
  function krOf(name) { var it = itemOf(name); return (it && it.kr) ? it.kr : name; }
  function ownedNames() {
    try { var a = JSON.parse(localStorage.getItem(OWN_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function climbToScene(obj) { var n = obj; while (n && n.parent) n = n.parent; return (n && n.isScene) ? n : null; }
  function sceneRoot() {
    try {
      var cam = (typeof window.__espilMapCameraObj === 'function') ? window.__espilMapCameraObj() : null;
      if (cam) { var s0 = climbToScene(cam); if (s0) return s0; }
      var dm = window.__espilDistrictMeshes || [];
      for (var i = 0; i < dm.length; i++) { var s1 = climbToScene(dm[i]); if (s1) return s1; }
      if (window.__espilTimeStoneGroup) { var s2 = climbToScene(window.__espilTimeStoneGroup); if (s2) return s2; }
    } catch (e) {}
    return null;
  }

  /* ================= the log (this module's own key) ========== */
  function readLog() { try { var o = JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
  function recordCatch(name, cm) {
    var log = readLog(), r = log[name] || { count: 0, bestCm: 0, firstAt: 0 };
    r.count += 1; if (cm > r.bestCm) r.bestCm = cm; if (!r.firstAt) r.firstAt = Date.now();
    log[name] = r;
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {}
    return r;
  }

  /* ================= state ==================================== */
  var S = {
    phase: 'idle',            /* idle|casting|waiting|bite|tracking|landing */
    posture: 'shore',         /* 'shore' | 'boat' for the live cast */
    tPhase: 0, tGame: 0,      /* phase clock / accumulated game clock */
    waitDur: 0, falseDipAt: -1, falseDipped: false, dipT: -1,
    castPoint: null,          /* {x, z} the bobber's water point */
    anchor: null,             /* {x, z} the caster's feet at cast start */
    species: null,            /* the rolled TABLE row (bite press) */
    sizeCm: 0,
    fishPos: 0.5, fishVel: 0, fishTarget: 0, fishTimer: 0, burstT: 0, resting: true,
    zonePos: 0.4, zoneVel: 0, zoneH: TUNE.zoneBase,
    meter: TUNE.meterStart,
    stillT: 0,                /* the boat stationary beat */
    lastHp: null, lastCity: null,
    landed: false             /* the landing delivery fires once */
  };
  var seedWait = null, seedRoll = null, pinMode = null;
  var spaceHeld = false, panelHeld = false, hudHeld = false;
  function inputHeld() { return !!(spaceHeld || panelHeld || hudHeld); }
  function fishHeld() { return S.fishPos >= S.zonePos && S.fishPos <= S.zonePos + S.zoneH; }

  /* ================= DOM: prompt chip + tracking panel ======== */
  var promptEl = null, panelEl = null, zoneEl = null, glyphCv = null, meterFillEl = null;
  function ensureDom() {
    if (promptEl) return;
    var st = document.createElement('style');
    st.textContent =
      '#espil-fishing-prompt{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:9001;display:none;' +
      'background:rgba(10,18,24,.82);color:#eaf6ff;border:1px solid rgba(126,200,216,.55);border-radius:999px;' +
      'padding:9px 18px;font:600 15px/1.25 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;white-space:nowrap}' +
      '#espil-fishing-prompt.show{display:block}' +
      /* while fishing owns the boat's stationary posture, the
         boat's own chip ('Space · 내리기') would lie about the
         press - it stands down until the posture ends */
      'body.espil-fishing-boat #espil-boat-prompt{display:none!important}' +
      '#espil-fishing-panel{position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:9002;display:none;' +
      'width:76px;height:min(52vh,430px);background:rgba(10,18,24,.86);border:1px solid rgba(126,200,216,.55);' +
      'border-radius:14px;padding:10px 0 8px;box-sizing:border-box;flex-direction:column;align-items:center}' +
      '#espil-fishing-panel.show{display:flex}' +
      '@media (orientation:landscape) and (max-height:520px){#espil-fishing-panel{height:min(64vh,430px)}}' +
      '#espil-fishing-panel .efp-mid{flex:1;display:flex;flex-direction:row;align-items:stretch;justify-content:center;gap:8px;width:100%}' +
      '#espil-fishing-panel .efp-rail{position:relative;width:36px;border-radius:9px;background:rgba(126,200,216,.13);' +
      'box-shadow:inset 0 0 0 1px rgba(126,200,216,.35);overflow:visible}' +
      '#espil-fishing-panel .efp-zone{position:absolute;left:2px;right:2px;border-radius:6px;background:rgba(87,200,232,.42);' +
      'box-shadow:inset 0 0 0 1px rgba(87,200,232,.85)}' +
      '#espil-fishing-panel .efp-glyph{position:absolute;left:50%;width:34px;height:34px;transform:translate(-50%,50%);pointer-events:none}' +
      '#espil-fishing-panel .efp-meter{position:relative;width:8px;border-radius:5px;background:rgba(126,200,216,.13);' +
      'box-shadow:inset 0 0 0 1px rgba(126,200,216,.35);overflow:hidden}' +
      '#espil-fishing-panel .efp-fill{position:absolute;left:0;right:0;bottom:0;background:#57c8e8}' +
      '#espil-fishing-panel .efp-cap{margin-top:8px;color:#cfeaff;font:600 11px/1.3 system-ui,sans-serif;text-align:center;white-space:nowrap}';
    document.head.appendChild(st);
    promptEl = document.createElement('div');
    promptEl.id = 'espil-fishing-prompt';
    document.body.appendChild(promptEl);
    panelEl = document.createElement('div');
    panelEl.id = 'espil-fishing-panel';
    panelEl.innerHTML = '<div class="efp-mid"><div class="efp-rail"><div class="efp-zone"></div>' +
      '<canvas class="efp-glyph" width="68" height="68"></canvas></div>' +
      '<div class="efp-meter"><div class="efp-fill"></div></div></div>' +
      '<div class="efp-cap">꾹 누르기 · 따라가기</div>';
    document.body.appendChild(panelEl);
    zoneEl = panelEl.querySelector('.efp-zone');
    glyphCv = panelEl.querySelector('.efp-glyph');
    meterFillEl = panelEl.querySelector('.efp-fill');
    /* pointer hold ON THE PANEL is the same hold as Space (B7);
       a pointer anywhere else is not zone input */
    panelEl.addEventListener('pointerdown', function (e) { panelHeld = true; e.preventDefault(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      panelEl.addEventListener(ev, function () { panelHeld = false; });
    });
  }
  function showPrompt(txt) {
    ensureDom();
    if (txt) { promptEl.textContent = txt; promptEl.classList.add('show'); }
    else promptEl.classList.remove('show');
  }
  /* the glyph: panels' icon painter, rasterised onto the panel's
     small canvas (DESIGN B6). Fish show the generic fish shape
     (species hidden); junk shows its own shape. */
  function paintGlyph() {
    if (!glyphCv || !S.species) return;
    var ctx = glyphCv.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, 68, 68);
    var it = itemOf(S.species.name);
    var app = JUNK[S.species.name]
      ? ((it && it.app) || { shape: 'box', c1: '#9aa7ad', c2: '#5d6d78' })
      : { shape: 'fish', c1: '#cfd8de', c2: '#5d7d8c' };
    var svg = null;
    try { if (window.__espilItemIconSVG) svg = window.__espilItemIconSVG({ name: S.species.name, app: app }, 68); } catch (e) {}
    if (!svg) { ctx.fillStyle = app.c1; ctx.beginPath(); ctx.ellipse(34, 34, 22, 12, 0, 0, 7); ctx.fill(); return; }
    var img = new Image();
    img.onload = function () { try { ctx.clearRect(0, 0, 68, 68); ctx.drawImage(img, 0, 0, 68, 68); } catch (e) {} };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function paintPanel() {
    if (!panelEl) return;
    var zh = S.zoneH * 100;
    zoneEl.style.bottom = (S.zonePos * 100) + '%';
    zoneEl.style.height = zh + '%';
    glyphCv.style.bottom = (S.fishPos * 100) + '%';
    meterFillEl.style.height = (Math.max(0, Math.min(1, S.meter)) * 100) + '%';
  }

  /* ================= sound: two synthesised plips ============= */
  var AC = null;
  function plip(f0, f1, dur, gain) {
    try {
      if (!AC) { var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = new Ctx(); }
      if (AC.state === 'suspended') AC.resume();
      var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  /* ================= world primitives: rod, line, bobber ====== */
  var fishGroup = null, rodMesh = null, lineObj = null, linePos = null, bobberGrp = null, catchSprite = null;
  var splashes = [];
  function buildWorld() {
    if (fishGroup || typeof THREE === 'undefined') return;
    var scene = sceneRoot(); if (!scene) return;
    fishGroup = new THREE.Group(); fishGroup.visible = false;
    var rodMat = new THREE.MeshLambertMaterial({ color: 0xa97e46 });
    var rodGeo = new THREE.CylinderGeometry(0.008, 0.02, 1.6, 5);
    rodGeo.translate(0, 0.8, 0); rodGeo.rotateX(Math.PI / 2);   /* axis -> +Z, base at origin */
    rodMesh = new THREE.Mesh(rodGeo, rodMat);
    fishGroup.add(rodMesh);
    linePos = new Float32Array(3 * 3);
    var lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    lineObj = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.85 }));
    lineObj.frustumCulled = false;
    fishGroup.add(lineObj);
    bobberGrp = new THREE.Group();
    var bLow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    var bCap = new THREE.Mesh(new THREE.SphereGeometry(0.086, 10, 6), new THREE.MeshLambertMaterial({ color: 0xe84a3a }));
    bCap.scale.set(1, 0.55, 1); bCap.position.y = 0.035;
    bobberGrp.add(bLow); bobberGrp.add(bCap);
    fishGroup.add(bobberGrp);
    scene.add(fishGroup);
  }
  function spawnSplash(x, z, big) {
    if (!fishGroup || typeof THREE === 'undefined') return;
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.15, 20),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, WATER_Y + 0.04, z);
    fishGroup.add(ring);
    var n = big ? 14 : 9, pos = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = WATER_Y + 0.05; pos[i * 3 + 2] = z;
      var an = Math.random() * 6.283, rr = 0.4 + Math.random() * 0.8;
      vel.push({ x: Math.cos(an) * rr, y: 1.1 + Math.random() * 1.1, z: Math.sin(an) * rr });
    }
    var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.07, transparent: true, opacity: 0.95 }));
    pts.frustumCulled = false;
    fishGroup.add(pts);
    splashes.push({ ring: ring, pts: pts, vel: vel, t: 0, big: !!big });
  }
  function stepSplashes(dt) {
    for (var i = splashes.length - 1; i >= 0; i--) {
      var s = splashes[i]; s.t += dt;
      var k = s.t / 0.55;
      if (k >= 1) {
        fishGroup.remove(s.ring); fishGroup.remove(s.pts);
        s.ring.geometry.dispose(); s.pts.geometry.dispose();
        splashes.splice(i, 1); continue;
      }
      var sc = 1 + k * (s.big ? 5.5 : 3.2);
      s.ring.scale.set(sc, sc, 1); s.ring.material.opacity = 0.9 * (1 - k);
      var pos = s.pts.geometry.attributes.position.array;
      for (var j = 0; j < s.vel.length; j++) {
        var v = s.vel[j]; v.y -= 5.5 * dt;
        pos[j * 3] += v.x * dt; pos[j * 3 + 1] += v.y * dt; pos[j * 3 + 2] += v.z * dt;
        if (pos[j * 3 + 1] < WATER_Y) pos[j * 3 + 1] = WATER_Y;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
      s.pts.material.opacity = 0.95 * (1 - k);
    }
  }
  function makeCatchSprite() {
    if (catchSprite || !S.species || typeof THREE === 'undefined') return;
    var it = itemOf(S.species.name); if (!it) return;
    var svg = null;
    try { if (window.__espilItemIconSVG) svg = window.__espilItemIconSVG(it, 72); } catch (e) {}
    if (!svg) return;
    var cv = document.createElement('canvas'); cv.width = cv.height = 72;
    var tex = new THREE.CanvasTexture(cv);
    var img = new Image();
    img.onload = function () { try { cv.getContext('2d').drawImage(img, 0, 0, 72, 72); tex.needsUpdate = true; } catch (e) {} };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    catchSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    catchSprite.scale.set(0.55, 0.55, 1);
    fishGroup.add(catchSprite);
  }
  function clearWorld() {
    if (catchSprite && fishGroup) { fishGroup.remove(catchSprite); catchSprite = null; }
    for (var i = splashes.length - 1; i >= 0; i--) {
      if (fishGroup) { fishGroup.remove(splashes[i].ring); fishGroup.remove(splashes[i].pts); }
    }
    splashes = [];
    if (fishGroup) fishGroup.visible = false;
  }
  /* hand point + rod tip for the current posture */
  function handPoint(p) {
    if (S.posture === 'boat') {
      var bs = boatState();
      if (bs) return { x: bs.x, y: 1.05, z: bs.z };
    }
    return { x: p.x, y: (p.y || 0) + 1.05, z: p.z };
  }
  function syncWorld(nowS) {
    if (!fishGroup || !S.castPoint) return;
    var p = playerPos(); if (!p) return;
    var hand = handPoint(p), cp = S.castPoint;
    /* bobber flight during casting: hand -> cast point on an arc */
    var bx = cp.x, bz = cp.z, by = WATER_Y + 0.03 + Math.sin(nowS * 2.1) * 0.03;
    if (S.phase === 'casting') {
      var k = Math.min(1, S.tPhase / TUNE.castTime);
      bx = hand.x + (cp.x - hand.x) * k; bz = hand.z + (cp.z - hand.z) * k;
      by = hand.y + (WATER_Y + 0.05 - hand.y) * k + Math.sin(k * Math.PI) * 1.1;
    }
    if (S.phase === 'bite' || S.phase === 'tracking') by = WATER_Y - 0.20;   /* plunged */
    if (S.dipT >= 0) by = WATER_Y - 0.06;                                    /* the false dip's twitch */
    bobberGrp.position.set(bx, by, bz);
    /* rod: base at the hand, tip toward the bobber, raised */
    rodMesh.position.set(hand.x, hand.y, hand.z);
    rodMesh.lookAt(bx, by + 0.55, bz);
    /* line: tip -> arc midpoint -> bobber; taut in tracking/landing */
    var tip = { x: hand.x + (bx - hand.x) * 0.62, y: hand.y + (by + 0.55 - hand.y) * 0.62 + 0.35, z: hand.z + (bz - hand.z) * 0.62 };
    var lift = (S.phase === 'tracking' || S.phase === 'landing') ? 0.05 : 0.30;
    linePos[0] = tip.x; linePos[1] = tip.y; linePos[2] = tip.z;
    linePos[3] = (tip.x + bx) / 2; linePos[4] = Math.max(tip.y, by) + lift * (S.phase === 'casting' ? 0.4 : 1); linePos[5] = (tip.z + bz) / 2;
    linePos[6] = bx; linePos[7] = by + 0.05; linePos[8] = bz;
    lineObj.geometry.attributes.position.needsUpdate = true;
    /* the catch sprite arcs bobber -> player across the landing */
    if (S.phase === 'landing' && catchSprite) {
      var q = Math.min(1, S.tPhase / TUNE.landTime);
      catchSprite.position.set(
        cp.x + (p.x - cp.x) * q,
        WATER_Y + 0.1 + Math.sin(q * Math.PI) * 1.3 + q * 0.8,
        cp.z + (p.z - cp.z) * q);
    } else if (catchSprite) catchSprite.position.set(bx, by + 0.15, bz);
  }

  /* ================= the cast test (DESIGN 5.1 + A2) ========== */
  function fanFrom(x, z, face) {
    var fx = -Math.sin(face), fz = -Math.cos(face);
    var rx = -fz, rz = fx;   /* lateral */
    var ds = [3, 5, 7], lats = [0, -1.2, 1.2];
    for (var i = 0; i < ds.length; i++) {
      for (var j = 0; j < lats.length; j++) {
        var px = x + fx * ds[i] + rx * lats[j], pz = z + fz * ds[i] + rz * lats[j];
        if (isWater(px, pz)) return { x: Math.round(px * 100) / 100, z: Math.round(pz * 100) / 100 };
      }
    }
    return null;
  }
  function shoreBlocked(p) {
    if (!p) return true;
    if (window.__espilInside) return true;
    try { var f = window.__espilFlyState && window.__espilFlyState(); if (f && (f.flying || f.falling)) return true; } catch (e) {}
    try { var vs = window.__espilVehicles && window.__espilVehicles.state(); if (vs && vs.mode === 'driving') return true; } catch (e) {}
    if (isWater(p.x, p.z) && p.y < 1.5) return true;   /* swimming - the monolith's own read */
    return false;
  }
  function shoreCastPoint() {
    var p = playerPos(); if (!p || shoreBlocked(p)) return null;
    return fanFrom(p.x, p.z, p.a || 0);
  }
  function aboardState() {
    var bs = boatState();
    if (!bs || bs.mode !== 'driving' || bs.driver !== 'me') return null;
    return bs;
  }
  function boatStationary(bs) { return S.stillT >= TUNE.stillSecs && bs.speed < TUNE.stillSpeed; }
  function boatCastPoint(bs) { return fanFrom(bs.x, bs.z, bs.face || 0); }
  function activeTable() {
    if (S.posture === 'boat' && TABLE_SEA) return TABLE_SEA;
    var k = null; try { k = window.__espilCityKey; } catch (e) {}
    return (k && TABLE_BY_CITY[k]) || TABLE;
  }
  function rollSpecies() {
    if (seedRoll) {
      var want = seedRoll; seedRoll = null;
      for (var i = 0; i < TABLE.length; i++) if (TABLE[i].name === want) return TABLE[i];
    }
    var t = activeTable(), sum = 0, i2;
    for (i2 = 0; i2 < t.length; i2++) sum += t[i2].rate;
    var r = Math.random() * sum;
    for (i2 = 0; i2 < t.length; i2++) { r -= t[i2].rate; if (r <= 0) return t[i2]; }
    return t[t.length - 1];
  }

  /* ================= the rod grant (DESIGN 7 + A5) ============ */
  function ensureRod() {
    if (ownedNames().indexOf(ROD_ITEM) >= 0) return;
    try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: { type: 'bought', item: ROD_ITEM } })); } catch (e) {}
    toast('낚싯대를 받았다');
  }

  /* ================= transitions ============================== */
  function startCast(posture, point) {
    ensureRod();
    S.posture = posture; S.castPoint = point; S.species = null; S.sizeCm = 0; S.landed = false;
    var p = playerPos();
    S.anchor = p ? { x: p.x, z: p.z } : { x: point.x, z: point.z };
    S.phase = 'casting'; S.tPhase = 0; S.dipT = -1;
    buildWorld();
    if (fishGroup) fishGroup.visible = true;
    showPrompt('');
  }
  function enterWaiting() {
    S.phase = 'waiting'; S.tPhase = 0;
    if (seedWait !== null) { S.waitDur = Math.max(0.2, seedWait); seedWait = null; }
    else S.waitDur = TUNE.waitMin + Math.random() * (TUNE.waitMax - TUNE.waitMin);
    S.falseDipped = false;
    S.falseDipAt = (Math.random() < TUNE.falseDipChance) ? (1 + Math.random() * Math.max(0.5, S.waitDur - 1.6)) : -1;
    spawnSplash(S.castPoint.x, S.castPoint.z, false);
    plip(520, 300, 0.10, 0.05);
  }
  function enterBite() {
    S.phase = 'bite'; S.tPhase = 0; S.dipT = -1;
    spawnSplash(S.castPoint.x, S.castPoint.z, true);
    plip(920, 480, 0.13, 0.09);
    showPrompt('Space · 낚아채기!');
  }
  function earlyPress() {
    /* DESIGN 5.2: the bobber jerks, the fish is scared, the wait
       RESTARTS with a fresh roll - no other penalty, ever */
    if (S.phase !== 'waiting') return;
    S.dipT = 0.25;
    enterWaiting();
  }
  function missBite() {
    spawnSplash(S.castPoint.x, S.castPoint.z, false);
    toast('놓쳤다...');
    endToIdle();
  }
  function openTracking() {
    /* Amendment B3: the species is rolled ONCE, here, at the bite
       press, and FIXED for the whole game */
    S.species = rollSpecies();
    S.phase = 'tracking'; S.tPhase = 0;
    S.zoneH = TUNE.zoneBase * S.species.zoneX;
    S.zonePos = Math.max(0, Math.min(1 - S.zoneH, 0.45 - S.zoneH / 2)); S.zoneVel = 0;
    S.fishPos = 0.3 + Math.random() * 0.4; S.fishVel = 0; S.fishTarget = 0;
    S.fishTimer = 0; S.burstT = 0; S.resting = true;
    S.meter = TUNE.meterStart;
    showPrompt('');
    ensureDom(); paintGlyph();
    panelEl.classList.add('show');
    paintPanel();
  }
  function closePanel() { if (panelEl) panelEl.classList.remove('show'); panelHeld = false; hudHeld = false; }
  function endToIdle() {
    S.phase = 'idle'; S.species = null; S.castPoint = null; S.tPhase = 0; S.dipT = -1;
    closePanel(); clearWorld(); showPrompt('');
  }
  function escapeFish() {
    if (S.castPoint) spawnSplash(S.castPoint.x, S.castPoint.z, false);
    toast('놓쳤다...');
    endToIdle();
  }
  function quitGame() { endToIdle(); }   /* B8: a quit IS an escape without a catch */
  function winGame() {
    closePanel();
    S.phase = 'landing'; S.tPhase = 0; S.landed = false;
    var row = S.species;
    S.sizeCm = Math.round(row.band[0] + Math.random() * (row.band[1] - row.band[0]));
    makeCatchSprite();
  }
  function deliverCatch() {
    var row = S.species; if (!row) return;
    try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: { type: 'monster-drop', items: [{ name: row.name, count: 1 }] } })); } catch (e) {}
    recordCatch(row.name, S.sizeCm);
    if (JUNK[row.name]) toast(krOf(row.name) + '를 낚았습니다');
    else toast(krOf(row.name) + ' ' + S.sizeCm + 'cm를 낚았습니다');
  }

  /* ================= the tracking game (Amendment B2/B4) ====== */
  function repickFish(dt) {
    var row = S.species, sp = row.speed, beh = row.beh;
    S.fishTimer -= dt;
    var dartFam = (beh === 'dart' || beh === 'dart-lite' || beh === 'floater-dart' || beh === 'sinker-dart');
    if (dartFam) {
      if (S.resting) {
        /* between bursts: ~0.3x speed on the mixed pattern, with
           the floater/sinker bias on the biased families */
        if (S.fishTimer <= 0) {
          var bias = beh === 'floater-dart' ? 0.35 * sp * 0.3 : (beh === 'sinker-dart' ? -0.35 * sp * 0.3 : 0);
          S.fishTarget = bias + (Math.random() * 2 - 1) * sp * 0.3;
          S.fishTimer = 0.3 + Math.random() * 0.4;
        }
        S.burstT -= dt;
        if (S.burstT <= 0) {
          S.resting = false;
          S.fishTimer = (beh === 'dart-lite') ? (0.25 + Math.random() * 0.15) : (0.25 + Math.random() * 0.25);
          S.fishTarget = (Math.random() < 0.5 ? -1 : 1) * sp;
        }
      } else {
        if (S.fishTimer <= 0) {
          S.resting = true;
          S.burstT = row.ci[0] + Math.random() * (row.ci[1] - row.ci[0]);
        }
      }
      return;
    }
    if (S.fishTimer > 0) return;
    S.fishTimer = row.ci[0] + Math.random() * (row.ci[1] - row.ci[0]);
    if (beh === 'smooth') S.fishTarget = (Math.random() * 2 - 1) * sp * 0.7;
    else if (beh === 'calm') S.fishTarget = (Math.random() * 2 - 1) * sp * 0.5;
    else if (beh === 'floater' || beh === 'sinker') {
      var b = (beh === 'floater' ? 1 : -1) * 0.35 * sp;
      var t = b + (Math.random() * 2 - 1) * sp * 0.8;
      if (t > sp) t = sp; if (t < -sp) t = -sp;
      S.fishTarget = t;
      /* re-picks against the bias are shorter (B4 draft shape) */
      if ((beh === 'floater' && t < b) || (beh === 'sinker' && t > b)) S.fishTimer *= 0.6;
    } else S.fishTarget = (Math.random() * 2 - 1) * sp;   /* mixed */
  }
  function stepTracking(dt) {
    var row = S.species; if (!row) return;
    /* the fish */
    repickFish(dt);
    var ease = (row.beh === 'smooth' || row.beh === 'calm') ? 2.5 : 6;
    S.fishVel += (S.fishTarget - S.fishVel) * Math.min(1, dt * ease);
    S.fishPos += S.fishVel * dt;
    if (S.fishPos < 0) { S.fishPos = 0; S.fishVel *= TUNE.fishEndReflect; S.fishTarget = Math.abs(S.fishTarget); }
    if (S.fishPos > 1) { S.fishPos = 1; S.fishVel *= TUNE.fishEndReflect; S.fishTarget = -Math.abs(S.fishTarget); }
    /* the zone - Stardew gravity on hold/release */
    if (inputHeld()) S.zoneVel += TUNE.zoneAccelUp * dt;
    else S.zoneVel -= TUNE.zoneGravity * dt;
    if (S.zoneVel > TUNE.zoneSpeedCap) S.zoneVel = TUNE.zoneSpeedCap;
    if (S.zoneVel < -TUNE.zoneSpeedCap) S.zoneVel = -TUNE.zoneSpeedCap;
    S.zonePos += S.zoneVel * dt;
    if (S.zonePos < 0) { S.zonePos = 0; S.zoneVel *= TUNE.zoneEndReflect; }
    if (S.zonePos > 1 - S.zoneH) { S.zonePos = 1 - S.zoneH; S.zoneVel *= TUNE.zoneEndReflect; }
    /* the rig pin (T3 seam): the fish is held where the leg puts it */
    if (pinMode === 'in') { S.fishPos = S.zonePos + S.zoneH / 2; S.fishVel = 0; }
    else if (pinMode === 'out') { S.fishPos = S.zonePos > 0.5 ? Math.max(0, S.zonePos - 0.3) : Math.min(1, S.zonePos + S.zoneH + 0.3); S.fishVel = 0; }
    /* the meter is the clock (B2) */
    if (fishHeld()) S.meter += TUNE.fillBase * row.fillX * dt;
    else S.meter -= TUNE.drainBase * row.drainX * dt;
    if (S.meter >= 1) { S.meter = 1; paintPanel(); winGame(); return; }
    if (S.meter <= 0) { S.meter = 0; escapeFish(); return; }
    paintPanel();
  }

  /* ================= cancels (DESIGN 5.3 + B8) ================ */
  var MOVE_KEYS = { w: 1, a: 1, s: 1, d: 1, arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1 };
  var SKILL_KEYS = { q: 1, e: 1, r: 1, f: 1 };
  function panelOpenNow() {
    try {
      var ip = document.getElementById('inventory-panel'); if (ip && ip.getAttribute('aria-hidden') === 'false') return true;
      var cp = document.getElementById('character-panel'); if (cp && cp.getAttribute('aria-hidden') === 'false') return true;
      var sm = document.getElementById('store-modal'); if (sm && !sm.classList.contains('hidden')) return true;
      var su = document.getElementById('shop-ui'); if (su && su.classList.contains('open')) return true;
      var am = document.getElementById('signin-modal'); if (am && am.getAttribute('aria-hidden') === 'false') return true;
      if (window.__espilPanelsState && window.__espilPanelsState().profileOpen) return true;
    } catch (e) {}
    return false;
  }
  function cancelChecks(p) {
    if (S.phase === 'idle') return;
    if (!inMap()) { endToIdle(); return; }
    var city = null; try { city = window.__espilCityKey; } catch (e) {}
    if (S.lastCity && city && city !== S.lastCity) { endToIdle(); return; }
    if (city) S.lastCity = city;
    var hp = skillsHp();
    if (hp !== null) {
      if (hp <= 0) { endToIdle(); return; }                       /* death: full cancel */
      if (S.lastHp !== null && hp < S.lastHp) { endToIdle(); return; }  /* damage taken */
      S.lastHp = hp;
    }
    if (window.__espilInside) { endToIdle(); return; }
    if (panelOpenNow()) { endToIdle(); return; }
    if (!p) return;
    if (S.posture === 'shore') {
      if (isWater(p.x, p.z) && p.y < 1.5) { endToIdle(); return; }   /* stepped in: swimming */
      var bs = boatState();
      if (bs && bs.mode === 'driving' && bs.driver === 'me') { endToIdle(); return; }  /* boarded / driving */
      if (S.anchor && Math.hypot(p.x - S.anchor.x, p.z - S.anchor.z) > 30) { endToIdle(); return; }  /* teleported away */
    } else {
      var b2 = boatState();
      if (!b2 || b2.mode !== 'driving' || b2.driver !== 'me') { endToIdle(); return; }  /* the ride ended */
      /* a joystick drag is helm input aboard (B7/B8) */
      try { var jv = window.__joyVec; if (jv && Math.hypot(jv.x || 0, jv.y || 0) > 0.35) { endToIdle(); return; } } catch (e) {}
    }
  }

  /* ================= input ==================================== */
  /* Window CAPTURE: this listener runs ahead of the boat's
     document capture listener and of the monolith's bubble
     listener. It claims the interact press ONLY where the
     design gives the press to fishing before the chain runs:
     aboard the stationary boat (A2's split) and whenever the
     tracking game is open (B7). On shore the press is NOT
     claimed here - it flows to tryInteract's end (tryUse). */
  window.addEventListener('keydown', function (e) {
    var kb = keybinds();
    if (e.key === kb.interact) spaceHeld = true;
    if (!inMap() || typingNow()) return;
    var lk = (e.key || '').toLowerCase();
    if (S.phase === 'idle') return;
    if (e.key === 'Escape' && !e.repeat) { e.stopPropagation(); e.preventDefault(); quitGame(); return; }
    if (S.phase === 'tracking') {
      if (e.key === kb.interact) { e.stopPropagation(); e.preventDefault(); return; }
      if (MOVE_KEYS[lk] && !e.repeat) { quitGame(); return; }   /* quits; the input proceeds (B8) */
      if (SKILL_KEYS[lk]) { e.stopPropagation(); e.preventDefault(); return; }
      if (e.key === kb.jump && !e.repeat) { quitGame(); return; }
      return;
    }
    /* casting / waiting / bite / landing */
    if (MOVE_KEYS[lk] && !e.repeat) { endToIdle(); return; }    /* the first step ends the cast */
    if (e.key === kb.jump && !e.repeat) { endToIdle(); return; }
    if (SKILL_KEYS[lk]) { e.stopPropagation(); e.preventDefault(); return; }
    if (e.key === kb.interact && !e.repeat && S.posture === 'boat') {
      e.stopPropagation(); e.preventDefault();
      if (S.phase === 'waiting') earlyPress();
      else if (S.phase === 'bite') openTracking();
      return;
    }
  }, true);
  window.addEventListener('keyup', function (e) {
    if (e.key === keybinds().interact) spaceHeld = false;
  }, true);
  /* the aboard CAST press (idle, stationary, prompt up) - claimed
     here, ahead of the boat's bail-out, per A2's split */
  window.addEventListener('keydown', function (e) {
    if (S.phase !== 'idle' || !inMap() || typingNow()) return;
    if (e.key !== keybinds().interact || e.repeat) return;
    var bs = aboardState();
    if (bs && boatStationary(bs)) {
      var cp = boatCastPoint(bs);
      if (cp) { e.stopPropagation(); e.preventDefault(); startCast('boat', cp); }
    }
  }, true);
  /* the mobile HUD interact button - Space's twin: its hold also
     drives the zone while tracking is open (B7) */
  document.addEventListener('pointerdown', function (e) {
    if (S.phase !== 'tracking') return;
    var t = e.target;
    if (t && t.closest && t.closest('#map-interact')) hudHeld = true;
  }, true);
  document.addEventListener('pointerup', function () { hudHeld = false; }, true);
  document.addEventListener('pointercancel', function () { hudHeld = false; panelHeld = false; }, true);

  /* ================= tryUse - the end of the chain ============ */
  function tryUse() {
    if (!inMap() || typingNow()) return false;
    if (S.phase === 'waiting') { earlyPress(); return true; }
    if (S.phase === 'bite') { openTracking(); return true; }
    if (S.phase === 'tracking' || S.phase === 'landing' || S.phase === 'casting') return true;
    /* idle: aboard first (the button path reaches here too) */
    var bs = aboardState();
    if (bs) {
      if (boatStationary(bs)) { var cp = boatCastPoint(bs); if (cp) { startCast('boat', cp); return true; } }
      return false;   /* moving: the press is the boat's, as today */
    }
    var sp = shoreCastPoint();
    if (sp) { startCast('shore', sp); return true; }
    return false;
  }

  /* ================= the tick ================================= */
  var lastTickMs = 0;
  function tick() {
    requestAnimationFrame(tick);
    var nowMs = performance.now();
    if (!lastTickMs) lastTickMs = nowMs;
    var wallDt = (nowMs - lastTickMs) / 1000;
    lastTickMs = nowMs;
    if (!inMap()) { if (S.phase !== 'idle') endToIdle(); showPrompt(''); document.body.classList.remove('espil-fishing-boat'); return; }
    ensureDom();
    var dt = Math.max(0.001, Math.min(0.25, wallDt));
    S.tGame += dt;
    var p = playerPos();
    /* the boat stationary beat (A2: 0.5 s under 0.2 m/s) */
    var bs = aboardState();
    if (bs && bs.speed < TUNE.stillSpeed) S.stillT += dt; else S.stillT = 0;
    /* prompt + the boat-chip stand-down */
    var boatEngaged = false;
    if (S.phase === 'idle') {
      if (bs && boatStationary(bs) && boatCastPoint(bs)) { showPrompt('Space · 낚시하기'); boatEngaged = true; }
      else if (!bs && shoreCastPoint()) showPrompt('Space · 낚시하기');
      else showPrompt('');
    } else if (S.phase === 'bite') { showPrompt('Space · 낚아채기!'); }
    else if (S.phase !== 'tracking') showPrompt('');
    if (S.posture === 'boat' && S.phase !== 'idle') boatEngaged = true;
    document.body.classList.toggle('espil-fishing-boat', boatEngaged);
    /* cancels that only the tick can see */
    cancelChecks(p);
    if (S.phase === 'idle') return;
    S.tPhase += dt;
    if (S.dipT >= 0) { S.dipT -= dt; if (S.dipT < 0) S.dipT = -1; }
    buildWorld();
    if (S.phase === 'casting' && S.tPhase >= TUNE.castTime) enterWaiting();
    else if (S.phase === 'waiting' && S.tPhase >= S.waitDur) enterBite();
    else if (S.phase === 'bite' && S.tPhase >= TUNE.biteWindow) missBite();
    else if (S.phase === 'tracking') stepTracking(dt);
    else if (S.phase === 'landing') {
      if (S.tPhase >= TUNE.landTime) {
        if (!S.landed) { S.landed = true; deliverCatch(); }
        endToIdle();
      }
    }
    if (S.phase !== 'idle' && fishGroup) { fishGroup.visible = true; syncWorld(nowMs / 1000); }
    stepSplashes(dt);
  }
  requestAnimationFrame(tick);

  /* ================= the landmark row's teacher =============== */
  function guide() {
    toast('물가에서 Space를 누르면 낚시를 시작합니다');
  }

  /* ================= public hook ============================== */
  window.__espilFishing = {
    state: function () {
      return {
        phase: S.phase, posture: S.posture,
        species: S.species ? S.species.name : null,
        castPoint: S.castPoint ? { x: S.castPoint.x, z: S.castPoint.z } : null,
        hasRod: ownedNames().indexOf(ROD_ITEM) >= 0,
        boatStationary: (function () { var b = aboardState(); return !!(b && boatStationary(b)); })()
      };
    },
    debug: function () {
      return {
        phase: S.phase, posture: S.posture,
        species: S.species ? S.species.name : null,
        meter: Math.round(S.meter * 10000) / 10000,
        fishPos: Math.round(S.fishPos * 10000) / 10000,
        zoneSpan: [Math.round(S.zonePos * 10000) / 10000, Math.round((S.zonePos + S.zoneH) * 10000) / 10000],
        zoneH: Math.round(S.zoneH * 10000) / 10000,
        held: S.phase === 'tracking' ? fishHeld() : false,
        inputHeld: inputHeld(),
        tGame: Math.round(S.tGame * 1000) / 1000,
        castPoint: S.castPoint ? { x: S.castPoint.x, z: S.castPoint.z } : null,
        panelOpen: !!(panelEl && panelEl.classList.contains('show'))
      };
    },
    tryUse: tryUse,
    cast: function () { return tryUse(); },
    cancel: function () { if (S.phase !== 'idle') endToIdle(); },
    guide: guide,
    log: function () { return readLog(); },
    _seed: function (o) {
      if (o) {
        if (typeof o.wait === 'number') seedWait = o.wait;
        if (typeof o.roll === 'string') seedRoll = o.roll;
      }
      return { wait: seedWait, roll: seedRoll };
    },
    _pin: function (mode) { pinMode = (mode === 'in' || mode === 'out') ? mode : null; return pinMode; }
  };
})();
