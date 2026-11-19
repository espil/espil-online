/* __espilCustomizer v1 - character look DATA hooks only.
   History: this module was the pair's own look customizer
   (Han 2026-10-28): it injected skin-tone / hair-style /
   hair-colour / outfit-colour pickers into the #char-custom gate
   panel, with a live painted preview, and an in-game edit mode
   behind the profile window's Customize button
   (window.__espilOpenCustomizer).
   Han 2026-11-04: that selection UI is REMOVED - the web
   character step is the REAL default character with the male /
   female cards only. No face, hairstyle or clothes selection
   remains anywhere in the web flow, and no editor opens from
   any trigger. What stays in this module is data support only:
   • window.__espilPendingLook() now returns the DEFAULT look
     for the gender picked on the cards, so the gate's confirm
     keeps writing the espil_character record in its usual shape
     ({gender, name, look, ts}) with default values.
   • window.__espilPaintLook / __espilOutfitHex stay as pure
     painters of a SAVED record's look (the profile portrait,
     the nameplate accent for peers) - they render data, they
     select nothing.
   • window.__espilOpenCustomizer stays defined as a NO-OP, so
     the profile Customize button and the custmerge wrapper land
     on a dead end instead of an editor.
   Han 2026-11-16 (first-setup-once batch): the no-op becomes a
   LOCK-INFO panel. After sign-up the character is set once at
   the gate; afterwards appearance changes go through the store
   only, so the profile button now shows the standing body, the
   setup state and the held appearance-change tickets, with a
   button into the cash shop. It still opens NO editor - the
   gate stays the only place a body is ever picked.
   The v3 customizer merge (custmerge.js + customizer.html) is
   suspended separately by its own flag (Batch D2) and is not
   touched here. __espilCustomizer END */
