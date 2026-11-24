/* __espilBoat v1 - the landmark activity boat (espil.online room,
   NAME-ONLY ENTRY package 2, 2026-11-24). Design:
   espil-online-room/name-entry/DESIGN.md section 6.5 (Han's
   decisions of 2026-11-24, via the deploy order of the same day).

   WHAT THIS MODULE OWNS
   - The ONE shared moored activity craft of a boatArea city
     (Vancouver / Canada Place in v1). It is not a possession:
     no ownership, no purchase, no unlock, no persistence - no
     localStorage key exists for it. The craft is a PLACE: it
     stands at its mooring, an entrant swims out and boards it
     with the Use key, drives it inside the harbour, and leaves
     it at the mooring; when it is empty it returns to the
     mooring on its own (the design's parked-car grammar).
   - Population (the design's reading, stated in the build
     report): the boat serves the landmark-activity population -
     name entrants, the session-less users the village rules
     bind. The craft, its marker and its prompt arm only while
     NO server-marked session record exists; an account never
     sees or boards it (accounts get no boat UI, exactly as
     they get no landmark UI). If a session record appears
     mid-drive the drive finishes, but no new boarding opens.
   - Boarding grammar: Use (the interact key) at the moored
     craft, from the water - the player swims to the craft and
     boards within BOARD_RANGE of its centre. B is NOT the
     boat's key: B stays the owned car's key (vehicles.js), and
     this module never touches it. Disembark is Use while
     driving, and only at the mooring (within ALIGHT_RANGE of
     the mooring point) - the design draft's rule; anywhere
     else the press answers with the mooring notice.
   - Driving model: the boat drives THROUGH the game's own
     walk pipeline, on the vehicles.js precedent - this module
     steers window.__joyVec for the coast injection and the
     swim lever window.__espilSwimBoost for speed (the monolith
     reads it on the swim branch of its speed line, package 2's
     seam H3; the land branch's __espilSpeedBoost does not act
     on a swimming body). Building collision, the swim state,
     chunk streaming and the village ring stay the game's own.
     Speed is a state of this module: TOP_SPEED 8 m/s (the
     design's harbour draft, ~8 m/s class - the car's 54 it is
     not), accelerating at ACCEL while a move input is held,
     coasting down at DECEL when released, with the measured-
     speed feedback loop keeping the cap honest.
   - Water-only movement, harbour bound: the nose probe (the
     car's building-stop shape) reads the collision grid ahead
     of the bow - a point that is not water (grid class water /
     swimmable, the isWaterAt rule) or that leaves the registry
     boatArea stops the craft; the stall detector is the
     backstop. The boundary is the ESPIL_CITIES registry's
     boatArea, read through the monolith's __espilLandmarkInfo
     hook (package 2's seam H1) - the registry stays the
     boundary's only home; this module keeps only the mooring
     points (the vehicles module's DEALER precedent).
   - Combat lock (the vehicles precedent): while driving,
     skill keys and jump are swallowed in the capture phase
     and window.__espilSkills.move is wrapped with a driving
     check. The rider avatar is hidden by the same scene scan
     vehicles.js uses; if the scan finds nothing the avatar
     simply stays visible in the boat (fallback, no error).
   - Empty return: alighting at the mooring's edge, death, or
     an interior taking the body empties the craft away from
     its exact mooring pose, and it glides home at
     RETURN_SPEED - direct when a 2 m-sampled segment probe is
     all water, else via the city's channel waypoint - then
     eases its face back to the mooring face and re-moors.
     Leaving the page or the city resets the module (memory
     only), so the next arrival finds the craft at its mooring:
     the cross-session form of the same return.
   - SHARING - THE MARKED SEAM (stated plainly): the craft's
     state does NOT reach other clients in v1. The Worker
     CityRoom relays a fixed set of frame types and drops the
     rest; its pos relay rebuilds frames with x/y/z/a only, and
     no honest channel carries craft state (the vehicles v1
     precedent is the same: the parked car is not presence-
     synced either - that sync is its own line). All craft
     state therefore lives in ONE state object below, and every
     transition calls publishState() - a no-op in v1 - which is
     the exact plug where a future Worker relay shaped like
     stall_update (a boat_state branch in the room plus a
     presence.js dispatch branch) switches sharing on without
     restructuring. Passenger seats are built into the craft
     and the state; boardAsPassenger() is the seam's receiving
     half - no local path calls it in v1, because a passenger
     ride needs the driver's craft state on the passenger's
     client, which is exactly what the relay will carry.
   - The model: DESIGN 6.5 assigns the boat model to the asset
     line as a new item, and no boat GLB exists on disk - so v1
     builds a small open boat from primitives in-module (the
     interim visual, never the asset line's model). When the
     asset line delivers, BOAT_GLB below names the file and
     makeBoatGroup() swaps to the GLB clone exactly as
     vehicles' makeCarGroup does; nothing else changes.

   Hooks: window.__espilBoat = { state(), board(), alight(),
   guideMooring(), mooring() }.
   Module sources are TAGLESS (house rule) - no script tags. */
