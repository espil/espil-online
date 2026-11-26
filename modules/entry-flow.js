
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
   (2) window.__espilEntryLocationGate - the arrival decision
       the character gate detours through. Batch D3 (Han
       2026-11-03) stopped the asking: the gate handed
       espilEntryStart a fixed first spawn in front of the Art
       Gallery as window.__espilSpawnPick; other cities entered
       directly. Location summon (Han 2026-11-18) restores the
       question in this chain - see the LOCATION SUMMON block at
       the gate: an unset device preference asks (fresh and
       returning users alike), 'always' receives silently,
       'never' is exactly the D3 judgement, which survives
       verbatim below as espilGateUsual. The Batch D3 spot
       picker implementation stays dormant. */
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
    geoAskTitle: { en: 'Start where you really are?', ko: '실제 계신 곳에서 시작하시겠습니까?', fr: 'Commencer l\u00e0 o\u00f9 vous \u00eates vraiment ?', zh: '从您实际所在的地方开始吗？' },
    geoAskSub: { en: 'Your location is checked on this device only, so you arrive at the matching place in the world. It is never sent to the server and never stored.', ko: '이 기기에서만 위치를 확인해 실제 위치와 같은 자리에 도착합니다. 위치는 서버로 보내지 않고 저장하지 않습니다.', fr: "Votre position est v\u00e9rifi\u00e9e sur cet appareil uniquement, pour arriver \u00e0 l'endroit correspondant dans le monde. Elle n'est jamais envoy\u00e9e au serveur ni conserv\u00e9e.", zh: '仅在此设备上确认您的位置，让您抵达世界中对应的地点。位置绝不会发送到服务器，也不会被保存。' },
    geoMine: { en: 'Start at my location', ko: '내 위치에서 시작', fr: 'Commencer \u00e0 ma position', zh: '从我的位置开始' },
    geoUsual: { en: 'Start at the usual place', ko: '평소 위치에서 시작', fr: "Commencer \u00e0 l'endroit habituel", zh: '从平常的位置开始' },
    geoCentre: { en: 'Start at the city centre', ko: '도시 중심에서 시작', fr: 'Commencer au centre-ville', zh: '从市中心开始' },
    geoLast: { en: 'Start at my last place', ko: '마지막 장소에서 시작', fr: 'Commencer \u00e0 mon dernier endroit', zh: '从上次的地点开始' },
    geoDontAsk: { en: "Don't ask again", ko: '다음부터 묻지 않기', fr: 'Ne plus demander', zh: '下次不再询问' },
    geoBack: { en: 'Back', ko: '뒤로', fr: 'Retour', zh: '返回' },
    geoFail: { en: 'Your location could not be confirmed - starting at the usual place.', ko: '위치를 확인할 수 없어 평소 위치에서 시작합니다.', fr: "Votre position n'a pas pu \u00eatre confirm\u00e9e - d\u00e9part \u00e0 l'endroit habituel.", zh: '无法确认您的位置，将从平常的位置开始。' },
    geoInaccurate: { en: 'That fix was too rough to trust - starting at the usual place.', ko: '위치 정확도가 낮아 평소 위치에서 시작합니다.', fr: "Cette position \u00e9tait trop impr\u00e9cise - d\u00e9part \u00e0 l'endroit habituel.", zh: '位置精度太低，将从平常的位置开始。' },
    geoClamped: { en: 'That is just outside the playable area - arriving at its nearest edge.', ko: '플레이 가능 지역 바로 밖이라 가장 가까운 경계에 도착합니다.', fr: "C'est juste hors de la zone jouable - arriv\u00e9e au bord le plus proche.", zh: '那里刚好在可游玩区域之外，将抵达最近的边界。' },
    geoOtherCity: { en: 'You are in {city} - this dive still enters {here}. Starting at the usual place.', ko: '{city}에 계십니다. 이번 다이브는 {here}로 들어가 평소 위치에서 시작합니다.', fr: 'Vous \u00eates \u00e0 {city} - cette plong\u00e9e entre quand m\u00eame \u00e0 {here}. D\u00e9part \u00e0 l\'endroit habituel.', zh: '您在{city}。本次进入仍前往{here}，将从平常的位置开始。' },
    geoFar: { en: 'That is far from {here} - starting at the usual place.', ko: '{here}에서 먼 곳이라 평소 위치에서 시작합니다.', fr: "C'est loin de {here} - d\u00e9part \u00e0 l'endroit habituel.", zh: '那里离{here}很远，将从平常的位置开始。' },
    geoDeniedNote: { en: 'Location permission is off in this browser - enter at the usual place, or allow location and pick the first row.', ko: '이 브라우저에서 위치 권한이 꺼져 있습니다. 평소 위치로 들어가시거나, 위치를 허용하고 첫 행을 골라 주세요.', fr: "L'autorisation de localisation est d\u00e9sactiv\u00e9e dans ce navigateur - entrez par l'endroit habituel, ou autorisez la position et choisissez la premi\u00e8re ligne.", zh: '此浏览器中位置权限已关闭。请从平常的位置进入，或允许定位后选择第一行。' },
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
    '.locpick-msg{min-height:18px;margin:10px 0 0;font-size:.78rem;color:#c2571b;text-align:center}' +
    '#espil-locsummon{position:fixed;inset:0;z-index:62;display:none;align-items:center;justify-content:center;background:rgba(4,12,14,.8);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
    '#espil-locsummon[aria-hidden="false"]{display:flex}' +
    '.locsummon-card{width:min(430px,92vw);border-radius:18px;padding:22px 22px 16px;background:linear-gradient(180deg,#fffbf0,#fff3dc);border:2px solid #d9b380;box-shadow:0 24px 60px rgba(90,60,20,.35);color:#5a4020;font-family:"Manrope",sans-serif}' +
    '.locsummon-card h3{margin:0 0 4px;font-size:1.05rem;letter-spacing:.02em}' +
    '.locsummon-card p{margin:0 0 14px;font-size:.8rem;opacity:.75}' +
    '.locsummon-list{display:flex;flex-direction:column;gap:9px}' +
    '.locsummon-row{padding:13px 10px;border-radius:12px;border:2px solid #cfa96f;background:linear-gradient(180deg,#fffdf6,#ffeecd);color:#6b4a1f;font:700 .82rem/1.25 "Manrope",sans-serif;cursor:pointer;text-align:center;box-shadow:inset 0 -3px 0 rgba(207,169,111,.35)}' +
    '.locsummon-row:hover,.locsummon-row:focus-visible{border-color:#b57708;background:linear-gradient(180deg,#ffe9b8,#ffd98c);outline:none}' +
    '.locsummon-row.primary{background:linear-gradient(180deg,#ffb84d,#f08c1a);border-color:#d97f10;color:#fff;text-shadow:0 1px 2px rgba(120,60,0,.5)}' +
    '.locsummon-row.dim{opacity:.55}' +
    '.locsummon-toggle{display:flex;align-items:center;gap:8px;padding:4px 2px;font:600 .8rem/1.3 "Manrope",sans-serif;color:#6b4a1f;cursor:pointer}' +
    '.locsummon-msg{min-height:18px;margin:10px 0 0;font-size:.78rem;color:#c2571b;text-align:center}';
  document.head.appendChild(css);

  /* ---------------- accounts (same store as the social module) --- */
  var LS_ACCOUNTS = 'espil_accounts_v1', LS_SESSION = 'espil_session_v1', LS_SESSION_PARK = 'espil_session_park_v1';
  function accounts() { try { var o = JSON.parse(localStorage.getItem(LS_ACCOUNTS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
  function saveAccounts(o) { try { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(o)); } catch (_) {} }
  function session() { try { var s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); return s && s.id ? s : null; } catch (_) { return null; } }
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
  /* S0 activation (flip step 1): refresh the local session record
     from the Worker's server session at boot, so a Google return
     (the session arrives as a cookie) becomes the espil_session_v1
     record this module's gate reads. social.js runs the same sync
     for its surfaces. NOTE for rig verification: the sync fires at
     init, ahead of any entry interaction; the gate reads the
     record when it fires. */
  var API_BASE = (typeof window.__espilAuthApiBase === 'string' && window.__espilAuthApiBase) || 'https://api.espil.online';
  /* Character first-setup adoption (Han 2026-11-16,
     customizer-once/DESIGN.md §3.3): the server record is the
     truth and espil_character.setupDone is only its mirror.
     A server character overwrites the device's gender/bodyChoice
     and sets the mirror (a storage edit is undone at the next
     sync); no server record + a device choice POSTs that choice
     as the account's one-time setup (existing users keep the
     body they already picked - design §5.1). A failed POST
     leaves a pending mark and the next sync retries through
     this same path (§3.4 fail-soft). Guests never reach here:
     this runs only inside the signed-in branch below. */
  var ESPIL_BODY_CHOICES_EF = ['master', 'style1', 'style2', 'style3', 'style4'];
  function espilCharacterAdopt(character) {
    var rec = null;
    try { rec = JSON.parse(localStorage.getItem('espil_character') || 'null'); } catch (_) {}
    if (character && (character.gender === 'male' || character.gender === 'female') &&
        ESPIL_BODY_CHOICES_EF.indexOf(character.bodyChoice) >= 0) {
      var out = (rec && typeof rec === 'object') ? rec : {};
      out.gender = character.gender;
      out.bodyChoice = character.bodyChoice;
      out.setupDone = true;
      delete out.setupPending;
      try { localStorage.setItem('espil_character', JSON.stringify(out)); } catch (_) {}
      return;
    }
    if (character) return; /* malformed server value: assert nothing */
    if (rec && (rec.gender === 'male' || rec.gender === 'female') &&
        ESPIL_BODY_CHOICES_EF.indexOf(rec.bodyChoice) >= 0 && window.fetch) {
      var markPending = function () {
        try {
          var cur = JSON.parse(localStorage.getItem('espil_character') || 'null');
          if (cur && cur.setupDone !== true) { cur.setupPending = true; localStorage.setItem('espil_character', JSON.stringify(cur)); }
        } catch (_) {}
      };
      fetch(API_BASE + '/auth/character/setup', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: rec.gender, bodyChoice: rec.bodyChoice })
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (b) { return { status: r.status, body: b }; });
      }).then(function (res) {
        if (res && (res.status === 200 || res.status === 409) && res.body && res.body.character) {
          espilCharacterAdopt(res.body.character);
        } else { markPending(); }
      }).catch(function () { markPending(); });
    }
  }
  function serverSessionSync() {
    if (!window.fetch) return;
    fetch(API_BASE + '/auth/session', { credentials: 'include' }).then(function (r) {
      return r.status === 200 ? r.json() : null;
    }).then(function (body) {
      if (body && body.signedIn && body.user && body.user.name) {
        try {
          var sesRec = { id: body.user.name, uid: body.user.id, at: Date.now(), server: true };
          /* Owner-only designated body (Han 2026-11-17): the
             server designates the account's body (Lunaris for
             the owner's account) and carries it as
             designatedBody; mirror it onto the session record
             so the avatar builders and the presence join can
             read it. It is written ONLY from this server
             response, into a fresh object every sync - a mark
             the server no longer sends disappears here, and the
             espil_character record never carries it. */
          if (body.designatedBody === 'lunaris') sesRec.designatedBody = 'lunaris';
          localStorage.setItem(LS_SESSION, JSON.stringify(sesRec));
        } catch (_) {}
        try { localStorage.setItem('espil_username', body.user.name); } catch (_) {}
        try { localStorage.removeItem(LS_SESSION_PARK); } catch (_) {}
        try { espilCharacterAdopt(body.character || null); } catch (_) {}
      } else {
        var s = session();
        if (s && s.server) { try { localStorage.removeItem(LS_SESSION); } catch (_) {} }
        /* A parked record is the same server session held out of a
           guest entry's way (see the guest-enter handler); the
           server saying signed-out retires it too, so a logout or
           an expired session can never be resurrected from it. */
        try { localStorage.removeItem(LS_SESSION_PARK); } catch (_) {}
      }
      /* Gate re-render notice (2026-11-18, Lunaris defect 1):
         the record written above is the gate's designation and
         setup source, but the gate BODY row renders once when
         the panel opens - when this sync lands after the panel
         opened, the row keeps showing the pre-sync snapshot
         (the designated owner saw five editable cards and no
         lock line). Notify so an open gate re-renders from the
         fresh record; a closed gate renders at open anyway. */
      try { window.dispatchEvent(new CustomEvent('espil-session-sync')); } catch (_) {}
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
    /* ENTRY FLOW V2 (Han 2026-11-24): an auto-named guest's name is
       never adopted into espil_username - the v2 guest path neither
       reads nor writes that key (entry-v2/DESIGN.md 7). The tab's
       v2 handoff (the sessionStorage name key, or the window flag
       the game page's name-once pass sets when it consumes it) is
       the signal to stay out. Direct game-page guests with no v2
       handoff keep the adoption below exactly as before. */
    try { if (sessionStorage.getItem('espil_entry_v2_guest_name') || window.__espilEntryV2GuestName) return; } catch (_) {}
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
  /* The Batch D3 gate judgement, kept verbatim as the
     USUAL-PLACE path of the location summon gate further below:
     a logged-in direct game-page visit with a valid saved
     position resumes; every other entry takes the gallery pick.
     The location summon wrapper decides whether this judgement
     runs directly (preference 'never', a refusal, any receive
     failure) or whether a location pick pre-empts it. */
  function espilGateUsual(next) {
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
  }

  /* ---------------- location summon (Han 2026-11-18) ------------
     __espilLocSummonGate v1 - the location question sits HERE, in
     the entry chain between the character confirm and the loading
     sequence (the seat the 2026-10-28 seam always named), never
     during the fall: the monolith's mid-dive prompt is retired
     with this build, so the question can never double. Device
     preference espil_loc_summon_v1 in {'always','never'} (absent
     = unset): unset asks on EVERY dive, fresh and returning users
     alike (Han's decision, DESIGN.md appendix); 'always'
     receives silently; 'never' runs espilGateUsual untouched.
     Only the preference is ever stored - never a coordinate
     (design 3.6). The raw fix is judged only by the monolith
     seam window.__espilGeoJudge; this module never converts
     coordinates itself.
     REVISION (Han 2026-11-19 - the dive choice is THREE start
     options): the ask's rows are now [my location] /
     [city centre] / [last place] / [back]. The old
     [usual place] row and the [don't ask again] toggle are
     gone, and choosing a row no longer writes the preference
     - the three options ARE the dive choice. The last-place
     row shows only for a signed-in session with a saved spot
     the world itself accepts (locSavedSpot below); guests
     hold no saved position by law (Han 2026-11-06), so they
     never see it. The preference machinery survives as the
     two no-ask paths in the wrapper below: 'always' still
     receives silently, 'never' still runs espilGateUsual -
     the exact judgement those users confirmed - and a legacy
     preference is never rewritten by the ask. */
  var LS_LOC_PREF = 'espil_loc_summon_v1';
  function locPref() {
    try { var v = localStorage.getItem(LS_LOC_PREF); return (v === 'always' || v === 'never') ? v : null; } catch (_) { return null; }
  }
  function setLocPref(v) {
    try { if (v) localStorage.setItem(LS_LOC_PREF, v); else localStorage.removeItem(LS_LOC_PREF); } catch (_) {}
  }
  /* The last-place row's two conditions (Han 2026-11-19): a
     signed-in session - the same signal espilGateUsual's
     resume branch uses (a server session record) - AND a
     saved spot the world itself accepts, asked of the
     monolith seam (loadLastPos's verdict, per-city bounds
     included) so the row never promises a resume the world
     would refuse. */
  function locIsLoggedIn() {
    var ses = session();
    return !!(ses && ses.server === true && ses.id);
  }
  function locSavedSpot() {
    if (!locIsLoggedIn()) return null;
    if (typeof window.__espilSavedSpot !== 'function') return null;
    try {
      var p = window.__espilSavedSpot();
      return (p && typeof p.x === 'number' && isFinite(p.x) && typeof p.z === 'number' && isFinite(p.z)) ? p : null;
    } catch (_) { return null; }
  }
  /* Was the character panel ever PRESENTED on this page? (The
     direct-entry path never shows it.) Watched the same way
     init() watches the sign-in modal. It decides what the ask's
     Back row means (design 2.1): presented -> return to the
     panel; never presented -> Back IS the usual-place row. */
  var locPanelSeen = false, locPanelWatch = false;
  function locWatchPanel() {
    if (locPanelWatch) return;
    var panel = document.getElementById('char-custom');
    if (!panel) return;
    locPanelWatch = true;
    if (panel.getAttribute('aria-hidden') === 'false') locPanelSeen = true;
    try {
      new MutationObserver(function () {
        if (panel.getAttribute('aria-hidden') === 'false') locPanelSeen = true;
      }).observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
    } catch (_) {}
  }
  function locToast(msg) { try { if (typeof window.__espilToast === 'function') window.__espilToast(msg); } catch (_) {} }
  var LOC_CITY_NAMES = { vancouver: 'Vancouver', auckland: 'Auckland', tokyo: 'Tokyo', newyork: 'New York', paris: 'Paris', london: 'London' };
  function locCityName() {
    var k = '';
    try { var kk = window.__espilCityKey; k = String(typeof kk === 'function' ? kk() : (kk || '')).toLowerCase(); } catch (_) {}
    for (var key in LOC_CITY_NAMES) { if (k.indexOf(key) >= 0) return LOC_CITY_NAMES[key]; }
    return 'Vancouver';
  }
  /* One receive attempt, judged by the monolith seam. cb gets
     {ok:true, point, kind:'inside'|'clamped'} or {ok:false, why}
     with why in denied|timeout|error|unsupported|inaccurate|
     other-city|outside. Every failure shape lands the caller on
     the usual-place path - entry is never blocked (design 2.3).
     The fix is requested only here, at selection time. */
  function locSummonTry(cb) {
    if (!navigator.geolocation) { cb({ ok: false, why: 'unsupported' }); return; }
    var settled = false;
    function once(r) { if (settled) return; settled = true; cb(r); }
    try {
      navigator.geolocation.getCurrentPosition(function (pos) {
        var c = pos && pos.coords;
        if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number' || !isFinite(c.latitude) || !isFinite(c.longitude)) { once({ ok: false, why: 'error' }); return; }
        var maxAcc = (typeof window.__espilGeoMaxAccuracyM === 'number') ? window.__espilGeoMaxAccuracyM : 5000;
        if (typeof c.accuracy === 'number' && c.accuracy > maxAcc) { once({ ok: false, why: 'inaccurate' }); return; }
        var j = null;
        try { j = window.__espilGeoJudge(c.latitude, c.longitude); } catch (_) {}
        if (!j) { once({ ok: false, why: 'error' }); return; }
        if (j.kind === 'inside' || j.kind === 'clamped') once({ ok: true, point: j.point, kind: j.kind });
        else if (j.kind === 'other-city') once({ ok: false, why: 'other-city', city: j.city });
        else once({ ok: false, why: 'outside' });
      }, function (err) {
        once({ ok: false, why: (err && err.code === 1) ? 'denied' : (err && err.code === 3) ? 'timeout' : 'error' });
      }, { timeout: 10000, maximumAge: 60000 });
    } catch (_) { once({ ok: false, why: 'error' }); }
  }
  function locFailNotice(why, city) {
    if (why === 'inaccurate') return t('geoInaccurate');
    if (why === 'other-city') return t('geoOtherCity', { city: LOC_CITY_NAMES[city] || city || '', here: locCityName() });
    if (why === 'outside') return t('geoFar', { here: locCityName() });
    return t('geoFail');
  }
  function locFinishPick(p, next) {
    /* The gate's final snap (design 3.5 step 4): the collision
       probe keeps the pick off buildings and water, exactly as
       the gallery pick has always been snapped. */
    var s = snapWalkable(p.x, p.z);
    window.__espilSpawnPick = { x: s.x, z: s.z };
    if (typeof next === 'function') next();
  }
  var locAskEl = null;
  function hideLocAsk() { if (locAskEl) locAskEl.setAttribute('aria-hidden', 'true'); }
  function locAskMsg(m) { var el = $('locsummon-msg'); if (el) el.textContent = m || ''; }
  function buildLocAsk(next) {
    hideLocAsk();
    /* One ask element only: a re-ask after Back must not leave
       a hidden same-id element ahead of the live one. */
    var stale = document.getElementById('espil-locsummon');
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    locAskEl = null;
    var el = document.createElement('div');
    el.id = 'espil-locsummon';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-hidden', 'false');
    el.innerHTML =
      '<div class="locsummon-card"><h3>' + esc(t('geoAskTitle')) + '</h3><p>' +
      esc(t('geoAskSub')) + '</p><div class="locsummon-list">' +
      '<button type="button" class="locsummon-row primary" data-act="mine">' + esc(t('geoMine')) + '</button>' +
      '<button type="button" class="locsummon-row" data-act="centre">' + esc(t('geoCentre')) + '</button>' +
      (locSavedSpot() ? '<button type="button" class="locsummon-row" data-act="last">' + esc(t('geoLast')) + '</button>' : '') +
      '<button type="button" class="locsummon-row" data-act="back">' + esc(t('geoBack')) + '</button>' +
      '</div><p class="locsummon-msg" id="locsummon-msg"></p></div>';
    document.body.appendChild(el);
    locAskEl = el;
    /* Permission pre-check (design 2.3): where the browser can
       say the permission is already denied, note it at the ask
       instead of letting the first row fail without a word. */
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(function (st) {
          if (st && st.state === 'denied') {
            locAskMsg(t('geoDeniedNote'));
            var b = el.querySelector('[data-act="mine"]');
            if (b) b.classList.add('dim');
          }
        }).catch(function () {});
      }
    } catch (_) {}
    el.querySelectorAll('.locsummon-row').forEach(function (b) {
      b.addEventListener('click', function () { locAskChoose(b.getAttribute('data-act'), next); });
    });
  }
  function locAskChoose(act, next) {
    if (act === 'back' && locPanelSeen) {
      /* Back to the character gate: the panel WAS presented on
         this page and confirmCharacter only hid it - re-show it
         exactly as the gate left it. No answer was given. */
      hideLocAsk();
      var panel = document.getElementById('char-custom');
      if (panel) panel.setAttribute('aria-hidden', 'false');
      return;
    }
    if (act === 'back') {
      /* Back on the direct-entry path (the panel never
         presented) DECLINES the question: the pre-revision
         judgement runs (espilGateUsual), exactly as it did
         when Back shared the old usual row's branch
         (design 2.1). */
      hideLocAsk();
      espilGateUsual(next);
      return;
    }
    if (act === 'centre') {
      /* The city centre: the monolith seam names the current
         city's centre anchor; the gate's final snap keeps the
         pick off buildings and water, as every pick here. */
      hideLocAsk();
      var c = null;
      try { if (typeof window.__espilCityCentre === 'function') c = window.__espilCityCentre(); } catch (_) {}
      if (c && typeof c.x === 'number' && isFinite(c.x) && typeof c.z === 'number' && isFinite(c.z)) {
        locFinishPick(c, next);
        return;
      }
      espilGateUsual(next);
      return;
    }
    if (act === 'last') {
      /* The last place: NO pick is set - espilEntryStart's
         own resume law delivers the saved spot (in-bounds:
         the dive lands on it, footprint-edge rule included;
         out-of-bounds: it resolves to the boundary), on the
         landing path too, which the old usual judgement
         could not promise there. The spot is re-checked at
         click time; if it vanished since the ask was built,
         the usual judgement stands. Any stale pick is
         cleared first so nothing can outrank the resume. */
      hideLocAsk();
      if (locSavedSpot()) {
        try { window.__espilSpawnPick = null; } catch (_) {}
        if (typeof next === 'function') next();
        return;
      }
      espilGateUsual(next);
      return;
    }
    if (act === 'mine') {
      locAskMsg(t('locating'));
      locSummonTry(function (r) {
        if (r.ok) {
          hideLocAsk();
          if (r.kind === 'clamped') locToast(t('geoClamped'));
          locFinishPick(r.point, next);
          return;
        }
        /* Every failure shape lands on the usual judgement
           with its notice - entry is never blocked
           (design 2.3). No preference is written: the ask
           only ever runs while the preference is unset, and
           the revision's rows carry no don't-ask toggle.
           The denied-resets-the-preference rule survives in
           the wrapper's 'always' path, untouched. */
        hideLocAsk();
        locToast(locFailNotice(r.why, r.city));
        espilGateUsual(next);
      });
    }
  }
  window.__espilEntryLocationGate = function (next) {
    var n = typeof next === 'function' ? next : function () {};
    locWatchPanel();
    /* Place-space child window (design L9): the visit's place
       mark sits in this window's sessionStorage and the entry is
       the building's own space - the ask never appears there;
       the usual judgement runs exactly as before this build. */
    var placeMark = null;
    try { placeMark = JSON.parse(sessionStorage.getItem('espil_store_space_v1') || 'null'); } catch (_) {}
    if (placeMark && placeMark.city && placeMark.slug) { espilGateUsual(n); return; }
    /* ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 6): the
       entry-place ASK is retired for every population - the gate
       never asks, never reads espil_last_pos, and no preference
       is consulted or written here anymore. The ask machinery
       (buildLocAsk, locPref, locSummonTry) stays in the file
       dormant and unreachable from this gate, the way the Batch
       D3 picker was left dormant before it.
       - ACCOUNT: the city-centre pick (__espilCityCentre()),
         unconditionally. If the seam is somehow absent the
         usual judgement stands as the fail-soft, as before.
       - GUEST: NO pick is set. The monolith's entrant branch
         (espilEntryStart's espilGuestNow branch) summons at
         the entered city's landmark - that branch is the ONE
         isolated seam carrying the guest landing decision
         (design 6.2, draft reading (b): the landmark is the
         entrant's centre). If Han answers Q1 with reading (a),
         the flip is that monolith branch alone; this gate does
         not change. Any stale pick is cleared so nothing from
         an earlier flow can outrank the summon. */
    if (isLoggedIn()) {
      var c = null;
      try { if (typeof window.__espilCityCentre === 'function') c = window.__espilCityCentre(); } catch (_) {}
      if (c && typeof c.x === 'number' && isFinite(c.x) && typeof c.z === 'number' && isFinite(c.z)) {
        locFinishPick(c, n);
        return;
      }
      espilGateUsual(n);
      return;
    }
    try { window.__espilSpawnPick = null; } catch (_) {}
    n();
  };


  /* claim the auth zone now, and re-claim it whenever the modal opens */
  function init() {
    locWatchPanel();
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
  /* I18N GUESTBTN PACKAGE (Han 2026-11-25 14:30): this IIFE has
     no access to the first IIFE's T table (closure-private), so
     its localised copy reads through the language dictionary's
     global accessor - the house channel for dynamic writers
     (language.js header). The door copy, the mode switch, the
     retired name step's copy and the About data-sources block
     live in language.js's DICT under guestDoor / loginDoor /
     signUp / signIn / nameEnter / nameAccount / aboutSources. */
  function efT(k) { try { return window.__espilT ? window.__espilT(k) : k; } catch (e) { return k; } }
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

  /* LANDING PACKAGE (Han 2026-11-25, item 3): a bundle-less city
     path (/Seoul, /SanFrancisco, ...) serves THIS landing by
     Vercel rewrite, and the path's city is preselected: when the
     city step's layer completes, its preparation panel opens at
     its own address (see activateCityLayer). The slug is the
     city name normalised - lowercase, diacritics stripped,
     spaces and punctuation removed - matched against the
     harvested city names the same way. A playable city's path
     never serves the landing (its rewrite serves the game
     page), and a bundle-city match here is ignored regardless. */
  var pathCitySlug = '';
  try {
    pathCitySlug = (location.pathname.split('/')[1] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  } catch (e) {}
  function citySlug(name) {
    try { return String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); } catch (e) { return ''; }
  }

  /* ---------------- styling (own style element) ---------------- */
  var css = document.createElement('style');
  css.id = 'espil-landing-flow-css';
  /* Unified city-list form (Han 2026-11-10: "every choice is
     handled through the city-list" + "use the city-list text
     style"): the flow's views are plain list blocks INSIDE the
     readout - #espil-flow-ui, built below inside #city-status,
     and pair.css owns the .flow-open switch that yields the
     readout's city children to them. No card, no overlay, at any
     step: choice entries are buttons carrying pair.css's own
     .city-name class, so their text style IS the city-list text
     style by construction. */
  css.textContent =
    '.espil-flow-view{display:none}' +
    '.espil-flow-view[aria-hidden="false"]{display:block}' +
    '.espil-flow-title{padding:10px 16px 2px;color:#fff8e1;font:800 1rem/1.3 "Manrope",sans-serif;letter-spacing:.16em;' +
      'text-shadow:0 0 8px rgba(255,217,77,.95),0 0 26px rgba(255,180,40,.55)}' +
    '.espil-flow-sub{margin:0 0 6px;padding:0 16px;color:rgba(232,220,192,.55);font:600 .72rem/1.5 "Manrope",sans-serif;letter-spacing:.08em}' +
    '.espil-flow-copy{margin:0;padding:8px 14px 12px;color:rgba(232,220,192,.78);font:600 .76rem/1.65 "Manrope",sans-serif;letter-spacing:.04em}' +
    '#espil-city-back{display:none}' +
    '#city-status.city-step:not(.flow-open) #espil-city-back{display:flex}' +
    '#city-status.is-city #espil-city-back{display:none !important}' +
    /* Fix batch 8 item 4 (Han 2026-11-14): the menu and guidance
       views carry their choices in a reel with the city-list
       treatment AS-IS - the pair.css .city-list declarations
       copied verbatim (fixed 165px window, 62px breathing
       padding, snap, fade mask, pan-y touch, hidden scrollbar).
       Before this, the views were plain blocks: their content fit
       the readout, nothing overflowed, and a swipe had no
       scrollable surface to bite on (measured scrollTop 0 before
       and after a touch drag). The reel gives every list step the
       same window the city step has. Item 2 uses the same reel:
       the row nearest its centre carries pair.css's .is-centered
       enlargement, tracked on scroll exactly like the city reel. */
    '.espil-flow-reel{position:relative;height:165px;overflow-y:auto;overflow-x:hidden;padding:62px 0;' +
      'scroll-snap-type:y mandatory;scrollbar-width:none;' +
      'mask-image:linear-gradient(to bottom,transparent 0,#000 24%,#000 76%,transparent 100%);' +
      '-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 24%,#000 76%,transparent 100%);' +
      'overscroll-behavior:contain;touch-action:pan-y}' +
    '.espil-flow-reel::-webkit-scrollbar{display:none}' +
    /* ENTRY FLOW V2 AMENDMENT B (Han 2026-11-24 20:47): keyboard-only
       operability is a HARD requirement - every interactive element
       of the entry flow carries a VISIBLE focus indicator, drawn by
       the flow itself (never left to browser defaults against the
       landing art). I18N GUESTBTN PACKAGE (Han 2026-11-25 14:30):
       the box stays; its colour leaves yellow for the pair's
       signal teal (--signal #86eee4). */
    '#signin-div button:focus,#signin-div input:focus,#signin-div select:focus,#signin-div textarea:focus,' +
    '#city-status button:focus,#city-list .espil-city-btn:focus,#auth-mode-switch:focus,' +
    '#signin-div button:focus-visible,#city-status button:focus-visible{outline:3px solid #86eee4 !important;outline-offset:2px !important;box-shadow:0 0 0 5px rgba(134,238,228,.35) !important}';
  document.head.appendChild(css);

  /* ---------------- DOM: menu + panels ---------------- */
  function el(tag, id, cls) {
    var n = document.createElement(tag);
    if (id) n.id = id;
    if (cls) n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    return n;
  }
  function flowItem(id, label, primary) {
    return '<button type="button" class="city-name espil-flow-item' + (primary ? ' is-centered' : '') +
      '" id="' + id + '">' + label + '</button>';
  }
  function buildUI() {
    buildCityBack();
    if ($('espil-mainmenu')) return;
    var cs = $('city-status');
    if (!cs) return;
    var ui = document.createElement('div');
    ui.id = 'espil-flow-ui';

    var menu = el('div', 'espil-mainmenu', 'espil-flow-view');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Espil Online menu');
    menu.innerHTML =
      '<div class="espil-flow-title">Espil Online</div>' +
      '<p class="espil-flow-sub">A digital replica of this world, in real time.</p>' +
      '<div class="espil-flow-reel">' +
      flowItem('espil-menu-play', 'Play', true) +
      flowItem('espil-menu-shop', 'Shop', false) +
      flowItem('espil-menu-zealandia', 'Zealandia', false) +
      flowItem('espil-menu-about', 'About', false) +
      flowItem('espil-menu-back', 'Back', false) +
      '</div>';
    ui.appendChild(menu);

    var zea = el('div', 'espil-zealandia-panel', 'espil-flow-view');
    zea.setAttribute('role', 'dialog');
    zea.setAttribute('aria-label', 'Zealandia');
    zea.innerHTML =
      '<div class="espil-flow-title">Zealandia</div>' +
      '<p class="espil-flow-copy">Zealandia is where the real game continues - in the Espil app for mobile and PC. ' +
      'There is no entry into Zealandia on the web: here the journey ends at the Auckland Time Stone, and the app takes over from there.</p>' +
      '<div class="espil-flow-reel">' +
      flowItem('espil-zealandia-back', 'Back', false) +
      '</div>';
    ui.appendChild(zea);

    var about = el('div', 'espil-about-panel', 'espil-flow-view');
    about.setAttribute('role', 'dialog');
    about.setAttribute('aria-label', 'About Espil Online');
    /* Data sources (Han 2026-11-17): the About panel states the
       real-world data stack this replica is composed from. */
    about.innerHTML =
      '<div class="espil-flow-title">About Espil Online</div>' +
      '<p class="espil-flow-copy">Espil Online is a digital replica of this world, based on the real world in real time - ' +
      'the sky, the weather and the alignment of the stars move with the real world. Vancouver is the first city; ' +
      'the destination is a map of the whole world, with the city chosen by where you are.</p>' +
      '<p class="espil-flow-copy" id="espil-about-sources">' + efT('aboutSources') + '</p>' +
      '<div class="espil-flow-reel">' +
      flowItem('espil-about-back', 'Back', false) +
      '</div>';
    ui.appendChild(about);

    var prep = el('div', 'espil-cityprep-panel', 'espil-flow-view');
    prep.setAttribute('role', 'dialog');
    prep.setAttribute('aria-label', 'City in preparation');
    prep.innerHTML =
      '<div class="espil-flow-title" id="espil-cityprep-name">City</div>' +
      '<p class="espil-flow-copy">This city\'s data pack is in preparation. When it is ready, the city opens here exactly as it stands in the real world.</p>' +
      '<div class="espil-flow-reel">' +
      flowItem('espil-cityprep-back', 'Back to city selection', false) +
      '</div>';
    ui.appendChild(prep);

    cs.appendChild(ui);

    $('espil-menu-play').addEventListener('click', function () { chooseMode('play'); });
    $('espil-menu-shop').addEventListener('click', function () { chooseMode('shop'); });
    (function () { var sr = $('espil-menu-shop'); if (sr) { sr.setAttribute('data-destination', ESPIL_SHOP_DESTINATION.id); sr.setAttribute('data-destination-route', ESPIL_SHOP_DESTINATION.route); sr.setAttribute('data-destination-arrival', ESPIL_SHOP_DESTINATION.arrival); } })(); /* Amendment A: the destination of record rides the row; the click behaviour above is the interim city path until the cauldron window ships. */
    $('espil-menu-zealandia').addEventListener('click', function () { presentFlowView($('espil-zealandia-panel')); });
    $('espil-menu-about').addEventListener('click', function () { presentFlowView($('espil-about-panel')); });
    $('espil-menu-back').addEventListener('click', function () { backToLogin(); });
    $('espil-zealandia-back').addEventListener('click', function () { presentFlowView($('espil-mainmenu')); });
    $('espil-about-back').addEventListener('click', function () { presentFlowView($('espil-mainmenu')); });
    $('espil-cityprep-back').addEventListener('click', function () { closePrep(); });
    /* Fix batch 8 items 2+4: every view's reel tracks its centre
       on scroll, like the city reel - the row nearest the reel's
       vertical centre carries .is-centered. */
    var reels = ui.querySelectorAll('.espil-flow-reel');
    for (var ri = 0; ri < reels.length; ri++) {
      (function (reel) {
        var frame = 0;
        reel.addEventListener('scroll', function () {
          if (!frame) frame = requestAnimationFrame(function () {
            frame = 0;
            centerFlowReel(reel.parentNode);
          });
        }, { passive: true });
      })(reels[ri]);
    }
  }
  /* The flow-reel centre tracker (items 2+4): nearest row to the
     reel's vertical centre is the centred one. On presentation
     presentFlowView resets the reel to the top, where the FIRST
     row is the nearest - so the first row starts active (item 2),
     and once the user scrolls this tracker governs, exactly the
     batch-7 reconciliation for the city reel. Views without a
     reel keep their first item centred. */
  function centerFlowReel(view) {
    if (!view) return;
    var items = view.querySelectorAll('.espil-flow-item');
    if (!items.length) return;
    var closest = items[0];
    var reel = view.querySelector('.espil-flow-reel');
    if (reel) {
      var rr = reel.getBoundingClientRect();
      var centre = rr.top + rr.height / 2, dist = Infinity;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - centre);
        if (d < dist) { dist = d; closest = items[i]; }
      }
    }
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('is-centered', items[j] === closest);
    }
  }
  function show(n) { if (n) n.setAttribute('aria-hidden', 'false'); }
  function hide(n) { if (n) n.setAttribute('aria-hidden', 'true'); }

  /* One presented view at a time inside the readout; presenting
     one sets .flow-open on #city-status (pair.css yields the
     readout's city children to the flow list and shows
     #espil-flow-ui). Presenting none returns the readout to its
     city face. */
  var FLOW_VIEW_IDS = ['espil-mainmenu', 'espil-zealandia-panel', 'espil-about-panel', 'espil-cityprep-panel'];
  function presentFlowView(view) {
    buildUI();
    FLOW_VIEW_IDS.forEach(function (id) { var n = $(id); if (n && n !== view) hide(n); });
    if (view) {
      show(view);
      /* Fix batch 8 item 2: a presented list starts at its first
         row - reel back to the top and let the centre tracker put
         the active treatment on row one. */
      var vreel = view.querySelector('.espil-flow-reel');
      if (vreel) vreel.scrollTop = 0;
      centerFlowReel(view);
      /* I18N GUESTBTN PACKAGE: the About data-sources block is
         rendered from the T table - refresh it on presentation so
         it follows the language in force when the panel opens. */
      if (view.id === 'espil-about-panel') { var asrc = $('espil-about-sources'); if (asrc) asrc.innerHTML = efT('aboutSources'); }
    }
    var cs = $('city-status');
    if (cs) {
      cs.classList.toggle('flow-open', !!view);
      if (view) cs.classList.remove('gate-hidden');
    }
  }
  function closePrep() {
    hide($('espil-cityprep-panel'));
    var cs = $('city-status');
    if (cs) cs.classList.remove('flow-open');
  }

  /* Back entries (Han 2026-11-10: a way back at every step of
     the city-list flow). The city step's Back lives in the
     readout under the reel; the menu's Back is a list entry in
     the menu view itself (built above). Back never logs out and
     never wipes, parks or moves the session record. */
  function buildCityBack() {
    if ($('espil-city-back')) return;
    var list = $('city-list');
    if (!list || !list.parentNode) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'espil-city-back';
    b.className = 'city-name';
    b.textContent = 'Back';
    b.setAttribute('aria-label', 'Back to the mode menu');
    list.parentNode.insertBefore(b, list.nextSibling);
    b.addEventListener('click', function () { backToMenu(); });
  }
  function backToMenu() {
    if (step !== 'city') return;
    step = 'menu';
    var cs = $('city-status'); if (cs) cs.classList.remove('city-step');
    presentFlowView($('espil-mainmenu'));
  }

  /* ---------------- LANDING PACKAGE: the dive (Han 2026-11-25,
     item 2b) --------------------------------------------------
     A bundled city's row (or pin) click dives IMMEDIATELY: the
     Press Enter button, its marking step (selectBundleCity /
     clearCitySelection) and its Enter-key handler are removed
     on Han's order, superseding the entry-v2 design 5 shape.
     The dive itself is unchanged: delegate to monolith's own
     reel button for the picked city (its selection and info
     panel run exactly as before), then press the panel's DIVE
     in the SAME synchronous turn - the popup never paints, and
     what follows is monolith's own startCityEntry. A missing
     button (build race) falls back to the preparation panel -
     the behaviour for an undelegatable pick. The rows are
     buttons, so Enter/Space on a focused row dives by native
     activation; no key handler replaces the removed one. */
  var flowOrigCityBtns = null; /* monolith's own reel buttons, harvested by the city layer below */
  function dive(name) {
    if (step !== 'city' || !name) return;
    var delegated = false;
    if (flowOrigCityBtns) {
      for (var k = 0; k < flowOrigCityBtns.length; k++) {
        if ((flowOrigCityBtns[k].textContent || '').trim() === name) { flowOrigCityBtns[k].click(); delegated = true; break; }
      }
    }
    var enter = $('city-info-enter');
    if (delegated && enter) {
      enter.click();
      step = 'done';
      return;
    }
    openPrep(name);
  }
  /* loginHold: the flow stays at the login/guest step until that
     step's own controls complete the gate. It is set by the
     menu's Back (backToLogin) and by social.js through
     window.__espilFlowHoldLogin when a name claim is abandoned
     (the claim's session record is already written then, and the
     player is returned to the login/guest selection to choose
     how to proceed - the advance poll below must not sweep them
     into the menu). Released when a gate completion hides the
     modal signal on a live record, or by the guest entry's own
     completion path. */
  var loginHold = false;
  window.__espilFlowHoldLogin = function () { loginHold = true; };
  function backToLogin() {
    if (step !== 'menu') return;
    presentFlowView(null);
    loginHold = true;
    showLoginStep();
  }
  function showLoginStep() {
    step = 'login';
    /* Restructure (Han 2026-11-11): the step opened on the
       three-entry list; a live session keeps the combined form.
       NAME-ONLY ENTRY (Han 2026-11-24): the step opened on the
       NAME step - no login wall; the account forms branched off
       it and returned via Back.
       ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 1): the
       step opens on the TWO-DOOR choice (게스트로 들어가기 /
       로그인) - the name step is retired, and sign-up lives
       inside the login door behind the form's switch. A live
       session keeps the combined form, exactly as before. */
    presentAuthStep(sessionRecord() ? null : 'choice');
    if (typeof window.__espilOpenAuth === 'function') { window.__espilOpenAuth(); return; }
    var m = $('signin-modal');
    if (m) {
      m.setAttribute('aria-hidden', 'false');
      var cs = $('city-status'); if (cs) cs.classList.add('gate-hidden');
    }
  }

  /* ---------------- the steps ---------------- */
  function openLoginStep() {
    if (step !== 'boot' && step !== 'login') return;
    showLoginStep();
  }
  function sessionRecord() {
    try { var s = JSON.parse(localStorage.getItem('espil_session_v1') || 'null'); return s && s.id ? s : null; }
    catch (e) { return null; }
  }
  function completeLogin() {
    if (step !== 'login') return;
    step = 'menu';
    loginHold = false;
    var m = $('signin-modal'); if (m) m.setAttribute('aria-hidden', 'true');
    var cs = $('city-status');
    if (cs) { cs.classList.remove('gate-hidden'); cs.classList.remove('city-step'); }
    buildUI(); /* the views must exist before the menu is resolved */
    presentFlowView($('espil-mainmenu')); /* the menu is list content inside the text div */
  }
  function setEntryMode(mode) {
    chosenMode = mode;
    try { sessionStorage.setItem('espil_entry_mode', mode); } catch (e) {}
    window.__espilEntryMode = mode;
  }
  function chooseMode(mode) {
    setEntryMode(mode);
    presentFlowView(null); /* the flow list yields to the readout's city face */
    step = 'city';
    var cs = $('city-status');
    if (cs) { cs.classList.remove('gate-hidden'); cs.classList.add('city-step'); /* city selection is live, with its Back entry */ }
    activateCityLayer();
    /* Fix batch 8 item 2: on RE-presentation (menu Back -> Play
       again) the city reel starts at its first row again, with
       the first row active. The first presentation is covered by
       the layer's own arrival pass. */
    var cl = $('city-list');
    if (cl && cl.querySelector('.espil-city-btn')) {
      cl.scrollTop = 0;
      if (flowCenterCity) flowCenterCity();
    }
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
  /* Fix batch 8 item 5 (Han 2026-11-14): the centred city faces
     the globe's centre again. The original reel coupled the two:
     monolith's updateReelCenter() read its centred marker and set
     the globe's target yaw/pitch from the marker's direction.
     That driver only ever sees monolith's own buttons - the ones
     this layer hides - so with the flow's buttons in place the
     globe never turned (measured: Tokyo centred, its pin stuck
     342px from the canvas centre, unmoving). The flow layer now
     reports every centre change through monolith's restored
     facing hook (__espilGlobeFaceCity, which carries the
     original math), and remembers the last faced city so a
     re-presentation does not re-drive an unchanged facing. */
  var flowCenterCity = null;
  var flowFacedCity = null;
  function faceFlowCity(name) {
    if (!name || name === flowFacedCity) return;
    flowFacedCity = name;
    if (typeof window.__espilGlobeFaceCity === 'function') {
      try { window.__espilGlobeFaceCity(name); } catch (e) {}
    }
  }
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
    buildUI();
    var n = $('espil-cityprep-name'); if (n) n.textContent = name;
    presentFlowView($('espil-cityprep-panel'));
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
      flowOrigCityBtns = orig; /* LANDING PACKAGE: dive() delegates through these (the enter button's path before item 2b) */
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
          faceFlowCity(c.name); /* item 5: a click centres the city too - face it */
          if (BUNDLE_CITIES[c.name]) {
            /* LANDING PACKAGE (Han 2026-11-25, item 2b): a bundle
               city's row click dives at once - the Press Enter
               button and its marking step are removed on Han's
               order. The Wave 0 delegation to monolith's own reel
               button happens inside dive(), at this click. */
            dive(c.name);
            return;
          }
          openPrep(c.name);
        });
        list.appendChild(b);
      });
      /* Fix batch 7 item 1 (Han 2026-11-12): restore the reel's
         default enlargement of the currently centred option. The
         original reel enlarged its centred entry through pair.css's
         .city-name.is-centered, driven by monolith's
         updateReelCenter() on scroll and by a startup centring
         call - but that driver only ever toggles monolith's own
         buttons, which this layer hides. The flow's own buttons
         therefore never centred except on click, and the selected
         option stayed at the base size. Track the centre for the
         flow's buttons instead: the button nearest the list's
         vertical centre carries .is-centered (and with it the
         enlarged font), at rest on arrival and on every scroll,
         exactly the original reel's behaviour. Scoped to
         .espil-city-btn and to the city step, so the auth lists
         that share #city-status are untouched. */
      var flowReelFrame = 0;
      function updateFlowReelCenter() {
        flowReelFrame = 0;
        if (step !== 'city') return;
        var btns = list.querySelectorAll('.espil-city-btn');
        if (!btns.length) return;
        var lr = list.getBoundingClientRect();
        var centre = lr.top + lr.height / 2;
        var closest = null, dist = Infinity;
        for (var n = 0; n < btns.length; n++) {
          var r = btns[n].getBoundingClientRect();
          var d = Math.abs(r.top + r.height / 2 - centre);
          if (d < dist) { dist = d; closest = btns[n]; }
        }
        for (var m = 0; m < btns.length; m++) {
          btns[m].classList.toggle('is-centered', btns[m] === closest);
        }
        /* I18N GUESTBTN PACKAGE (Han 2026-11-25 14:30, directive
           2): selection IS the centred row - DOM focus moves with
           it, so the focused row (and its visible focus box) and
           the centred row can never be two different rows. The
           morning's arrow rule is untouched: arrows still only
           scroll, and this tracker - driven by the scroll event,
           exactly as for wheel/touch - settles selection, facing
           and focus together. preventScroll keeps the focus move
           from fighting the snap. */
        if (closest && document.activeElement !== closest) {
          try { closest.focus({ preventScroll: true }); } catch (e) {}
        }
        /* item 5: the globe follows the centred city */
        if (closest) faceFlowCity(closest.getAttribute('data-city'));
      }
      flowCenterCity = updateFlowReelCenter;
      list.addEventListener('scroll', function () {
        if (!flowReelFrame) flowReelFrame = requestAnimationFrame(updateFlowReelCenter);
      }, { passive: true });
      requestAnimationFrame(updateFlowReelCenter);
      setTimeout(updateFlowReelCenter, 350);
      /* LANDING PACKAGE (Han 2026-11-25, item 3): a bundle-less
         city path (e.g. /Seoul) serves this landing by rewrite and
         preselects its city - the moment the city step's layer
         stands, that city's preparation panel opens at its own
         address. Consumed once; the panel's Back returns to the
         city list as for any bundle-less pick. */
      if (pathCitySlug) {
        var pslug = pathCitySlug; pathCitySlug = '';
        for (var pi = 0; pi < cities.length; pi++) {
          if (!BUNDLE_CITIES[cities[pi].name] && citySlug(cities[pi].name) === pslug) { openPrep(cities[pi].name); break; }
        }
      }
    }, 300);
    /* pin picks for bundle-less cities: capture-phase, so
       monolith's own pin handler (which would refuse them) never
       runs; a bundle city's pin falls through to the native flow,
       the same delegation as the list (Wave 0, 2026-11-19). */
    document.addEventListener('click', function (e) {
      if (step !== 'city') return;
      var t = e.target;
      var pin = t && t.closest ? t.closest('.city-pin') : null;
      if (!pin) return;
      var name = (pin.getAttribute('aria-label') || '').split(',')[0].trim();
      if (!name) return;
      e.stopPropagation();
      e.preventDefault();
      if (BUNDLE_CITIES[name]) {
        /* LANDING PACKAGE (Han 2026-11-25, item 2b): a bundle city's
           pin dives at once, exactly like its list row - monolith's
           native pin flow (which would open the retired dive popup)
           no longer runs at the city step. The corresponding list
           row takes the centred treatment first so the pick reads
           in the list during the dive. */
        faceFlowCity(name);
        var cityListEl = $('city-list');
        var btns = cityListEl ? cityListEl.querySelectorAll('.espil-city-btn') : [];
        for (var j = 0; j < btns.length; j++) {
          var on = btns[j].getAttribute('data-city') === name;
          btns[j].classList.toggle('is-centered', on);
          if (on && btns[j].scrollIntoView) { try { btns[j].scrollIntoView({ block: 'center' }); } catch (err) {} }
        }
        dive(name);
        return;
      }
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
     (startSession -> completeGate hides the modal) flows on.
     Two holds apply (Han 2026-11-10):
     - a sign-up NAME CLAIM pending or failed: social.js has
       already written the (held) session record, but the gate
       completes only when the claim resolves. The state is read
       through __espilAuthState().nameClaim, never guessed here.
     - loginHold (set by the menu's Back and by social.js's
       claim-abandon hook __espilFlowHoldLogin): the flow stays
       at the login/guest selection until the gate itself
       completes - the modal signal hides - on a live record. */
  function claimInFlight() {
    try {
      var st = window.__espilAuthState && window.__espilAuthState();
      return !!(st && (st.nameClaim === 'pending' || st.nameClaim === 'failed'));
    } catch (e) { return false; }
  }

  /* ---- First-step restructure (Han 2026-11-11) ----
     The login step presents THREE entries inside #signin-div -
     Login / Sign-up / Guest - and each choice swaps the same div's
     content in place (no card, no separate window):
       choice : the three entries only.
       login  : ID + password fields of the shared #auth-box (the
                name field and the SIGN UP action hidden) + the
                provider row (Google live; Apple/Facebook present
                with an honest in-list not-yet notice).
       signup : name (the shipped claim field) + email + password
                + the provider row; the claim hold / reserved /
                retry behaviour in social.js is untouched - only
                field visibility and labels are re-cut per step.
       guest  : a session-local name input + the Male/Female
                character choice, then the EXISTING #guest-enter
                path (session parking + step completion) is driven
                programmatically, so guest semantics stay identical.
       null   : a session already exists - the combined form shows
                exactly as before (the session block state).
     Back from login/signup/guest returns to the choice list. This
     state machine exists ONLY on the landing: the game page has
     no landing flow and presents the combined form as today. */
  var authDiv = document.getElementById('signin-div');
  function setLabelText(label, text) {
    if (!label) return;
    for (var i = 0; i < label.childNodes.length; i++) {
      var n = label.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) { n.nodeValue = text; return; }
    }
    label.insertBefore(document.createTextNode(text), label.firstChild);
  }
  /* NAME-ONLY ENTRY (Han 2026-11-24): the name step reuses the
     guest step's box in the same list grammar - name input +
     enter - with the gender/style sub-steps hidden (entrants wear
     the one neutral body; there is nothing to pick), the guest
     Back hidden (the name step is the root step), and the account
     line as a first-class row under the enter button. Returning
     entrants get their stored name prefilled. Prepared once.
     ENTRY FLOW V2 (Han 2026-11-24): the name step is retired -
     no state of presentAuthStep presents it anymore (the guest
     door is the auto-name entry in wireAuthSteps below), and
     the prefill is gone with it: the v2 guest path never reads
     espil_username. This prep survives only as the dormant
     body of the retired step. */
  /* ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 1): the
     first screen is exactly two doors. The choice box's three
     static rows are re-cut in place: the sign-up row leaves the
     first screen (sign-up lives inside the login door now, behind
     the form's switch), the guest row moves first and carries
     the door copy, and the login row carries its door copy.
     Prepared once; the rows' click wiring is in wireAuthSteps
     below. */
  var espilTwoDoorReady = false;
  function espilTwoDoorPrep() {
    if (espilTwoDoorReady) return;
    var goGuest = document.getElementById('auth-go-guest');
    var goLogin = document.getElementById('auth-go-login');
    var goSignup = document.getElementById('auth-go-signup');
    if (!goGuest || !goLogin) return;
    espilTwoDoorReady = true;
    if (goSignup) goSignup.style.display = 'none';
    /* I18N GUESTBTN PACKAGE: the door copy renders through the language
       dictionary (guestDoor / loginDoor) in the selected
       language - the hardcoded Korean overwrite is gone. */
    goGuest.textContent = efT('guestDoor');
    goLogin.textContent = efT('loginDoor');
    if (goGuest.parentNode) goGuest.parentNode.insertBefore(goGuest, goGuest.parentNode.firstChild);
  }
  /* The prep above runs once; the labels re-render on every
     choice presentation so a language switch is honoured. */
  function espilDoorLabels() {
    var goGuest = document.getElementById('auth-go-guest');
    var goLogin = document.getElementById('auth-go-login');
    if (goGuest) goGuest.textContent = efT('guestDoor');
    if (goLogin) goLogin.textContent = efT('loginDoor');
  }
  /* ENTRY FLOW V2 AMENDMENT A (Han 2026-11-24 20:47): the menu's
     Shop choice has a FIXED destination of record - the MROS
     Center (the cauldron space, child window /cauldron), arriving
     at the CHERRY-BLOSSOM PLAZA. Until the cauldron window ships
     (cauldron stage 1), Shop keeps the interim behaviour exactly:
     chooseMode('shop') and today's city-shopping path. The
     destination lives here as structure only - when stage 1
     lands, flipping `live` to true and routing chooseMode's shop
     branch to this target is the whole change, not a redesign.
     The row is NEVER pointed at the route before it exists. */
  var ESPIL_SHOP_DESTINATION = { id: 'mros-center', label: 'MROS Center', route: '/cauldron', arrival: 'cherry-blossom-plaza', live: false };
  window.__espilShopDestination = ESPIL_SHOP_DESTINATION;

  var espilNameStepReady = false;
  function espilNameStepPrep() {
    if (espilNameStepReady) return;
    espilNameStepReady = true;
    var gMale = document.getElementById('guest-char-male');
    var gFemale = document.getElementById('guest-char-female');
    var row = gMale && gMale.parentNode ? gMale.parentNode : (gFemale ? gFemale.parentNode : null);
    if (row) row.style.display = 'none';
    var s1 = document.getElementById('guest-style-1');
    var sRow = s1 ? s1.parentNode : null;
    if (sRow) sRow.style.display = 'none';
    var gBack = document.getElementById('guest-back');
    if (gBack) gBack.style.display = 'none';
    var gGo = document.getElementById('guest-go');
    if (gGo) gGo.textContent = efT('nameEnter');
    var guestBox = document.getElementById('auth-gueststep');
    if (guestBox && gGo && !document.getElementById('auth-name-account')) {
      var acct = document.createElement('button');
      acct.type = 'button';
      acct.id = 'auth-name-account';
      acct.className = 'city-name';
      acct.textContent = efT('nameAccount');
      acct.addEventListener('click', function () { presentAuthStep('login'); });
      if (gGo.nextSibling) guestBox.insertBefore(acct, gGo.nextSibling);
      else guestBox.appendChild(acct);
    }
  }
  function presentAuthStep(name) {
    if (!authDiv) return;
    if (name === 'guest') name = 'name'; /* legacy alias: the guest step IS the name step now */
    var choiceBox = document.getElementById('auth-choice');
    var guestBox = document.getElementById('auth-gueststep');
    var authBox = document.getElementById('auth-box');
    var toBack = document.getElementById('auth-toback');
    var guestEnter = document.getElementById('guest-enter');
    var formMode = (name === 'login' || name === 'signup');
    var formShown = formMode || name === null;
    if (choiceBox) choiceBox.hidden = name !== 'choice';
    if (guestBox) guestBox.hidden = name !== 'name';
    if (toBack) toBack.hidden = !formMode;
    if (authBox) authBox.style.display = formShown ? '' : 'none';
    if (guestEnter) guestEnter.style.display = name === null ? '' : 'none';
    var dividers = authDiv.querySelectorAll('.modal-divider');
    for (var d = 0; d < dividers.length; d++) {
      var isGuestDiv = dividers[d].classList.contains('div-guest');
      dividers[d].style.display = (formShown && !(formMode && isGuestDiv)) ? '' : 'none';
    }
    var provRow = authDiv.querySelector('.provider-social-row');
    if (provRow) provRow.style.display = formShown ? '' : 'none';
    var provNote = authDiv.querySelector('.provider-note');
    if (provNote) provNote.style.display = formShown ? '' : 'none';
    authDiv.setAttribute('data-authstep', name || '');
    authDiv.setAttribute('data-authmode', formMode ? name : '');
    /* Fix batch 8 item 2 (Han 2026-11-14) put the choice list's
       FIRST row in the .is-centered enlargement on every
       presentation - written when Login was first. Entry-v2 moved
       the GUEST row first, so the enlargement landed on the guest
       door and read as an oversized button (measured: its text at
       1.76x the login door's). I18N GUESTBTN PACKAGE (Han
       2026-11-25 14:30, directive 1b shape B): the choice step no
       longer applies .is-centered at all - the two doors are a
       matched pair of 48px list-form rows (pair.css), the guest
       door keeping colour emphasis only. */
    if (name === 'choice') { espilTwoDoorPrep(); espilDoorLabels(); }
    if (name === 'choice' && choiceBox) {
      var cItems = choiceBox.querySelectorAll('.auth-choice-item');
      for (var ci = 0; ci < cItems.length; ci++) {
        cItems[ci].classList.remove('is-centered');
      }
    }
    if (formMode) {
      var nameLabel = document.getElementById('auth-name-label');
      var nameInput = document.getElementById('auth-name');
      var idLabel = document.getElementById('auth-id-label');
      var idInput = document.getElementById('auth-id');
      var signinBtn = document.getElementById('auth-signin');
      var signupBtn = document.getElementById('auth-signup');
      var guestNote = authBox ? authBox.querySelector('.auth-guestonly-note') : null;
      var isLogin = name === 'login';
      if (nameLabel) nameLabel.style.display = isLogin ? 'none' : '';
      if (nameInput) nameInput.style.display = isLogin ? 'none' : '';
      setLabelText(idLabel, isLogin ? 'ID' : 'EMAIL');
      if (idInput) {
        idInput.placeholder = isLogin ? 'Email or account name' : 'you@example.com';
        idInput.setAttribute('autocomplete', isLogin ? 'username' : 'email');
      }
      if (signinBtn) signinBtn.style.display = isLogin ? '' : 'none';
      if (signupBtn) signupBtn.style.display = isLogin ? 'none' : '';
      if (guestNote) guestNote.style.display = isLogin ? 'none' : '';
      var provBtns = authDiv.querySelectorAll('.provider-logo');
      for (var p = 0; p < provBtns.length; p++) {
        var pn = (provBtns[p].getAttribute('data-provider') || '').toLowerCase();
        if (pn === 'apple' || pn === 'facebook') provBtns[p].disabled = false;
      }
      var focusEl = isLogin ? idInput : nameInput;
      if (focusEl) { try { focusEl.focus({ preventScroll: true }); } catch (e) {} }
      /* ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 1):
         sign-up lives inside the login door - this switch is the
         way across: in the login state it offers 회원가입, in the
         sign-up state 로그인. It only re-cuts the presentation
         through presentAuthStep; social.js's submit wiring, the
         post-register name claim and its hold are untouched. */
      var modeSwitch = document.getElementById('auth-mode-switch');
      if (!modeSwitch && authBox) {
        modeSwitch = document.createElement('button');
        modeSwitch.type = 'button';
        modeSwitch.id = 'auth-mode-switch';
        modeSwitch.className = 'city-name';
        modeSwitch.style.minHeight = '48px';
        modeSwitch.addEventListener('click', function () {
          var cur = authDiv ? authDiv.getAttribute('data-authmode') : '';
          presentAuthStep(cur === 'login' ? 'signup' : 'login');
        });
        authBox.appendChild(modeSwitch);
      }
      if (modeSwitch) {
        modeSwitch.style.display = '';
        /* I18N GUESTBTN PACKAGE: the switch offers the OTHER mode
           through the dictionary's signUp / signIn keys. */
        modeSwitch.textContent = isLogin ? efT('signUp') : efT('signIn');
      }
    }
    if (!formMode) {
      var msOff = document.getElementById('auth-mode-switch');
      if (msOff) msOff.style.display = 'none';
    }
    if (name === 'name') {
      espilNameStepPrep();
      var gName = document.getElementById('guest-name');
      if (gName) { try { gName.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  (function wireAuthSteps() {
    if (!authDiv) return;
    var goLogin = document.getElementById('auth-go-login');
    var goSignup = document.getElementById('auth-go-signup');
    var goGuest = document.getElementById('auth-go-guest');
    if (goLogin) goLogin.addEventListener('click', function () { presentAuthStep('login'); });
    if (goSignup) goSignup.addEventListener('click', function () { presentAuthStep('signup'); });
    if (goGuest) goGuest.addEventListener('click', function () {
      /* ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 2): the
         guest row IS the guest door - one tap, no step after it.
         The auto-name entry below rolls a name, checks it
         silently, writes the entrant records and drives the
         existing #guest-enter path onto the menu. */
      espilGuestDoorEnter();
    });
    var toBack = document.getElementById('auth-toback');
    if (toBack) toBack.addEventListener('click', function () { presentAuthStep('choice'); });
    var guestBack = document.getElementById('guest-back');
    if (guestBack) guestBack.addEventListener('click', function () { presentAuthStep('choice'); });
    /* The name-claim Back (#auth-back, social.js's abandon control)
       also returns the presentation to the two-door choice; its
       claim semantics stay with social.js's own listener. */
    var claimBack = document.getElementById('auth-back');
    if (claimBack) claimBack.addEventListener('click', function () { presentAuthStep('choice'); });
    /* Apple / Facebook have no backend yet: on the landing the
       items are selectable and answer with an honest notice in the
       form's message line (the Google 503 pattern) instead of a
       fake flow; Google's real flow stays with landing-auth.js. */
    authDiv.addEventListener('click', function (ev) {
      var b = (ev.target && ev.target.closest) ? ev.target.closest('.provider-logo') : null;
      if (!b) return;
      var pn = (b.getAttribute('data-provider') || '').toLowerCase();
      if (pn === 'apple' || pn === 'facebook') {
        ev.preventDefault();
        ev.stopPropagation();
        var msg = document.getElementById('auth-msg');
        if (msg) msg.textContent = (pn === 'apple' ? 'Apple' : 'Facebook') + ' sign-in is not available yet.';
      }
    }, true);
    /* Returning guest fast path (Han 2026-11-17): RETIRED by
       ENTRY FLOW V2 (Han 2026-11-24, entry-v2/DESIGN.md 7).
       Guests are always refreshed - there is no returning-guest
       identity to fast-path. The function that re-issued the
       named stamp from espil_username is gone; every guest
       entry goes through the auto-name door below. */
    /* Guest step: name (session-local only) + character choice.
       The reserved list mirrors the Worker's account-name rule as
       a display sanity; nothing here writes to any account store. */
    var guestGender = 'male';
    var gMale = document.getElementById('guest-char-male');
    var gFemale = document.getElementById('guest-char-female');
    function setGuestGender(g) {
      guestGender = g;
      if (gMale) { gMale.classList.toggle('is-on', g === 'male'); gMale.setAttribute('aria-pressed', g === 'male' ? 'true' : 'false'); }
      if (gFemale) { gFemale.classList.toggle('is-on', g === 'female'); gFemale.setAttribute('aria-pressed', g === 'female' ? 'true' : 'false'); }
    }
    if (gMale) gMale.addEventListener('click', function () { setGuestGender('male'); });
    if (gFemale) gFemale.addEventListener('click', function () { setGuestGender('female'); });
    /* Body style (Han 2026-11-16: guest character selection):
       the guest picks one of the Chibi pack's four styles for
       their gender. The saved choice (espil_character.bodyChoice,
       device-local - guests have no server record) pre-selects
       for a returning guest; a first-time guest starts at
       Style 1. guestGo writes the pick into the same record the
       gender rides, and the in-game gate offers the same choice
       again on every entry. */
    var guestStyle = 1;
    try {
      var savedRec = JSON.parse(localStorage.getItem('espil_character') || 'null');
      if (savedRec && /^style[1-4]$/.test(savedRec.bodyChoice || '')) guestStyle = +savedRec.bodyChoice.slice(-1);
    } catch (e) {}
    var gStyleBtns = [1, 2, 3, 4].map(function (n) { return document.getElementById('guest-style-' + n); });
    function setGuestStyle(n) {
      guestStyle = n;
      gStyleBtns.forEach(function (b, i) {
        if (!b) return;
        var on = (i + 1 === n);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    gStyleBtns.forEach(function (b, i) { if (b) b.addEventListener('click', function () { setGuestStyle(i + 1); }); });
    setGuestStyle(guestStyle);
    /* ENTRY FLOW V2 - THE GUEST DOOR (Han 2026-11-24,
       entry-v2/DESIGN.md 2+3): one tap on the guest door and
       the guest is in the flow. There is no name form, no
       typing and no error a guest can ever see: the client
       rolls a name from the shared pools (the __espilEntryV2Name
       block near the end of this file), asks the shipped
       availability endpoint about it silently (design 3.2
       layer 1), falls back to a numeric suffix if the loop
       exhausts (layer 2), writes the P1 entrant records, and
       drives the existing #guest-enter path onto the menu.
       The CityRoom join backstop (layer 3) is read by the game
       page's name-once pass as a silent re-roll signal - see
       that block.

       ALWAYS REFRESHED (design 3.3 + 7): the name is rolled
       fresh on EVERY guest entry and is written to no
       persistent store. The guest path neither reads nor
       writes espil_username - a stale value from an older
       build is removed here so no downstream fallback (the
       presence join's stored-name fallback above all) can
       resurrect a previous guest's identity - and the retired
       espil_guest_named_v1 stamp is removed, never written.
       The one carry across the dive is the tab-session
       handoff (sessionStorage espil_entry_v2_guest_name):
       the game page's name-once pass reads it once, fills the
       character gate's name input with it and removes it. It
       is how the rolled name reaches the join, not a record:
       it dies with the tab and is re-rolled at the next entry
       regardless. espil_character is written fresh with the
       fixed neutral values, exactly as the P1 name step wrote
       it (gender 'male', bodyChoice 'neutral', a pending look
       carried when one stands). */
    function espilAutoName() {
      if (typeof window.__espilEntryV2RollName === 'function') return window.__espilEntryV2RollName();
      return 'QuietVillage'; /* pool-shaped fallback (ADJ[0] + NOUN[0]); the shared roller is defined later in this file and always lands before any tap */
    }
    /* The availability courtesy layer: the shipped endpoint
       (GET /auth/name/available), asked exactly as the retired
       name step asked it - fail OPEN on any network trouble,
       because the CityRoom join re-checks both rules for
       session-less sockets. cb(true) = the name may be worn. */
    function espilNameAvailable(name, cb) {
      if (typeof window.__espilEntryV2NameAvailable === 'function') { window.__espilEntryV2NameAvailable(name, cb); return; }
      try {
        var apiBase = (typeof window.__espilAuthApiBase === 'string' && window.__espilAuthApiBase) || 'https://api.espil.online';
        var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var to = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 2500) : 0;
        fetch(apiBase + '/auth/name/available?name=' + encodeURIComponent(name), ctl ? { signal: ctl.signal } : {})
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (to) clearTimeout(to);
            cb(!(j && j.available === false));
          })
          .catch(function () { if (to) clearTimeout(to); cb(true); });
      } catch (e) { cb(true); }
    }
    var guestDoorInFlight = false;
    function espilGuestDoorEnter() {
      if (guestDoorInFlight) return;
      guestDoorInFlight = true;
      /* Fresh entry, fresh identity: the legacy name key and
         the retired stamp leave before anything rolls, so no
         stale guest identity can be read by any path. */
      try { localStorage.removeItem('espil_username'); } catch (e) {}
      try { sessionStorage.removeItem('espil_guest_named_v1'); } catch (e) {}
      var proceed = function (name) {
        guestDoorInFlight = false;
        try { sessionStorage.setItem('espil_entry_v2_guest_name', name); } catch (e) {}
        try {
          var rec = { gender: 'male', ts: Date.now(), bodyChoice: 'neutral' };
          if (window.__espilPendingLook && typeof window.__espilPendingLook === 'object') rec.look = window.__espilPendingLook;
          localStorage.setItem('espil_character', JSON.stringify(rec));
        } catch (e) {}
        var ge = document.getElementById('guest-enter');
        if (ge) ge.click();
      };
      var tries = 0;
      var attempt = function () {
        tries++;
        var cand = espilAutoName();
        espilNameAvailable(cand, function (ok) {
          if (ok) { proceed(cand); return; }
          if (tries < 5) { attempt(); return; }
          /* Suffix fallback (design 3.2 layer 2): the loop
             exhausted its bound - the candidate gains a 3-digit
             suffix, still inside the 16-char cap, and is checked
             once more. If that somehow exhausts too, the suffix
             loops again, as the design rules. */
          var suffixed = function () {
            var suffix = String(100 + Math.floor(Math.random() * 900));
            var cand2 = (cand + suffix).slice(0, 16);
            espilNameAvailable(cand2, function (ok2) {
              if (ok2) { proceed(cand2); return; }
              suffixed();
            });
          };
          suffixed();
        });
      };
      attempt();
    }
    /* The retired name step's own controls carry no behaviour
       in v2 - its box is never presented. Its go button is wired
       to the same door, so no stray path can resurrect the
       form's semantics. */
    var guestGoBtn = document.getElementById('guest-go');
    if (guestGoBtn) guestGoBtn.addEventListener('click', function () { espilGuestDoorEnter(); });
  })();
  setInterval(function () {
    if (step !== 'login') return;
    if (claimInFlight()) return;
    if (loginHold) {
      var m = $('signin-modal');
      if (m && m.getAttribute('aria-hidden') === 'true' && sessionRecord()) {
        loginHold = false;
        completeLogin();
      }
      return;
    }
    if (sessionRecord()) completeLogin();
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
      /* ENTRY FLOW V2 (keyboard amendment): at the menu step a
         key on a menu row must activate that row ONLY - the pass
         below would also hand it to monolith's reel keys, whose
         Enter opens the retired city info popup over the flow.
         Stop the propagation but keep the default action, so the
         focused row still activates natively. */
      if (step === 'menu' && t.closest && t.closest('#espil-mainmenu')) {
        e.stopPropagation();
        return;
      }
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
     presentation's globe stays orbitable.
     ENTRY FLOW V2 (design 5): the swallow now covers the city
     step too - the raycast path ends at the city info panel,
     which is the retired dive popup; at the city step cities
     are picked by list row or pin only, and the enter button
     dives. Orbit dragging is unaffected (pointer movement, not
     the click event), exactly as before. */
  document.addEventListener('click', function (e) {
    if (step === 'done') return;
    if (window.__espilIntroActive) return;
    var t = e.target;
    if (t && t.tagName === 'CANVAS') e.stopPropagation();
  }, true);

  /* ENTRY FLOW V2 (keyboard amendment): while the bundle-less
     preparation panel stands at the city step, an Enter belongs
     to the panel's focused Back row alone - monolith's reel keys
     would otherwise also spend it on the retired city info
     popup. Stop the propagation only; the Back row still
     activates by its native default action. */
  document.addEventListener('keydown', function (e) {
    if (step !== 'city' || e.key !== 'Enter') return;
    if (window.__espilIntroActive) return;
    var prep = document.getElementById('espil-cityprep-panel');
    if (prep && prep.getAttribute('aria-hidden') === 'false') e.stopPropagation();
  }, true);


  /* All cities OPEN from first presentation (Han 2026-11-10:
     every city is open - the selection must not LOOK locked
     either). Monolith builds its globe pins once and marks every
     city outside its selectable set disabled + is-inactive
     (pair.css greys them to 45% opacity). The city layer above
     used to strip that only when the city step began, so the
     login form and the mode menu sat in front of a globe whose
     cities all read as closed. Strip the locked state from BOOT
     instead, and keep it stripped: the poll runs until the pins
     exist, and the observer re-strips if the locked state is
     ever re-applied (monolith applies it once, at pin build;
     nothing re-applies it per frame - the observer is the belt
     on those braces). stripPinLocks mutates only when a lock is
     actually present, so the observer cannot loop on its own
     corrections. */
  function stripPinLocks() {
    var pins = document.querySelectorAll('#city-pins .city-pin');
    for (var i = 0; i < pins.length; i++) {
      if (pins[i].disabled) pins[i].disabled = false;
      if (pins[i].classList.contains('is-inactive')) pins[i].classList.remove('is-inactive');
    }
    return pins.length;
  }
  var pinWatchTries = 0;
  var pinWatchTimer = setInterval(function () {
    pinWatchTries++;
    if (stripPinLocks() > 0 || pinWatchTries > 400) clearInterval(pinWatchTimer);
  }, 300);
  var pinLayerEl = $('city-pins');
  if (pinLayerEl && window.MutationObserver) {
    new MutationObserver(function () { stripPinLocks(); }).observe(pinLayerEl, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'disabled']
    });
  }

  /* The acting half of the same order: the pins now LOOK open
     from boot, but a pick must not ACT before the city step
     (login/guest -> mode menu -> city selection). Swallow every
     pin click until then, capture-phase like the canvas guard
     above, so monolith's own pin handler (centre the reel,
     select the city, start the approach) never runs early. At
     the city step this guard steps aside and the city layer's
     own capture handler routes the pick exactly as before
     (Vancouver native, every other city the prep panel). */
  document.addEventListener('click', function (e) {
    if (step === 'city' || step === 'done') return;
    var t = e.target;
    if (t && t.closest && t.closest('.city-pin')) {
      e.stopPropagation();
      e.preventDefault();
    }
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
     overrides gate-hidden for the form alone), presents the
     flow's list at the menu step (.flow-open, the same readout
     carrying the menu instead of its city face), and returns to
     the city face only at the city step. */
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

/* __espilAuthOnce v1 - AUTH ONCE (Han 2026-11-11).
   Diagnosis of the second sign-in appearance: the game page's own
   entry sequence (monolith maybeShowEntrySub -> openLoginGate)
   presents the login gate UNCONDITIONALLY once the intro typing
   completes - it never checks whether the visitor already finished
   Login / Sign-up / Guest at the landing. The landing hands off
   through sessionStorage espil_pending_city, and the pair's head
   script marks that arrival with the espil-handoff class on <html>
   before any module loads. So: on the game page ONLY, and ONLY for
   a handoff arrival, the moment the gate presents while a gate is
   pending we complete it through the gate's own completion hook
   (the same call the form's success path makes). The completion
   runs in the MutationObserver microtask - before the presented
   frame can paint. A DIRECT arrival at the game page (no handoff
   mark) keeps the presented gate exactly as today, and the guest
   parking / session restore / logout semantics are untouched. */
(function () {
  'use strict';
  try {
    if (window.__ESPIL_GAME_PAGE !== true) return;
    if (!document.documentElement.classList.contains('espil-handoff')) return;
    var done = false;
    function passGate() {
      if (done) return true;
      try {
        if (typeof window.__espilLoginGatePending === 'function' && window.__espilLoginGatePending()
            && typeof window.__espilLoginGateDone === 'function') {
          window.__espilLoginGateDone();
          done = true;
          return true;
        }
      } catch (e) { console.error('[Espil] AUTH ONCE gate pass failed:', e); }
      return false;
    }
    function watch() {
      var modal = document.getElementById('signin-modal');
      if (!modal) return;
      if (modal.getAttribute('aria-hidden') === 'false') passGate();
      try {
        new MutationObserver(function () {
          if (modal.getAttribute('aria-hidden') === 'false') passGate();
        }).observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
      } catch (e) {}
      /* Belt and braces: the gate hooks are defined by the game
         module, which can land after this observer; a bounded poll
         covers a presentation that predates their definition. */
      var ticks = 0;
      var iv = setInterval(function () {
        ticks++;
        if (done || ticks > 240) { clearInterval(iv); return; }
        if (modal.getAttribute('aria-hidden') === 'false') passGate();
      }, 500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();
  } catch (e) {}
})();

/* __espilEntryV2Name v1 - THE AUTO-NAME ROLLER (Han 2026-11-24,
   entry-v2/DESIGN.md 3.1). One shared roller + availability
   check for the landing's guest door and the game page's
   backstop re-roll (the name-once pass below). The grammar is
   an adjective + noun combination in the village's grain,
   from curated pools (40 adjectives x 59 nouns, measured in
   the shipped bytes): every combination is pronounceable and
   village-shaped by construction, and the reserved law holds
   BY CONSTRUCTION - no pool word is a reserved word (espil,
   lunaris, leo, admin, official, system, guest), no
   combination of pool words reduces to one, and no pool word
   carries a digit, so the digit-collapsed reserved variants
   cannot occur either. ENGLISH POOLS (Han 2026-11-25 17:27,
   superseding the Korean pools of the first ship): the pools
   are the same words in English, word for word in the same
   order, Titlecase-concatenated in the same bare draw - a
   guest's name is a name, not UI copy, so the pools are
   English for every guest whatever the UI language.
   Combinations run 6-14 characters, inside cleanName's
   16-char cap; the design's numeric-suffix fallback appends
   3 digits and slices at the cap, as shipped. Codes are never
   the primary form (design 3.1). */
(function () {
  'use strict';
  if (window.__espilEntryV2RollName) return;
  var ADJ = ['Quiet', 'Swift', 'Slow', 'Bright', 'Dark', 'Warm', 'Cool', 'Cozy', 'Clear', 'Cloudy', 'Light', 'Heavy', 'Small', 'Grand', 'Round', 'Square', 'Long', 'Short', 'Deep', 'Shallow', 'High', 'Low', 'Blue', 'Red', 'White', 'Yellow', 'Green', 'Violet', 'Pink', 'Silver', 'Golden', 'Dawn', 'Noon', 'Dusk', 'Night', 'Early', 'Late', 'Far', 'Near', 'Fresh'];
  var NOUN = ['Village', 'Cloud', 'Wind', 'River', 'Lake', 'Sea', 'Isle', 'Peak', 'Hill', 'Field', 'Forest', 'Tree', 'Flower', 'Leaf', 'Stone', 'Sand', 'Snow', 'Rain', 'Moon', 'Star', 'Sun', 'Sky', 'Glow', 'Road', 'Bridge', 'House', 'Window', 'Door', 'Boat', 'Train', 'Bike', 'Mailbox', 'Beacon', 'Market', 'School', 'Library', 'Park', 'Garden', 'Pond', 'Falls', 'Cave', 'Desert', 'Meadow', 'Marsh', 'Cliff', 'Harbor', 'Alley', 'Roof', 'Chimney', 'Well', 'Spring', 'Mill', 'Farm', 'Ranch', 'Nursery', 'Tower', 'Castle', 'Plaza', 'Melody'];
  window.__espilEntryV2RollName = function () {
    return ADJ[Math.floor(Math.random() * ADJ.length)] + NOUN[Math.floor(Math.random() * NOUN.length)];
  };
  /* The shipped availability endpoint (GET /auth/name/available),
     fail-open on any network trouble - the CityRoom join
     re-checks both rules for session-less sockets. cb(true) =
     the name may be worn. */
  window.__espilEntryV2NameAvailable = function (name, cb) {
    try {
      var apiBase = (typeof window.__espilAuthApiBase === 'string' && window.__espilAuthApiBase) || 'https://api.espil.online';
      var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 2500) : 0;
      fetch(apiBase + '/auth/name/available?name=' + encodeURIComponent(name), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (to) clearTimeout(to);
          cb(!(j && j.available === false));
        })
        .catch(function () { if (to) clearTimeout(to); cb(true); });
    } catch (e) { cb(true); }
  };
})();

/* __espilGuestNameOnce v2 - THE AUTO-NAME HANDOFF (Han
   2026-11-24, entry-v2/DESIGN.md 2+3; supersedes the v1
   name-stamp pass of fix batch 7 item 2). The landing's guest
   door rolls the name (no form, no typing) and carries it
   across the dive in this tab's sessionStorage under
   espil_entry_v2_guest_name - a handoff, not a record: this
   pass reads it once, fills the game page's #char-name input
   with it (its consumers - presence's join name above all -
   read the input first) and removes it, so the name is
   presented nowhere and asked nowhere. The retired
   espil_guest_named_v1 stamp is removed on sight, never read.
   The rolled name is also published as
   window.__espilEntryV2GuestName for this page's life: the
   auth module's adoption interval keys off it to keep
   espil_username untouched for v2 guests, and the session's
   current name - the in-place upgrade's claim candidate -
   stays readable from the same places it always was (the
   input, the roster).
   JOIN BACKSTOP, READ AS A RE-ROLL (design 3.2 layer 3): if
   the CityRoom join refuses the name (name_reserved /
   name_taken, close 1008 - the seconds-wide race between the
   door's pre-check and the join), presence retries on its
   own backoff and re-reads the input on every attempt. If
   this tab stands in the map and has still never joined
   after a generous window, the refusal is the likely cause:
   a fresh name is rolled into the input, silently (checked
   against the availability endpoint first, fail-open), so
   the next retry rejoins under it. Capped at 3 re-rolls; a
   tab that has joined is never renamed, and a slow network
   alone costs at most a pre-join name change nobody has
   seen yet.
   Signed-in arrivals (a server-marked session record) and
   direct game-page arrivals (no handoff mark, no handoff
   key) keep today's behaviour exactly. */
(function () {
  'use strict';
  try {
    if (window.__ESPIL_GAME_PAGE !== true) return;
    if (!document.documentElement.classList.contains('espil-handoff')) return;
    try { sessionStorage.removeItem('espil_guest_named_v1'); } catch (e) {}
    var named = '';
    try { named = (sessionStorage.getItem('espil_entry_v2_guest_name') || '').trim(); } catch (e) {}
    if (!named) return;
    var signedIn = false;
    try {
      var rec = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      signedIn = !!(rec && rec.id && rec.server === true);
    } catch (e) {}
    if (signedIn) return;
    window.__espilEntryV2GuestName = named;
    function apply() {
      var inp = document.getElementById('char-name');
      if (!inp) return false;
      inp.value = named;
      inp.style.display = 'none';
      inp.setAttribute('data-espil-guest-named', '1');
      try { sessionStorage.removeItem('espil_entry_v2_guest_name'); } catch (e) {}
      return true;
    }
    if (!apply()) {
      var ticks = 0;
      var iv = setInterval(function () {
        ticks++;
        if (apply() || ticks > 40) clearInterval(iv);
      }, 250);
    }
    /* The pair markup is static, so the pass above normally lands
       before the gate opens; re-apply on the panel's own open in
       case anything re-shows the bare input. */
    var panel = document.getElementById('char-custom');
    if (panel) {
      try {
        new MutationObserver(function () {
          if (panel.getAttribute('aria-hidden') === 'false') apply();
        }).observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
      } catch (e) {}
    }
    /* The backstop re-roll watch (see the header): ticks count
       only while the tab stands in the map, which is when a
       join can actually be in flight. */
    var rerolls = 0, watchTicks = 0;
    var watch = setInterval(function () {
      var joined = false;
      try {
        var st = window.__espilChatState && window.__espilChatState();
        joined = !!(st && st.joined);
      } catch (e) {}
      if (joined) { clearInterval(watch); return; }
      if (!document.body || !document.body.classList.contains('in-map')) { watchTicks = 0; return; }
      watchTicks++;
      if (watchTicks >= 30 && rerolls < 3) {
        watchTicks = 0;
        rerolls++;
        var fresh = null;
        try { fresh = window.__espilEntryV2RollName && window.__espilEntryV2RollName(); } catch (e) {}
        if (!fresh) return;
        var swap = function () {
          named = fresh;
          window.__espilEntryV2GuestName = fresh;
          var inp = document.getElementById('char-name');
          if (inp) inp.value = fresh;
        };
        if (typeof window.__espilEntryV2NameAvailable === 'function') {
          window.__espilEntryV2NameAvailable(fresh, function (ok) { if (ok) swap(); });
        } else swap();
      }
      if (watchTicks > 240 && rerolls >= 3) clearInterval(watch);
    }, 500);
  } catch (e) {}
})();

/* __espilDiveGuide v1 - DIVE GUIDE (Han 2026-11-11 item 3).
   A NEW component (not the retired guide system): at dive time a
   popup shows on the game page. A first-time visitor gets the
   movement modal; a returning visitor gets the slim popup with a
   way back into the modal. The modal carries the skip-tutorial
   toggle: once ON (persisted), neither surface ever appears
   again. First-visit and skip state live in localStorage under
   this component's own keys. The guide arms on the arrival guide
   event and presents once the player is in the map and landed, so
   it never interrupts the fall or the entry gates. */
(function () {
  'use strict';
  if (window.__ESPIL_GAME_PAGE !== true) return;
  /* PLACE SPACE (Han 2026-11-16, design 10-2): a place-space
     arrival carries the handoff treatment - the first-visit
     guide surfaces never present inside a building's own space;
     the visit continues the parent window's session. */
  try { if (sessionStorage.getItem('espil_store_space_v1')) return; } catch (e) {}
  var SKIP_KEY = 'espil_diveguide_skip_v1';
  var SEEN_KEY = 'espil_diveguide_seen_v1';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function curLang() {
    try { if (typeof window.__espilLang === 'function') return window.__espilLang(); } catch (e) {}
    return 'en';
  }
  var COPY = {
    en: {
      title: 'HOW TO MOVE',
      sub: 'Welcome to Espil Online. These are the controls your traveler uses.',
      rows: [
        ['Move', 'Arrow keys - you walk toward where the camera faces. On touch screens, use the stick.'],
        ['Look', 'Drag to look around.'],
        ['Jump', 'Shift'],
        ['Interact', 'Space - talk, enter, and use what stands in front of you.'],
        ['Sprint', 'Ctrl toggles sprint.'],
        ['Indoors', 'Inside a store the view is first-person: A and D turn the camera.']
      ],
      skip: 'Skip this guide from now on',
      start: 'START EXPLORING',
      back: 'Welcome back.',
      how: 'HOW TO MOVE'
    },
    ko: {
      title: '이동 방법',
      sub: '에스필 온라인에 오신 것을 환영합니다. 여행자가 사용하는 조작법입니다.',
      rows: [
        ['이동', '방향키 - 카메라가 향한 쪽으로 걷습니다. 터치 화면에서는 스틱을 사용합니다.'],
        ['둘러보기', '드래그하면 주변을 둘러봅니다.'],
        ['점프', 'Shift'],
        ['상호작용', 'Space - 앞에 있는 것과 대화하고, 들어가고, 사용합니다.'],
        ['달리기', 'Ctrl로 달리기를 켜고 끕니다.'],
        ['실내', '가게 안에서는 1인칭 시점입니다: A와 D로 카메라를 돌립니다.']
      ],
      skip: '다음부터 이 가이드를 건너뜁니다',
      start: '탐험 시작',
      back: '다시 오신 것을 환영합니다.',
      how: '이동 방법'
    }
  };
  function copy() { return COPY[curLang()] || COPY.en; }
  var modal = null, mini = null, skipBox = null, built = false;
  function build() {
    if (built) return;
    built = true;
    var c = copy();
    modal = document.createElement('div');
    modal.id = 'espil-diveguide';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', c.title);
    var rowsHtml = '';
    for (var i = 0; i < c.rows.length; i++) {
      rowsHtml += '<li><span class="dg-key"></span><span class="dg-val"></span></li>';
    }
    modal.innerHTML = '<div class="dg-card"><h3 class="dg-title"></h3><p class="dg-sub"></p>'
      + '<ul class="dg-rows">' + rowsHtml + '</ul>'
      + '<label class="dg-skip"><input type="checkbox" id="espil-diveguide-skip"> <span class="dg-skip-text"></span></label>'
      + '<button type="button" class="dg-start"></button></div>';
    modal.querySelector('.dg-title').textContent = c.title;
    modal.querySelector('.dg-sub').textContent = c.sub;
    var lis = modal.querySelectorAll('.dg-rows li');
    for (var j = 0; j < lis.length && j < c.rows.length; j++) {
      lis[j].querySelector('.dg-key').textContent = c.rows[j][0];
      lis[j].querySelector('.dg-val').textContent = c.rows[j][1];
    }
    modal.querySelector('.dg-skip-text').textContent = c.skip;
    modal.querySelector('.dg-start').textContent = c.start;
    skipBox = modal.querySelector('#espil-diveguide-skip');
    skipBox.checked = lsGet(SKIP_KEY) === '1';
    skipBox.addEventListener('change', function () {
      if (skipBox.checked) lsSet(SKIP_KEY, '1'); else lsDel(SKIP_KEY);
    });
    modal.querySelector('.dg-start').addEventListener('click', hideModal);
    document.body.appendChild(modal);
    mini = document.createElement('div');
    mini.id = 'espil-diveguide-mini';
    mini.hidden = true;
    mini.innerHTML = '<span class="dg-mini-text"></span>'
      + '<button type="button" class="dg-mini-how"></button>'
      + '<button type="button" class="dg-mini-close" aria-label="Close">&times;</button>';
    mini.querySelector('.dg-mini-text').textContent = c.back;
    mini.querySelector('.dg-mini-how').textContent = c.how;
    mini.querySelector('.dg-mini-how').addEventListener('click', function () { hideMini(); showModal(); });
    mini.querySelector('.dg-mini-close').addEventListener('click', hideMini);
    document.body.appendChild(mini);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modal && !modal.hidden) hideModal();
    });
  }
  function showModal() { build(); if (skipBox) skipBox.checked = lsGet(SKIP_KEY) === '1'; modal.hidden = false; }
  function hideModal() { if (modal) modal.hidden = true; }
  var miniTimer = 0;
  function showMini() {
    build();
    mini.hidden = false;
    if (miniTimer) clearTimeout(miniTimer);
    miniTimer = setTimeout(hideMini, 9000);
  }
  function hideMini() { if (mini) mini.hidden = true; if (miniTimer) { clearTimeout(miniTimer); miniTimer = 0; } }
  var armed = false, shown = false, poll = 0;
  function present() {
    if (shown) return;
    if (!document.body.classList.contains('in-map')) return;
    var pose = null;
    try { pose = (typeof window.__espilPlayerPose === 'function') ? window.__espilPlayerPose() : null; } catch (e) {}
    if (!pose || !(pose.y < 1.5)) return;
    shown = true;
    if (poll) { clearInterval(poll); poll = 0; }
    if (lsGet(SKIP_KEY) === '1') return;
    if (lsGet(SEEN_KEY) === '1') { showMini(); return; }
    lsSet(SEEN_KEY, '1');
    showModal();
  }
  function arm() {
    if (armed) return;
    armed = true;
    poll = setInterval(present, 400);
    setTimeout(function () { if (poll) { clearInterval(poll); poll = 0; } }, 600000);
    present();
  }
  window.addEventListener('espil-guide', function (ev) {
    if (ev && ev.detail && ev.detail.type === 'arrival') arm();
  });
  window.addEventListener('espil-arrival', arm);
})();

/* __espilGenderOnce v1 - GENDER NEVER ASKED TWICE (Han 2026-11-14,
   fix batch 8 item 3). The gender is decided at the login/guest
   step: the landing Guest step writes it into the saved character
   record (localStorage espil_character, the record the avatar
   build itself reads), and a signed-in player's saved look
   carries the same record. But the game page's character gate
   still PRESENTED the Male/Female cards on every entry - pre-
   selected is not enough; Han's order is that the question is
   not asked again. So: when a decision exists in the record, the
   gate's gender cards (.char-grid) are hidden and the panel is
   stamped data-espil-gender-decided; the gate's own confirm path
   keeps running untouched and builds from the record exactly as
   it does today. When NO decision exists anywhere - a first-ever
   signed-in account with no saved look - the cards present once,
   here at the gate, and confirming writes the record, so the
   question never comes back. This supersedes the batch-7 note
   that the cards "keep their landing pre-selection untouched":
   for decided paths there is no presentation at all now.
   Changing the choice later stays possible in the in-game
   customizer. Guest pin, session parking, the name-once fix and
   the avatar build's gender branch are untouched. */
(function () {
  'use strict';
  try {
    if (window.__ESPIL_GAME_PAGE !== true) return;
    var gender = '';
    try {
      var rec = JSON.parse(localStorage.getItem('espil_character') || 'null');
      if (rec && (rec.gender === 'male' || rec.gender === 'female')) gender = rec.gender;
    } catch (e) {}
    if (!gender) return; /* no decision anywhere: the gate asks, once */
    function apply() {
      var panel = document.getElementById('char-custom');
      if (!panel) return false;
      var grid = panel.querySelector('.char-grid');
      if (grid) grid.style.display = 'none';
      panel.setAttribute('data-espil-gender-decided', gender);
      return true;
    }
    if (!apply()) {
      var ticks = 0;
      var iv = setInterval(function () {
        ticks++;
        if (apply() || ticks > 40) clearInterval(iv);
      }, 250);
    }
    /* The pair markup is static, so the pass above lands before
       the gate opens; re-apply on the panel's own open in case
       anything re-shows the bare cards. */
    var panel = document.getElementById('char-custom');
    if (panel) {
      try {
        new MutationObserver(function () {
          if (panel.getAttribute('aria-hidden') === 'false') apply();
        }).observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
      } catch (e) {}
    }
  } catch (e) {}
})();

/* __espilKbFit v1 - KEYBOARD FIT (Han 2026-11-14, fix batch 8
   item 1). On mobile, filling the landing guest-registration or
   login form raised the software keyboard over the form: the
   readout is anchored to the bottom of the LAYOUT viewport, and
   on the iOS model the keyboard does not shrink that viewport -
   it only shrinks the VISUAL viewport - so the bottom-anchored
   form stayed behind the keyboard (measured: password field at
   y 563-601 with the visible area ending at 470). This component
   tracks window.visualViewport: while the keyboard inset (layout
   height minus visual height) exceeds 80px it publishes the
   visual height and the inset as CSS variables and flags
   html.espil-kb-open; pair.css then lifts the readout clear of
   the keyboard and caps the form to the visual height, and the
   focused field is scrolled into the form's own visible band.
   Keyboard closed -> inset 0 -> the class and the lift vanish,
   so the resting layout is byte-identical to before. Desktop
   never engages (inset stays 0). */
(function () {
  'use strict';
  try {
    var vv = window.visualViewport;
    if (!vv) return;
    var root = document.documentElement;
    function focusedFormField() {
      var dv = document.getElementById('signin-div');
      var a = document.activeElement;
      if (dv && a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && dv.contains(a)) return a;
      return null;
    }
    function refit() {
      var a = focusedFormField();
      if (a) { try { a.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    }
    function update() {
      var inset = Math.max(0, Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0)));
      root.style.setProperty('--espil-vvh', Math.round(vv.height) + 'px');
      root.style.setProperty('--espil-kbinset', inset + 'px');
      var open = inset > 80;
      root.classList.toggle('espil-kb-open', open);
      if (open) refit();
    }
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusin', function (e) {
      var dv = document.getElementById('signin-div');
      if (dv && e.target && e.target.tagName === 'INPUT' && dv.contains(e.target)) {
        setTimeout(function () { update(); refit(); }, 60);
        setTimeout(refit, 350);
      }
    });
    update();
  } catch (e) {}
})();


