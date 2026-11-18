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