(function () {
  'use strict';
  if (window.__espilBoat) return;

  /* ================= constants ================= */
  var BOAT_GLB = null;             /* asset-line seam: 'assets/vehicles/boat.glb' when delivered */
  var BOAT_LENGTH_M = 5.2;         /* small open harbour boat */
  var BOAT_HALF_LEN_M = BOAT_LENGTH_M / 2;
  var NOSE_PROBE_M = BOAT_HALF_LEN_M + 0.45;   /* water-stop nose probe reach (the car's shape) */
  var TOP_SPEED = 8;               /* m/s - the design's harbour draft (~8 m/s class) */
  var ACCEL = 2.4;                 /* m/s^2 */
  var DECEL = 3.2;                 /* m/s^2 coast-down */
  var TURN_RATE = 2.2;             /* rad/s - a boat turns slower than the car */
  var BOARD_RANGE = 4.6;           /* player-to-centre boarding range, from the water */
  var ALIGHT_RANGE = 7;            /* disembark only within this of the mooring point */
  var RETURN_SPEED = 4;            /* m/s - the empty glide home */
  var SWIM_BASE = 4;               /* moveSpeeds().swim - the lever's divisor */
  /* Mooring points, world coordinates (the vehicles DEALER
     precedent: a place this module owns). Vancouver's was
     surveyed on the shipped collision grid (build report P2):
     open water ~5.4 m off the Canada Place quay's north-west
     edge, bow lying parallel to the quay; the channel waypoint
     keeps the empty return in open water. A city with a
     registry boatArea but no mooring here gets no craft -
     the two facts are surveyed together or not at all. */
  var MOORINGS = {
    vancouver: { x: 730, z: -764, face: 1.711, channel: { x: 700, z: -770 } }
  };
  /* Seat offsets in craft space (bow = +Z): the driver at the
     stern helm, four passenger places on the two benches. */
  var SEATS = {
    driver: { x: 0, z: -1.55 },
    passengers: [
      { x: -0.55, z: 0.55 }, { x: 0.55, z: 0.55 },
      { x: -0.55, z: -0.55 }, { x: 0.55, z: -0.55 }
    ]
  };

  /* ================= small helpers (vehicles pattern) == */
  function $(id) { return document.getElementById(id); }
  function inMap() { return !!(document.body && document.body.classList.contains('in-map')); }
  function playerPos() {
    try { var p = window.__espilPlayerPose && window.__espilPlayerPose(); if (p && isFinite(p.x)) return p; } catch (e) {}
    return null;
  }
  function signedIn() {
    try { var a = window.__espilAuthState && window.__espilAuthState(); if (a && typeof a.signedIn === 'boolean') return a.signedIn; } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      return !!(s && s.id && s.server === true);
    } catch (e) { return false; }
  }
  function entrantNow() { return !signedIn(); }
  function notice(msg) {
    try { if (window.__espilToast) { window.__espilToast(msg); return; } } catch (e) {}
    var t = $('toast');
    if (t) { t.textContent = msg; t.classList.add('show'); clearTimeout(t._bt); t._bt = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  }
  function toast(msg) { notice(msg); }
  function probe(x, z) {
    try { return window.__espilCollisionProbe ? window.__espilCollisionProbe(x, z) : null; } catch (e) { return null; }
  }
  function isWater(x, z) {
    var r = probe(x, z);
    return !!(r && (r.cls === 'water' || r.swimmable));
  }
  function landmarkInfo() {
    try { return window.__espilLandmarkInfo ? window.__espilLandmarkInfo() : null; } catch (e) { return null; }
  }
  function cityKey() {
    var k = window.__espilCityKey;
    try { k = (typeof k === 'function') ? k() : k; } catch (e) {}
    return String(k || 'vancouver').toLowerCase();
  }
  function mooringFor(key) { return MOORINGS[key] || null; }
  function inArea(area, x, z) { return !!(area && x >= area.x0 && x <= area.x1 && z >= area.z0 && z <= area.z1); }
  function flyActive() {
    try { var f = window.__espilFlyState && window.__espilFlyState(); return !!(f && (f.flying || f.falling)); } catch (e) { return false; }
  }
  function playerDead() {
    try { var ss = window.__espilSkills && window.__espilSkills.state; return !!(ss && ss.hp <= 0); } catch (e) { return false; }
  }
  function keybinds() {
    var kb = { jump: 'Shift', interact: ' ', stall: 'y' };
    try { var s = JSON.parse(localStorage.getItem('espil_keybinds') || 'null'); if (s && s.jump && s.interact && s.stall) kb = s; } catch (e) {}
    return kb;
  }
  function typingNow() {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    return /INPUT|TEXTAREA|SELECT/.test(tag) || !!(ae && ae.isContentEditable);
  }
  function climbToScene(obj) {
    var n = obj;
    while (n && n.parent) n = n.parent;
    return (n && n.isScene) ? n : null;
  }
  function sceneRoot() {
    try {
      var cam = (typeof window.__espilMapCameraObj === 'function') ? window.__espilMapCameraObj() : null;
      if (cam) { var s0 = climbToScene(cam); if (s0) return s0; }
      var dm = window.__espilDistrictMeshes || [];
      for (var i = 0; i < dm.length; i++) { var s1 = climbToScene(dm[i]); if (s1) return s1; }
      if (window.__espilTimeStoneGroup) { var s2 = climbToScene(window.__espilTimeStoneGroup); if (s2) return s2; }
      return null;
    } catch (e) { return null; }
  }

  /* ================= craft state (ONE object - the seam) == */
  /* Every fact a second client would need lives here and only
     here: mode, pose, speed, who drives, who rides. v1 keeps it
     local; the relay named in the header fills the same shape. */
  var craft = {
    mode: 'moored',                /* 'moored' | 'driving' | 'returning' */
    x: 0, z: 0, face: 0,           /* craft pose (module-owned while moored/returning; follows the driver while driving) */
    speed: 0,                      /* the boat's own speed state, m/s */
    driver: null,                  /* 'me' in v1; a peer session id once the relay lands */
    passengers: []                 /* peer session ids once the relay lands; seat i rides SEATS.passengers[i] */
  };
  var armedKey = null;             /* the city key the craft currently stands in */
  var armedArea = null;            /* the registry boatArea of that city */
  var armedMooring = null;         /* MOORINGS[armedKey] */
  var heading = 0;                 /* driving heading; vector = (sin h, cos h) */
  var measured = 0;                /* smoothed measured body speed */
  var boostCorr = 1;               /* feedback correction on (speed / SWIM_BASE) */
  var stallTime = 0;
  var blockedByWater = false;
  var swimBoost = null;            /* current __espilSwimBoost value while driving */
  var priorSwimBoost;              /* the lever value found at board time, restored at alight */
  var boostOwned = false;
  var joyInjected = null;
  var lastPose = null, prevPose = null;
  var dryTime = 0;                 /* seconds the driving body has read not-over-water (safety valve) */
  var returnLeg = null;            /* current glide target {x, z, final} */
  var publishThrottle = 0;

  /* The sharing seam: called on every state transition and at
     1 Hz while the craft moves. In v1 it does nothing - the
     Worker relay that would carry {t:'boat_state', ...craft}
     to the room does not exist (see the header). When it lands,
     this function sends, and a presence-side dispatch calls
     applyRemoteState(frame) below; neither changes the driving
     code, which reads only `craft`. */
  function publishState() { /* v1: no relay - intentionally empty */ }
  function applyRemoteState(frame) {
    /* The seam's receiving half (v1: unreachable - no relay
       delivers frames). A remote driver's craft would take
       mode 'driving' with driver = frame.from, and a local
       boarder would join craft.passengers via
       boardAsPassenger(); both are honoured by state() and
       the visual sync as soon as a frame source exists. */
    if (!frame || typeof frame !== 'object') return;
    if (frame.mode) craft.mode = frame.mode;
    if (typeof frame.x === 'number') craft.x = frame.x;
    if (typeof frame.z === 'number') craft.z = frame.z;
    if (typeof frame.face === 'number') craft.face = frame.face;
    craft.driver = frame.driver || null;
    craft.passengers = Array.isArray(frame.passengers) ? frame.passengers.slice(0, SEATS.passengers.length) : [];
  }

  /* ================= DOM: the prompt chip ================= */
  var promptEl = null;
  function ensureDom() {
    if (promptEl) return;
    var st = document.createElement('style');
    st.id = 'espil-boat-style';
    st.textContent =
      '#espil-boat-prompt{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:9000;display:none;' +
      'padding:7px 16px;border-radius:999px;border:1px solid #7ec8d8;background:rgba(10,22,28,.85);color:#dff4f8;' +
      'font-family:sans-serif;font-size:13px;font-weight:700;letter-spacing:.4px;pointer-events:none}' +
      '#espil-boat-prompt.show{display:block}';
    document.head.appendChild(st);
    promptEl = document.createElement('div');
    promptEl.id = 'espil-boat-prompt';
    document.body.appendChild(promptEl);
  }

  /* ================= 3D: marker + craft ================= */
  var builtScene = null, markerGroup = null, boatGroup = null, glbTemplate = null, glbLoading = false;
  function makeLabel(text) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 160;
    var g2 = c.getContext('2d');
    g2.fillStyle = 'rgba(8,20,26,0.72)';
    g2.beginPath();
    if (g2.roundRect) g2.roundRect(96, 18, 320, 124, 22); else g2.rect(96, 18, 320, 124);
    g2.fill();
    g2.strokeStyle = '#7ec8d8'; g2.lineWidth = 5; g2.stroke();
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillStyle = '#dff4f8'; g2.font = '700 54px sans-serif';
    g2.fillText(text, 256, 82);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(4.2, 1.31, 1);
    return sp;
  }
  function loadGlb(cb) {
    if (!BOAT_GLB) { cb(null); return; }
    if (glbTemplate) { cb(glbTemplate); return; }
    if (glbLoading) { setTimeout(function () { loadGlb(cb); }, 300); return; }
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') { cb(null); return; }
    glbLoading = true;
    new THREE.GLTFLoader().load(BOAT_GLB, function (gltf) {
      glbLoading = false;
      glbTemplate = gltf.scene;
      cb(glbTemplate);
    }, undefined, function () { glbLoading = false; cb(null); });
  }
  function buildPrimitivesBoat() {
    /* The interim craft (asset-line model pending): a small
       open boat - plan-view hull outline extruded down, a
       gunwale rim, an inner floor, two bench seats and the
       stern helm console. Bow toward +Z, length BOAT_LENGTH_M. */
    var g = new THREE.Group();
    var hullMat = new THREE.MeshLambertMaterial({ color: 0xe9e2d2 });
    var rimMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
    var woodMat = new THREE.MeshLambertMaterial({ color: 0xa97e46 });
    var floorMat = new THREE.MeshLambertMaterial({ color: 0x5d4023 });
    var L = BOAT_LENGTH_M, B = 2.2, hl = L / 2, hb = B / 2;
    function planShape(scale) {
      var s = new THREE.Shape();
      var w = hb * scale, l = hl * scale;
      s.moveTo(-w, -l);
      s.lineTo(w, -l);
      s.lineTo(w, l * 0.35);
      s.quadraticCurveTo(w, l * 0.85, 0, l);
      s.quadraticCurveTo(-w, l * 0.85, -w, l * 0.35);
      s.lineTo(-w, -l);
      return s;
    }
    var hullGeo = new THREE.ExtrudeGeometry(planShape(1), { depth: 0.55, bevelEnabled: false });
    hullGeo.rotateX(Math.PI / 2);   /* shape XY -> XZ plan; extrusion becomes -Y..0 below the rim plane */
    var hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.62;
    g.add(hull);
    var rimGeo = new THREE.ExtrudeGeometry(planShape(1.07), { depth: 0.1, bevelEnabled: false });
    rimGeo.rotateX(Math.PI / 2);
    var rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.72;
    g.add(rim);
    var floor = new THREE.Mesh(new THREE.BoxGeometry(B * 0.82, 0.06, L * 0.78), floorMat);
    floor.position.set(0, 0.3, -0.1);
    g.add(floor);
    [0.55, -0.55].forEach(function (bz) {
      var bench = new THREE.Mesh(new THREE.BoxGeometry(B * 0.84, 0.09, 0.42), woodMat);
      bench.position.set(0, 0.52, bz);
      g.add(bench);
    });
    var console_ = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.34), rimMat);
    console_.position.set(0, 0.55, -1.35);
    g.add(console_);
    var stern = new THREE.Mesh(new THREE.BoxGeometry(B * 0.84, 0.09, 0.5), woodMat);
    stern.position.set(0, 0.52, -2.05);
    g.add(stern);
    return g;
  }
  function makeBoatGroup() {
    var g = new THREE.Group();
    loadGlb(function (tpl) {
      if (tpl) {
        var inner = tpl.clone(true);
        var box = new THREE.Box3().setFromObject(inner);
        var size = box.getSize(new THREE.Vector3());
        var len = Math.max(size.x, size.z);
        var s = len > 0 ? BOAT_LENGTH_M / len : 1;
        inner.scale.setScalar(s);
        var box2 = new THREE.Box3().setFromObject(inner);
        inner.position.y -= box2.min.y;
        inner.position.y -= 0.30;   /* waterline allowance: the keel sits under the surface */
        g.add(inner);
      } else {
        var prim = buildPrimitivesBoat();
        prim.position.y -= 0.30;    /* the same waterline allowance */
        g.add(prim);
      }
      g.userData.ready = true;
    });
    return g;
  }
  function buildWorld() {
    var scene = sceneRoot();
    if (!scene) return false;
    if (builtScene === scene && boatGroup) return true;
    builtScene = scene;
    markerGroup = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(3.3, 3.75, 40),
      new THREE.MeshBasicMaterial({ color: 0x7ec8d8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    markerGroup.add(ring);
    var label = makeLabel('배 타기');
    label.position.y = 2.6;
    markerGroup.add(label);
    scene.add(markerGroup);
    boatGroup = makeBoatGroup();
    scene.add(boatGroup);
    syncBoatVisual(true);
    return true;
  }
  function syncBoatVisual(force) {
    if (!boatGroup) return;
    var show = !!armedMooring && entrantNow();
    boatGroup.visible = show;
    if (markerGroup) markerGroup.visible = show;
    if (!show) return;
    var t = performance.now() / 1000;
    if (craft.mode === 'driving') {
      var p = playerPos();
      if (p) boatGroup.position.set(p.x, p.y + 0.02, p.z);
      boatGroup.rotation.set(0, heading, 0);
    } else {
      boatGroup.position.set(craft.x, 0.27 + Math.sin(t * 0.9) * 0.035, craft.z);
      boatGroup.rotation.set(Math.sin(t * 0.7) * 0.012, craft.face, Math.sin(t * 0.55) * 0.012);
    }
    if (markerGroup && armedMooring) markerGroup.position.set(armedMooring.x, 0.26 + Math.sin(t * 0.9) * 0.03, armedMooring.z);
  }

  /* ================= rider avatar (vehicles pattern) ====== */
  var avatarHidden = false, avatarGroupRef = null;
  function findAvatarGroup() {
    var scene = sceneRoot();
    var p = playerPos();
    if (!scene || !p) return null;
    var found = null;
    for (var i = 0; i < scene.children.length; i++) {
      var ch = scene.children[i];
      if (ch === boatGroup || ch === markerGroup) continue;
      if (!ch.position) continue;
      var dx = ch.position.x - p.x, dz = ch.position.z - p.z;
      if (dx * dx + dz * dz > 0.02) continue;
      var hasBody = false;
      ch.traverse(function (o) { if (o.isSkinnedMesh || o.isSprite) hasBody = true; });
      if (hasBody) { found = ch; break; }
    }
    return found;
  }
  function hideAvatar() {
    if (avatarHidden) return;
    var g = findAvatarGroup();
    if (g) { avatarGroupRef = g; g.visible = false; avatarHidden = true; }
  }
  function showAvatar() {
    if (avatarGroupRef) { avatarGroupRef.visible = true; }
    avatarGroupRef = null;
    avatarHidden = false;
  }

  /* ================= driving levers ================= */
  function setSwimBoost(v) {
    swimBoost = v;
    window.__espilSwimBoost = v;
  }
  function clearSwimBoost() {
    if (boostOwned) {
      if (priorSwimBoost === undefined) { try { delete window.__espilSwimBoost; } catch (e) { window.__espilSwimBoost = undefined; } }
      else window.__espilSwimBoost = priorSwimBoost;
    }
    boostOwned = false;
    swimBoost = null;
  }
  function clearJoy() {
    if (joyInjected && window.__joyVec && Math.abs(window.__joyVec.x - joyInjected.x) < 0.001 && Math.abs(window.__joyVec.y - joyInjected.y) < 0.001) {
      window.__joyVec = { x: 0, y: 0 };
    }
    joyInjected = null;
  }
  var skillsWrapped = false, moveToastAt = 0;
  function wrapSkills() {
    if (skillsWrapped) return;
    var sk = window.__espilSkills;
    if (!sk || typeof sk.move !== 'function') return;
    var orig = sk.move;
    var wrapped = function (id) {
      if (craft.mode === 'driving') {
        var now = Date.now();
        if (now - moveToastAt > 2500) { moveToastAt = now; toast('항해 중에는 공격할 수 없습니다'); }
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__espilBoatWrapped = true;
    try { sk.move = wrapped; skillsWrapped = true; } catch (e) {}
  }

  /* ================= board / alight / return ============= */
  function board() {
    if (craft.mode === 'driving') return { ok: true, already: true };
    if (craft.mode !== 'moored') return { ok: false, why: 'away' };
    if (!armedMooring || !entrantNow()) return { ok: false, why: 'population' };
    /* one body, one vehicle: never board over a live car drive
       (the two modules steer the same walk pipeline) */
    try { var vs = window.__espilVehicles && window.__espilVehicles.state(); if (vs && vs.mode === 'driving') return { ok: false, why: 'vehicle' }; } catch (e) {}
    if (window.__espilInside) return { ok: false, why: 'inside' };
    if (flyActive()) return { ok: false, why: 'fly' };
    if (playerDead()) return { ok: false, why: 'dead' };
    var p = playerPos();
    if (!p) return { ok: false, why: 'nopose' };
    var d = Math.hypot(p.x - craft.x, p.z - craft.z);
    if (d > BOARD_RANGE) return { ok: false, why: 'range' };
    if (!isWater(p.x, p.z)) { notice('배 옆 물에서 탈 수 있습니다'); return { ok: false, why: 'dry' }; }
    craft.mode = 'driving';
    craft.driver = 'me';
    craft.speed = 0; measured = 0; boostCorr = 1; stallTime = 0; blockedByWater = false; dryTime = 0;
    heading = craft.face;
    lastPose = null; prevPose = null;
    priorSwimBoost = window.__espilSwimBoost;
    boostOwned = true;
    swimBoost = null;
    wrapSkills();
    hideAvatar();
    publishState();
    toast('배에 올랐습니다 (계류지에서 Space: 내리기)');
    syncBoatVisual(true);
    return { ok: true };
  }
  function startReturn() {
    /* The empty craft goes home: direct when the sampled
       segment is all water, else via the channel waypoint. */
    craft.driver = null;
    craft.passengers = [];
    craft.speed = 0;
    var m = armedMooring;
    if (!m) { craft.mode = 'moored'; publishState(); return; }
    var d = Math.hypot(craft.x - m.x, craft.z - m.z);
    if (d <= 0.4) {
      craft.x = m.x; craft.z = m.z; craft.face = m.face;
      craft.mode = 'moored'; returnLeg = null;
      publishState();
      return;
    }
    if (segmentAllWater(craft.x, craft.z, m.x, m.z)) {
      returnLeg = { x: m.x, z: m.z, final: true };
    } else if (m.channel && segmentAllWater(craft.x, craft.z, m.channel.x, m.channel.z)) {
      returnLeg = { x: m.channel.x, z: m.channel.z, final: false };
    } else if (m.channel) {
      returnLeg = { x: m.channel.x, z: m.channel.z, final: false };
    } else {
      returnLeg = { x: m.x, z: m.z, final: true };
    }
    craft.mode = 'returning';
    publishState();
  }
  function segmentAllWater(x0, z0, x1, z1) {
    var d = Math.hypot(x1 - x0, z1 - z0);
    var n = Math.max(1, Math.ceil(d / 2));
    for (var i = 0; i <= n; i++) {
      var x = x0 + (x1 - x0) * (i / n), z = z0 + (z1 - z0) * (i / n);
      if (!isWater(x, z)) return false;
      if (armedArea && !inArea(armedArea, x, z)) return false;
    }
    return true;
  }
  function emptyCraft() {
    /* The driver leaves the craft wherever it floats (alight
       at the mooring, death, an interior): levers are released,
       the rider returns, and the empty craft goes home. */
    clearJoy();
    clearSwimBoost();
    showAvatar();
    craft.speed = 0; measured = 0;
    startReturn();
  }
  function alight() {
    if (craft.mode !== 'driving') return { ok: false, why: 'notdriving' };
    var p = playerPos();
    var m = armedMooring;
    if (!p || !m) return { ok: false, why: 'nopose' };
    var d = Math.hypot(p.x - m.x, p.z - m.z);
    if (d > ALIGHT_RANGE) { notice('계류지에서만 내릴 수 있습니다'); return { ok: false, why: 'notmooring' }; }
    /* the craft takes the driver's last pose as its float point,
       then the empty return carries it the last metres home */
    craft.x = p.x; craft.z = p.z; craft.face = heading;
    emptyCraft();
    toast('배에서 내렸습니다');
    return { ok: true };
  }
  function boardAsPassenger() {
    /* The seam's receiving half (see the header): a local
       boarder joins a REMOTE driver's craft. Unreachable in
       v1 - craft.driver is only ever 'me' or null locally,
       because no relay delivers a remote driver's state. The
       shape is here so the relay's arrival is a wiring job,
       not a redesign. */
    if (craft.mode !== 'driving' || !craft.driver || craft.driver === 'me') return { ok: false, why: 'nodriver' };
    if (craft.passengers.length >= SEATS.passengers.length) return { ok: false, why: 'full' };
    return { ok: false, why: 'norelay' };
  }
  function guideMooring() {
    if (!armedMooring) { notice('부두 가장자리에서 물로 들어갈 수 있습니다'); return; }
    notice('부두 끝 계류지에서 배에 오를 수 있습니다');
    if (markerGroup) { markerGroup.scale.set(1.35, 1, 1.35); setTimeout(function () { if (markerGroup) markerGroup.scale.set(1, 1, 1); }, 1600); }
  }

  /* ================= input ================= */
  var myArrows = { arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
  var SKILL_KEYS = { q: 1, w: 1, e: 1, r: 1, a: 1, s: 1, d: 1, f: 1 };
  document.addEventListener('keydown', function (e) {
    var lk = (e.key || '').toLowerCase();
    if (lk in myArrows) myArrows[lk] = true;
    if (!inMap() || typingNow()) return;
    var kb = keybinds();
    if (e.key === kb.interact && !e.repeat) {
      if (craft.mode === 'driving') {
        e.stopPropagation(); e.preventDefault();
        alight();
        return;
      }
      if (craft.mode === 'moored' && armedMooring && entrantNow() && !window.__espilInside) {
        var p = playerPos();
        if (p && Math.hypot(p.x - craft.x, p.z - craft.z) <= BOARD_RANGE) {
          e.stopPropagation(); e.preventDefault();
          board();
          return;
        }
      }
      return;
    }
    /* driving: combat inputs and jump stay silent (the
       vehicles rule). The interact key is handled above. */
    if (craft.mode === 'driving' && (SKILL_KEYS[lk] || lk === 'shift')) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    var lk = (e.key || '').toLowerCase();
    if (lk in myArrows) myArrows[lk] = false;
  }, true);

  /* ================= arming ================= */
  function armCheck() {
    var info = landmarkInfo();
    var key = cityKey();
    var area = (info && info.boatArea) ? info.boatArea : null;
    var moor = mooringFor(key);
    if (area && moor && info && info.key === key) {
      if (armedKey !== key) {
        armedKey = key; armedArea = area; armedMooring = moor;
        craft.mode = 'moored';
        craft.x = moor.x; craft.z = moor.z; craft.face = moor.face;
        craft.driver = null; craft.passengers = []; craft.speed = 0;
        heading = moor.face;
        builtScene = null;   /* rebuild the world dressing for this city */
        markerGroup = null; boatGroup = null;
        publishState();
      }
    } else if (armedKey !== null) {
      /* a city with no surveyed mooring (or no boatArea):
         no craft stands here */
      if (craft.mode === 'driving') emptyCraft();
      armedKey = null; armedArea = null; armedMooring = null;
      if (boatGroup) boatGroup.visible = false;
      if (markerGroup) markerGroup.visible = false;
    }
  }

  /* ================= tick ================= */
  var lastTickMs = 0;
  function camForward(p) {
    try {
      var cam = (typeof window.__espilMapCameraObj === 'function') ? window.__espilMapCameraObj() : null;
      if (cam && cam.position) {
        var fx = p.x - cam.position.x, fz = p.z - cam.position.z;
        var l = Math.sqrt(fx * fx + fz * fz);
        if (l > 0.01) return { x: fx / l, z: fz / l };
      }
    } catch (e) {}
    return { x: -Math.sin(p.a || 0), z: -Math.cos(p.a || 0) };
  }
  function tick() {
    requestAnimationFrame(tick);
    var nowMs = performance.now();
    if (!lastTickMs) lastTickMs = nowMs;
    var wallDt = (nowMs - lastTickMs) / 1000;
    lastTickMs = nowMs;
    if (!inMap()) { lastPose = null; return; }
    ensureDom();
    armCheck();
    if (!armedMooring) { if (promptEl) promptEl.classList.remove('show'); return; }
    buildWorld();
    wrapSkills();
    var p = playerPos();
    if (!p) return;
    var entrant = entrantNow();

    /* an interior takes the body: the craft empties where it
       floats and goes home (the car's auto-park, on water) */
    if (craft.mode === 'driving' && window.__espilInside) { craft.x = p.x; craft.z = p.z; craft.face = heading; emptyCraft(); }
    if (craft.mode === 'driving' && playerDead()) { craft.x = p.x; craft.z = p.z; craft.face = heading; emptyCraft(); toast('배가 계류지로 돌아갑니다'); }

    /* prompt chip */
    if (promptEl) {
      var txt = '';
      if (entrant && !window.__espilInside) {
        if (craft.mode === 'moored' && Math.hypot(p.x - craft.x, p.z - craft.z) <= BOARD_RANGE && isWater(p.x, p.z)) txt = 'Space · 배 타기';
        else if (craft.mode === 'driving' && armedMooring && Math.hypot(p.x - armedMooring.x, p.z - armedMooring.z) <= ALIGHT_RANGE) txt = 'Space · 내리기';
      }
      if (txt) { promptEl.textContent = txt; promptEl.classList.add('show'); }
      else promptEl.classList.remove('show');
    }

    if (craft.mode === 'returning') { tickReturn(Math.max(0.004, Math.min(0.05, wallDt))); syncBoatVisual(false); prevPose = { x: p.x, y: p.y, z: p.z }; lastPose = prevPose; return; }
    if (craft.mode !== 'driving') {
      /* moored: ease the face back to the mooring face (the
         glide home ends looking along its last travel line) */
      if (craft.mode === 'moored' && armedMooring) {
        var mdf = armedMooring.face - craft.face;
        while (mdf > Math.PI) mdf -= Math.PI * 2;
        while (mdf < -Math.PI) mdf += Math.PI * 2;
        if (Math.abs(mdf) > 0.001) craft.face += Math.max(-TURN_RATE * wallDt, Math.min(TURN_RATE * wallDt, mdf));
      }
      syncBoatVisual(false); prevPose = { x: p.x, y: p.y, z: p.z }; lastPose = prevPose; return;
    }

    /* ---- driving ---- */
    var dt = Math.max(0.004, Math.min(0.05, wallDt));
    var dist = lastPose ? Math.hypot(p.x - lastPose.x, p.z - lastPose.z) : 0;
    var instMeas = lastPose && dt > 0 ? dist / dt : 0;
    if (instMeas > 70) instMeas = measured;   /* a pose jump is an artefact, not a speed */
    measured = measured * 0.65 + instMeas * 0.35;
    var F = camForward(p);
    var R = { x: -F.z, z: F.x };
    var ix = 0, iz = 0;
    if (myArrows.arrowup) iz -= 1;
    if (myArrows.arrowdown) iz += 1;
    if (myArrows.arrowleft) ix -= 1;
    if (myArrows.arrowright) ix += 1;
    var joyExt = null;
    if (window.__joyVec) {
      var jv = window.__joyVec;
      var isMine = joyInjected && Math.abs(jv.x - joyInjected.x) < 0.06 && Math.abs(jv.y - joyInjected.y) < 0.06;
      if (!isMine && Math.hypot(jv.x, jv.y) > 0.15) joyExt = jv;
    }
    if (joyExt) { ix += joyExt.x; iz += joyExt.y; joyInjected = null; }
    var il = Math.hypot(ix, iz);
    if (il > 1) { ix /= il; iz /= il; il = 1; }
    var manual = il > 0.12;
    var mx = 0, mz = 0;
    if (manual) { mx = F.x * (-iz) + R.x * ix; mz = F.z * (-iz) + R.z * ix; var ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; }

    /* heading follows the measured travel direction, turned
       at a limited rate (the car's smoothed rotation feel) */
    if (dist > 0.03 && lastPose) {
      var vx = (p.x - lastPose.x) / dist, vz = (p.z - lastPose.z) / dist;
      var want = Math.atan2(vx, vz);
      var dh = want - heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      heading += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, dh));
    }
    var hv = { x: Math.sin(heading), z: Math.cos(heading) };

    /* safety valve: a driving body that reads dry land for
       over half a second has left the water by some other
       system's hand - the craft empties and goes home */
    if (!isWater(p.x, p.z)) { dryTime += dt; if (dryTime > 0.5) { craft.x = p.x; craft.z = p.z; craft.face = heading; emptyCraft(); syncBoatVisual(true); return; } }
    else dryTime = 0;

    /* water stops the boat: the nose probe reads the grid
       ahead of the bow - not water, or outside the harbour
       area, is the boat's building. The stall detector is the
       robust backstop, exactly as the car learned it. */
    blockedByWater = false;
    if (craft.speed > 0 || manual) {
      /* probe along the INTENDED motion - the input direction
         while the driver steers, the heading while coasting.
         Probing only along the heading deadlocks a stalled
         craft: the heading follows measured travel, and a
         braked body cannot travel to turn it, so a driver who
         nosed into the edge could never steer clear. With the
         input-direction probe, steering away clears the bow
         and motion resumes (the car's escape, made real). */
      var pvx = manual ? mx : hv.x, pvz = manual ? mz : hv.z;
      var nx = p.x + pvx * NOSE_PROBE_M, nz = p.z + pvz * NOSE_PROBE_M;
      /* the latch must not wait for the body to slow: at a
         shoreline edge the walk pipeline carries the body
         ashore at full speed (measured never falls), so a
         measured-speed condition lets the bow cross before it
         can engage. Latch on the probe alone, and hold the
         acceleration below while blocked - the lever then
         reads 0 and the body stalls at the waterline. (Fix
         found by the P2 verification rig: the harbour's north
         edge is a shoreline, and the craft beached there.) */
      if (!isWater(nx, nz) || !inArea(armedArea, nx, nz)) { blockedByWater = true; craft.speed = 0; }
    }
    if (!blockedByWater && manual && craft.speed > 3 && measured < 0.8) {
      stallTime += dt;
      if (stallTime > 1.0) { blockedByWater = true; craft.speed = 0; stallTime = 0; }
    } else {
      stallTime = 0;
    }

    if (manual && !blockedByWater) {
      if (joyInjected) clearJoy();
      craft.speed = Math.min(TOP_SPEED, craft.speed + ACCEL * dt);
    } else if (craft.speed > 0) {
      craft.speed = Math.max(0, craft.speed - DECEL * dt);
      if (craft.speed > 0) {
        /* coast: keep gliding along the boat's heading */
        var cix = hv.x * R.x + hv.z * R.z;
        var ciz = -(hv.x * F.x + hv.z * F.z);
        window.__joyVec = { x: cix, y: ciz };
        joyInjected = { x: cix, y: ciz };
      } else {
        clearJoy();
      }
    }
    if (craft.speed > 0) {
      /* the lever is DERIVED from the speed state every tick
         (swimBoost = speed / SWIM_BASE, the swim the lever is
         taken on); the slow multiplicative correction trims it
         against the measured body speed - the car's anti-
         deadlock shape, gated the same way. */
      if (measured > 2 && craft.speed > 3) {
        boostCorr = Math.max(0.45, Math.min(2.2, boostCorr * Math.max(0.92, Math.min(1.08, craft.speed / measured))));
      }
      setSwimBoost(Math.max(0, Math.min(2.72, (craft.speed / SWIM_BASE) * boostCorr)));
    } else {
      /* the lever stays owned for the whole drive (restored
         at alight); at a standstill it simply reads zero */
      swimBoost = null;
      window.__espilSwimBoost = 0;
    }
    craft.x = p.x; craft.z = p.z; craft.face = heading;
    publishThrottle += dt;
    if (publishThrottle > 1) { publishThrottle = 0; publishState(); }
    syncBoatVisual(false);
    prevPose = { x: p.x, y: p.y, z: p.z };
    lastPose = prevPose;
  }
  function tickReturn(dt) {
    if (!returnLeg || !armedMooring) { craft.mode = 'moored'; return; }
    var dx = returnLeg.x - craft.x, dz = returnLeg.z - craft.z;
    var d = Math.hypot(dx, dz);
    var step = RETURN_SPEED * dt;
    if (d <= Math.max(0.4, step)) {
      craft.x = returnLeg.x; craft.z = returnLeg.z;
      if (returnLeg.final) {
        returnLeg = null;
        craft.mode = 'moored';
        publishState();
      } else {
        returnLeg = { x: armedMooring.x, z: armedMooring.z, final: true };
      }
      return;
    }
    var vx = dx / d, vz = dz / d;
    craft.x += vx * step; craft.z += vz * step;
    var want = Math.atan2(vx, vz);
    var dh = want - craft.face;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    craft.face += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, dh));
    publishThrottle += dt;
    if (publishThrottle > 1) { publishThrottle = 0; publishState(); }
  }
  requestAnimationFrame(tick);

  /* ================= public hook ================= */
  window.__espilBoat = {
    state: function () {
      return {
        armed: !!armedMooring,
        city: armedKey,
        mode: craft.mode,
        x: Math.round(craft.x * 100) / 100, z: Math.round(craft.z * 100) / 100,
        face: Math.round(craft.face * 1000) / 1000,
        speed: Math.round(craft.speed * 100) / 100,
        measured: Math.round(measured * 100) / 100,
        topSpeed: TOP_SPEED,
        blockedByWater: blockedByWater,
        swimBoost: (typeof window.__espilSwimBoost === 'number') ? window.__espilSwimBoost : null,
        driver: craft.driver,
        passengers: craft.passengers.slice(),
        seats: { driver: SEATS.driver, passengers: SEATS.passengers },
        mooring: armedMooring ? { x: armedMooring.x, z: armedMooring.z, face: armedMooring.face } : null,
        area: armedArea ? { x0: armedArea.x0, x1: armedArea.x1, z0: armedArea.z0, z1: armedArea.z1 } : null,
        model: BOAT_GLB ? 'glb' : 'primitives-interim'
      };
    },
    board: board,
    alight: alight,
    guideMooring: guideMooring,
    mooring: function () { return armedMooring ? { x: armedMooring.x, z: armedMooring.z, face: armedMooring.face } : null; },
    /* the sharing seam's receiving half (v1: no relay calls it) */
    _applyRemoteState: applyRemoteState
  };
})();