/* __espilEntryV2Keys v1 - KEYBOARD-ONLY OPERABILITY (Han
   2026-11-24 20:47, entry-v2 amendment B - a HARD requirement):
   the whole entry flow completes with the keyboard alone, Enter
   + arrow keys sufficient. The pieces: (1) focus lands on the
   step's primary control at every step change (this pass watches
   the flow's step + visible view + auth sub-state and focuses
   accordingly - the doors' guest door, the form's first field,
   the menu's Play row, the city step's marked row); (2) arrow
   keys move within the doors, the menu/panel reels, and the
   CITY LIST - in the list an arrow moves the SELECTION itself
   (the same .sel marking a click makes, so the visible
   selection state and the focus ring travel together), and a
   bundle-less row reached by arrows opens its preparation
   panel exactly as a click does; (3) the enter button is a
   real button - focused, Enter and Space fire it natively
   (the flow's global Enter handler steps aside for it), and
   away from the button the physical Enter still dives the
   marked city (design 5 draft). The visible focus ring itself
   is drawn by the flow's own stylesheet (see the
   espil-landing-flow-css block). Nothing here changes any
   click behaviour. */
(function () {
  'use strict';
  try {
    function flowStep() {
      try { return window.__espilLandingFlow ? window.__espilLandingFlow.step() : null; } catch (e) { return null; }
    }
    function visibleViewId() {
      var views = document.querySelectorAll('.espil-flow-view');
      for (var i = 0; i < views.length; i++) {
        if (views[i].getAttribute('aria-hidden') === 'false') return views[i].id;
      }
      return null;
    }
    function authSub() {
      var box = document.getElementById('auth-box');
      if (box && box.offsetParent !== null && box.style.display !== 'none') return 'form';
      return 'choice';
    }
    function focusTarget() {
      var step = flowStep();
      /* Panels present over either the menu or the city step (the
         preparation panel opens from the city list): their row is
         the step's primary control while they stand. */
      var vv = visibleViewId();
      if (vv === 'espil-cityprep-panel') return document.getElementById('espil-cityprep-back');
      if (vv === 'espil-zealandia-panel') return document.getElementById('espil-zealandia-back');
      if (vv === 'espil-about-panel') return document.getElementById('espil-about-back');
      if (step === 'login') {
        if (authSub() === 'form') {
          var inputs = document.querySelectorAll('#auth-box input');
          for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].offsetParent !== null && inputs[i].type !== 'hidden') return inputs[i];
          }
          var sw = document.getElementById('auth-mode-switch');
          if (sw) return sw;
        }
        return document.getElementById('auth-go-guest');
      }
      if (step === 'menu') {
        return document.getElementById('espil-menu-play');
      }
      if (step === 'city') {
        /* The list's visible selection state is the centred row
           (the treatment a click and the centre tracker share). */
        var cen = document.querySelector('#city-list .espil-city-btn.is-centered');
        if (cen) return cen;
        return document.querySelector('#city-list .espil-city-btn');
      }
      return null;
    }
    var lastSig = null;
    setInterval(function () {
      try {
        if (window.__espilIntroActive) return;
        var sig = flowStep() + '|' + visibleViewId() + '|' + (flowStep() === 'login' ? authSub() : '');
        if (sig === lastSig) return;
        var t = focusTarget();
        if (!t) return; /* the step's controls are still building (the city rows land async) - retry next tick */
        lastSig = sig;
        if (document.activeElement !== t) t.focus();
      } catch (e) {}
    }, 400);

    function formTarget(e) {
      var t = e.target;
      if (!t || !t.tagName) return false;
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
    }
    document.addEventListener('keydown', function (e) {
      try {
        if (window.__espilIntroActive) return;
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
        if (formTarget(e)) return;
        var step = flowStep();
        if (step === 'city') {
          var rows = Array.prototype.slice.call(document.querySelectorAll('#city-list .espil-city-btn'));
          if (!rows.length) return;
          var list = document.getElementById('city-list');
          if (!list) return;
          e.preventDefault();
          e.stopPropagation();
          /* LANDING PACKAGE (Han 2026-11-25, item 2a): arrows behave
             exactly like scrolling - the press scrolls the list by
             one row height and the list's own scroll event drives
             the centre tracker (updateFlowReelCenter), precisely
             the wheel/touch path. No click is fired: an arrow press
             can never mark a city, open a preparation panel or dive
             (item 2b makes a row click dive, so this scroll form is
             its precondition), and the globe's facing follows the
             centred row exactly as it does for a scroll. Home/End
             scroll to the list's ends. */
          if (e.key === 'Home') list.scrollTop = 0;
          else if (e.key === 'End') list.scrollTop = list.scrollHeight;
          else {
            var rowH = rows[0] && rows[0].offsetHeight ? rows[0].offsetHeight : 44;
            list.scrollTop += (e.key === 'ArrowDown' ? rowH : -rowH);
          }
          return;
        }
        /* Doors + menu/panel reels: arrows move FOCUS among the
           container's visible buttons; Enter/Space activate. */
        var t = e.target;
        var container = null;
        if (t && t.closest) container = t.closest('#auth-choice') || t.closest('.espil-flow-view');
        if (!container) return;
        var btns = Array.prototype.slice.call(container.querySelectorAll('button')).filter(function (b) {
          return b.offsetParent !== null && b.style.display !== 'none';
        });
        if (btns.length < 2) return;
        var idx = btns.indexOf(t);
        if (idx < 0) return;
        var nidx;
        if (e.key === 'Home') nidx = 0;
        else if (e.key === 'End') nidx = btns.length - 1;
        else if (e.key === 'ArrowDown') nidx = Math.min(btns.length - 1, idx + 1);
        else nidx = Math.max(0, idx - 1);
        e.preventDefault();
        e.stopPropagation();
        btns[nidx].focus();
      } catch (err) {}
    }, true);
  } catch (e) {}
})();
