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
      /* Portal phase A (Han 2026-11-20): this button is the road
         to the appearance-change ticket, and the shop now lives
         in the community portal's fixed cash tab - land there.
         The intent (buy a ticket) is unchanged. */
      if (window.__espilPortal && window.__espilPortal.open) { window.__espilPortal.open('cash'); return; }
      /* The portal rides the arrival bundle; if it has not
         loaded yet on this page, pull it in directly (the same
         fallback this button used for the cash shop itself). */
      var s = document.createElement('script');
      s.src = 'modules/comm-portal.js';
      s.onload = function () { if (window.__espilPortal && window.__espilPortal.open) window.__espilPortal.open('cash'); };
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

/* __espilCustStyleOptions v2 - LIVE 3D style option views in
   the character gate (Han 2026-11-20: "게스트로 접속할 때
   캐릭터 선택하는 거, 캐릭터 샘플 보여야 한다고 몇 번째
   말했냐? 제발 좀 이행해라. 3D 모델 보여줘" - at guest entry
   the character selection must show the samples, as 3D
   MODELS). v1 (Han 2026-11-18) painted each option with a
   rendered PORTRAIT (one shared offscreen renderer, a PNG
   data URL per (gender, body), cached for the page's life).
   Han's 2026-11-20 directive supersedes that form: every
   offered body option now displays its ACTUAL 3D model,
   rendered live by WebGL in the selection view.

   Step-1 record (this line, production bytes, 2026-11-20)
   that the build answers:
   • Canonical landing path: the guest step offers gender +
     Style 1-4 as TEXT buttons with NO imagery at all, and
     the gate panel is never presented on that path - the
     canonical guest saw no sample anywhere.
   • Direct game-page path: the gate's card samples are the
     v1 portrait stills; the only live 3D is the preview
     stage above the row, showing the SELECTED body alone.

   Shape: the v1 block's wiring, lifecycle and laws are kept;
   only the presentation mechanism changes, and one shared
   live core (window.__espilLiveViews) serves TWO surfaces:
   • the gate's .char-body-card options (this block), and
   • the landing guest step's #guest-style-1..4 buttons (the
     __espilGuestLive block below) - the canonical guest pick.
   The core holds ONE offscreen WebGL renderer (the v1 stage:
   same camera, lights, disc, PI pivot, 192x224). Each option
   carries a small visible 2D canvas; while its surface is
   open, a RAF loop attaches the option's entry to the shared
   pivot, ticks its mixer, renders once and blits the frame
   into the option's canvas - a live render of the real GLB
   every frame (the idle animation advances), never a cached
   still. WebGL contexts added by option views: exactly ONE
   (the same single context v1 used), shared by both surfaces
   and by every option.

   Bodies (the REAL GLBs, same files the preview shows):
   • style1-4: built through window.__espilBuildGateAvatar
     (monolith), the same service the preview uses, so the
     chibi template cache and its Basis/KTX2 machinery are
     shared and no GLB is parsed twice.
   • master: __espilBuildGateAvatar returns null for the
     masters on purpose (the game builder fires entry
     machinery), so - exactly like the preview block and v1 -
     this core loads the body file itself (male.glb /
     female_idle.glb) with the preview's framing (PI
     counter-rotation, 1.5x scale, bbox grounding, embedded
     idle).

   Laws kept from v1 (intact):
   • PRESENTATION ONLY. espilRenderBodyRow owns the row and
     chosenBody; entry-flow owns the landing step. These
     blocks never write selection state and never touch the
     options' text or handlers; clicking a view is clicking
     the option itself (the holder sits inside the button,
     the canvas ignores pointer events).
   • Start order: styles first, Master last (the 2026-11-19
     defect fix - the signed-in row leads with the ~16 MB
     Master card; entry construction starts in the same
     two-pass order so the style samples lead here too).
   • Locked gates and the designated account render
     .char-body-lock and NO cards, so there is nothing to
     show and nothing reopens; queued starts drop the moment
     the lock shows. The revert modes (kaykit / sprite) hide
     the row - again no cards, no views.
   • Layout: the v1 style still lets the gate wrap scroll
     vertically on short viewports, and the holder keeps
     max-height:176px so a lone last-row card cannot balloon.
   • A body that fails twice stays unshown (honest empty
     holder); no retry spin.

   NEW law (the first-creation line's section-7 finding,
   unscheduled until now - it belongs here because this core
   is the sample path): the WRONG-STYLE GUARD. The monolith's
   __espilEnsureChibi fail-soft can hand back style 1 when a
   style's GLB fails to load, and v1 cached that picture as
   the requested style's sample (observed once on
   production: female Style 4 identical to Style 1). A live
   entry whose built style (av.__cbStyle) differs from the
   requested style is treated as FAILED here - it is never
   presented as that style's model, and the 2-attempt retry
   reloads the file. The in-world avatar fail-soft is
   untouched.

   Cost, stated plainly: entries are cached per (gender,
   body) for the page's life (the preview keeps its own
   selected-body entry, as before). The master bodies are
   parsed once by this core (male.glb 15,999,984 B /
   female_idle.glb 16,291,868 B) - one parse fewer than the
   v1 world, where the portrait block parsed its own copy
   on top of the preview's. Per frame the core renders one
   small frame per visible option (4 guest / 5 signed-in).
   Test hooks: window.__espilCustStyleOptionsState() (gate)
   and window.__espilGuestLiveState() (landing step). */