(function () {
  'use strict';
  if (window.__espilCustomizer) return;
  window.__espilCustomizer = true;

  var SK = ['#ffe3c2', '#f2c49b', '#dca26b', '#a8703c', '#6f4525'];
  var HC = ['#3a2a1c', '#7a4a2b', '#b3764a', '#e3c188', '#ececec', '#23262b', '#c94f4f', '#4a6ac9', '#5da873'];
  var OF = ['#3f7fbf', '#c94f4f', '#57a773', '#e0a83c', '#7a5fc0', '#e77fc0', '#37b8a5', '#e8e4da'];

  function clampIdx(v, max, dflt) { return (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max) ? Math.floor(v) : dflt; }
  function sanitize(lk, gender) {
    lk = lk || {};
    return {
      skin: clampIdx(lk.skin, 4, 1),
      hair: clampIdx(lk.hair, 3, 0),
      hairColor: clampIdx(lk.hairColor, 8, gender === 'female' ? 1 : 0),
      outfit: clampIdx(lk.outfit, 7, 0)
    };
  }

  /* ---- the portrait painter (112-space; same recipe as the
     profile panel and the social card) - renders a saved look,
     unchanged from the selection era ---- */
  function paintInto(c, gender, look) {
    var lk = look || {};
    var skin = SK[typeof lk.skin === 'number' ? lk.skin : 1] || SK[1];
    var hairCol = HC[typeof lk.hairColor === 'number' ? lk.hairColor : (gender === 'f' ? 1 : 0)] || HC[0];
    var outfit = OF[typeof lk.outfit === 'number' ? lk.outfit : 0] || OF[0];
    var hs = typeof lk.hair === 'number' ? lk.hair : 0;
    var f = (gender === 'f' || gender === 'female');
    c.clearRect(0, 0, 112, 112);
    c.save(); c.beginPath(); c.arc(56, 56, 54, 0, Math.PI * 2); c.clip();
    var grd = c.createLinearGradient(0, 0, 0, 112); grd.addColorStop(0, '#1d4256'); grd.addColorStop(1, '#12242f');
    c.fillStyle = grd; c.fillRect(0, 0, 112, 112);
    c.fillStyle = outfit; c.beginPath(); c.moveTo(22, 112); c.quadraticCurveTo(56, 82, 90, 112); c.closePath(); c.fill();
    c.fillStyle = skin; c.fillRect(50, 74, 12, 16);
    c.beginPath(); c.arc(56, 58, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = hairCol;
    if (f) {
      if (hs === 3) { c.beginPath(); c.arc(56, 28, 9, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.arc(56, 40, 27, Math.PI, Math.PI * 2); c.fill();
      if (hs === 0) { c.fillRect(27, 40, 11, 42); c.fillRect(74, 40, 11, 42); }
      else if (hs === 1) { c.fillRect(28, 40, 10, 25); c.fillRect(74, 40, 10, 25); }
      else if (hs === 2) { c.fillRect(77, 38, 9, 36); }
    } else {
      if (hs === 1) { c.beginPath(); c.moveTo(31, 42); c.lineTo(37, 25); c.lineTo(45, 36); c.lineTo(53, 23); c.lineTo(61, 36); c.lineTo(69, 25); c.lineTo(77, 38); c.lineTo(83, 43); c.lineTo(31, 43); c.closePath(); c.fill(); }
      else if (hs === 2) { c.beginPath(); c.arc(56, 47, 25, Math.PI, Math.PI * 2); c.fill(); }
      else if (hs === 3) { c.beginPath(); c.arc(52, 40, 27, Math.PI, Math.PI * 2); c.fill(); c.fillRect(66, 36, 12, 13); }
      else { c.beginPath(); c.arc(56, 40, 27, Math.PI, Math.PI * 2); c.fill(); }
    }
    c.fillStyle = '#22303a';
    c.beginPath(); c.arc(47, 58, 3, 0, Math.PI * 2); c.arc(65, 58, 3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b3764a'; c.lineWidth = 2; c.beginPath(); c.arc(56, 64, 8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.restore();
  }

  function selectedCardGender() {
    var sel = document.querySelector('.char-card.is-selected');
    return (sel && sel.getAttribute('data-gender') === 'female') ? 'female' : 'male';
  }
  function defaultLook(gender) { return sanitize(null, gender); }

  /* ---- data hooks (no UI is built, no editor ever opens) ---- */
  window.__espilPendingLook = function () { return defaultLook(selectedCardGender()); };
  window.__espilOutfitHex = function (i) { return OF[clampIdx(i, 7, 0)]; };
  window.__espilPaintLook = function (cv, gender, look) {
    if (!cv) return;
    var c = cv.getContext('2d'); if (!c) return;
    paintInto(c, gender, look);
  };
  /* ---- first-setup state (Han 2026-11-16) ----
     Mirrors the gate's reading: the server record is the truth,
     espil_character.setupDone is its device mirror, and the
     ticket count lives in the cash ledger (read through
     __espilCash when the arrival bundle has loaded it, from
     the ledger store directly otherwise - read-only either way). */
  function charSetupState() {
    var guest = true, rec = null;
    try { guest = !localStorage.getItem('espil_session_v1'); } catch (e) {}
    try { rec = JSON.parse(localStorage.getItem('espil_character') || 'null'); } catch (e) {}
    var held = 0;
    if (window.__espilCash && window.__espilCash.state) {
      try { held = window.__espilCash.state().entitlements.bodyChanges || 0; } catch (e) {}
    } else {
      try {
        var l = JSON.parse(localStorage.getItem('espil_cash_v1') || 'null');
        var n = l && l.entitlements ? Number(l.entitlements.bodyChanges) : 0;
        held = isFinite(n) && n > 0 ? Math.floor(n) : 0;
      } catch (e) {}
    }
    var setupDone = !guest && !!(rec && rec.setupDone === true);
    return { guest: guest, rec: (rec && typeof rec === 'object') ? rec : null,
             setupDone: setupDone, bodyChanges: held, locked: setupDone && held <= 0 };
  }
  function standingBodyLabel(st) {
    /* Owner-only designated body (Han 2026-11-17): the standing
       record names the designation when the server-marked
       session record carries it - the label reads the session
       record, never espil_character (which never carries the
       reserved value). */
    try {
      var ses = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      if (ses && ses.server === true && ses.designatedBody === 'lunaris') return 'Lunaris';
    } catch (e) {}
    var rec = st.rec || {};
    var gender = (rec.gender === 'female' || rec.gender === 'male') ? rec.gender : selectedCardGender();
    var bc = (typeof rec.bodyChoice === 'string' && /^(master|style[1-4])$/.test(rec.bodyChoice))
      ? rec.bodyChoice : (st.guest ? 'style1' : 'master');
    return (gender === 'female' ? 'Female' : 'Male') + ' · ' + (bc === 'master' ? 'Master' : 'Style ' + bc.slice(-1));
  }

  /* ---- the lock-info panel (no editor, ever) ---- */
  var lockPanel = null;
  function ensureLockPanel() {
    if (lockPanel) return lockPanel;
    var st = document.createElement('style');
    st.id = 'espil-cust-lock-style';
    st.textContent =
      '#espil-cust-lock{position:fixed;inset:0;z-index:9995;display:none;align-items:center;justify-content:center;background:rgba(10,6,4,.55)}' +
      '#espil-cust-lock.open{display:flex}' +
      '.ecl-card{background:linear-gradient(180deg,#fffbf0,#fff3dc);border:2px solid #d9b380;border-radius:14px;width:min(430px,92vw);' +
      'padding:20px 22px;color:#5a4020;font-family:Manrope,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)}' +
      '.ecl-title{font-size:19px;font-weight:800;color:#6b4a1f;margin-bottom:8px}' +
      '.ecl-body{font-size:15px;font-weight:700;margin-bottom:6px}' +
      '.ecl-line{font-size:13px;line-height:1.55;color:#7a5c33;margin-bottom:6px}' +
      '.ecl-row{display:flex;gap:8px;margin-top:14px}' +
      '.ecl-btn{flex:1;border:2px solid #d97f10;background:linear-gradient(180deg,#ffb84d,#f08c1a);color:#fff;font-weight:800;' +
      'border-radius:9px;padding:9px 10px;cursor:pointer;font-family:inherit;font-size:13px}' +
      '.ecl-btn.sub{background:#fffdf6;color:#5a4020;border-color:#cfa96f}';
    (document.head || document.documentElement).appendChild(st);
    var wrap = document.createElement('div');
    wrap.id = 'espil-cust-lock';
    wrap.innerHTML =
      '<div class="ecl-card" role="dialog" aria-label="캐릭터 외형">' +
      '<div class="ecl-title">캐릭터 외형</div>' +
      '<div class="ecl-body" id="ecl-body"></div>' +
      '<div class="ecl-line" id="ecl-status"></div>' +
      '<div class="ecl-line" id="ecl-tickets"></div>' +
      '<div class="ecl-row">' +
      '<button type="button" class="ecl-btn" id="ecl-shop">캐시 상점 열기</button>' +
      '<button type="button" class="ecl-btn sub" id="ecl-close">닫기</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeLockPanel(); });
    wrap.querySelector('#ecl-close').addEventListener('click', closeLockPanel);
    wrap.querySelector('#ecl-shop').addEventListener('click', function () {
      closeLockPanel();
      if (window.__espilCash && window.__espilCash.open) { window.__espilCash.open(); return; }
      /* The cash shop rides the arrival bundle; if it has not
         loaded yet on this page, pull it in directly. */
      var s = document.createElement('script');
      s.src = 'modules/cashshop.js';
      s.onload = function () { if (window.__espilCash && window.__espilCash.open) window.__espilCash.open(); };
      document.head.appendChild(s);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLockPanel(); });
    lockPanel = wrap;
    return wrap;
  }
  function closeLockPanel() { if (lockPanel) lockPanel.classList.remove('open'); }
  window.__espilOpenCustomizer = function () {
    var st = charSetupState();
    var p = ensureLockPanel();
    p.querySelector('#ecl-body').textContent = '현재 캐릭터: ' + standingBodyLabel(st);
    p.querySelector('#ecl-status').textContent = st.guest
      ? '게스트는 입장 화면에서 자유롭게 바꿀 수 있습니다.'
      : (st.setupDone
        ? '첫 설정이 완료되어 있습니다. 외형 변경은 변경권으로 입장 화면에서 가능합니다.'
        : '아직 첫 설정을 마치지 않았습니다. 입장 화면에서 캐릭터를 설정해 주세요.');
    p.querySelector('#ecl-tickets').textContent = '외형 변경권: ' + st.bodyChanges + '장';
    p.classList.add('open');
    return true;
  };
  window.__espilCustomizerState = function () {
    var g = selectedCardGender();
    var st = charSetupState();
    return { built: false, editMode: false, suspended: true, gender: g, look: defaultLook(g),
             setupDone: st.setupDone, bodyChanges: st.bodyChanges, guest: st.guest, locked: st.locked };
  };
})();
/* __espilCustomizer END */

/* __espilCustPreview v1 - live 3D preview in the character gate
   (Han 2026-11-17: the character must be VISIBLE in the
   customizer; when a style is picked a selection animation
   plays, and otherwise the idle animation loops).
   Appended as its own block; the data hooks above are untouched.

   Shape: a small self-contained stage (own renderer, scene,
   camera, lights) mounted inside the gate card above the body
   row. It reads the gate's PENDING selection from the DOM and
   the stored records - the same read-only recipes the gate
   itself uses - and never writes selection state: the gate's
   own handlers stay the only writers, this block only follows.

   Bodies:
   • style1-4 / kaykit: built by the game builders through
     window.__espilBuildGateAvatar (monolith), so the chibi
     template cache and its Basis/KTX2 machinery are shared,
     never forked, and no GLB is parsed twice.
   • master: loaded by this block (body file + the male idle
     file only). The game builder is NOT reused for the masters
     on purpose: buildWalkerAvatar starts the entry-descent
     clip loads whose completion flips
     window.__espilDescentClipsReady, and a gate preview must
     not fire entry machinery. Cost, stated plainly: the
     preview parses male.glb (15,999,984 B) or female_idle.glb
     (16,291,868 B) once per page; the game still parses its
     own copy at entry, exactly as it did before this block
     existed (the bytes come from the HTTP cache the second
     time; the parse is the added cost).
   • lunaris (designated accounts only): the designation is
     the server mark on the session record
     (espil_session_v1.designatedBody, mirrored by the
     entry-flow sync in the designation build; absent in builds
     without it, where this branch can never fire). The preview
     loads the serving GLB itself (assets/zealandia/lunaris.glb,
     1,171,248 B - the same bytes the Auckland NPC loads) with
     the player path's measured framing (scale 1.0, PI
     counter-rotation, span exactly 1.7000 m). No stored
     bodyChoice can reach this branch: it is checked before
     every other body source, and the allowlist values are
     never widened.

   Selection animation (per body, from the clip inventory):
   • lunaris: the serving GLB embeds a real Wave clip
     (4.133 s) - played once, then idle resumes.
   • master / chibi / kaykit: their sets hold NO wave-style
     one-shot (masters: embedded locomotion + Chat 5.2 s /
     Checkout 6.5 s action files; chibi: Idle/Walk/Run/
     WalkBasic/RunBasic only; KayKit likewise locomotion).
     Rather than mislabel a chat gesture, the selection
     feedback is a code-driven full turn + small hop on the
     preview pivot (0.85 s), stated as such here and in the
     build report.

   Lifecycle: the render loop runs ONLY while the gate is open
   (aria-hidden="false"); closing the gate cancels the RAF and
   resets the pivot. The one small WebGL context and the
   per-body entry cache stay allocated for the page's life -
   the gate reopens on every entry, and re-parsing the master
   bodies per open would cost far more than the idle context.
   Test hook: window.__espilCustPreviewState(). */
(function () {
  'use strict';
  if (window.__espilCustPreview) return;
  window.__espilCustPreview = true;

  var TURN_MS = 850;
  var pv = {
    mounted: false, open: false, raf: 0, lastTs: 0, primed: false,
    renderer: null, scene: null, camera: null, pivot: null, labelEl: null,
    sel: null, selKey: '', cur: null, cache: {}, gesture: null,
    waveTimer: 0, pollTimer: 0, resizeBound: false
  };

  /* ---------- read-only state recipes (mirror the gate's) ---------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsJson(k) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function isGuest() { return !lsGet('espil_session_v1'); }
  function designatedBody() {
    var s = lsJson('espil_session_v1');
    return (s && s.designatedBody === 'lunaris') ? 'lunaris' : null;
  }
  function guestBodyMode() {
    try { if (window.__espilGuestBodyState) return window.__espilGuestBodyState().mode; } catch (e) {}
    var w = window.__ESPIL_GUEST_BODY__;
    return (w === 'chibi' || w === 'kaykit' || w === 'sprite') ? w : 'chibi';
  }
  function domGender() {
    var sel = document.querySelector('#char-custom .char-card.is-selected');
    return (sel && sel.getAttribute('data-gender') === 'female') ? 'female' : 'male';
  }
  function savedBody(rec, guest) {
    var bc = rec && rec.bodyChoice;
    return (typeof bc === 'string' && /^(master|style[1-4])$/.test(bc)) ? bc : (guest ? 'style1' : 'master');
  }
  function currentSelection() {
    var guest = isGuest();
    var rec = lsJson('espil_character');
    var des = designatedBody();
    if (des) return { gender: domGender(), body: 'lunaris', designated: des, locked: true, guest: guest };
    var row = document.getElementById('char-body-row');
    var locked = false, body = null;
    if (row && row.querySelector('.char-body-lock')) { locked = true; body = savedBody(rec, guest); }
    else if (row && !row.hidden) {
      var card = row.querySelector('.char-body-card.is-selected');
      if (card) body = card.getAttribute('data-body');
    }
    if (!body) {
      /* Body row hidden: the guest-body revert modes. Mirror
         buildPlayerAvatar's routing for the pending gender. */
      var mode = guestBodyMode();
      if (guest) body = (mode === 'kaykit') ? 'kaykit' : (mode === 'sprite' ? 'sprite' : savedBody(rec, true));
      else body = (mode === 'chibi' && rec && /^style[1-4]$/.test(rec.bodyChoice || '')) ? rec.bodyChoice : 'master';
    }
    return { gender: domGender(), body: body, designated: null, locked: locked, guest: guest };
  }
  function selKeyOf(sel) { return sel.designated ? 'lunaris' : sel.gender + '|' + sel.body; }
  function bodyLabel(sel) {
    if (sel.designated) return 'Lunaris · 이 계정의 지정 캐릭터입니다';
    var g = sel.gender === 'female' ? 'Female' : 'Male';
    var b = sel.body === 'master' ? 'Master'
      : sel.body === 'kaykit' ? 'KayKit'
      : sel.body === 'sprite' ? 'Sprite'
      : 'Style ' + sel.body.slice(-1);
    return g + ' · ' + b;
  }

  /* ---------- body entries ---------- */
  function stripRootMotion(clip) {
    clip.tracks = clip.tracks.filter(function (t) {
      var n = (t.name || '').toLowerCase();
      var isPos = n.indexOf('.position') >= 0;
      var isRoot = /^(mixamorig[_:]?hips|hips|armature|root)/.test(n);
      return !(isPos && isRoot);
    });
    return clip;
  }
  function noCull(group) { group.traverse(function (o) { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; }); }

  /* Master entry: preview-owned loader (see the header for why
     the game builder is not reused). Mirrors buildWalkerAvatar's
     framing exactly: PI counter-rotation, 1.5x scale, bbox
     grounding; the embedded locomotion seeds the table and the
     male idle file takes over 'idle' when it lands. */
  function buildMasterEntry(gender) {
    var ent = { kind: 'master', ready: false, failed: false, group: new THREE.Group(), mixer: null, actions: {}, curAnim: null };
    var loader = new THREE.GLTFLoader();
    loader.load(gender === 'female' ? 'assets/character/female_idle.glb' : 'assets/character/male.glb', function (gltf) {
      try {
        var model = gltf.scene;
        model.rotation.y = Math.PI;
        model.scale.setScalar(1.5);
        var bbox = new THREE.Box3().setFromObject(model);
        model.position.y -= bbox.min.y;
        model.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        ent.group.add(model);
        var mixer = new THREE.AnimationMixer(model);
        ent.mixer = mixer;
        var clips = gltf.animations || [];
        function findClip(rx) { for (var i = 0; i < clips.length; i++) { if (rx.test(clips[i].name)) return clips[i]; } return null; }
        var idleClip = findClip(/baselayer|idle/i) || clips[0];
        if (idleClip) { ent.actions.idle = mixer.clipAction(idleClip); ent.actions.idle.play(); ent.curAnim = 'idle'; }
        try { mixer.update(0); } catch (e) {}
        ent.ready = true;
        if (gender === 'male') {
          loader.load('assets/character/male_idle.glb', function (g2) {
            var cs = g2.animations || [];
            if (!cs.length || !ent.mixer) return;
            var act = ent.mixer.clipAction(stripRootMotion(cs[0]));
            var old = ent.actions.idle;
            ent.actions.idle = act;
            if (ent.curAnim === 'idle') {
              act.reset().fadeIn(.15).play();
              if (old && old !== act) { old.fadeOut(.15); setTimeout(function () { try { old.stop(); } catch (e) {} }, 220); }
            }
          });
        }
      } catch (e) { ent.failed = true; }
    }, undefined, function () { ent.failed = true; });
    return ent;
  }

  /* Lunaris entry: preview-owned loader for the designated
     body (see the header). Idle = the embedded Idle clip;
     selection = the embedded Wave clip, once. */
  function buildLunarisEntry() {
    var ent = { kind: 'lunaris', ready: false, failed: false, group: new THREE.Group(), mixer: null, actions: {}, curAnim: null };
    var loader = new THREE.GLTFLoader();
    try { if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); } catch (e) {}
    loader.load('assets/zealandia/lunaris.glb', function (gltf) {
      try {
        var model = gltf.scene;
        model.rotation.y = Math.PI; /* authored +Z (Lunaris line's lab measurement) */
        var bbox = new THREE.Box3().setFromObject(model);
        model.position.y -= bbox.min.y; /* span is exactly 1.7000 m at scale 1.0 */
        model.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        ent.group.add(model);
        var mixer = new THREE.AnimationMixer(model);
        ent.mixer = mixer;
        (gltf.animations || []).forEach(function (clip) { ent.actions[clip.name] = mixer.clipAction(clip); });
        if (ent.actions.Idle) { ent.actions.Idle.play(); ent.curAnim = 'Idle'; }
        try { mixer.update(0); } catch (e) {}
        ent.ready = true;
      } catch (e) { ent.failed = true; }
    }, undefined, function () { ent.failed = true; });
    return ent;
  }

  /* Game-built entry (chibi / kaykit): the av object IS the
     entry - group, mixer, actions, playAnim all ride it. */
  function buildGameEntry(sel) {
    var av = null;
    try { av = window.__espilBuildGateAvatar ? window.__espilBuildGateAvatar(sel.gender, sel.body) : null; } catch (e) {}
    if (!av) return { kind: 'game', ready: false, failed: true, group: new THREE.Group(), mixer: null, actions: {}, curAnim: null, av: null };
    return { kind: 'game', ready: false, failed: false, group: av.group, av: av,
             get mixer() { return av.mixer; }, get actions() { return av.actions || {}; },
             get curAnim() { return av.curAnim; } };
  }
  function entryFor(sel) {
    var key = selKeyOf(sel);
    if (pv.cache[key]) return pv.cache[key];
    var ent;
    if (sel.designated) ent = buildLunarisEntry();
    else if (sel.body === 'master') ent = buildMasterEntry(sel.gender);
    else ent = buildGameEntry(sel);
    ent.key = key;
    pv.cache[key] = ent;
    return ent;
  }
  function entryReady(ent) {
    if (!ent || ent.failed) return false;
    if (ent.kind === 'game') return !!(ent.av && ent.av.ready && ent.av.mixer);
    return !!ent.ready;
  }
  function entryPlayIdle(ent) {
    if (!ent) return;
    try {
      if (ent.kind === 'game') { if (ent.av && ent.av.playAnim) ent.av.playAnim('idle'); return; }
      if (ent.kind === 'lunaris') {
        var w = ent.actions.Wave, id = ent.actions.Idle;
        if (w && ent.curAnim === 'Wave') { w.fadeOut(.15); }
        if (id) { id.reset().fadeIn(.15).play(); ent.curAnim = 'Idle'; }
        return;
      }
      var a = ent.actions.idle;
      if (a && ent.curAnim !== 'idle') { a.reset().fadeIn(.15).play(); ent.curAnim = 'idle'; }
    } catch (e) {}
  }

  /* ---------- selection feedback ---------- */
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function playSelect() {
    var ent = pv.cur;
    if (!ent || !entryReady(ent)) return;
    if (ent.kind === 'lunaris' && ent.actions.Wave) {
      var w = ent.actions.Wave, id = ent.actions.Idle;
      try {
        w.reset(); w.setLoop(THREE.LoopOnce, 1); w.clampWhenFinished = false; w.fadeIn(.15); w.play();
        if (id) id.fadeOut(.15);
        ent.curAnim = 'Wave';
        if (pv.waveTimer) clearTimeout(pv.waveTimer);
        pv.waveTimer = setTimeout(function () { if (pv.cur === ent) entryPlayIdle(ent); }, Math.round((w.getClip().duration || 4.133) * 1000));
      } catch (e) {}
      return;
    }
    pv.gesture = { t0: performance.now() };
  }

  /* ---------- stage ---------- */
  function ensureStyle() {
    if (document.getElementById('espil-cust-preview-style')) return;
    var st = document.createElement('style');
    st.id = 'espil-cust-preview-style';
    st.textContent =
      '#espil-cust-preview3d{margin:10px 0 2px;border:2px solid #cfa96f;border-radius:12px;overflow:hidden;' +
      'background:radial-gradient(120% 95% at 50% 0%,#fffdf4 0%,#ffedcb 78%,#f3dcab 100%)}' +
      '#espil-cust-preview3d-cv{display:block;width:100%;height:290px}' +
      '#espil-cust-preview3d .ecp-label{padding:5px 10px 7px;text-align:center;font:700 12px Manrope,sans-serif;color:#5a4020;letter-spacing:.04em}' +
      '@media (max-width:640px){#espil-cust-preview3d-cv{height:238px}}';
    (document.head || document.documentElement).appendChild(st);
  }
  function mount() {
    var panel = document.getElementById('char-custom');
    var wrap = panel ? panel.querySelector('.char-card-wrap') : null;
    var row = document.getElementById('char-body-row');
    if (!panel || !wrap || !row) return false;
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return false;
    ensureStyle();
    var box = document.createElement('div');
    box.id = 'espil-cust-preview3d';
    box.innerHTML = '<canvas id="espil-cust-preview3d-cv"></canvas><div class="ecp-label" id="espil-cust-preview3d-label"></div>';
    wrap.insertBefore(box, row);
    var cv = box.querySelector('canvas');
    pv.labelEl = box.querySelector('.ecp-label');
    var renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    pv.renderer = renderer;
    var scene = new THREE.Scene();
    pv.scene = scene;
    var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    camera.position.set(0, 1.04, 3.35);
    camera.lookAt(0, 0.88, 0);
    pv.camera = camera;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a3b, 1.05));
    var key = new THREE.DirectionalLight(0xfff2dd, 1.6); key.position.set(1.6, 3.0, 2.4); scene.add(key);
    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-2.0, 1.2, 1.4); scene.add(fill);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28),
      new THREE.MeshBasicMaterial({ color: 0x5a4020, transparent: true, opacity: 0.16, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002;
    scene.add(disc);
    var pivot = new THREE.Group();
    pivot.rotation.y = Math.PI; /* game bodies face -Z after their PI counter-rotation; the stage camera sits at +Z */
    scene.add(pivot);
    pv.pivot = pivot;
    pv.mounted = true;
    sizeRenderer();
    return true;
  }
  function sizeRenderer() {
    if (!pv.renderer || !pv.camera) return;
    var cv = pv.renderer.domElement;
    var w = cv.clientWidth || 360, h = cv.clientHeight || 290;
    pv.renderer.setSize(w, h, false);
    pv.camera.aspect = w / h;
    pv.camera.updateProjectionMatrix();
  }

  /* ---------- show / swap ---------- */
  function showSelection(animate) {
    var sel = currentSelection();
    pv.sel = sel;
    var key = selKeyOf(sel);
    var box = document.getElementById('espil-cust-preview3d');
    if (box) box.style.display = (sel.body === 'sprite') ? 'none' : '';
    if (pv.labelEl) pv.labelEl.textContent = bodyLabel(sel) + (sel.body === 'sprite' ? '' : '');
    if (sel.body === 'sprite') {
      if (pv.cur && pv.cur.group && pv.cur.group.parent === pv.pivot) pv.pivot.remove(pv.cur.group);
      pv.cur = null; pv.gesture = null; pv.selKey = key; return;
    }
    var ent = entryFor(sel);
    if (key !== pv.selKey || pv.cur !== ent) {
      if (pv.waveTimer) { clearTimeout(pv.waveTimer); pv.waveTimer = 0; }
      if (pv.cur && pv.cur.group && pv.cur.group.parent === pv.pivot) pv.pivot.remove(pv.cur.group);
      pv.gesture = null;
      if (pv.pivot) { pv.pivot.rotation.y = Math.PI; pv.pivot.position.y = 0; }
      noCull(ent.group);
      pv.pivot.add(ent.group);
      pv.cur = ent;
      entryPlayIdle(ent);
      pv.selKey = key;
      if (animate) playSelectWhenReady(ent);
    }
  }
  function playSelectWhenReady(ent) {
    var tries = 0;
    (function waitReady() {
      if (pv.cur !== ent || !pv.open) return;
      if (entryReady(ent)) { playSelect(); return; }
      if (++tries <= 40) setTimeout(waitReady, 150);
    })();
  }

  /* ---------- render loop (gate-open only) ---------- */
  function tick(ts) {
    if (!pv.open) { pv.raf = 0; return; }
    pv.raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, pv.lastTs ? (ts - pv.lastTs) / 1000 : 0.016);
    pv.lastTs = ts;
    var ent = pv.cur;
    if (ent && ent.mixer && entryReady(ent)) { try { ent.mixer.update(dt); } catch (e) {} }
    if (pv.gesture && pv.pivot) {
      var t = (ts - pv.gesture.t0) / TURN_MS;
      if (t >= 1) { pv.pivot.rotation.y = Math.PI; pv.pivot.position.y = 0; pv.gesture = null; }
      else {
        pv.pivot.rotation.y = Math.PI + Math.PI * 2 * easeInOut(t);
        pv.pivot.position.y = Math.sin(Math.PI * t) * 0.05;
      }
    }
    if (pv.renderer && pv.scene && pv.camera) pv.renderer.render(pv.scene, pv.camera);
  }
  function setOpen(on) {
    if (on === pv.open) return;
    pv.open = on;
    if (on) {
      if (!pv.mounted && !mount()) { /* THREE not up yet: the poll below retries while open */ }
      pv.primed = false;
      pv.lastTs = 0;
      if (pv.mounted) { sizeRenderer(); showSelection(false); pv.primed = true; }
      if (!pv.raf) pv.raf = requestAnimationFrame(tick);
      if (pv.pollTimer) clearInterval(pv.pollTimer);
      pv.pollTimer = setInterval(function () {
        if (!pv.open) return;
        if (!pv.mounted) { if (mount()) { sizeRenderer(); showSelection(false); pv.primed = true; } return; }
        var k = selKeyOf(currentSelection());
        if (k !== pv.selKey) showSelection(true);
      }, 700);
    } else {
      if (pv.raf) cancelAnimationFrame(pv.raf);
      pv.raf = 0;
      if (pv.pollTimer) { clearInterval(pv.pollTimer); pv.pollTimer = 0; }
      if (pv.waveTimer) { clearTimeout(pv.waveTimer); pv.waveTimer = 0; }
      pv.gesture = null;
      if (pv.pivot) { pv.pivot.rotation.y = Math.PI; pv.pivot.position.y = 0; }
    }
  }

  /* ---------- wiring ---------- */
  function boot() {
    var panel = document.getElementById('char-custom');
    if (!panel) { setTimeout(boot, 600); return; }
    var refreshQueued = false;
    function queueRefresh() {
      if (refreshQueued) return;
      refreshQueued = true;
      setTimeout(function () {
        refreshQueued = false;
        if (!pv.open || !pv.mounted) return;
        var k = selKeyOf(currentSelection());
        if (k !== pv.selKey) showSelection(true);
        else if (pv.labelEl && pv.sel) pv.labelEl.textContent = bodyLabel(pv.sel);
      }, 30);
    }
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].type === 'attributes' && muts[i].attributeName === 'aria-hidden' && muts[i].target === panel) {
          setOpen(panel.getAttribute('aria-hidden') === 'false');
        }
      }
      if (pv.open) queueRefresh();
    });
    mo.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'hidden'] });
    panel.addEventListener('click', function () { setTimeout(queueRefresh, 60); });
    if (!pv.resizeBound) {
      pv.resizeBound = true;
      window.addEventListener('resize', function () { if (pv.open && pv.mounted) sizeRenderer(); });
    }
    if (panel.getAttribute('aria-hidden') === 'false') setOpen(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__espilCustPreviewState = function () {
    var ent = pv.cur;
    var clip = null;
    if (ent) {
      if (ent.kind === 'game') clip = ent.av ? (ent.av.curAnim || null) : null;
      else clip = ent.curAnim || null;
    }
    return {
      mounted: pv.mounted, open: pv.open, raf: !!pv.raf,
      gender: pv.sel ? pv.sel.gender : null,
      bodyKey: pv.sel ? pv.sel.body : null,
      designated: pv.sel ? pv.sel.designated : null,
      locked: pv.sel ? !!pv.sel.locked : false,
      ready: ent ? entryReady(ent) : false,
      failed: ent ? !!ent.failed : false,
      clip: clip,
      playing: pv.gesture ? 'turn' : clip,
      selectMode: (pv.sel && pv.sel.designated) ? 'clip:Wave' : 'turn'
    };
  };
})();
/* __espilCustPreview END */

