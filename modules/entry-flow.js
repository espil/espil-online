
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
    guestOnly: { en: 'Account sign-in is paused. Accounts are moving to our server, with character data saved server-side and email verification. Until that system lands, entry is guest-only.', ko: '계정 로그인은 잠시 중단되었습니다. 계정은 저희 서버로 이전되며, 캐릭터 데이터는 서버에 저장되고 이메일 인증이 도입됩니다. 그 시스템이 열릴 때까지는 게스트로만 입장하실 수 있습니다.', fr: 'La connexion par compte est en pause. Les comptes migrent vers notre serveur, avec les personnages enregistrés côté serveur et une vérification par e-mail. En attendant, l\'entrée est réservée aux invités.', zh: '账户登录已暂停。账户正在迁移到我们的服务器，角色数据将保存在服务器端并引入邮箱验证。在此之前，仅限访客进入。' }
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
  var LS_ACCOUNTS = 'espil_accounts_v1', LS_SESSION = 'espil_session_v1';
  function accounts() { try { var o = JSON.parse(localStorage.getItem(LS_ACCOUNTS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
  function saveAccounts(o) { try { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(o)); } catch (_) {} }
  function session() { try { var s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); return s && s.id ? s : null; } catch (_) { return null; } }
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
  var GUEST_ONLY = true;
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
    zone.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; });
    var note = zone.querySelector('.auth-guestonly-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'auth-guestonly-note';
      zone.appendChild(note);
    }
    note.textContent = t('guestOnly');
  }

  /* ---------------- guests: adopt the server's Guest N ----------- */
  var guestIntent = false, guestNumbered = false;
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'guest-enter') {
      guestIntent = true;
      /* Batch A guest-only: a guest entry must not silently carry a
         stored account session (the custmerge gate would otherwise
         adopt the account's registered character, and presence would
         join under the account name). Drop ONLY the session record;
         espil_accounts_v1 itself is left untouched for the server
         backend step. Capture phase: this runs before the gate
         completes and the character gate reads the session. */
      try { localStorage.removeItem(LS_SESSION); } catch (_) {}
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
         valid cached last position resumes at that last location:
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
       it is only ever READ for the game-page resume above. */
    var directGamePage = false;
    try { directGamePage = window.__ESPIL_GAME_PAGE === true && !document.documentElement.classList.contains('espil-handoff'); } catch (_) {}
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('espil_last_pos') || 'null'); } catch (_) {}
    if (directGamePage && saved && typeof saved.x === 'number' && isFinite(saved.x) && typeof saved.z === 'number' && isFinite(saved.z) &&
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

