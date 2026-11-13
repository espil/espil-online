/* __espilVehicles v1 - the VEHICLES system (espil.online room,
   2026-11-11). Build 4 of the large update, after the cash shop,
   the arena and the story chain. Design:
   espil-online-room/vehicles/DESIGN-v1.md (Han decisions
   2026-11-09 + the B-key ruling 2026-11-10).

   WHAT THIS MODULE OWNS
   • The dealership point (a glowing marker on the open lot south
     of the Art Gallery plaza, DEALER below) and the car panel.
     The panel is a self-contained DOM in the panels/cashshop
     palette - panels.js is NOT edited (the design text names
     "the car panel (panels.js)"; the panel ships inside this
     module instead so the D&D Phase B line, which owns
     panels.js next, has zero contention with this build - the
     deviation is recorded in the build report).
   • The one v1 car: 씨엘로 (Cielo) - Leo 3,000 (LOCKED, design
     section 1), top speed 54 m/s (LOCKED, design section 2 -
     2.5x the 21.6 m/s run). The display name is NEVER "Civic"
     (Han's naming rule). The model is Kenney Car Kit 3.1's
     generic sedan, CC0 (assets/vehicles/sedan.glb + LICENSE.txt
     in-tree, the KayKit placeholder precedent).
   • The purchase gate: the dealership opens only when the story
     chain's Q4 is complete - this module only READS
     window.__espilStoryState().dealershipUnlocked, the hook the
     story build left for it; it never writes story state.
   • Ownership: localStorage espil_car_v1 { v, owned, active,
     out, parked:{x,z,face} } - local-first per the design, the
     same shape account storage will adopt later. Persistence
     follows the story module's standing rule: LOGGED-IN users
     (server-marked session, __espilAuthState / the {id, at,
     server:true} record) read and write the key; GUESTS keep
     ownership in memory only and never write it (the design
     section 1 leaves the guest non-quest data boundary
     undecided and applies that undecided state to vehicles
     too; a stored record is never deleted by a guest boot - it
     may belong to the account on this browser).
   • Controls (Han, 2026-11-10): B is the ride key - summon /
     board toggle. Pressing B on foot with a car owned brings
     the car beside the player (summoned to the nearest empty
     spot, design section 3) and boards it in the same press;
     B while driving alights and parks the car where it stands.
     With NO car owned, B does nothing at all. Use (the interact
     key) near the parked car also boards; Use at the marker
     opens the dealership panel.
     B-KEY SUPERSESSION, stated plainly: the monolith's own
     keydown handler binds B to the Batch G fly/ride TEST
     vehicle (summonVehicle). Han's 2026-11-10 ruling gives B
     to the car, so while this module is resident its capture-
     phase B listener consumes the key in-map and the fly
     summon never fires (the fly code itself is untouched; it
     stays reachable only while this module is not loaded, and
     if a fly ride is already active the B press is passed
     through so the flyer can still release). Removing this
     module restores the old B behaviour exactly.
   • Driving model: the car drives THROUGH the game's own walk
     pipeline - this module steers the two window levers the
     monolith already reads every frame (window.__espil
     SpeedBoost for speed, window.__joyVec for the coast
     injection), so building collision, ground support, chunk
     streaming and the 5 km boundary are the game's own, not a
     fork. Speed is a state of this module: it accelerates at
     ACCEL toward the 54 m/s cap while a move input is held,
     coasts down at DECEL when the input is released (the
     design's deceleration), and a feedback loop on the measured
     body speed keeps the cap honest against tree-boosted run
     speeds. Buildings stop the car: the body collision stops
     the body, and a blocked nose probe at ~0 measured speed
     zeroes the car's speed state (state().blockedByBuilding).
   • Combat lock (design section 2): while driving, attacks and
     skills cannot fire - the keyboard skill row is swallowed
     in the capture phase and window.__espilSkills.move (the
     HUD/quickslot funnel, === the monolith's doMove) is wrapped
     with a driving check, the story module's wrapCraft
     precedent. Jump is likewise swallowed while driving (the
     interact key stays live - see the input section). There
     is NO car kill credit in v1: a driving
     player simply has no attack path, and body contact with a
     monster does nothing.
   • Interiors: a car never enters a building. If the player
     enters an interior (window.__espilInside appears - the
     shared interior, a routed store, or the arena space) while
     driving, the car auto-parks at the last outdoor position
     (design section 2). Summoning indoors is refused (B is a
     no-op inside). Death while driving alights and parks.
   • The rider: the avatar stays the game's own; while driving
     this module finds the avatar group in the scene (the group
     at the player's own position carrying skinned meshes or
     sprites - the masters, the KayKit placeholder and the
     sprite builder all match) and hides it, restoring it on
     alight; if the scan finds nothing the avatar simply stays
     visible inside the car body (fallback, no error).
   • NOT in v1 (design scope): other players seeing the parked
     car (the design marks it draft - presence sync is its own
     line), wheel-spin / shadow / light dressing (the design
     excludes presentation dressing in v1), a mobile drive
     button (the HUD line owns buttons; B and Use are keyboard
     controls here), car paint / wrapping (a cash-shop fashion
     candidate in the design, not built).

   Hooks: window.__espilVehicles = { state(), buy(),
   openDealership(), closeDealership(), pressB(), board(),
   alight(), store(), summon(), dealership() }.
   Module sources are TAGLESS (house rule) - no script tags. */