/* __espilCustStyleOptions v1 - style option portraits in the
   character gate (Han 2026-11-18: when a player picks among
   Style 1-4 they must SEE each style's avatar on the option
   itself - choosing by number or name alone is not enough.
   On a gender switch the newly picked gender's Style 1-4
   avatars show instead. Guests and signed-in users alike.)

   Appended as its own block after __espilCustPreview v1; the
   data hooks and the preview block above are untouched.

   Shape: PRESENTATION ONLY. The monolith's
   espilRenderBodyRow owns the body row - it builds the
   .char-body-card buttons, owns chosenBody, and re-renders
   the whole row on every pick. This block never writes
   selection state and never touches the cards' text or
   handlers; it only places a portrait holder
   (<div class="char-body-portrait">) at the head of each
   card and paints it. Because the row is rebuilt on every
   render, a MutationObserver + slow poll re-inject the
   holders from the portrait cache - injection is idempotent
   and a no-op when everything is already painted.

   Rendering form - PORTRAITS, not live renders (measured in
   STYLE-OPTIONS-REPORT.md): one shared offscreen renderer
   renders each body ONCE per (gender, body) into a PNG data
   URL, cached for the page's life; a gender switch renders
   the other gender's set on demand. The live alternative
   (one WebGL context + ticking mixer per card) would add
   4-5 contexts on top of the game context and the preview
   context and hold 4-5 avatar clones for the gate's whole
   life, for options the player glances at once - the
   portrait form adds exactly ONE small context and pays
   each body once.

   Bodies (the REAL GLBs, same files the preview shows):
   • style1-4: built through window.__espilBuildGateAvatar
     (monolith), the same service the preview uses, so the
     chibi template cache and its Basis/KTX2 machinery are
     shared and no GLB is parsed twice. The portrait clone
     is dropped after its snapshot.
   • master: __espilBuildGateAvatar returns null for the
     masters on purpose (the game builder fires entry
     machinery), so - exactly like the preview block - this
     block loads the body file itself (male.glb /
     female_idle.glb) with the preview's framing (PI
     counter-rotation, 1.5x scale, bbox grounding, embedded
     idle). The male_idle.glb override is NOT awaited: it
     swaps the idle loop, not the body's look.
   • Framing and lighting mirror the preview stage: same
     camera (36 deg, (0,1.04,3.35) -> (0,0.88,0)), same
     three lights, same PI pivot, same shadow disc recipe.

   Law kept intact:
   • Locked gates (first-setup done, no ticket) and the
     designated account render .char-body-lock and NO cards,
     so there is nothing to paint and nothing reopens -
     this block only ever follows .char-body-card elements.
     The gate can still paint the cards briefly from the
     pre-sync snapshot before the session sync lands the
     lock (the Lunaris defect-1 window): the moment the row
     shows the lock, injectAll drops every queued portrait
     job and want() refuses new ones, so a locked gate costs
     at most the one render already in flight.
   • The revert modes (kaykit / sprite) hide the row, so
     again no cards and no portraits.
   • Clicking a portrait is clicking the card (the holder
     sits inside the button), so the monolith's own pick
     handler stays the only selection path.
   • Layout: portrait rows make the gate taller than the
     wrap's max-height (100dvh - 20px) on short viewports,
     and the wrap is overflow:hidden with flex:none children
     (espil-mobile-fit) - unpainted, the confirm button
     would be clipped away unreachable. This block's style
     therefore lets the gate wrap scroll vertically - the
     same pattern the sign-in box already uses
     (.modal #auth-box{overflow-y:auto}). On tall viewports
     nothing changes; on short ones the whole gate, confirm
     included, stays reachable by scrolling the wrap.
     The holder also carries max-height:176px - a card left
     alone on the last flex row grows to the full row width,
     and an uncapped aspect-ratio holder would balloon with
     it (measured 565px); capped, every option's portrait
     shows at the same height and the paint letterboxes
     inside (background-size:contain).
   Test hook: window.__espilCustStyleOptionsState(). */