(function () {
  'use strict';
  if (window.__espilCustStyleOptions) return;
  window.__espilCustStyleOptions = true;

  var PW = 192, PH = 224; /* shared stage size; CSS scales it to the option */
  var core = {
    renderer: null, scene: null, camera: null, pivot: null,
    entries: {}, startQueue: [], startTimer: 0, building: false
  };
  var so = { open: false, views: [], pollTimer: 0, injectQueued: false, raf: 0, lastTs: 0, frameId: 0, ticked: {} };

  /* ---------- read-only state recipes (mirror the preview block's) ---------- */
  function domGender() {
    var sel = document.querySelector('#char-custom .char-card.is-selected');
    return (sel && sel.getAttribute('data-gender') === 'female') ? 'female' : 'male';
  }
  function keyOf(g, b) { return g + '|' + b; }
  function noCull(group) { group.traverse(function (o) { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; }); }

  /* ---------- the one shared offscreen stage (mirrors v1 / the preview) ---------- */
  function ensureStage() {
    if (core.renderer) return true;
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
    core.renderer = renderer; core.scene = scene; core.camera = camera; core.pivot = pivot;
    return true;
  }

  /* ---------- body entries (uniform shape) ---------- */
  function buildChibiEntry(gender, body) {
    var av = null;
    try { av = window.__espilBuildGateAvatar ? window.__espilBuildGateAvatar(gender, body) : null; } catch (e) {}
    if (!av) return { failed: true, group: null, ready: function () { return false; }, playIdle: function () {}, mixer: function () { return null; } };
    var wantStyle = +body.slice(-1);
    return {
      failed: false, group: av.group, av: av,
      ready: function () { return !!(av.ready && av.mixer); },
      /* WRONG-STYLE GUARD: the built style is stamped on the
         avatar (av.__cbStyle) once its template lands; a built
         style different from the requested one means the
         fail-soft served a substitute - never a sample. */
      wrongStyle: function () {
        return !!(av.ready && typeof av.__cbStyle === 'number' && av.__cbStyle !== wantStyle);
      },
      playIdle: function () { try { av.playAnim('idle'); } catch (e) {} },
      mixer: function () { return av.mixer; }
    };
  }
  /* Master entry: the core's own loader, mirroring the
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

  /* ---------- entry lifecycle (shared by both surfaces) ---------- */
  function want(gender, body) {
    var rec = core.entries[keyOf(gender, body)];
    if (rec) {
      if (rec.status !== 'failed') return;
      if ((rec.attempts || 0) >= 2) return; /* a body that failed twice stays unshown; no retry spin */
    }
    for (var i = 0; i < core.startQueue.length; i++) {
      if (core.startQueue[i].gender === gender && core.startQueue[i].body === body) return;
    }
    core.startQueue.push({ gender: gender, body: body });
    pumpStarts();
  }
  function pumpStarts() {
    if (core.building || core.startTimer) return;
    var job = core.startQueue.shift();
    if (!job) return;
    core.building = true;
    startEntry(job.gender, job.body);
    core.building = false;
    if (core.startQueue.length) {
      /* Starts are staggered so the small style files lead and
         the ~16 MB master parse starts last and alone (the
         2026-11-19 order law, carried to construction). */
      core.startTimer = setTimeout(function () { core.startTimer = 0; pumpStarts(); }, 200);
    }
  }
  function startEntry(gender, body) {
    var key = keyOf(gender, body);
    var prev = core.entries[key];
    var rec = core.entries[key] = { status: 'loading', ent: null, ms: 0,
      attempts: (prev ? (prev.attempts || 0) : 0) + 1, startedAt: performance.now(), wrongStyle: false };
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined' ||
        (body !== 'master' && !window.__espilBuildGateAvatar)) {
      /* Machinery not up yet (early boot): not an attempt -
         requeue shortly instead of burning the retry cap. */
      rec.status = 'queued';
      rec.attempts -= 1;
      setTimeout(function () {
        if (core.entries[key] === rec && rec.status === 'queued') { rec.status = 'failed'; want(gender, body); }
      }, 600);
      return;
    }
    rec.ent = (body === 'master') ? buildMasterEntry(gender) : buildChibiEntry(gender, body);
    if (!rec.ent || rec.ent.failed || !rec.ent.group) rec.status = 'failed';
  }
  function tryPromote(rec) {
    if (!rec || rec.status !== 'loading' || !rec.ent) return;
    var ent = rec.ent;
    if (ent.failed) { rec.status = 'failed'; return; }
    if (ent.wrongStyle && ent.wrongStyle()) { rec.status = 'failed'; rec.wrongStyle = true; return; }
    if (ent.ready()) {
      rec.status = 'live';
      rec.ms = Math.round(performance.now() - rec.startedAt);
      try { ent.playIdle(); } catch (e) {}
      noCull(ent.group);
      return;
    }
    if (performance.now() - rec.startedAt > 120000) rec.status = 'failed'; /* a load that never lands is a failure, not a spinner */
  }
  function entryRec(gender, body) { return core.entries[keyOf(gender, body)] || null; }

  /* Render ONE live frame of an entry into a view's 2D canvas.
     The mixer ticks at most once per surface frame per entry
     (frameId), so two surfaces never double-step an entry. */
  function renderView(view, dt, frameId) {
    var rec = entryRec(view.gender, view.body);
    if (!rec) return;
    if (rec.status === 'loading') { tryPromote(rec); if (rec.status !== 'live') return; }
    if (rec.status !== 'live' || !rec.ent || !ensureStage()) return;
    var ent = rec.ent;
    try {
      if (so.ticked[rec.key || (rec.key = keyOf(view.gender, view.body))] !== frameId) {
        so.ticked[rec.key] = frameId;
        var mx = ent.mixer();
        if (mx) mx.update(dt);
      }
      if (ent.group.parent !== core.pivot) {
        if (ent.group.parent) ent.group.parent.remove(ent.group);
        core.pivot.add(ent.group);
      }
      core.renderer.render(core.scene, core.camera);
      core.pivot.remove(ent.group);
      view.ctx.drawImage(core.renderer.domElement, 0, 0, view.canvas.width, view.canvas.height);
      view.frames++;
    } catch (e) {}
  }

  /* The shared service the landing-step block drives. */
  window.__espilLiveViews = {
    want: want,
    entryRec: entryRec,
    tryPromote: tryPromote,
    renderView: renderView,
    stageReady: function () { return !!core.renderer; },
    newFrame: function () { return ++so.frameId; }
  };

  /* ---------- gate surface: injection into the monolith's cards ---------- */
  function ensureStyle() {
    if (document.getElementById('espil-cust-styleopt-style')) return;
    var st = document.createElement('style');
    st.id = 'espil-cust-styleopt-style';
    st.textContent =
      '#char-custom .char-card-wrap{overflow-y:auto}' +
      '#char-custom .char-body-portrait{width:100%;aspect-ratio:6/7;max-height:176px;margin:0 auto 4px;border-radius:8px;' +
      'background-color:rgba(255,250,235,.55);box-shadow:inset 0 0 0 1px rgba(207,169,111,.45);overflow:hidden}' +
      '#char-custom .char-body-portrait[data-so-status="live"]{background-color:transparent;box-shadow:none}' +
      '#char-custom .char-body-portrait canvas{display:block;width:100%;height:100%;pointer-events:none}';
    (document.head || document.documentElement).appendChild(st);
  }
  function rowLocked() {
    var row = document.getElementById('char-body-row');
    return !!(row && row.querySelector('.char-body-lock'));
  }
  function viewFor(card, gender, body) {
    for (var i = 0; i < so.views.length; i++) {
      if (so.views[i].el === card) {
        so.views[i].gender = gender; so.views[i].body = body;
        return so.views[i];
      }
    }
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
    var canvas = holder.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = PW; canvas.height = PH;
      holder.appendChild(canvas);
    }
    var view = { el: card, holder: holder, canvas: canvas, ctx: canvas.getContext('2d'),
                 gender: gender, body: body, frames: 0 };
    so.views.push(view);
    return view;
  }
  function injectAll() {
    var row = document.getElementById('char-body-row');
    if (!row) return;
    /* Locked / designated row: drop any queued starts and
       show nothing - the lock line stays the only
       presentation (v1 law, unchanged). */
    if (row.querySelector('.char-body-lock')) { core.startQueue.length = 0; so.views = []; return; }
    var cards = row.querySelectorAll('.char-body-card');
    if (!cards.length) { so.views = []; return; }
    ensureStyle();
    var gender = domGender();
    /* Drop views whose card element left the row (the row is
       rebuilt on every render; the fresh cards get fresh
       views bound to the same cached entries). */
    var live = [];
    for (var v = 0; v < so.views.length; v++) {
      if (so.views[v].el.isConnected && row.contains(so.views[v].el)) live.push(so.views[v]);
    }
    so.views = live;
    function visitCard(card) {
      var body = card.getAttribute('data-body');
      if (!body) return;
      var view = viewFor(card, gender, body);
      var rec = entryRec(gender, body);
      var status = rec ? rec.status : 'queued';
      if (view.holder.getAttribute('data-so-status') !== status) view.holder.setAttribute('data-so-status', status);
      if (view.holder.getAttribute('data-so-body') !== body) view.holder.setAttribute('data-so-body', body);
      if (view.holder.getAttribute('data-so-gender') !== gender) view.holder.setAttribute('data-so-gender', gender);
      if (!rec || rec.status === 'failed') want(gender, body);
    }
    /* Start order (2026-11-19 defect-fix law): styles first,
       the Master entry last - see the header. */
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-body') !== 'master') visitCard(cards[i]);
    }
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-body') === 'master') visitCard(cards[i]);
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

  /* ---------- gate render loop (gate-open only) ---------- */
  function tick(ts) {
    if (!so.open) { so.raf = 0; return; }
    so.raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, so.lastTs ? (ts - so.lastTs) / 1000 : 0.016);
    so.lastTs = ts;
    var fid = ++so.frameId;
    for (var i = 0; i < so.views.length; i++) renderView(so.views[i], dt, fid);
  }
  function setOpen(on) {
    if (on === so.open) return;
    so.open = on;
    if (on) {
      injectAll();
      so.lastTs = 0;
      if (!so.raf) so.raf = requestAnimationFrame(tick);
      if (so.pollTimer) clearInterval(so.pollTimer);
      so.pollTimer = setInterval(function () { if (so.open) injectAll(); }, 900);
    } else {
      if (so.raf) cancelAnimationFrame(so.raf);
      so.raf = 0;
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
        var body = list[i].getAttribute('data-body');
        var view = null;
        for (var v = 0; v < so.views.length; v++) { if (so.views[v].el === list[i]) { view = so.views[v]; break; } }
        var rec = body ? entryRec(domGender(), body) : null;
        cards.push({
          body: body,
          selected: list[i].classList.contains('is-selected'),
          portrait: !!list[i].querySelector('.char-body-portrait'),
          live: true,
          status: rec ? rec.status : (view ? 'queued' : null),
          gender: domGender(),
          painted: view ? view.frames > 0 : false,
          frames: view ? view.frames : 0
        });
      }
    }
    var cache = {};
    for (var k in core.entries) {
      var r = core.entries[k];
      cache[k] = { status: r.status, ms: r.ms, attempts: r.attempts, wrongStyle: !!r.wrongStyle };
    }
    return {
      open: so.open, gender: domGender(), cards: cards, cache: cache,
      lockPresent: row ? !!row.querySelector('.char-body-lock') : false,
      queued: core.startQueue.length, busy: core.building,
      live: true, contexts: core.renderer ? 1 : 0
    };
  };
})();
/* __espilCustStyleOptions END */