(function () {
  'use strict';
  if (window.__espilVehicles) return;

  /* ================= constants ================= */
  var LS_KEY = 'espil_car_v1';
  var LEO_KEY = 'espil_leo_balance';
  var CAR = { id: 'cielo', name: '씨엘로', en: 'Cielo', price: 3000, topSpeed: 54, glb: 'assets/vehicles/sedan.glb' };
  var CAR_LENGTH_M = 3.7;          /* in-world length after scale-up (asset is ~2.55 m) */
  var ACCEL = 16;                  /* m/s^2 - a few seconds to top speed (design draft) */
  var DECEL = 26;                  /* m/s^2 coast-down when the input is released */
  var TURN_RATE = 3.4;             /* rad/s - the car's smoothed rotation feel */
  var DEALER = { x: 3, z: 78 };    /* open lot south of the Art Gallery plaza (collision-probed clear, +-6 m grid) */
  var DEALER_DISPLAY = { x: 9.5, z: 78, face: -Math.PI / 2 };
  var DEALER_PARK = { x: -3.5, z: 78, face: Math.PI / 2 };
  var PANEL_RANGE = 4.5;
  var BOARD_RANGE = 4.2;
  var SUMMON_RADII = [5, 6.5, 8, 10];

  /* ================= small helpers (story/cashshop pattern) == */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
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
  function leoBalance() { var n = parseInt(localStorage.getItem(LEO_KEY), 10); return isFinite(n) ? n : 1000; }
  function leoAdd(n) { try { localStorage.setItem(LEO_KEY, String(leoBalance() + n)); } catch (e) {} }
  function toast(msg) { try { if (window.__espilToast) window.__espilToast(msg); } catch (e) {} }
  function blocked(x, z) {
    try {
      var r = window.__espilCollisionProbe && window.__espilCollisionProbe(x, z);
      if (!r) return false;
      if (typeof r === 'object') return !!r.blocked;
      return !!r;
    } catch (e) { return false; }
  }
  function swimmable(x, z) {
    try {
      var r = window.__espilCollisionProbe && window.__espilCollisionProbe(x, z);
      return !!(r && r.swimmable);
    } catch (e) { return false; }
  }
  function dealershipUnlocked() {
    try { var st = window.__espilStoryState && window.__espilStoryState(); return !!(st && st.dealershipUnlocked); } catch (e) { return false; }
  }
  function flyActive() {
    try { var f = window.__espilFlyState && window.__espilFlyState(); return !!(f && (f.flying || f.falling)); } catch (e) { return false; }
  }
  function playerDead() {
    try { var ss = window.__espilSkills && window.__espilSkills.state; return !!(ss && ss.hp <= 0); } catch (e) { return false; }
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
  function keybinds() {
    var kb = { jump: 'Shift', interact: ' ', stall: 'y' };
    try { var s = JSON.parse(localStorage.getItem('espil_keybinds') || 'null'); if (s && s.jump && s.interact && s.stall) kb = s; } catch (e) {}
    return kb;
  }
  function typingNow() {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    return /INPUT|TEXTAREA|SELECT/.test(tag) || !!(ae && ae.isContentEditable);
  }

  /* ================= ownership record ================= */
  var persisted = signedIn();
  function blankRec() { return { v: 1, owned: [], active: null, out: false, parked: null }; }
  var rec = blankRec();
  if (persisted) {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (raw && raw.v === 1 && Array.isArray(raw.owned)) {
        rec = { v: 1, owned: raw.owned.slice(), active: raw.active || null, out: !!raw.out, parked: raw.parked || null };
      }
    } catch (e) {}
  }
  function save() {
    if (!persisted) return;   /* guests: session memory only */
    try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch (e) {}
  }
  function ownsCar() { return rec.owned.indexOf(CAR.id) >= 0; }

  /* ================= runtime state ================= */
  var mode = 'stored';           /* 'stored' | 'parked' | 'driving' */
  if (rec.out && rec.parked) mode = 'parked';
  var speed = 0;                 /* the car's own speed state, m/s */
  var heading = rec.parked ? (rec.parked.face || 0) : 0;  /* angle; vector = (sin h, cos h) */
  var boost = null;              /* current __espilSpeedBoost value while driving */
  var boostCorr = 1;             /* feedback correction factor on (speed / 21.6) */
  var stallTime = 0;             /* game-seconds of input-held-but-body-stopped */
  var priorBoost;                /* the boost value found at board time, restored at alight */
  var boostOwned = false;
  var measured = 0;              /* smoothed measured body speed, m/s */
  var lastPose = null, prevPose = null;
  var lastOutdoorPose = null;
  var joyInjected = null;        /* {x, y} values this module last wrote to __joyVec */
  var blockedByBuilding = false;
  var carGroup = null, displayGroup = null, markerGroup = null;
  var glbTemplate = null, glbLoading = false;
  var builtScene = null;
  var avatarGroupRef = null, avatarHidden = false;
  var saveThrottle = 0;
  var moveToastAt = 0;

  /* ================= DOM (dealership panel + prompt) ========= */
  var winEl = null, bodyEl = null, msgEl = null, balEl = null, promptEl = null;
  function ensureDom() {
    if (winEl) return;
    var st = document.createElement('style');
    st.id = 'espil-veh-style';
    st.textContent =
      '#espil-veh-window{position:fixed;inset:0;z-index:9990;display:none;align-items:center;justify-content:center;background:rgba(10,6,4,.55)}' +
      '#espil-veh-window.open{display:flex}' +
      '.evw-card{background:linear-gradient(180deg,#3a2a1c,#241a10);border:2px solid #8a6a44;border-radius:14px;' +
      'width:min(560px,94vw);max-height:88vh;overflow:auto;padding:20px 22px;color:#f2e3c2;font-family:sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
      '.evw-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.evw-title{font-size:22px;font-weight:800;color:#ffe9bd}' +
      '.evw-bal{font-size:15px;font-weight:700;color:#ffd76a}' +
      '.evw-close{border:1px solid #8a6a44;background:#57402a;color:#ffe9bd;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700}' +
      '.evw-item{border:1px solid #57402a;border-radius:10px;padding:14px;background:rgba(0,0,0,.22);margin-top:10px}' +
      '.evw-name{font-weight:800;font-size:18px;color:#ffe9bd}' +
      '.evw-kr{font-size:12px;color:#b8a888;margin-top:2px}' +
      '.evw-blurb{font-size:13px;line-height:1.55;color:#d8c49a;margin:8px 0 10px}' +
      '.evw-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}' +
      '.evw-price{font-weight:800;color:#ffd76a;font-size:16px}' +
      '.evw-buy{border:1px solid #c9a227;background:#6d5836;color:#ffe9bd;border-radius:8px;padding:8px 16px;cursor:pointer;font-weight:700}' +
      '.evw-buy[disabled]{opacity:.45;cursor:not-allowed}' +
      '.evw-owned{font-size:13px;font-weight:700;color:#9fd48a}' +
      '.evw-msg{min-height:20px;font-size:13px;margin-top:10px;color:#ffd76a}' +
      '.evw-msg.err{color:#ff9d9d}' +
      '.evw-note{font-size:12px;color:#b8a888;line-height:1.55;margin-top:10px}' +
      '#espil-veh-prompt{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:9000;display:none;' +
      'padding:7px 16px;border-radius:999px;border:1px solid #c9a227;background:rgba(20,14,8,.82);color:#ffe9bd;' +
      'font-family:sans-serif;font-size:13px;font-weight:700;letter-spacing:.4px;pointer-events:none}' +
      '#espil-veh-prompt.show{display:block}';
    document.head.appendChild(st);

    winEl = document.createElement('div');
    winEl.id = 'espil-veh-window';
    winEl.setAttribute('aria-hidden', 'true');
    winEl.innerHTML =
      '<div class="evw-card" role="dialog" aria-label="Vehicle Dealership">' +
      '<div class="evw-head"><div class="evw-title">차량 딜러십</div>' +
      '<div><span class="evw-bal" id="espil-veh-bal"></span> ' +
      '<button class="evw-close" id="espil-veh-close" type="button">닫기</button></div></div>' +
      '<div id="espil-veh-body"></div>' +
      '<div class="evw-msg" id="espil-veh-msg"></div>' +
      '<p class="evw-note">탑승과 소환은 B 키입니다. 차가 없으면 B 키는 동작하지 않습니다. ' +
      '운전 중에는 공격과 스킬을 쓸 수 없고, 건물에 부딪히면 차가 멈춥니다. 실내에 들어가면 차는 자동으로 밖에 주차됩니다.</p>' +
      '</div>';
    document.body.appendChild(winEl);
    balEl = winEl.querySelector('#espil-veh-bal');
    bodyEl = winEl.querySelector('#espil-veh-body');
    msgEl = winEl.querySelector('#espil-veh-msg');
    winEl.querySelector('#espil-veh-close').addEventListener('click', function () { closeDealership(); });
    winEl.addEventListener('click', function (e) { if (e.target === winEl) closeDealership(); });

    promptEl = document.createElement('div');
    promptEl.id = 'espil-veh-prompt';
    document.body.appendChild(promptEl);
  }
  function setMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'evw-msg' + (isErr ? ' err' : '');
  }
  function renderPanel() {
    if (!winEl || !winEl.classList.contains('open')) return;
    if (balEl) balEl.textContent = '보유 Leo ' + leoBalance().toLocaleString('en-US');
    if (!bodyEl) return;
    var unlocked = dealershipUnlocked();
    var html = '';
    if (!unlocked) {
      html = '<div class="evw-item"><div class="evw-name">' + esc(CAR.name) + '</div>' +
        '<div class="evw-kr">' + esc(CAR.en) + ' · 컴팩트 세단</div>' +
        '<p class="evw-blurb">딜러십은 아직 열리지 않았습니다. 스토리 퀘스트 4 \'항구의 전언\'을 완료하면 이곳에서 첫 차를 살 수 있습니다.</p>' +
        '<div class="evw-row"><span class="evw-price">Leo ' + CAR.price.toLocaleString('en-US') + '</span>' +
        '<span class="evw-kr">판매 대기 중</span></div></div>';
    } else if (!ownsCar()) {
      html = '<div class="evw-item"><div class="evw-name">' + esc(CAR.name) + '</div>' +
        '<div class="evw-kr">' + esc(CAR.en) + ' · 컴팩트 세단 · 최고 속도 ' + CAR.topSpeed + ' m/s</div>' +
        '<p class="evw-blurb">첫 차입니다. 도보 달리기의 2.5배로 도시를 가로지릅니다. 주차 위치는 저장되어 다시 접속해도 그 자리에 있습니다.</p>' +
        '<div class="evw-row"><span class="evw-price">Leo ' + CAR.price.toLocaleString('en-US') + '</span>' +
        '<button class="evw-buy" id="espil-veh-buy" type="button">구매하기</button></div></div>';
    } else {
      var where = mode === 'driving' ? '운전 중' : (mode === 'parked' && rec.parked ? '주차됨 (' + Math.round(rec.parked.x) + ', ' + Math.round(rec.parked.z) + ')' : '보관 중');
      html = '<div class="evw-item"><div class="evw-name">' + esc(CAR.name) + '</div>' +
        '<div class="evw-kr">' + esc(CAR.en) + ' · 보유 중 · ' + esc(where) + '</div>' +
        '<p class="evw-blurb">B 키로 소환하고 탑승합니다. 운전 중 B 키를 다시 누르면 그 자리에 주차합니다.</p>' +
        '<div class="evw-row"><span class="evw-owned">구매 완료</span>' +
        (mode !== 'driving' && rec.out ? '<button class="evw-buy" id="espil-veh-store" type="button">차 보관하기</button>' : '') +
        '</div></div>';
    }
    bodyEl.innerHTML = html;
    var buyBtn = $('espil-veh-buy');
    if (buyBtn) buyBtn.addEventListener('click', function () {
      var r = buy();
      if (r.ok) { setMsg('씨엘로를 구매했습니다. 딜러십 앞에 주차되어 있습니다. B 키로 탑승하세요.'); }
      else if (r.why === 'funds') { setMsg('Leo가 부족합니다. 필요 Leo ' + CAR.price.toLocaleString('en-US') + ' · 보유 Leo ' + leoBalance().toLocaleString('en-US'), true); }
      else if (r.why === 'locked') { setMsg('딜러십이 아직 열리지 않았습니다.', true); }
      else if (r.why === 'owned') { setMsg('이미 보유한 차량입니다.', true); }
      renderPanel();
    });
    var storeBtn = $('espil-veh-store');
    if (storeBtn) storeBtn.addEventListener('click', function () { store(); setMsg('차를 보관했습니다. B 키로 다시 소환할 수 있습니다.'); renderPanel(); });
  }
  function openDealership() {
    ensureDom();
    winEl.classList.add('open');
    winEl.setAttribute('aria-hidden', 'false');
    setMsg('');
    renderPanel();
  }
  function closeDealership() {
    if (!winEl) return;
    winEl.classList.remove('open');
    winEl.setAttribute('aria-hidden', 'true');
  }
  function panelOpen() { return !!(winEl && winEl.classList.contains('open')); }

  /* ================= purchase ================= */
  function buy() {
    if (!dealershipUnlocked()) return { ok: false, why: 'locked' };
    if (ownsCar()) return { ok: false, why: 'owned' };
    if (leoBalance() < CAR.price) return { ok: false, why: 'funds' };
    leoAdd(-CAR.price);
    rec.owned.push(CAR.id);
    rec.active = CAR.id;
    rec.out = true;
    rec.parked = { x: DEALER_PARK.x, z: DEALER_PARK.z, face: DEALER_PARK.face };
    heading = DEALER_PARK.face;
    mode = 'parked';
    save();
    syncCarVisual(true);
    return { ok: true };
  }

  /* ================= 3D: marker, display car, own car ======== */
  function loadGlb(cb) {
    if (glbTemplate) { cb(glbTemplate); return; }
    if (glbLoading) { setTimeout(function () { loadGlb(cb); }, 300); return; }
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return;
    glbLoading = true;
    new THREE.GLTFLoader().load(CAR.glb, function (gltf) {
      glbLoading = false;
      glbTemplate = gltf.scene;
      cb(glbTemplate);
    }, undefined, function () { glbLoading = false; });
  }
  function makeCarGroup() {
    var g = new THREE.Group();
    loadGlb(function (tpl) {
      var inner = tpl.clone(true);
      /* scale so the model's longest horizontal extent is CAR_LENGTH_M */
      var box = new THREE.Box3().setFromObject(inner);
      var size = box.getSize(new THREE.Vector3());
      var len = Math.max(size.x, size.z);
      var s = len > 0 ? CAR_LENGTH_M / len : 1;
      inner.scale.setScalar(s);
      /* re-ground: the model's floor sits at the box minimum */
      var box2 = new THREE.Box3().setFromObject(inner);
      inner.position.y -= box2.min.y;
      g.add(inner);
      g.userData.ready = true;
      g.userData.lenAxis = size.z >= size.x ? 'z' : 'x';
      g.userData.scale = s;
    });
    return g;
  }
  function makeLabel(lines) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 192;
    var g2 = c.getContext('2d');
    g2.fillStyle = 'rgba(12,8,4,0.72)';
    g2.beginPath();
    if (g2.roundRect) g2.roundRect(66, 16, 380, 160, 24); else g2.rect(66, 16, 380, 160);
    g2.fill();
    g2.strokeStyle = '#d9b45c'; g2.lineWidth = 5; g2.stroke();
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillStyle = '#ffe9b0'; g2.font = '700 58px sans-serif';
    g2.fillText(lines[0], 256, 74);
    g2.fillStyle = '#c9b48a'; g2.font = '36px sans-serif';
    g2.fillText(lines[1], 256, 132);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(4.6, 1.73, 1);
    return sp;
  }
  function buildWorld() {
    var scene = sceneRoot();
    if (!scene) return false;
    if (builtScene === scene && markerGroup) return true;
    builtScene = scene;
    markerGroup = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 2.05, 40),
      new THREE.MeshBasicMaterial({ color: 0xf2b63c, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    markerGroup.add(ring);
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.55, 3.4, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.y = 1.7;
    markerGroup.add(beam);
    var label = makeLabel(['딜러십', '씨엘로']);
    label.position.y = 3.1;
    markerGroup.add(label);
    markerGroup.position.set(DEALER.x, 0, DEALER.z);
    scene.add(markerGroup);
    displayGroup = makeCarGroup();
    displayGroup.position.set(DEALER_DISPLAY.x, 0.02, DEALER_DISPLAY.z);
    displayGroup.rotation.y = DEALER_DISPLAY.face;
    scene.add(displayGroup);
    carGroup = makeCarGroup();
    scene.add(carGroup);
    syncCarVisual(true);
    return true;
  }
  function syncCarVisual(force) {
    if (!carGroup) return;
    if (mode === 'stored' || !rec.out) { carGroup.visible = false; return; }
    carGroup.visible = true;
    if (mode === 'driving') {
      var p = playerPos();
      if (p) { carGroup.position.set(p.x, p.y, p.z); carGroup.rotation.y = heading; }
    } else if (rec.parked) {
      carGroup.position.set(rec.parked.x, 0.02, rec.parked.z);
      carGroup.rotation.y = rec.parked.face || 0;
    }
  }

  /* ================= rider avatar hide (best effort) ========= */
  function findAvatarGroup() {
    var scene = sceneRoot();
    var p = playerPos();
    if (!scene || !p) return null;
    var found = null;
    for (var i = 0; i < scene.children.length; i++) {
      var ch = scene.children[i];
      if (ch === carGroup || ch === displayGroup || ch === markerGroup) continue;
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
  function setBoost(v) {
    boost = v;
    window.__espilSpeedBoost = v;
  }
  function clearBoost() {
    if (boostOwned) {
      if (priorBoost === undefined) { try { delete window.__espilSpeedBoost; } catch (e) { window.__espilSpeedBoost = undefined; } }
      else window.__espilSpeedBoost = priorBoost;
    }
    boostOwned = false;
    boost = null;
  }
  function clearJoy() {
    if (joyInjected && window.__joyVec && Math.abs(window.__joyVec.x - joyInjected.x) < 0.001 && Math.abs(window.__joyVec.y - joyInjected.y) < 0.001) {
      window.__joyVec = { x: 0, y: 0 };
    }
    joyInjected = null;
  }
  var skillsWrapped = false;
  function wrapSkills() {
    if (skillsWrapped) return;
    var sk = window.__espilSkills;
    if (!sk || typeof sk.move !== 'function') return;
    var orig = sk.move;
    var wrapped = function (id) {
      if (mode === 'driving') {
        var now = Date.now();
        if (now - moveToastAt > 2500) { moveToastAt = now; toast('운전 중에는 공격할 수 없습니다'); }
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__espilVehWrapped = true;
    sk.move = wrapped;
    skillsWrapped = true;
  }

  /* ================= actions ================= */
  function summonSpot() {
    var p = playerPos();
    if (!p) return null;
    for (var ri = 0; ri < SUMMON_RADII.length; ri++) {
      var r = SUMMON_RADII[ri];
      for (var ai = 0; ai < 12; ai++) {
        var a = ai * Math.PI / 6;
        var x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        if (blocked(x, z) || swimmable(x, z)) continue;
        if (blocked(x + 1.7, z) || blocked(x - 1.7, z) || blocked(x, z + 1.7) || blocked(x, z - 1.7)) continue;
        return { x: x, z: z };
      }
    }
    return null;
  }
  function summon() {
    if (!ownsCar()) return { ok: false, why: 'nocar' };
    if (window.__espilInside) return { ok: false, why: 'inside' };
    var spot = summonSpot();
    if (!spot) { toast('주변에 차를 댈 빈 곳이 없습니다'); return { ok: false, why: 'nospace' }; }
    var p = playerPos();
    var face = p ? Math.atan2(p.x - spot.x, p.z - spot.z) : 0;
    rec.out = true;
    rec.parked = { x: spot.x, z: spot.z, face: face };
    heading = face;
    if (mode !== 'driving') mode = 'parked';
    save();
    syncCarVisual(true);
    return { ok: true, x: spot.x, z: spot.z };
  }
  function board() {
    if (!ownsCar()) return { ok: false, why: 'nocar' };
    if (window.__espilInside) return { ok: false, why: 'inside' };
    if (mode === 'driving') return { ok: true, already: true };
    if (!rec.out || !rec.parked) { var s = summon(); if (!s.ok) return s; }
    mode = 'driving';
    speed = 0; measured = 0; blockedByBuilding = false;
    boostCorr = 1; stallTime = 0;
    lastPose = null; prevPose = null;
    priorBoost = window.__espilSpeedBoost;
    boostOwned = true;
    boost = null;
    var p = playerPos();
    if (p && typeof p.a === 'number') heading = Math.atan2(-Math.sin(p.a), -Math.cos(p.a));
    if (rec.parked && typeof rec.parked.face === 'number') heading = rec.parked.face;
    wrapSkills();
    hideAvatar();
    toast('씨엘로에 탑승했습니다 (B: 내리기)');
    syncCarVisual(true);
    return { ok: true };
  }
  function alight(parkPose) {
    if (mode !== 'driving') return { ok: false, why: 'notdriving' };
    var p = parkPose || playerPos();
    mode = 'parked';
    if (p) {
      rec.out = true;
      rec.parked = { x: p.x, z: p.z, face: heading };
    }
    speed = 0; measured = 0;
    clearJoy();
    clearBoost();
    showAvatar();
    save();
    syncCarVisual(true);
    return { ok: true };
  }
  function store() {
    if (mode === 'driving') alight();
    mode = 'stored';
    rec.out = false;
    rec.parked = null;
    save();
    syncCarVisual(true);
    return { ok: true };
  }
  function pressB() {
    if (!inMap() || typingNow()) return { ok: false, why: 'context' };
    if (flyActive()) return { ok: false, why: 'fly' };   /* the caller lets the key through to the fly release */
    if (mode === 'driving') { var r = alight(); toast('주차했습니다'); return r; }
    if (!ownsCar()) return { ok: false, why: 'nocar' };
    if (window.__espilInside) return { ok: false, why: 'inside' };
    if (playerDead()) return { ok: false, why: 'dead' };
    /* on foot: if the car stands within board range, board it
       where it is; otherwise summon it beside the player first -
       either way this one press ends in the driver's seat. */
    var p = playerPos();
    if (rec.out && rec.parked && p) {
      var dx = p.x - rec.parked.x, dz = p.z - rec.parked.z;
      if (Math.sqrt(dx * dx + dz * dz) > BOARD_RANGE) { var s = summon(); if (!s.ok) return s; }
    } else {
      var s2 = summon(); if (!s2.ok) return s2;
    }
    return board();
  }

  /* ================= input ================= */
  var myArrows = { arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
  var SKILL_KEYS = { q: 1, w: 1, e: 1, r: 1, a: 1, s: 1, d: 1, f: 1 };
  document.addEventListener('keydown', function (e) {
    var lk = (e.key || '').toLowerCase();
    if (lk in myArrows) myArrows[lk] = true;
    if (!inMap() || typingNow()) return;
    if (lk === 'b' && !e.repeat) {
      if (flyActive()) return;              /* let the monolith release / re-summon the fly ride */
      e.stopPropagation();
      e.preventDefault();
      pressB();
      return;
    }
    if (mode !== 'driving') {
      var kb = keybinds();
      if (e.key === kb.interact && !e.repeat) {
        var p = playerPos();
        if (!p || window.__espilInside) return;
        var dd = Math.hypot(p.x - DEALER.x, p.z - DEALER.z);
        if (dd <= PANEL_RANGE) { e.stopPropagation(); e.preventDefault(); openDealership(); return; }
        if (rec.out && rec.parked) {
          var dc = Math.hypot(p.x - rec.parked.x, p.z - rec.parked.z);
          if (dc <= BOARD_RANGE) { e.stopPropagation(); e.preventDefault(); board(); return; }
        }
      }
      return;
    }
    /* driving: combat inputs and jump stay silent. The interact
       key is NOT swallowed - using a building while driving is
       the organic path into an interior, and the interior watch
       in the tick auto-parks the car there. */
    if (SKILL_KEYS[lk] || lk === 'shift') {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    var lk = (e.key || '').toLowerCase();
    if (lk in myArrows) myArrows[lk] = false;
  }, true);
  window.addEventListener('beforeunload', function () { if (mode === 'driving') { var p = playerPos(); if (p) { rec.out = true; rec.parked = { x: p.x, z: p.z, face: heading }; save(); } } });

  /* ================= driving tick ================= */
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
    buildWorld();
    wrapSkills();
    var p = playerPos();
    if (!p) return;
    /* interior / arena entry while driving: auto-park outside */
    if (window.__espilInside) {
      if (mode === 'driving') { alight(lastOutdoorPose || prevPose || p); toast('실내에서는 차를 주차합니다'); }
    } else {
      lastOutdoorPose = { x: p.x, y: p.y, z: p.z };
    }
    if (mode === 'driving' && playerDead()) { alight(p); }

    /* prompt chip */
    if (promptEl) {
      var txt = '';
      if (mode !== 'driving' && !window.__espilInside && !panelOpen()) {
        if (Math.hypot(p.x - DEALER.x, p.z - DEALER.z) <= PANEL_RANGE) txt = 'Space · 딜러십';
        else if (rec.out && rec.parked && Math.hypot(p.x - rec.parked.x, p.z - rec.parked.z) <= BOARD_RANGE) txt = 'Space · 탑승';
      }
      if (txt) { promptEl.textContent = txt; promptEl.classList.add('show'); }
      else promptEl.classList.remove('show');
    }
    if (markerGroup) { var s = 1 + Math.sin(nowMs / 600) * 0.05; markerGroup.scale.set(s, 1, s); }

    if (mode !== 'driving') { prevPose = { x: p.x, y: p.y, z: p.z }; lastPose = prevPose; syncCarVisual(false); return; }

    /* ---- driving ---- */
    var dt = Math.max(0.004, Math.min(0.05, wallDt));   /* the world's own dt clamp */
    var dist = lastPose ? Math.hypot(p.x - lastPose.x, p.z - lastPose.z) : 0;
    var instMeas = lastPose && dt > 0 ? dist / dt : 0;
    /* a pose jump far beyond the car's own physics (an entry /
       resume re-fire on this rig) is an artefact, not a speed -
       it never enters the measurement or the feedback */
    if (instMeas > 70) instMeas = measured;
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

    /* heading follows the measured travel direction, turned at a
       limited rate - the design's smoothed rotation feel */
    if (dist > 0.03 && lastPose) {
      var vx = (p.x - lastPose.x) / dist, vz = (p.z - lastPose.z) / dist;
      var want = Math.atan2(vx, vz);
      var dh = want - heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      heading += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, dh));
    }
    var hv = { x: Math.sin(heading), z: Math.cos(heading) };

    /* buildings stop the car: the body's own collision does the
       stopping; the speed state learns it two ways - a blocked
       nose probe at ~0 measured speed (fast path), or input held
       while the body demonstrably does not move for a full
       game-second (the polygon face and the collision-grid face
       do not always coincide, so the stall is the robust path) */
    blockedByBuilding = false;
    if (speed > 0) {
      var nx = p.x + hv.x * 2.3, nz = p.z + hv.z * 2.3;
      if (blocked(nx, nz) && measured < 1.0) { blockedByBuilding = true; speed = 0; }
    }
    if (!blockedByBuilding && manual && speed > 3 && measured < 0.8) {
      stallTime += dt;
      if (stallTime > 1.0) { blockedByBuilding = true; speed = 0; stallTime = 0; }
    } else {
      stallTime = 0;
    }

    if (manual) {
      if (joyInjected) clearJoy();
      speed = Math.min(CAR.topSpeed, speed + ACCEL * dt);
    } else if (speed > 0) {
      speed = Math.max(0, speed - DECEL * dt);
      if (speed > 0) {
        /* coast: keep rolling along the car's heading */
        var cix = hv.x * R.x + hv.z * R.z;
        var ciz = -(hv.x * F.x + hv.z * F.z);
        window.__joyVec = { x: cix, y: ciz };
        joyInjected = { x: cix, y: ciz };
      } else {
        clearJoy();
      }
    }
    if (speed > 0) {
      /* the lever is DERIVED from the speed state every tick
         (boost = speed / 21.6, the run the design's 2.5x is
         taken on); a slow multiplicative correction trims it
         against the measured body speed so tree-boosted run
         speeds cannot push the car past its cap. An earlier
         shape seeded the lever once and gated the correction
         on measured > 2 - a deadlock: too small a lever kept
         the body under the gate forever (found by
         diag_vehicles3: lever pinned at 0.065, body at
         1.4 m/s, speed state at 54). */
      if (measured > 2 && speed > 3) {
        boostCorr = Math.max(0.45, Math.min(2.2, boostCorr * Math.max(0.92, Math.min(1.08, speed / measured))));
      }
      boost = Math.max(0, Math.min(3.4, (speed / 21.6) * boostCorr));
      setBoost(boost);
    } else {
      /* the lever stays owned for the whole drive (restored at
         alight); at a standstill it simply reads zero */
      boost = null;
      window.__espilSpeedBoost = 0;
    }
    /* while driving, keep the parked record near the car (crash-safe) */
    saveThrottle += dt;
    if (saveThrottle > 2) {
      saveThrottle = 0;
      rec.out = true;
      rec.parked = { x: p.x, z: p.z, face: heading };
      save();
    }
    syncCarVisual(true);
    prevPose = { x: p.x, y: p.y, z: p.z };
    lastPose = prevPose;
  }
  requestAnimationFrame(tick);

  /* ================= public hook ================= */
  window.__espilVehicles = {
    state: function () {
      var p = playerPos();
      return {
        version: 1,
        mode: mode,
        owned: rec.owned.slice(),
        active: rec.active,
        out: rec.out,
        parked: rec.parked ? { x: rec.parked.x, z: rec.parked.z, face: rec.parked.face } : null,
        persisted: persisted,
        unlocked: dealershipUnlocked(),
        leo: leoBalance(),
        speed: speed,
        speedMeasured: measured,
        topSpeed: CAR.topSpeed,
        heading: heading,
        boost: boost,
        blockedByBuilding: blockedByBuilding,
        avatarHidden: avatarHidden,
        driving: mode === 'driving',
        player: p ? { x: p.x, y: p.y, z: p.z } : null,
        carPos: carGroup && carGroup.visible ? { x: carGroup.position.x, y: carGroup.position.y, z: carGroup.position.z } : null,
        carReady: !!(carGroup && carGroup.userData.ready),
        price: CAR.price,
        carName: CAR.name
      };
    },
    buy: buy,
    openDealership: openDealership,
    closeDealership: closeDealership,
    pressB: pressB,
    board: board,
    alight: function () { return alight(); },
    store: store,
    summon: summon,
    dealership: function () { return { x: DEALER.x, z: DEALER.z, display: DEALER_DISPLAY, park: DEALER_PARK }; }
  };
})();
