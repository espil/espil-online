
/* __espilEntryFlow v1 - Han's entry order (2026-10-28): Dive, then
   sign in / sign up, then gender, then the LOCATION pick, then the
   glass loading sequence. This module owns two pieces:
   (1) the sign-in modal's account zone, rebuilt as tabs - Sign up
       (ID first, then name, email, password) and Sign in (ID,
       password) - on the same on-device account store the social
       module uses (espil_accounts_v1, salted SHA-256), so accounts
       made in either form keep working; server accounts remain
       Han's pending D1 + Google OAuth step. Guests are numbered in
       entry order: the Worker assigns "Guest N" at join and this
       module adopts that name from the roster (with a client-side
       count as fallback until the Worker update deploys).
   (2) window.__espilEntryLocationGate - formerly the arrival
       picker the character gate detoured through. Batch D3 (Han
       2026-11-03): entry no longer asks for a location - the gate
       hands espilEntryStart a fixed first spawn in front of the
       Art Gallery as window.__espilSpawnPick; other cities enter
       directly. The picker implementation below is dormant. */
(function () {
  'use strict';
  if (window.__espilEntryFlow) return;
  window.__espilEntryFlow = true;

  var T = {
    signUp: { en: 'Sign up', ko: '회원가입', fr: "S'inscrire", zh: '注册' },
    signIn: { en: 'Sign in', ko: '로그인', fr: 'Se connecter', zh: '登录' },
    idPh: { en: 'ID (shown above your character)', ko: '아이디 (캐릭터 위에 표시됩니다)', fr: 'ID (affiché au-dessus du personnage)', zh: 'ID（显示在角色上方）' },
    namePh: { en: 'Name', ko: '이름', fr: 'Nom', zh: '姓名' },
    emailPh: { en: 'Email', ko: '이메일', fr: 'E-mail', zh: '邮箱' },
    pwPh: { en: 'Password', ko: '비밀번호', fr: 'Mot de passe', zh: '密码' },
    create: { en: 'Create account and enter', ko: '가입하고 입장', fr: 'Créer le compte et entrer', zh: '注册并进入' },
    enter: { en: 'Sign in and enter', ko: '로그인하고 입장', fr: 'Se connecter et entrer', zh: '登录并进入' },
    idRule: { en: 'ID: 3-16 letters, numbers or underscore.', ko: '아이디는 3-16자, 영문/숫자/밑줄만 됩니다.', fr: 'ID : 3-16 lettres, chiffres ou _ .', zh: 'ID：3-16 个字母、数字或下划线。' },
    nameRule: { en: 'Please enter your name.', ko: '이름을 입력해 주세요.', fr: 'Entrez votre nom.', zh: '请输入姓名。' },
    emailRule: { en: 'Please enter a valid email.', ko: '올바른 이메일을 입력해 주세요.', fr: 'Entrez un e-mail valide.', zh: '请输入有效的邮箱。' },
    pwRule: { en: 'Password: 6 characters or more.', ko: '비밀번호는 6자 이상이어야 합니다.', fr: 'Mot de passe : 6 caractères ou plus.', zh: '密码至少 6 个字符。' },
    taken: { en: 'That ID is already taken. Sign in instead.', ko: '이미 있는 아이디입니다. 로그인해 주세요.', fr: 'Cet ID est déjà pris. Connectez-vous.', zh: '该 ID 已被注册，请直接登录。' },
    created: { en: 'Account created. Welcome, {id}.', ko: '가입이 완료되었습니다. 환영합니다, {id}님.', fr: 'Compte créé. Bienvenue, {id}.', zh: '注册成功，欢迎 {id}。' },
    noAcct: { en: 'No account with that ID yet. Sign up first.', ko: '아직 없는 아이디입니다. 먼저 가입해 주세요.', fr: "Aucun compte avec cet ID. Inscrivez-vous d'abord.", zh: '该 ID 尚无账户，请先注册。' },
    wrongPw: { en: 'Wrong password.', ko: '비밀번호가 틀렸습니다.', fr: 'Mot de passe incorrect.', zh: '密码不正确。' },
    welcomeBack: { en: 'Welcome back, {id}.', ko: '다시 오신 것을 환영합니다, {id}님.', fr: 'Bon retour, {id}.', zh: '欢迎回来，{id}。' },
    locTitle: { en: 'Where will you arrive?', ko: '어디에 도착하시겠습니까?', fr: 'Où arriverez-vous ?', zh: '您想在哪里抵达？' },
    locSub: { en: 'Pick your arrival spot in {city}.', ko: '{city}에서 도착할 장소를 골라 주세요.', fr: "Choisissez votre lieu d'arrivée à {city}.", zh: '选择您在{city}的抵达地点。' },
    curLoc: { en: 'My current location', ko: '현재 본인 위치', fr: 'Ma position actuelle', zh: '我当前的位置' },
    gallery: { en: 'Vancouver Art Gallery', ko: '밴쿠버 아트갤러리', fr: "Vancouver Art Gallery", zh: '温哥华美术馆' },
    robsonSq: { en: 'Robson Square', ko: '랍슨 스퀘어', fr: 'Robson Square', zh: '罗布森广场' },
    holt: { en: 'Holt Renfrew', ko: '홀트 렌프류', fr: 'Holt Renfrew', zh: 'Holt Renfrew' },
    waterfront: { en: 'Waterfront', ko: '워터프론트', fr: 'Waterfront', zh: '海滨站' },
    stanley: { en: 'Stanley Park', ko: '스탠리 파크', fr: 'Stanley Park', zh: '斯坦利公园' },
    englishBay: { en: 'English Bay', ko: '잉글리시 베이', fr: 'English Bay', zh: '英吉利湾' },
    locating: { en: 'Finding your location...', ko: '위치를 확인하는 중입니다...', fr: 'Localisation en cours...', zh: '正在定位...' },
    outside: { en: 'That is outside the playable area - arriving at the Art Gallery instead.', ko: '플레이 가능 지역 밖이라 아트갤러리 앞에 도착합니다.', fr: "Hors de la zone jouable - arrivée devant la galerie d'art.", zh: '超出可游玩区域，将在美术馆前抵达。' },
    noGeo: { en: 'Location is unavailable - pick a place instead.', ko: '위치를 확인할 수 없습니다. 장소를 골라 주세요.', fr: 'Position indisponible - choisissez un lieu.', zh: '无法定位，请选择一个地点。' },
    guestOnly: { en: 'Accounts live on our server now. Sign in with Google, or register with your email and password - your character and progress save to your account.', ko: '계정은 이제 서버에서 운영됩니다. Google로 로그인하거나 이메일과 비밀번호로 가입해 주십시오. 캐릭터와 진행 상황은 계정에 저장됩니다.', fr: 'La connexion par compte est en pause. Les comptes migrent vers notre serveur, avec les personnages enregistrés côté serveur et une vérification par e-mail. En attendant, l\'entrée est réservée aux invités.', zh: '账户登录已暂停。账户正在迁移到我们的服务器，角色数据将保存在服务器端并引入邮箱验证。在此之前，仅限访客进入。' }
  };
  function lang() { try { return window.__espilLang() || 'en'; } catch (e) { return 'en'; } }
  function t(k, vars) {
    var s = (T[k] && (T[k][lang()] || T[k].en)) || k;
    if (vars) for (var key in vars) s = s.split('{' + key + '}').join(vars[key]);
    return s;
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = document.createElement('style');
  css.textContent =
    '.eauth-tabs{display:flex;gap:8px;margin:0 0 12px}' +
    '.eauth-tab{flex:1;padding:9px 0;border-radius:10px;border:2px solid #cfa96f;background:linear-gradient(180deg,#fffdf6,#ffeecd);color:#8a6a3b;font:700 .8rem/1 "Manrope",sans-serif;letter-spacing:.06em;cursor:pointer}' +
    '.eauth-tab.on{background:linear-gradient(180deg,#ffe9b8,#ffd98c);color:#6b4a1f;border-color:#b57708}' +
    '.eauth-label{display:block;font:700 .66rem/1.4 "Manrope",sans-serif;letter-spacing:.14em;color:#8a6a3b;margin:8px 0 5px}' +
    '.eauth-pane input{display:block;width:100%;box-sizing:border-box;background:#fffdf6;border:1.5px solid #d9b380;border-radius:9px;padding:10px 11px;font-size:14px;color:#5a4020;outline:none}' +
    '.eauth-pane .espil-auth-btn{display:block;width:100%;appearance:none;border:2px solid #d97f10;border-radius:12px;padding:12px;margin-top:12px;background:linear-gradient(180deg,#ffb84d,#f08c1a);color:#fff;text-shadow:0 1px 2px rgba(120,60,0,.5);box-shadow:0 4px 12px rgba(190,110,10,.4);font:800 .78rem/1 "Manrope",sans-serif;letter-spacing:.08em;cursor:pointer}' +
    '#auth-msg{min-height:1.2em;margin:9px 0 0;font-size:.76rem;line-height:1.5;color:#c2571b}' +
    '#auth-session{margin:4px 0 0;font-size:.76rem;line-height:1.5;color:#8a6a3b}' +
    '#espil-locpick{position:fixed;inset:0;z-index:61;display:none;align-items:center;justify-content:center;background:rgba(4,12,14,.8);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
    '#espil-locpick[aria-hidden="false"]{display:flex}' +
    '.locpick-card{width:min(430px,92vw);border-radius:18px;padding:22px 22px 16px;background:linear-gradient(180deg,#fffbf0,#fff3dc);border:2px solid #d9b380;box-shadow:0 24px 60px rgba(90,60,20,.35);color:#5a4020;font-family:"Manrope",sans-serif}' +
    '.locpick-card h3{margin:0 0 4px;font-size:1.05rem;letter-spacing:.02em}' +
    '.locpick-card p{margin:0 0 14px;font-size:.8rem;opacity:.75}' +
    '.locpick-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}' +
    '.locpick-btn{padding:13px 10px;border-radius:12px;border:2px solid #cfa96f;background:linear-gradient(180deg,#fffdf6,#ffeecd);color:#6b4a1f;font:700 .82rem/1.25 "Manrope",sans-serif;cursor:pointer;text-align:center;box-shadow:inset 0 -3px 0 rgba(207,169,111,.35)}' +
    '.locpick-btn:hover,.locpick-btn:focus-visible{border-color:#b57708;background:linear-gradient(180deg,#ffe9b8,#ffd98c);outline:none}' +
    '.locpick-btn.wide{grid-column:1/-1;background:linear-gradient(180deg,#ffb84d,#f08c1a);border-color:#d97f10;color:#fff;text-shadow:0 1px 2px rgba(120,60,0,.5)}' +
    '.locpick-msg{min-height:18px;margin:10px 0 0;font-size:.78rem;color:#c2571b;text-align:center}';
  document.head.appendChild(css);

  /* ---------------- accounts (same store as the social module) --- */
  var LS_ACCOUNTS = 'espil_accounts_v1', LS_SESSION = 'espil_session_v1', LS_SESSION_PARK = 'espil_session_park_v1';
  function accounts() { try { var o = JSON.parse(localStorage.getItem(LS_ACCOUNTS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
  function saveAccounts(o) { try { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(o)); } catch (_) {} }
  function session() { try { var s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); return s && s.id ? s : null; } catch (_) { return null; } }
  /* S0 activation (flip step 1): refresh the local session record
     from the Worker's server session at boot, so a Google return
     (the session arrives as a cookie) becomes the espil_session_v1
     record this module's gate reads. social.js runs the same sync
     for its surfaces. NOTE for rig verification: the sync fires at
     init, ahead of any entry interaction; the gate reads the
     record when it fires. */
  var API_BASE = 'https://api.espil.online';
  function serverSessionSync() {
    if (!window.fetch) return;
    fetch(API_BASE + '/auth/session', { credentials: 'include' }).then(function (r) {
      return r.status === 200 ? r.json() : null;
    }).then(function (body) {
      if (body && body.signedIn && body.user && body.user.name) {
        try { localStorage.setItem(LS_SESSION, JSON.stringify({ id: body.user.name, at: Date.now(), server: true })); } catch (_) {}
        try { localStorage.setItem('espil_username', body.user.name); } catch (_) {}
        try { localStorage.removeItem(LS_SESSION_PARK); } catch (_) {}
      } else {
        var s = session();
        if (s && s.server) { try { localStorage.removeItem(LS_SESSION); } catch (_) {} }
        /* A parked record is the same server session held out of a
           guest entry's way (see the guest-enter handler); the
           server saying signed-out retires it too, so a logout or
           an expired session can never be resurrected from it. */
        try { localStorage.removeItem(LS_SESSION_PARK); } catch (_) {}
      }
    }).catch(function () {});
  }
  /* S0 GAP-1 fix (2026-11-10): hand a parked session record back
     on a fresh visit. A dive handoff (espil_pending_city in
     sessionStorage, the espil-handoff class on <html>) is the
     SAME entry still travelling - the guest choice governs it
     end to end, so the record stays parked through the handoff
     and the game page it lands on enters as the guest the
     player chose. Any other load is a new visit: the record
     returns to its live key, and serverSessionSync (called next
     in init) revalidates it against the Worker, pruning it if
     the server session is gone. If a live record already
     exists it wins and the park is stale. */
  function restoreParkedSession() {
    try {
      if (localStorage.getItem(LS_SESSION)) { localStorage.removeItem(LS_SESSION_PARK); return; }
      var parked = localStorage.getItem(LS_SESSION_PARK);
      if (!parked) return;
      var handoff = false;
      try {
        handoff = document.documentElement.classList.contains('espil-handoff') ||
                  !!sessionStorage.getItem('espil_pending_city');
      } catch (_) {}
      if (handoff) return;
      localStorage.setItem(LS_SESSION, parked);
      localStorage.removeItem(LS_SESSION_PARK);
    } catch (_) {}
  }
  function sha256hex(str) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return Promise.resolve('fnv:' + (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16));
  }
  function authMsg(msg, ok) { var el = $('auth-msg'); if (el) { el.textContent = msg || ''; el.style.color = ok ? '#4a7d2a' : '#c2571b'; } }
  function completeGate() {
    try { if (window.__espilLoginGatePending && window.__espilLoginGatePending()) { window.__espilLoginGateDone(); return; } } catch (_) {}
    try { if (window.__espilLoginBypass && window.__espilLoginBypass()) return; } catch (_) {}
    var m = $('signin-modal'); if (m) m.setAttribute('aria-hidden', 'true');
  }
  function startSession(rec, msg) {
    try { localStorage.setItem(LS_SESSION, JSON.stringify({ id: rec.name, at: Date.now() })); } catch (_) {}
    try { localStorage.setItem('espil_username', rec.name); } catch (_) {}
    authMsg(msg, true);
    setTimeout(completeGate, 350);
  }
  /* Batch A (Han 2026-11-02 #2): guest-only entry until the server
     account system lands (server-side character storage + email
     verification). The account code below stays intact for that
     backend step; the guard makes it unreachable, and buildAuthZone
     renders the zone disabled. Stored accounts are never deleted. */
  var GUEST_ONLY = false; /* S0 activation (flip step 2): server accounts are live. */
  function doSignup() {
    if (GUEST_ONLY) { authMsg(t('guestOnly')); return; }
    var id = ($('eauth-su-id') || {}).value || '', nm = ($('eauth-su-name') || {}).value || '',
        em = ($('eauth-su-email') || {}).value || '', pw = ($('eauth-su-pw') || {}).value || '';
    id = id.trim(); nm = nm.trim(); em = em.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(id)) { authMsg(t('idRule')); return; }
    if (!nm || nm.length > 24) { authMsg(t('nameRule')); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { authMsg(t('emailRule')); return; }
    if (!pw || pw.length < 6) { authMsg(t('pwRule')); return; }
    var all = accounts(), key = id.toLowerCase();
    if (all[key]) { authMsg(t('taken')); return; }
    var salt = ('00000000' + Math.floor(Math.random() * 0xffffffff).toString(16)).slice(-8) +
               ('00000000' + Math.floor(Math.random() * 0xffffffff).toString(16)).slice(-8);
    sha256hex(salt + '::' + pw).then(function (hash) {
      all[key] = { name: id, display: nm, email: em, salt: salt, hash: hash, at: Date.now() };
      saveAccounts(all);
      startSession(all[key], t('created', { id: id }));
    });
  }
  function doSignin() {
    if (GUEST_ONLY) { authMsg(t('guestOnly')); return; }
    var id = (($('eauth-si-id') || {}).value || '').trim(), pw = ($('eauth-si-pw') || {}).value || '';
    var rec = accounts()[id.toLowerCase()];
    if (!rec) { authMsg(t('noAcct')); return; }
    sha256hex(rec.salt + '::' + pw).then(function (hash) {
      if (hash !== rec.hash) { authMsg(t('wrongPw')); return; }
      startSession(rec, t('welcomeBack', { id: rec.name }));
    });
  }
  function buildAuthZone() {
    var zone = $('auth-box');
    if (!zone || zone.getAttribute('data-entryflow') === '1') return;
    zone.setAttribute('data-entryflow', '1');
    /* Batch A guest-only: the pair's own account form (auth-id,
       auth-pw, auth-signin, auth-signup) is kept in place - ids and
       the social module's wiring stay valid for the server backend
       step - but every control is disabled and the reason is written
       under the form. (This replaces the tabbed rebuild this module
       used to inject: while GUEST_ONLY stands, no account control
       may be live anywhere in the modal.) */
    /* S0 activation (flip step 2): the zone is disabled only while
       GUEST_ONLY stands. With server accounts live, the form stays
       enabled and social.js owns its wiring. */
    if (GUEST_ONLY) {
      zone.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; });
    }
    var note = zone.querySelector('.auth-guestonly-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'auth-guestonly-note';
      zone.appendChild(note);
    }
    note.textContent = GUEST_ONLY ? t('guestOnly') : '';
  }

  /* ---------------- guests: adopt the server's Guest N ----------- */
  var guestIntent = false, guestNumbered = false;
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'guest-enter') {
      guestIntent = true;
      /* Batch A guest-only: a guest entry must not silently carry a
         stored account session (the custmerge gate would otherwise
         adopt the account's registered character, and presence would
         join under the account name). Capture phase: this runs before
         the gate completes and the character gate reads the session.
         S0 GAP-1 fix (2026-11-10): the record is PARKED, not dropped.
         The live key still leaves before the gate completes - every
         consumer of this entry (the spawn gate above, custmerge,
         monolith's espilGuestNow, presence) keys off the record's
         absence, so the entry stays a true guest entry, pinned to
         the Art Gallery with no restore. But the record is the local
         face of a server session the player never signed out of:
         parking it verbatim under LS_SESSION_PARK lets the next
         fresh visit restore it (restoreParkedSession in init), so
         entering as a guest no longer signs the player out.
         espil_accounts_v1 itself stays untouched, as before. */
      try {
        var raw = localStorage.getItem(LS_SESSION);
        if (raw) localStorage.setItem(LS_SESSION_PARK, raw);
        localStorage.removeItem(LS_SESSION);
      } catch (_) {}
    }
  }, true);
  setInterval(function () {
    if (guestNumbered || session()) return;
    var st = null;
    try { st = window.__espilChatState && window.__espilChatState(); } catch (_) {}
    if (!st || !st.joined || !st.myId) return;
    var me = null;
    for (var i = 0; i < st.users.length; i++) if (st.users[i].id === st.myId) { me = st.users[i]; break; }
    if (!me) return;
    if (/^Guest \d+$/.test(me.name)) {
      // the Worker numbered this guest at join - adopt it locally
      try { localStorage.setItem('espil_username', me.name); } catch (_) {}
      guestNumbered = true;
      return;
    }
    if (guestIntent && me.name === 'Guest') {
      // fallback until the Worker update deploys: count the room
      var max = 0;
      st.users.forEach(function (u) { var m = /^Guest (\d+)$/.exec(u.name || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); });
      try { localStorage.setItem('espil_username', 'Guest ' + (max + 1)); } catch (_) {}
      guestNumbered = true;
    }
  }, 1000);

  /* ---------------- location picker ------------------------------ */
  var COS = Math.cos(49.2827 * Math.PI / 180);
  function xy(lat, lng) { return { x: Math.round((lng + 123.1207) * 111320 * COS), z: Math.round(-(lat - 49.2827) * 111320) }; }
  var VAN_BOUNDS = { x0: -1799, z0: -2028, x1: 2027, z1: 1956 }; // cfg.bounds for Vancouver
  var SPOTS = [
    { id: 'current', label: 'curLoc', wide: true },
    { id: 'gallery', label: 'gallery', x: 3, z: 33 }, // the Art Gallery plaza (the first-summon spot)
    { id: 'robsonsq', label: 'robsonSq', lat: 49.282000, lng: -123.121000 },
    { id: 'holt', label: 'holt', lat: 49.284078, lng: -123.116606 },
    { id: 'waterfront', label: 'waterfront', lat: 49.285692, lng: -123.111674 },
    { id: 'stanley', label: 'stanley', lat: 49.292200, lng: -123.136800 },
    { id: 'englishbay', label: 'englishBay', lat: 49.277000, lng: -123.140200 }
  ];
  SPOTS.forEach(function (s) { if (s.lat !== undefined) { var p = xy(s.lat, s.lng); s.x = p.x; s.z = p.z; } });
  function snapWalkable(x, z) {
    var probe = window.__espilCollisionProbe;
    if (typeof probe !== 'function') return { x: x, z: z };
    function ok(px, pz) {
      try { var r = probe(px, pz); return r && r.cls && r.cls !== 'building' && r.cls !== 'water'; } catch (_) { return false; }
    }
    if (ok(x, z)) return { x: x, z: z };
    for (var r = 6; r <= 84; r += 6) {
      for (var a = 0; a < 16; a++) {
        var px = Math.round(x + r * Math.cos(a * Math.PI / 8)), pz = Math.round(z + r * Math.sin(a * Math.PI / 8));
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x: x, z: z };
  }
  var locEl = null;
  function buildLocPick() {
    locEl = document.createElement('div');
    locEl.id = 'espil-locpick';
    locEl.setAttribute('aria-hidden', 'true');
    locEl.setAttribute('role', 'dialog');
    var city = 'Vancouver';
    var btns = SPOTS.map(function (s) {
      return '<button type="button" class="locpick-btn' + (s.wide ? ' wide' : '') + '" data-spot="' + s.id + '">' + esc(t(s.label)) + '</button>';
    }).join('');
    locEl.innerHTML = '<div class="locpick-card"><h3>' + esc(t('locTitle')) + '</h3><p>' +
      esc(t('locSub', { city: city })) + '</p><div class="locpick-grid">' + btns +
      '</div><p class="locpick-msg" id="locpick-msg"></p></div>';
    document.body.appendChild(locEl);
    locEl.querySelectorAll('.locpick-btn').forEach(function (b) {
      b.addEventListener('click', function () { chooseSpot(b.getAttribute('data-spot')); });
    });
  }
  function locMsg(m) { var el = $('locpick-msg'); if (el) el.textContent = m || ''; }
  function chooseSpot(id) {
    if (id === 'current') {
      if (!navigator.geolocation) { locMsg(t('noGeo')); return; }
      locMsg(t('locating'));
      navigator.geolocation.getCurrentPosition(function (pos) {
        var p = xy(pos.coords.latitude, pos.coords.longitude);
        if (p.x < VAN_BOUNDS.x0 || p.x > VAN_BOUNDS.x1 || p.z < VAN_BOUNDS.z0 || p.z > VAN_BOUNDS.z1) {
          if (typeof window.__espilToast === 'function') window.__espilToast(t('outside'));
          finishPick(snapWalkable(3, 33));
          return;
        }
        finishPick(snapWalkable(p.x, p.z));
      }, function () { locMsg(t('noGeo')); }, { timeout: 8000, maximumAge: 60000 });
      return;
    }
    var s = null;
    SPOTS.forEach(function (o) { if (o.id === id) s = o; });
    if (s) finishPick(snapWalkable(s.x, s.z));
  }
  var pendingNext = null;
  function finishPick(p) {
    window.__espilSpawnPick = { x: p.x, z: p.z };
    if (locEl) locEl.setAttribute('aria-hidden', 'true');
    var n = pendingNext; pendingNext = null;
    if (typeof n === 'function') n(); /* the world's own continuation enters the map */
  }
  window.__espilEntryLocationGate = function (next) {
    var key = '';
    try { var k = window.__espilCityKey; key = String(typeof k === 'function' ? k() : (k || '')).toLowerCase(); } catch (_) {}
    if (key && key.indexOf('vancouver') < 0) { if (typeof next === 'function') next(); return; }
    /* Batch D3 (Han 2026-11-03) + Han 2026-11-04 refinement:
       entry NEVER asks for a location (the picker UI is not built
       or shown), and the spawn rule is exactly:
       - arriving DIRECTLY on the GAME PAGE (/vancouver -
         vancouver.html alone sets window.__ESPIL_GAME_PAGE, and a
         direct visit carries no landing handoff mark: the pair's
         head script adds the espil-handoff class when a landing
         DIVE's espil_pending_city is in sessionStorage) WITH a
         valid cached last position resumes at that last location
         (LOGGED-IN sessions only - the session scope note below;
         guests take the gallery branch even on this path):
         no pick is set, so espilEntryStart resumes exactly as
         before. Valid means espil_last_pos parses to numeric x/z,
         its city is 'vancouver' or unset, and it lies inside the
         Vancouver playable bounds with the same 50 m margin the
         world's own loadLastPos allows.
       - EVERY other entry - no cache, an invalid cache, or any
         other entry path (the landing page, including its DIVE
         handoff onto the game page) - spawns in front of the
         downtown Art Gallery: the old picker's own 'gallery'
         spot (3, 33), street-side south of the gallery footprint,
         snapped to walkable ground, handed over as the spawn pick
         (an explicit pick beats the saved position in
         espilEntryStart, so the gallery wins there too).
       The picker code above stays dormant for a future multi-spot
       return. espil_last_pos keeps being recorded by the world;
       it is only ever READ for the game-page resume above.
       Session scope (Han, clarified 2026-11-06 11:36, superseding
       both earlier readings of his gallery line): the resume above
       is a LOGGED-IN user's restore only - GUESTS are pinned to
       the Art Gallery on EVERY entry path, regardless of any
       espil_last_pos cache. isLoggedIn() below is the single
       session signal for this gate, built on this module's own
       account store (session() / accounts() - the same records
       custmerge.js reads at its gate). Account login is disabled
       in the current build (GUEST_ONLY stands; the sign-in form is
       inert), so no live path writes a session today, every real
       entry is a guest entry, and the gallery pick below is set
       deterministically - the guest branch never consults the
       cache for spawning. (The guest-enter handler above also
       parks any stored session record out of the live key when
       the guest button is used - restored on a later fresh
       visit, never during the guest entry itself - so a session
       can only ever reach this gate via a real sign-in through
       startSession.) The account stage only has to enable
       sign-in and the restore branch goes live with no further
       spawn changes. */
    function isLoggedIn() {
      var ses = session();
      /* S0 activation (flip step 1): the basis is the SERVER
         session - espil_session_v1 as written from the Worker's
         /auth/session response (server:true). espil_accounts_v1
         is retired as an authority: records stay in place, never
         deleted, never read for auth. This is the swap PLAN.md S0
         names - the restore branch above goes live on it with no
         further spawn changes. */
      return !!(ses && ses.server === true && ses.id);
    }
    var loggedIn = isLoggedIn();
    var directGamePage = false;
    try { directGamePage = window.__ESPIL_GAME_PAGE === true && !document.documentElement.classList.contains('espil-handoff'); } catch (_) {}
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('espil_last_pos') || 'null'); } catch (_) {}
    if (loggedIn && directGamePage && saved && typeof saved.x === 'number' && isFinite(saved.x) && typeof saved.z === 'number' && isFinite(saved.z) &&
        (!saved.city || saved.city === 'vancouver') &&
        saved.x >= VAN_BOUNDS.x0 - 50 && saved.x <= VAN_BOUNDS.x1 + 50 && saved.z >= VAN_BOUNDS.z0 - 50 && saved.z <= VAN_BOUNDS.z1 + 50) {
      if (typeof next === 'function') next();
      return;
    }
    pendingNext = typeof next === 'function' ? next : null;
    finishPick(snapWalkable(3, 33));
  };

  /* claim the auth zone now, and re-claim it whenever the modal opens */
  function init() {
    buildAuthZone();
    restoreParkedSession();
    serverSessionSync();
    var m = $('signin-modal');
    if (m && !m.__espilEntryObs) {
      m.__espilEntryObs = true;
      new MutationObserver(function () { if (m.getAttribute('aria-hidden') === 'false') buildAuthZone(); })
        .observe(m, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* =====================================================================
   LANDING FLOW (Han direct order, 2026-11-09): the landing no longer
   starts at city selection. The staged order is: the text div as
   before (title presentation unchanged) -> FIRST Login / Guest (the
   existing sign-in modal is this step) -> THEN the menu (Play / Shop /
   Zealandia / About) -> Play and Shop share CITY SELECTION (all
   cities selectable; a city without a data bundle shows the
   preparation panel - city name + data-pack-in-preparation notice +
   back to the selection; no fake map, no silent Vancouver fallback)
   -> the chosen city is entered in the recorded mode.

   MODE CONTRACT: Play/Shop record the mode in sessionStorage
   'espil_entry_mode' ('play' | 'shop') and on window.__espilEntryMode
   BEFORE any navigation; monsters.js reads it at boot on the game
   page (shop = zero spawns, zero activation). A direct game-page
   entry with no stored mode defaults to 'play' on that side.

   This section is a separate IIFE appended after the module above:
   it edits no existing function, so the staged S0 pair patches
   (whose hunks live in the module above and in the modal markup)
   keep their context lines byte-for-byte.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__espilLandingFlow) return; /* single instance */

  /* ---- scope guards: this flow owns a PLAIN landing load only.
     The game page, a dive handoff, a direct city entry and a
     pending city switch all keep the existing machinery. ---- */
  var plainLanding = false;
  try {
    plainLanding =
      window.__ESPIL_GAME_PAGE !== true &&
      window.__espilDirectCityEntry !== true &&
      !document.documentElement.classList.contains('espil-handoff') &&
      !sessionStorage.getItem('espil_pending_city');
  } catch (e) { plainLanding = false; }
  if (!plainLanding) return;

  var $ = function (id) { return document.getElementById(id); };
  var step = 'boot'; /* boot -> login -> menu -> city -> done */
  var chosenMode = null;

  /* Cities with a data bundle in the shipped config (monolith's
     ESPIL_CITIES keys). Every other city on the globe is
     bundle-less and gets the preparation panel. Of the bundle
     cities only Vancouver's entry gate is open in the current
     monolith build (espilPlayableCity / ESPIL_SELECTABLE_CITIES
     live in monolith.js) - see landing/MONOLITH-SEAM.md; until
     that seam lands, a bundle city other than Vancouver also
     lands on the preparation panel. */
  var BUNDLE_CITIES = { 'Vancouver': 1, 'Auckland': 1, 'Tokyo': 1, 'New York': 1, 'Paris': 1, 'London': 1 };

  /* ---------------- styling (own style element) ---------------- */
  var css = document.createElement('style');
  css.id = 'espil-landing-flow-css';
  css.textContent =
    '#espil-mainmenu,#espil-zealandia-panel,#espil-about-panel,#espil-cityprep-panel{position:fixed;inset:0;z-index:60;display:none;' +
      'align-items:center;justify-content:center;background:rgba(4,6,9,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}' +
    '#espil-mainmenu[aria-hidden="false"],#espil-zealandia-panel[aria-hidden="false"],' +
    '#espil-about-panel[aria-hidden="false"],#espil-cityprep-panel[aria-hidden="false"]{display:flex}' +
    '.espil-flow-card{width:min(92vw,380px);background:rgba(9,11,15,.92);border:1px solid rgba(255,217,122,.35);border-radius:16px;' +
      'padding:26px 24px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.55);font-family:"Manrope",sans-serif;color:#f3ead2}' +
    '.espil-flow-card h2{margin:0 0 4px;font-size:21px;font-weight:800;letter-spacing:.02em;color:#ffe9a8}' +
    '.espil-flow-card .espil-flow-sub{margin:0 0 18px;font-size:12px;line-height:1.55;color:rgba(243,234,210,.72)}' +
    '.espil-flow-card p.espil-flow-copy{margin:0 0 18px;font-size:13px;line-height:1.65;color:rgba(243,234,210,.88);text-align:left}' +
    '.espil-flow-btn{display:block;width:100%;margin:8px 0;padding:12px 14px;border-radius:11px;border:1px solid rgba(255,217,122,.4);' +
      'background:rgba(255,217,122,.08);color:#ffe9a8;font:800 14px "Manrope",sans-serif;letter-spacing:.03em;cursor:pointer}' +
    '.espil-flow-btn:hover{background:rgba(255,217,122,.18)}' +
    '.espil-flow-btn.espil-flow-primary{background:linear-gradient(180deg,#ffd97a,#e8ae3c);color:#241a04;border-color:#ffd97a}' +
    '.espil-flow-btn.espil-flow-ghost{background:transparent;border-color:rgba(243,234,210,.25);color:rgba(243,234,210,.8);font-weight:700}' +
    '#espil-cityprep-name{color:#ffe9a8}';
  document.head.appendChild(css);

  /* ---------------- DOM: menu + panels ---------------- */
  function el(tag, id, cls) {
    var n = document.createElement(tag);
    if (id) n.id = id;
    if (cls) n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    return n;
  }
  function buildUI() {
    if ($('espil-mainmenu')) return;
    var menu = el('div', 'espil-mainmenu');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Espil Online menu');
    menu.innerHTML =
      '<div class="espil-flow-card"><h2>Espil Online</h2>' +
      '<p class="espil-flow-sub">A digital replica of this world, in real time.</p>' +
      '<button type="button" class="espil-flow-btn espil-flow-primary" id="espil-menu-play">Play</button>' +
      '<button type="button" class="espil-flow-btn" id="espil-menu-shop">Shop</button>' +
      '<button type="button" class="espil-flow-btn" id="espil-menu-zealandia">Zealandia</button>' +
      '<button type="button" class="espil-flow-btn espil-flow-ghost" id="espil-menu-about">About</button></div>';
    document.body.appendChild(menu);

    var zea = el('div', 'espil-zealandia-panel');
    zea.setAttribute('role', 'dialog');
    zea.setAttribute('aria-label', 'Zealandia');
    zea.innerHTML =
      '<div class="espil-flow-card"><h2>Zealandia</h2>' +
      '<p class="espil-flow-copy">Zealandia is where the real game continues - in the Espil app for mobile and PC. ' +
      'There is no entry into Zealandia on the web: here the journey ends at the Auckland Time Stone, and the app takes over from there.</p>' +
      '<button type="button" class="espil-flow-btn espil-flow-ghost" id="espil-zealandia-back">Back</button></div>';
    document.body.appendChild(zea);

    var about = el('div', 'espil-about-panel');
    about.setAttribute('role', 'dialog');
    about.setAttribute('aria-label', 'About Espil Online');
    about.innerHTML =
      '<div class="espil-flow-card"><h2>About Espil Online</h2>' +
      '<p class="espil-flow-copy">Espil Online is a digital replica of this world, based on the real world in real time - ' +
      'the sky, the weather and the alignment of the stars move with the real world. Vancouver is the first city; ' +
      'the destination is a map of the whole world, with the city chosen by where you are.</p>' +
      '<button type="button" class="espil-flow-btn espil-flow-ghost" id="espil-about-back">Back</button></div>';
    document.body.appendChild(about);

    var prep = el('div', 'espil-cityprep-panel');
    prep.setAttribute('role', 'dialog');
    prep.setAttribute('aria-label', 'City in preparation');
    prep.innerHTML =
      '<div class="espil-flow-card"><h2 id="espil-cityprep-name">City</h2>' +
      '<p class="espil-flow-copy">This city\'s data pack is in preparation. When it is ready, the city opens here exactly as it stands in the real world.</p>' +
      '<button type="button" class="espil-flow-btn espil-flow-ghost" id="espil-cityprep-back">Back to city selection</button></div>';
    document.body.appendChild(prep);

    $('espil-menu-play').addEventListener('click', function () { chooseMode('play'); });
    $('espil-menu-shop').addEventListener('click', function () { chooseMode('shop'); });
    $('espil-menu-zealandia').addEventListener('click', function () { show(zea); });
    $('espil-menu-about').addEventListener('click', function () { show(about); });
    $('espil-zealandia-back').addEventListener('click', function () { hide(zea); });
    $('espil-about-back').addEventListener('click', function () { hide(about); });
    $('espil-cityprep-back').addEventListener('click', function () { hide(prep); });
  }
  function show(n) { if (n) n.setAttribute('aria-hidden', 'false'); }
  function hide(n) { if (n) n.setAttribute('aria-hidden', 'true'); }

  /* ---------------- the steps ---------------- */
  function openLoginStep() {
    if (step !== 'boot' && step !== 'login') return;
    step = 'login';
    if (typeof window.__espilOpenAuth === 'function') { window.__espilOpenAuth(); return; }
    var m = $('signin-modal');
    if (m) {
      m.setAttribute('aria-hidden', 'false');
      var cs = $('city-status'); if (cs) cs.classList.add('gate-hidden');
    }
  }
  function sessionRecord() {
    try { var s = JSON.parse(localStorage.getItem('espil_session_v1') || 'null'); return s && s.id ? s : null; }
    catch (e) { return null; }
  }
  function completeLogin() {
    if (step !== 'login') return;
    step = 'menu';
    var m = $('signin-modal'); if (m) m.setAttribute('aria-hidden', 'true');
    var cs = $('city-status'); if (cs) cs.classList.add('gate-hidden'); /* the menu owns the screen until Play/Shop */
    buildUI();
    show($('espil-mainmenu'));
  }
  function setEntryMode(mode) {
    chosenMode = mode;
    try { sessionStorage.setItem('espil_entry_mode', mode); } catch (e) {}
    window.__espilEntryMode = mode;
  }
  function chooseMode(mode) {
    setEntryMode(mode);
    hide($('espil-mainmenu'));
    step = 'city';
    var cs = $('city-status'); if (cs) cs.classList.remove('gate-hidden'); /* city selection is live: the text div returns */
    activateCityLayer();
  }

  /* ---------------- city selection layer ----------------
     Monolith's reel lists only the cities its selectable set
     opens, and its pins sit disabled for the rest. Han's order
     makes ALL cities selectable: while the flow is at the city
     step this layer lists every city, re-enables every pin, and
     routes each pick - Vancouver to monolith's own button (its
     info panel and DIVE run untouched), every other city to the
     preparation panel. */
  var cityLayerActive = false;
  function harvestCities() {
    var out = [];
    var pins = document.querySelectorAll('#city-pins .city-pin');
    for (var i = 0; i < pins.length; i++) {
      var label = pins[i].getAttribute('aria-label') || '';
      var name = label.split(',')[0].trim();
      if (name) out.push({ name: name, pin: pins[i] });
    }
    return out;
  }
  function openPrep(name) {
    var n = $('espil-cityprep-name'); if (n) n.textContent = name;
    show($('espil-cityprep-panel'));
  }
  function activateCityLayer() {
    if (cityLayerActive) return;
    cityLayerActive = true;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var cities = harvestCities();
      var list = $('city-list');
      if ((!cities.length || !list) && tries < 200) return;
      clearInterval(timer);
      if (!list) return;
      /* pins: every city selectable */
      cities.forEach(function (c) {
        c.pin.disabled = false;
        c.pin.classList.remove('is-inactive');
      });
      /* the reel: hide monolith's own entries, list all cities */
      var orig = [];
      for (var i = 0; i < list.children.length; i++) {
        orig.push(list.children[i]);
        list.children[i].style.display = 'none';
      }
      cities.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'city-name espil-city-btn';
        b.textContent = c.name;
        b.setAttribute('data-city', c.name);
        b.setAttribute('aria-label', c.pin.getAttribute('aria-label') || c.name);
        b.addEventListener('click', function () {
          var btns = list.querySelectorAll('.espil-city-btn');
          for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('is-centered', btns[j] === b);
          if (c.name === 'Vancouver') {
            for (var k = 0; k < orig.length; k++) {
              if ((orig[k].textContent || '').trim() === 'Vancouver') { orig[k].click(); return; }
            }
          }
          openPrep(c.name);
        });
        list.appendChild(b);
      });
    }, 300);
    /* pin picks for non-Vancouver cities: capture-phase, so
       monolith's own pin handler (which would refuse them) never
       runs; Vancouver's pin falls through to the native flow. */
    document.addEventListener('click', function (e) {
      if (step !== 'city') return;
      var t = e.target;
      var pin = t && t.closest ? t.closest('.city-pin') : null;
      if (!pin) return;
      var name = (pin.getAttribute('aria-label') || '').split(',')[0].trim();
      if (!name || name === 'Vancouver') return;
      e.stopPropagation();
      e.preventDefault();
      openPrep(name);
    }, true);
  }

  /* Guest completion of the login step: capture-phase at the
     document, registered after entry-flow's own guest listener
     above (which drops any stored session first, as before). The
     propagation stop keeps landing-auth's landing-page toast
     ('Guest entry is available at a city gate') from firing -
     under this flow the guest button IS the gate. On the game
     page this whole section never runs, so the in-entry guest
     path is untouched. */
  document.addEventListener('click', function (e) {
    if (step !== 'login') return;
    if (e.target && e.target.id === 'guest-enter') {
      e.stopPropagation();
      completeLogin();
    }
  }, true);

  /* Sign-in completion (post-S0): a session record appearing
     while the flow sits at the login step advances it to the
     menu - this is how a Google return or an email sign-in
     (startSession -> completeGate hides the modal) flows on. */
  setInterval(function () {
    if (step === 'login' && sessionRecord()) completeLogin();
  }, 500);

  /* Order guard (Han 2026-11-10: mode selection comes BEFORE
     city selection): until the flow reaches the city step,
     monolith's native reel keys (Enter / ArrowUp / ArrowDown)
     must not step or select a city - during the intro slide-up
     window and at the menu step the reel is hidden, but the
     keys would otherwise still drive it. Keys that belong to
     the intro, to a form control, to the sign-in div or to
     this flow's own panels pass through untouched. */
  document.addEventListener('keydown', function (e) {
    if (step === 'city' || step === 'done') return;
    if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (window.__espilIntroActive) return;
    var t = e.target;
    if (t) {
      var tag = t.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (t.closest && (t.closest('#signin-div') || t.closest('#espil-mainmenu') ||
          t.closest('#espil-zealandia-panel') || t.closest('#espil-about-panel') ||
          t.closest('#espil-cityprep-panel'))) return;
    }
    e.stopPropagation();
    e.preventDefault();
  }, true);

  /* Same order guard for the mouse: a click on the globe canvas
     before the city step can raycast-select a city (monolith
     flies the camera and the city info panel follows) - swallow
     canvas clicks until the city step. Orbit dragging is driven
     by pointer movement, not by the click event, so the start
     presentation's globe stays orbitable. */
  document.addEventListener('click', function (e) {
    if (step === 'city' || step === 'done') return;
    if (window.__espilIntroActive) return;
    var t = e.target;
    if (t && t.tagName === 'CANVAS') e.stopPropagation();
  }, true);

  /* probe/inspection hook */
  window.__espilLandingFlow = {
    step: function () { return step; },
    mode: function () { return chosenMode; },
    bundleCities: Object.keys(BUNDLE_CITIES)
  };

  /* ---------------- boot: the intro plays first, as today ------ */
  /* Order (Han 2026-11-10): the city-selection reel inside the
     text div is not presented before the mode menu. The div
     starts gate-hidden (the intro covers the first moments, as
     today), shows the login form at the login step (.auth-open
     overrides gate-hidden for the form alone), stays hidden at
     the menu step, and returns only at the city step, where
     chooseMode removes gate-hidden exactly as before. */
  var csBoot = $('city-status');
  if (csBoot) csBoot.classList.add('gate-hidden');
  var bootTries = 0;
  var bootTimer = setInterval(function () {
    bootTries++;
    var introEl = document.getElementById('intro');
    var introActive = window.__espilIntroActive === true;
    if ((!introEl && !introActive) || bootTries > 400) {
      clearInterval(bootTimer);
      openLoginStep();
    }
  }, 300);
})();