/* __espilGuestLive v1 - LIVE 3D style views on the LANDING
   guest step (Han 2026-11-20, same directive as the v2 block
   above). The landing guest step is the canonical guest
   character selection: entry-flow offers name + Male/Female
   + Style 1-4 there, and the Step-1 record (this line,
   production bytes, 2026-11-20) proved the step carried NO
   imagery at all - text buttons only - and that the gate
   panel (with its samples) is never presented on the
   canonical path, so the canonical guest picked blind.

   Shape: PRESENTATION ONLY, a follower of the step's DOM.
   Each #guest-style-N button gains a live view of that style
   for the gender the step currently has picked (read from
   the gender buttons' aria-pressed state - entry-flow owns
   the pick; this block reads it and never writes it). The
   views are driven by the shared live core above
   (window.__espilLiveViews): ONE WebGL context serves the
   gate cards and these buttons together, entries are shared
   per (gender, body), and the idle animation advances in
   every view. The loop runs only while #auth-gueststep is
   visible. Name / gender / style behaviour, guestGo and the
   espil_character record it writes are untouched;
   entry-flow.js and index.html are not modified.

   Layout note (measured on this build's first run): the
   step's buttons carry pair.css's .city-name form -
   display:flex row, height:40px - so a holder placed inside
   is compressed into the 40 px row (the first build's views
   measured ~22 px tall beside the label). This block's
   style therefore turns ONLY the four style buttons into a
   column layout with an explicit holder height; the gender
   buttons keep the 40 px row form, and no other .city-name
   surface is touched (the rules are scoped to
   #auth-gueststep and the style buttons' own ids).
   Test hook: window.__espilGuestLiveState(). */
