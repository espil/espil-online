/* __espilBoat v2 - the landmark activity boat (espil.online room,
   NAME-ONLY ENTRY package 2, 2026-11-24; GUEST BOAT ARRIVAL
   amendment the same day). Designs:
   espil-online-room/name-entry/DESIGN.md section 6.5 (Han's
   decisions of 2026-11-24, via the deploy order of the same day)
   and espil-online-room/guest-arrival/DESIGN.md (Han's direct
   ruling: guests start RIDING A BOAT; the boat beaches on
   landfall and the rider steps off automatically; the
   disembarked boat does NOT return empty - it stays anchored
   at the last disembarkation spot; when the guest disappears,
   the boat VANISHES; Q1 assisted course + instant manual
   takeover and Q2 re-boardable all session decided by Han's
   delegation, recorded in guest-arrival/DESIGN-LOG.md).

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

   V2 AMENDMENT - THE ARRIVAL GRAMMAR (guest-arrival/DESIGN.md
   sections 2-5; the v1 header above stands as the record of
   the shipped P2 grammar, and this block names what the
   amendment replaces):
   - A Vancouver guest's entry no longer summons on land: the
     monolith's entrant branch hands the dive the registry's
     arrivalSpawn and leaves window.__espilBoatArrival; this
     module consumes the flag on arm and starts the guest
     ABOARD the craft at the spawn, mode 'arriving', driver
     'me', on an assisted course (the mooring table's channel
     waypoint, then its landing aim) at COURSE_SPEED. ANY
     movement input cancels the course the same tick and the
     craft is the guest's to drive (mode 'driving').
   - LANDFALL = BEACHING: while arriving or driving, a nose
     probe that reads NOT WATER inside the boatArea resolves
     a disembark point (the probe point if walkable, else the
     nearest walkable cell within ~4 m); the craft stops
     afloat where it floated, the rider is placed at that
     point through the monolith's __espilPlacePlayerAt hook,
     no key pressed. No resolution (building cell, non-
     standable edge) or a probe outside the boatArea keeps
     the v1 blocked-stop - the area's open-sea edges beach
     NEVER, by the area test, whatever the bake beyond them
     reads. The dry-land valve's consequence is re-read the
     same way: stop and beach at the last afloat pose, never
     empty.
   - DISEMBARK otherwise = BAIL-OUT: Use while driving,
     anywhere, steps off into the water; the craft ANCHORS
     where it floats (mode 'anchored'). The v1 mooring-only
     alight rule and its refusal notice are dead.
   - The empty-return glide is DEAD outright: modes
     'returning' and its tick, the face-ease home and the
     re-mooring are removed. After any disembark the craft
     holds its exact pose indefinitely - 'beached' off a
     shore, 'anchored' afloat - and the same guest re-boards
     it all session under the v1 water-boarding grammar.
   - VANISHING: page/city leave ends the module state as in
     v1 (a fresh entry is a fresh arrival). Death NEVER moves
     the boat: death while driving anchors the craft at the
     death spot. An in-place account flip ashore vanishes
     the boat on the spot; a flip mid-drive does not cut the
     drive, but the next release is the boat's last (it
     vanishes instead of anchoring and cannot be re-boarded).
   - The mooring (730, -764) is no longer home: it survives
     as the course's final-approach reference and the harbour
     marker's rest point. guideMooring() is re-pointed at the
     live craft wherever it lies and renamed guideToBoat()
     (the old name stays as an alias for the v1 caller).
   - Population, confinement, the swim lever, the combat
     lock, the sharing seam and the interim visual are v1's,
     unchanged. Worker: NO change - every state here is
     client-local memory, as measured for P2.
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
  var COURSE_SPEED = 4;            /* m/s - the assisted arrival course (the retired empty glide's speed) */
  var SWIM_BASE = 4;               /* moveSpeeds().swim - the lever's divisor */
  /* Mooring points, world coordinates (the vehicles DEALER
     precedent: a place this module owns). Vancouver's was
     surveyed on the shipped collision grid (build report P2):
     open water ~5.4 m off the Canada Place quay's north-west
     edge, bow lying parallel to the quay; the channel waypoint
     keeps the arrival course in open water. V2: the mooring
     is the course's final-approach reference, no longer home;
     the table gains the LANDING AIM - a walkable quay-edge
     point (746, -759), surveyed on the shipped grid by the
     P2 probe method (guest-arrival build survey: steering
     waypoint -> aim, the nose probe first reads land at the
     aim's own cell with the centre still ~3 m afloat, and
     the disembark resolution lands on the probe point
     itself). The arrival SPAWN lives in the registry (the
     monolith's entrant branch must read it before this lazy
     module exists): landmark.arrivalSpawn, read back through
     __espilLandmarkInfo. A city with a registry boatArea but
     no mooring here gets no craft - the two facts are
     surveyed together or not at all. */
  var MOORINGS = {
    vancouver: { x: 730, z: -764, face: 1.711, channel: { x: 700, z: -770 }, landing: { x: 746, z: -759 } }
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
  /* V2 state grammar: 'arriving' is a driving state (the
     course drives the same walk pipeline, levers, combat
     lock and hidden rider as the helm); the boardable rest
     states are the mooring rest and the two stays-put forms
     the arrival grammar leaves behind. */
  function drivingState() { return craft.mode === 'driving' || craft.mode === 'arriving'; }
  function boardableState() { return craft.mode === 'moored' || craft.mode === 'beached' || craft.mode === 'anchored'; }
  function probeWalkable(x, z) {
    var r = probe(x, z);
    return !!(r && r.walkable);
  }
  /* The beaching resolution (design 3.3): the probe point
     itself when it is standable, else the nearest standable
     cell within ~4 m of it - the game's own walkable read
     (the __espilCollisionProbe palette flag espilNavWalkable
     uses), so a beaching can never place the guest on water,
     inside a building, or on a non-standable edge. */
  function resolveDisembark(x, z) {
    if (probeWalkable(x, z)) return { x: x, z: z };
    for (var r = 0.75; r <= 4.01; r += 0.75) {
      for (var k = 0; k < 16; k++) {
        var a = (2 * Math.PI * k) / 16;
        var px = x + r * Math.cos(a), pz = z + r * Math.sin(a);
        if (probeWalkable(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }
  /* The rider steps ashore through the monolith's placement
     hook (the walk player is monolith-owned). A missing hook
     answers false and the caller leaves the rider swimming
     at the waterline - degraded, never stranded mid-air. */
  function placeRider(x, z) {
    try { return !!(window.__espilPlacePlayerAt && window.__espilPlacePlayerAt(x, z)); } catch (e) { return false; }
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
    mode: 'moored',                /* 'moored' (armed rest) | 'arriving' | 'driving' | 'beached' | 'anchored' | 'gone' */
    x: 0, z: 0, face: 0,           /* craft pose (module-owned while moored/returning; follows the driver while driving) */
    speed: 0,                      /* the boat's own speed state, m/s */
    driver: null,                  /* 'me' in v1; a peer session id once the relay lands */
    passengers: []                 /* peer session ids once the relay lands; seat i rides SEATS.passengers[i] */
  };
  var armedKey = null;             /* the city key the craft currently stands in */
  var armedArea = null;            /* the registry boatArea of that city */
  var armedMooring = null;         /* MOORINGS[armedKey] */
  var armedSpawn = null;           /* the registry arrivalSpawn while the landmark carries arrival:'boat' */
  var wasEntrant = false;          /* this page has been entrant-populated (the flip test's memory) */
  var course = null;               /* the assisted arrival course {legs:[{x,z}], i} while 'arriving' */
  var flipLastRide = false;        /* a session appeared mid-drive: the next release vanishes the boat */
  var lastAfloat = null;           /* the last driving pose that read water (the dry valve's beach pose) */
  var guideUntil = 0;              /* guideToBoat(): the marker re-point window's end (performance.now ms) */
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
    var show = !!armedMooring && entrantNow() && craft.mode !== 'gone';
    boatGroup.visible = show;
    if (markerGroup) markerGroup.visible = show;
    if (!show) return;
    var t = performance.now() / 1000;
    if (drivingState()) {
      var p = playerPos();
      if (p) boatGroup.position.set(p.x, p.y + 0.02, p.z);
      boatGroup.rotation.set(0, heading, 0);
    } else {
      boatGroup.position.set(craft.x, 0.27 + Math.sin(t * 0.9) * 0.035, craft.z);
      boatGroup.rotation.set(Math.sin(t * 0.7) * 0.012, craft.face, Math.sin(t * 0.55) * 0.012);
    }
    if (markerGroup && armedMooring) {
      /* the marker rests at the mooring (the harbour's fixed
         point); while a guideToBoat() window runs it stands
         at the craft itself, wherever the guest left it */
      if (performance.now() < guideUntil && !drivingState()) {
        markerGroup.position.set(craft.x, 0.26 + Math.sin(t * 0.9) * 0.03, craft.z);
        markerGroup.scale.set(1.35, 1, 1.35);
      } else {
        markerGroup.position.set(armedMooring.x, 0.26 + Math.sin(t * 0.9) * 0.03, armedMooring.z);
        markerGroup.scale.set(1, 1, 1);
      }
    }
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
      if (drivingState()) {
        var now = Date.now();
        if (now - moveToastAt > 2500) { moveToastAt = now; toast('항해 중에는 공격할 수 없습니다'); }
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__espilBoatWrapped = true;
    try { sk.move = wrapped; skillsWrapped = true; } catch (e) {}
  }

  /* ================= board / alight / arrival ============ */
  /* The drive's two lever halves, shared by board() (the
     guest steps in) and startArrival() (the entry puts the
     guest in): engage takes the swim lever and the combat
     lock; release gives them back. The rider avatar hides
     for the whole of either. */
  function engageDrive() {
    craft.speed = 0; measured = 0; boostCorr = 1; stallTime = 0; blockedByWater = false; dryTime = 0;
    lastPose = null; prevPose = null; lastAfloat = null;
    priorSwimBoost = window.__espilSwimBoost;
    boostOwned = true;
    swimBoost = null;
    wrapSkills();
    hideAvatar();
  }
  function releaseDrive() {
    clearJoy();
    clearSwimBoost();
    showAvatar();
    craft.speed = 0; measured = 0;
    course = null;
  }
  /* Every way a ride ends lands here: the craft settles into
     its stays-put form - unless a session appeared mid-drive,
     in which case this release is the boat's last and it
     vanishes instead of anchoring (design 5). The caller has
     already set the craft's final pose. */
  function finishRide(mode) {
    releaseDrive();
    craft.driver = null;
    if (flipLastRide) { vanishCraft(); return; }
    craft.mode = mode;
    publishState();
  }
  function vanishCraft() {
    releaseDrive();
    craft.driver = null;
    craft.passengers = [];
    flipLastRide = false;
    craft.mode = 'gone';
    publishState();
    syncBoatVisual(true);
  }
  /* The arrival itself: the monolith's entrant branch left
     window.__espilBoatArrival and placed the guest at the
     registry spawn; the tick consumes the flag and calls
     this. The craft stands at the spawn with the guest as
     its driver from the module's first armed frame, bow on
     the first course leg (the channel waypoint, then the
     landing aim - the retired glide's route shape at its
     speed, now carrying the rider through the drive pipeline
     instead of moving an empty hull). */
  function startArrival() {
    var sp = armedSpawn, m = armedMooring;
    if (!sp || !m || !m.landing) return;
    var legs = [];
    if (m.channel) legs.push({ x: m.channel.x, z: m.channel.z });
    legs.push({ x: m.landing.x, z: m.landing.z });
    craft.x = sp.x; craft.z = sp.z;
    heading = Math.atan2(legs[0].x - sp.x, legs[0].z - sp.z);
    craft.face = heading;
    engageDrive();
    craft.driver = 'me';
    course = { legs: legs, i: 0 };
    craft.mode = 'arriving';
    publishState();
    syncBoatVisual(true);
  }
  function board() {
    if (drivingState()) return { ok: true, already: true };
    if (!boardableState()) return { ok: false, why: 'away' };
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
    heading = craft.face;
    engageDrive();
    publishState();
    toast('배에 올랐습니다 (Space: 내리기)');
    syncBoatVisual(true);
    return { ok: true };
  }
  function alight() {
    /* V2: the bail-out. Use while driving (or on the course),
       anywhere in the harbour - the rider steps off into the
       water and swims; the craft anchors where it floats.
       There is no home point left to restrict this to, and
       the beaching form (automatic, on landfall) is the
       other disembark - see the probe block in the tick. */
    if (!drivingState()) return { ok: false, why: 'notdriving' };
    var p = playerPos();
    if (!p) return { ok: false, why: 'nopose' };
    craft.x = p.x; craft.z = p.z; craft.face = heading;
    finishRide('anchored');
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
  function guideToBoat() {
    /* V2 guidance: the landmark row guides to the guest's
       boat WHEREVER IT WAS LEFT (design 2/4) - the marker
       leaves the mooring and stands at the craft for the
       guide window (syncBoatVisual), with the distance in
       the notice. */
    if (!armedMooring || craft.mode === 'gone') { notice('부두 가장자리에서 물로 들어갈 수 있습니다'); return; }
    if (drivingState()) { notice('배를 타고 있습니다'); return; }
    var p = playerPos();
    if (p) notice('배는 마지막으로 내린 곳에 있습니다 (약 ' + Math.round(Math.hypot(p.x - craft.x, p.z - craft.z)) + ' m)');
    else notice('배는 마지막으로 내린 곳에 있습니다');
    guideUntil = performance.now() + 4000;
    syncBoatVisual(true);
  }
  /* The v1 name, kept as an alias: the shipped landmark row
     called guideMooring(); the re-pointed row prefers
     guideToBoat() and falls back to this. */
  function guideMooring() { guideToBoat(); }

  /* ================= input ================= */
  var myArrows = { arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
  var SKILL_KEYS = { q: 1, w: 1, e: 1, r: 1, a: 1, s: 1, d: 1, f: 1 };
  document.addEventListener('keydown', function (e) {
    var lk = (e.key || '').toLowerCase();
    if (lk in myArrows) myArrows[lk] = true;
    if (!inMap() || typingNow()) return;
    var kb = keybinds();
    if (e.key === kb.interact && !e.repeat) {
      if (drivingState()) {
        e.stopPropagation(); e.preventDefault();
        alight();
        return;
      }
      if (boardableState() && armedMooring && entrantNow() && !window.__espilInside) {
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
    if (drivingState() && (SKILL_KEYS[lk] || lk === 'shift')) {
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
        /* the arrival opt-in rides the registry read: only a
           landmark carrying arrival:'boat' AND its surveyed
           spawn arms the arrival; the spawn is re-read on
           every arm so the flag consumption below always
           steers at the registry's current point */
        armedSpawn = (info.arrival === 'boat' && info.arrivalSpawn && isFinite(info.arrivalSpawn.x) && isFinite(info.arrivalSpawn.z))
          ? { x: info.arrivalSpawn.x, z: info.arrivalSpawn.z } : null;
        craft.mode = 'moored';
        craft.x = moor.x; craft.z = moor.z; craft.face = moor.face;
        craft.driver = null; craft.passengers = []; craft.speed = 0;
        course = null; flipLastRide = false; lastAfloat = null; guideUntil = 0;
        heading = moor.face;
        builtScene = null;   /* rebuild the world dressing for this city */
        markerGroup = null; boatGroup = null;
        publishState();
      }
    } else if (armedKey !== null) {
      /* a city with no surveyed mooring (or no boatArea):
         no craft stands here. Leaving the harbour city
         VANISHES the boat (design 5) - the levers release
         and nothing glides anywhere. */
      if (drivingState()) releaseDrive();
      craft.mode = 'gone';
      craft.driver = null; craft.passengers = []; craft.speed = 0;
      course = null; flipLastRide = false;
      armedKey = null; armedArea = null; armedMooring = null; armedSpawn = null;
      if (boatGroup) boatGroup.visible = false;
      if (markerGroup) markerGroup.visible = false;
      publishState();
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
    if (entrant) wasEntrant = true;

    /* THE ARRIVAL (design 3.1): the monolith's entrant branch
       left its flag for this entry and placed the guest at
       the registry spawn. Consume it exactly once - start
       aboard when the guest is at the spawn (the dive put
       them there); a flag whose guest is nowhere near the
       spawn is stale and is simply dropped. */
    if (armedSpawn && entrant && craft.mode === 'moored') {
      var pend = null;
      try { pend = window.__espilBoatArrival || null; } catch (e) {}
      if (pend) {
        try { window.__espilBoatArrival = null; } catch (e) {}
        if (Math.hypot(p.x - armedSpawn.x, p.z - armedSpawn.z) <= 12 && !playerDead() && !flyActive() && !window.__espilInside) startArrival();
      }
    }

    /* the in-place account flip (design 5): this page WAS a
       guest's and now carries a session. Ashore, the boat
       vanishes on the spot; mid-drive the drive is not cut
       (v1's rule) but finishRide() makes the next release
       the boat's last. A born-account page never sets
       wasEntrant, so its armed rest state is v1's exactly. */
    if (armedMooring && wasEntrant && !entrant) {
      if (boardableState()) vanishCraft();
      else if (drivingState()) flipLastRide = true;
    }

    /* an interior takes the body: the craft anchors where it
       floats (v1 emptied it home; the arrival grammar has no
       home - design 2). Death is the same shape and never a
       disappearance: the craft anchors AT THE DEATH SPOT and
       the respawned guest walks back to it (design 5). */
    if (drivingState() && window.__espilInside) { craft.x = p.x; craft.z = p.z; craft.face = heading; finishRide('anchored'); }
    if (drivingState() && playerDead()) { craft.x = p.x; craft.z = p.z; craft.face = heading; finishRide('anchored'); }

    /* prompt chip */
    if (promptEl) {
      var txt = '';
      if (entrant && !window.__espilInside) {
        if (boardableState() && Math.hypot(p.x - craft.x, p.z - craft.z) <= BOARD_RANGE && isWater(p.x, p.z)) txt = 'Space · 배 타기';
        else if (drivingState()) txt = 'Space · 내리기';
      }
      if (txt) { promptEl.textContent = txt; promptEl.classList.add('show'); }
      else promptEl.classList.remove('show');
    }

    if (!drivingState()) {
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

    /* THE COURSE (design 3.2): while 'arriving', the craft
       steers itself at the current leg - spawn -> channel
       waypoint -> landing aim - as an auto-input in the same
       shape as a driver's. ANY manual input cancels the
       course on this very tick and the mode becomes plain
       'driving': no prompt, no confirm, the helm is the
       guest's from that position and heading. The steering
       waits while the dive envelope still holds the body
       above the surface (pose y is the only read of it this
       module needs). */
    var autoDir = null;
    if (craft.mode === 'arriving' && course) {
      if (manual) {
        course = null;
        craft.mode = 'driving';
        publishState();
      } else if (p.y < 2.5) {
        var leg = course.legs[course.i];
        var ldx = leg.x - p.x, ldz = leg.z - p.z;
        var ld = Math.hypot(ldx, ldz);
        if (ld < 3 && course.i < course.legs.length - 1) {
          course.i++;
          leg = course.legs[course.i];
          ldx = leg.x - p.x; ldz = leg.z - p.z; ld = Math.hypot(ldx, ldz);
        }
        if (ld > 0.01) autoDir = { x: ldx / ld, z: ldz / ld };
      }
    }

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
       system's hand. V1 emptied the craft home; the arrival
       grammar re-reads the consequence (design 2): stop, do
       not empty - the ride ends as a beaching at the LAST
       AFLOAT pose (the hull never climbs onto the land) and
       the rider, already ashore, simply stands there. */
    if (!isWater(p.x, p.z)) {
      dryTime += dt;
      if (dryTime > 0.5) {
        if (lastAfloat) { craft.x = lastAfloat.x; craft.z = lastAfloat.z; craft.face = lastAfloat.face; }
        else { craft.x = p.x; craft.z = p.z; craft.face = heading; }
        finishRide('beached');
        syncBoatVisual(true);
        prevPose = { x: p.x, y: p.y, z: p.z }; lastPose = prevPose;
        return;
      }
    }
    else { dryTime = 0; lastAfloat = { x: p.x, z: p.z, face: heading }; }

    /* water stops the boat: the nose probe reads the grid
       ahead of the bow - not water, or outside the harbour
       area, is the boat's building. The stall detector is the
       robust backstop, exactly as the car learned it. */
    blockedByWater = false;
    if (craft.speed > 0 || manual || autoDir) {
      /* probe along the INTENDED motion - the input direction
         while the driver steers, the heading while coasting.
         Probing only along the heading deadlocks a stalled
         craft: the heading follows measured travel, and a
         braked body cannot travel to turn it, so a driver who
         nosed into the edge could never steer clear. With the
         input-direction probe, steering away clears the bow
         and motion resumes (the car's escape, made real). */
      var pvx = manual ? mx : (autoDir ? autoDir.x : hv.x), pvz = manual ? mz : (autoDir ? autoDir.z : hv.z);
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
      var probeWet = isWater(nx, nz), probeIn = inArea(armedArea, nx, nz);
      if (!probeWet && probeIn) {
        /* LANDFALL (design 3.3): a dry probe INSIDE the
           harbour is the beaching trigger, not a wall. When
           a standable disembark point resolves, the ride
           ends here: the craft stops afloat at the body's
           pose (the hull does not climb), and the rider is
           placed ashore at the resolved point - reaching
           land IS the disembark, no key at any point. No
           resolution (a building cell, a non-standable
           edge) falls through to the v1 blocked-stop. */
        var dp = resolveDisembark(nx, nz);
        if (dp) {
          craft.x = p.x; craft.z = p.z; craft.face = heading;
          finishRide('beached');
          placeRider(dp.x, dp.z);
          toast('배가 해안에 닿았습니다');
          syncBoatVisual(true);
          prevPose = { x: p.x, y: p.y, z: p.z }; lastPose = prevPose;
          return;
        }
        blockedByWater = true; craft.speed = 0;
      } else if (!probeWet || !probeIn) {
        /* a wet probe outside the area, or a dry probe
           outside it (the bake's patch edges beyond the
           north/west bounds read as land): the v1 blocked
           stop, exactly - the area bound decides those
           edges, never the class beyond them (design 2) */
        blockedByWater = true; craft.speed = 0;
      }
    }
    if (!blockedByWater && (manual || autoDir) && craft.speed > 3 && measured < 0.8) {
      stallTime += dt;
      if (stallTime > 1.0) { blockedByWater = true; craft.speed = 0; stallTime = 0; }
    } else {
      stallTime = 0;
    }

    if (manual && !blockedByWater) {
      if (joyInjected) clearJoy();
      craft.speed = Math.min(TOP_SPEED, craft.speed + ACCEL * dt);
    } else if (autoDir && !blockedByWater) {
      /* the course's own input: the camera-relative joy
         vector in the leg's direction, injected exactly as
         the coast injection below injects the heading - the
         walk pipeline swims the body along it and the lever
         (derived from the speed state further down) holds
         the course at COURSE_SPEED */
      var aix = autoDir.x * R.x + autoDir.z * R.z;
      var aiz = -(autoDir.x * F.x + autoDir.z * F.z);
      window.__joyVec = { x: aix, y: aiz };
      joyInjected = { x: aix, y: aiz };
      craft.speed = Math.min(COURSE_SPEED, craft.speed + ACCEL * dt);
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
        arrival: craft.mode === 'arriving',
        courseLeg: course ? course.i : null,
        arrivalSpawn: armedSpawn ? { x: armedSpawn.x, z: armedSpawn.z } : null,
        mooring: armedMooring ? { x: armedMooring.x, z: armedMooring.z, face: armedMooring.face } : null,
        area: armedArea ? { x0: armedArea.x0, x1: armedArea.x1, z0: armedArea.z0, z1: armedArea.z1 } : null,
        model: BOAT_GLB ? 'glb' : 'primitives-interim'
      };
    },
    board: board,
    alight: alight,
    guideToBoat: guideToBoat,
    guideMooring: guideMooring,
    mooring: function () { return armedMooring ? { x: armedMooring.x, z: armedMooring.z, face: armedMooring.face } : null; },
    /* the sharing seam's receiving half (v1: no relay calls it) */
    _applyRemoteState: applyRemoteState
  };
})();