(function () {
  'use strict';
  if (window.__espilCustStyleOptions) return;
  window.__espilCustStyleOptions = true;

  var PW = 192, PH = 224; /* portrait render size; CSS scales it to the card */
  var so = {
    open: false, renderer: null, scene: null, camera: null, pivot: null,
    cache: {}, queue: [], busy: false, pollTimer: 0, injectQueued: false
  };

  /* ---------- read-only state recipes (mirror the preview block's) ---------- */
  function domGender() {
    var sel = document.querySelector('#char-custom .char-card.is-selected');
    return (sel && sel.getAttribute('data-gender') === 'female') ? 'female' : 'male';
  }
  function keyOf(g, b) { return g + '|' + b; }
  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  function noCull(group) { group.traverse(function (o) { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; }); }

  /* ---------- offscreen stage (mirrors __espilCustPreview's) ---------- */
  function ensureStage() {
    if (so.renderer) return true;
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return false;
    var cv = document.createElement('canvas');
    cv.width = PW; cv.height = PH;
    var renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(PW, PH, false);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(36, PW / PH, 0.1, 60);
    camera.position.set(0, 1.04, 3.35);
    camera.lookAt(0, 0.88, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a3b, 1.05));
    var key = new THREE.DirectionalLight(0xfff2dd, 1.6); key.position.set(1.6, 3.0, 2.4); scene.add(key);
    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-2.0, 1.2, 1.4); scene.add(fill);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28),
      new THREE.MeshBasicMaterial({ color: 0x5a4020, transparent: true, opacity: 0.16, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002;
    scene.add(disc);
    var pivot = new THREE.Group();
    pivot.rotation.y = Math.PI; /* same law as the preview stage */
    scene.add(pivot);
    so.renderer = renderer; so.scene = scene; so.camera = camera; so.pivot = pivot;
    return true;
  }

  /* ---------- body entries (uniform shape) ---------- */
  function buildChibiEntry(gender, body) {
    var av = null;
    try { av = window.__espilBuildGateAvatar ? window.__espilBuildGateAvatar(gender, body) : null; } catch (e) {}
    if (!av) return { failed: true, group: null, ready: function () { return false; }, playIdle: function () {}, mixer: function () { return null; } };
    return {
      failed: false, group: av.group,
      ready: function () { return !!(av.ready && av.mixer); },
      playIdle: function () { try { av.playAnim('idle'); } catch (e) {} },
      mixer: function () { return av.mixer; }
    };
  }
  /* Master entry: this block's own loader, mirroring the
     preview block's buildMasterEntry (see the header for why
     the game builder is not used for the masters). */
  function buildMasterEntry(gender) {
    var ent = { failed: false, group: new THREE.Group(), _mixer: null, readyFlag: false };
    var loader = new THREE.GLTFLoader();
    loader.load(gender === 'female' ? 'assets/character/female_idle.glb' : 'assets/character/male.glb', function (gltf) {
      try {
        var model = gltf.scene;
        model.rotation.y = Math.PI;
        model.scale.setScalar(1.5);
        var bbox = new THREE.Box3().setFromObject(model);
        model.position.y -= bbox.min.y;
        model.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        ent.group.add(model);
        var mixer = new THREE.AnimationMixer(model);
        ent._mixer = mixer;
        var clips = gltf.animations || [];
        function findClip(rx) { for (var i = 0; i < clips.length; i++) { if (rx.test(clips[i].name)) return clips[i]; } return null; }
        var idleClip = findClip(/baselayer|idle/i) || clips[0];
        if (idleClip) mixer.clipAction(idleClip).play();
        try { mixer.update(0); } catch (e) {}
        ent.readyFlag = true;
      } catch (e) { ent.failed = true; }
    }, undefined, function () { ent.failed = true; });
    ent.ready = function () { return ent.readyFlag; };
    ent.playIdle = function () {};
    ent.mixer = function () { return ent._mixer; };
    return ent;
  }
  function entryFor(gender, body) {
    return body === 'master' ? buildMasterEntry(gender) : buildChibiEntry(gender, body);
  }

  /* ---------- portrait production (one at a time) ---------- */
  function renderPortrait(gender, body, done) {
    var key = keyOf(gender, body);
    var rec = so.cache[key];
    if (rec && rec.status !== 'failed') { done(); return; }
    var prevAttempts = rec ? (rec.attempts || 0) : 0;
    rec = so.cache[key] = { status: 'pending', url: null, ms: 0, bytes: 0, hash: '', attempts: prevAttempts + 1 };
    var t0 = performance.now();
    if (!ensureStage()) { rec.status = 'failed'; done(); return; }
    var ent = entryFor(gender, body);
    if (!ent || ent.failed || !ent.group) { rec.status = 'failed'; done(); return; }
    var tries = 0;
    (function waitReady() {
      if (ent.failed) { rec.status = 'failed'; done(); return; }
      if (ent.ready()) {
        try {
          ent.playIdle();
          noCull(ent.group);
          so.pivot.add(ent.group);
          var mx = ent.mixer();
          for (var i = 0; i < 3; i++) { if (mx) mx.update(0.12); so.renderer.render(so.scene, so.camera); }
          rec.url = so.renderer.domElement.toDataURL('image/png');
          rec.bytes = rec.url.length;
          rec.hash = hashStr(rec.url);
          rec.status = 'ready';
          rec.ms = Math.round(performance.now() - t0);
          so.pivot.remove(ent.group);
        } catch (e) { rec.status = 'failed'; }
        done();
        return;
      }
      if (++tries <= 400) setTimeout(waitReady, 150); /* up to ~60 s: the master parse is slow on cold loads */
      else { rec.status = 'failed'; done(); }
    })();
  }
  function pump() {
    if (so.busy) return;
    var job = so.queue.shift();
    if (!job) return;
    so.busy = true;
    renderPortrait(job.gender, job.body, function () {
      so.busy = false;
      injectAll();
      pump();
    });
  }
  function rowLocked() {
    var row = document.getElementById('char-body-row');
    return !!(row && row.querySelector('.char-body-lock'));
  }
  function want(gender, body) {
    if (rowLocked()) return; /* a locked row never queues portrait work */
    var rec = so.cache[keyOf(gender, body)];
    if (rec) {
      if (rec.status !== 'failed') return;
      if ((rec.attempts || 0) >= 2) return; /* a body that failed twice stays unpainted; no retry spin */
    }
    for (var i = 0; i < so.queue.length; i++) {
      if (so.queue[i].gender === gender && so.queue[i].body === body) return;
    }
    so.queue.push({ gender: gender, body: body });
    pump();
  }

  /* ---------- injection into the monolith's cards ---------- */
  function ensureStyle() {
    if (document.getElementById('espil-cust-styleopt-style')) return;
    var st = document.createElement('style');
    st.id = 'espil-cust-styleopt-style';
    st.textContent =
      '#char-custom .char-card-wrap{overflow-y:auto}' +
      '#char-custom .char-body-portrait{width:100%;aspect-ratio:6/7;max-height:176px;margin:0 auto 4px;border-radius:8px;' +
      'background-color:rgba(255,250,235,.55);background-size:contain;background-position:center bottom;background-repeat:no-repeat;' +
      'box-shadow:inset 0 0 0 1px rgba(207,169,111,.45)}' +
      '#char-custom .char-body-portrait[data-so-status="ready"]{background-color:transparent;box-shadow:none}';
    (document.head || document.documentElement).appendChild(st);
  }
  function injectAll() {
    var row = document.getElementById('char-body-row');
    if (!row) return;
    /* Locked / designated row: the gate can paint the cards
       briefly from the pre-sync snapshot before the session
       sync lands the lock line (the Lunaris defect-1 window).
       When the lock is what the row now shows, drop any
       queued portrait work and paint nothing - the lock
       line stays the only presentation. */
    if (row.querySelector('.char-body-lock')) { so.queue.length = 0; return; }
    var cards = row.querySelectorAll('.char-body-card');
    if (!cards.length) return;
    ensureStyle();
    var gender = domGender();
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var body = card.getAttribute('data-body');
      if (!body) continue;
      var holder = null;
      for (var j = 0; j < card.childNodes.length; j++) {
        var n = card.childNodes[j];
        if (n.nodeType === 1 && n.className && String(n.className).indexOf('char-body-portrait') >= 0) { holder = n; break; }
      }
      if (!holder) {
        holder = document.createElement('div');
        holder.className = 'char-body-portrait';
        card.insertBefore(holder, card.firstChild);
      }
      var rec = so.cache[keyOf(gender, body)];
      var wantBg = (rec && rec.status === 'ready' && rec.url) ? 'url(' + rec.url + ')' : '';
      if (holder.style.backgroundImage !== wantBg) holder.style.backgroundImage = wantBg;
      var wantStatus = rec ? rec.status : 'queued';
      if (holder.getAttribute('data-so-status') !== wantStatus) holder.setAttribute('data-so-status', wantStatus);
      if (holder.getAttribute('data-so-body') !== body) holder.setAttribute('data-so-body', body);
      if (holder.getAttribute('data-so-gender') !== gender) holder.setAttribute('data-so-gender', gender);
      if (!rec || rec.status === 'failed') want(gender, body);
    }
  }
  function queueInject() {
    if (so.injectQueued) return;
    so.injectQueued = true;
    setTimeout(function () {
      so.injectQueued = false;
      if (so.open) injectAll();
    }, 40);
  }

  /* ---------- wiring (mirrors the preview block's lifecycle) ---------- */
  function setOpen(on) {
    if (on === so.open) return;
    so.open = on;
    if (on) {
      injectAll();
      if (so.pollTimer) clearInterval(so.pollTimer);
      so.pollTimer = setInterval(function () { if (so.open) injectAll(); }, 900);
    } else {
      if (so.pollTimer) { clearInterval(so.pollTimer); so.pollTimer = 0; }
    }
  }
  function boot() {
    var panel = document.getElementById('char-custom');
    if (!panel) { setTimeout(boot, 600); return; }
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].type === 'attributes' && muts[i].attributeName === 'aria-hidden' && muts[i].target === panel) {
          setOpen(panel.getAttribute('aria-hidden') === 'false');
        }
      }
      if (so.open) queueInject();
    });
    mo.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'hidden'] });
    if (panel.getAttribute('aria-hidden') === 'false') setOpen(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__espilCustStyleOptionsState = function () {
    var row = document.getElementById('char-body-row');
    var cards = [];
    if (row) {
      var list = row.querySelectorAll('.char-body-card');
      for (var i = 0; i < list.length; i++) {
        var holder = list[i].querySelector('.char-body-portrait');
        cards.push({
          body: list[i].getAttribute('data-body'),
          selected: list[i].classList.contains('is-selected'),
          portrait: !!holder,
          status: holder ? holder.getAttribute('data-so-status') : null,
          gender: holder ? holder.getAttribute('data-so-gender') : null,
          painted: holder ? !!holder.style.backgroundImage : false
        });
      }
    }
    var cache = {};
    for (var k in so.cache) {
      var r = so.cache[k];
      cache[k] = { status: r.status, ms: r.ms, bytes: r.bytes, hash: r.hash };
    }
    return {
      open: so.open, gender: domGender(), cards: cards, cache: cache,
      lockPresent: row ? !!row.querySelector('.char-body-lock') : false,
      queued: so.queue.length, busy: so.busy
    };
  };
})();
/* __espilCustStyleOptions END */