(function () {
  'use strict';
  if (window.__espilGuestLive) return;
  window.__espilGuestLive = true;

  var gl = { views: [], active: false, gender: 'male', raf: 0, lastTs: 0, pollTimer: 0, booted: false };

  function stepEl() { return document.getElementById('auth-gueststep'); }
  function stepVisible() {
    var s = stepEl();
    return !!(s && !s.hidden && s.offsetParent !== null);
  }
  function pickedGender() {
    var f = document.getElementById('guest-char-female');
    return (f && f.getAttribute('aria-pressed') === 'true') ? 'female' : 'male';
  }
  function ensureStyle() {
    if (document.getElementById('espil-guest-live-style')) return;
    var st = document.createElement('style');
    st.id = 'espil-guest-live-style';
    st.textContent =
      '#auth-gueststep #guest-style-1,#auth-gueststep #guest-style-2,#auth-gueststep #guest-style-3,#auth-gueststep #guest-style-4' +
      '{flex-direction:column;height:auto;padding:8px 4px 7px;gap:3px;white-space:normal}' +
      '#auth-gueststep .elp-live{display:block;width:100%;max-width:76px;height:88px;flex:none;' +
      'margin:0 auto;border-radius:8px;background-color:rgba(255,250,235,.55);overflow:hidden;' +
      'box-shadow:inset 0 0 0 1px rgba(207,169,111,.45)}' +
      '#auth-gueststep .elp-live[data-glive-status="live"]{background-color:transparent;box-shadow:none}' +
      '#auth-gueststep .elp-live canvas{display:block;width:100%;height:100%;pointer-events:none}';
    (document.head || document.documentElement).appendChild(st);
  }
  function buildViews() {
    ensureStyle();
    gl.views = [];
    for (var n = 1; n <= 4; n++) {
      var btn = document.getElementById('guest-style-' + n);
      if (!btn) return false;
      var holder = btn.querySelector('.elp-live');
      if (!holder) {
        holder = document.createElement('div');
        holder.className = 'elp-live';
        btn.insertBefore(holder, btn.firstChild);
      }
      var canvas = holder.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 144; canvas.height = 168;
        holder.appendChild(canvas);
      }
      gl.views.push({ el: btn, holder: holder, canvas: canvas, ctx: canvas.getContext('2d'),
                      gender: gl.gender, body: 'style' + n, frames: 0 });
    }
    return true;
  }
  function refresh() {
    if (!window.__espilLiveViews) return;
    var g = pickedGender();
    if (g !== gl.gender) {
      gl.gender = g;
      for (var i = 0; i < gl.views.length; i++) gl.views[i].gender = g;
    }
    for (var j = 0; j < gl.views.length; j++) {
      var view = gl.views[j];
      var rec = window.__espilLiveViews.entryRec(view.gender, view.body);
      var status = rec ? rec.status : 'queued';
      if (view.holder.getAttribute('data-glive-status') !== status) view.holder.setAttribute('data-glive-status', status);
      if (!rec || rec.status === 'failed') window.__espilLiveViews.want(view.gender, view.body);
      else if (rec.status === 'loading') window.__espilLiveViews.tryPromote(rec);
    }
  }
  function tick(ts) {
    if (!gl.active) { gl.raf = 0; return; }
    gl.raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, gl.lastTs ? (ts - gl.lastTs) / 1000 : 0.016);
    gl.lastTs = ts;
    if (!window.__espilLiveViews) return;
    var fid = window.__espilLiveViews.newFrame();
    for (var i = 0; i < gl.views.length; i++) window.__espilLiveViews.renderView(gl.views[i], dt, fid);
  }
  function setActive(on) {
    if (on === gl.active) return;
    gl.active = on;
    if (on) {
      if (!gl.views.length && !buildViews()) return;
      refresh();
      gl.lastTs = 0;
      if (!gl.raf) gl.raf = requestAnimationFrame(tick);
    } else {
      if (gl.raf) cancelAnimationFrame(gl.raf);
      gl.raf = 0;
    }
  }
  function boot() {
    var step = stepEl();
    if (!step || !document.getElementById('guest-style-1')) { setTimeout(boot, 600); return; }
    gl.booted = true;
    if (gl.pollTimer) clearInterval(gl.pollTimer);
    gl.pollTimer = setInterval(function () {
      var vis = stepVisible();
      setActive(vis);
      if (vis) refresh();
    }, 500);
    setActive(stepVisible());
    if (gl.active) refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__espilGuestLiveState = function () {
    var views = [];
    for (var i = 0; i < gl.views.length; i++) {
      var view = gl.views[i];
      var rec = window.__espilLiveViews ? window.__espilLiveViews.entryRec(view.gender, view.body) : null;
      views.push({ style: view.body, gender: view.gender,
                   status: rec ? rec.status : 'queued', frames: view.frames });
    }
    return { booted: gl.booted, active: gl.active, visible: stepVisible(),
             gender: gl.gender, views: views,
             contexts: (window.__espilLiveViews && window.__espilLiveViews.stageReady()) ? 1 : 0 };
  };
})();
/* __espilGuestLive END */
