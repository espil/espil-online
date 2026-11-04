
/* Espil presence + chat client (spec v1, Architecture room 2026-10-24).
   Stateless guest layer: the name and gender live only in this tab's
   memory (and the guest's own localStorage for the name prefill); the
   server stores nothing. Connects on city arrival to
   wss://api.espil.online/ws?room=<cityKey>; endpoint overridable via
   window.__espilChatEndpoint for local testing.
   v2 (Han's order 2026-10-24): own position is sent every 1 s while
   joined; received positions drive the other users' minimap markers
   through the world script's __espilMinimapSet/Remove bridges. */
(function(){
  'use strict';
  if (window.__espilChatClient) return;
  window.__espilChatClient = true;

  var ENDPOINT = window.__espilChatEndpoint || 'wss://api.espil.online/ws';
  var ws = null, room = null, myId = null, users = {}, joined = false;
  var backoff = 1000, retryTimer = null, posTimer = null, pingTimer = null, sendWindow = [];
  var seenChats = {}, everJoined = false, localNoticeShown = false;
  var NAME_PH = { en: 'Your name', ko: '이름을 입력하세요', fr: 'Votre nom', zh: '你的名字' };

  function $(id){ return document.getElementById(id); }
  function lang(){ try { return window.__espilLang ? window.__espilLang() : 'en'; } catch(_){ return 'en'; } }
  function myName(){
    /* Spec v1: the name lives only in this connection's memory - no
       localStorage prefill (UI-room conformance note, 2026-10-24). */
    var inp = $('char-name');
    var v = inp ? inp.value.trim() : '';
    if (!v) {
      /* Returning browser: the character panel is skipped when a
         character record exists, so the input never appears and the
         join name collapsed to 'Guest' (live finding, 2026-10-24).
         Carry the game's own stored display name instead. This is a
         read-only fallback - nothing is written back, and the guest
         panel name itself is still never persisted (spec v1). */
      try { v = (localStorage.getItem('espil_username') || '').trim(); } catch(_){ v = ''; }
    }
    return (v || 'Guest').slice(0, 16);
  }
  function myGender(){
    /* The build's own record first (espil_character, the same source
       the world script reads), then this session's card clicks, then
       the panel's selected card. */
    try {
      var rec = JSON.parse(localStorage.getItem('espil_character') || 'null');
      if (rec && rec.gender) return rec.gender === 'female' ? 'f' : 'm';
    } catch(_){}
    if (window.__espilGuestGender) return window.__espilGuestGender;
    var sel = document.querySelector('.char-card.is-selected');
    if (sel && sel.getAttribute('data-gender')) return sel.getAttribute('data-gender') === 'female' ? 'f' : 'm';
    return 'm';
  }
  function myLook(){
    /* The saved customizer look rides the join frame (Han 2026-10-28);
       the Worker sanitizes and relays it on the roster, so peers see
       the same portrait and nameplate accent. */
    try { var rec = JSON.parse(localStorage.getItem('espil_character') || 'null'); if (rec && rec.look) return rec.look; } catch(_){}
    return null;
  }
  function line(who, text, sys){
    try { window.dispatchEvent(new CustomEvent('espil-chat-recv', { detail: { who: who, text: text, sys: !!sys } })); } catch(_){}
  }
  function presenceEl(){
    var el = $('chat-presence');
    if (!el) {
      var head = document.querySelector('.chat-head');
      if (!head) return null;
      el = document.createElement('span');
      el.id = 'chat-presence';
      el.style.cssText = 'margin-left:auto;font-size:11px;color:#9fd8e8;white-space:nowrap;padding-right:2px;';
      var exp = $('chat-expand');
      if (exp) head.insertBefore(el, exp); else head.appendChild(el);
    }
    return el;
  }
  function renderPresence(){
    var el = presenceEl(); if (!el) return;
    var names = Object.keys(users).map(function(k){ return users[k].name; });
    el.textContent = ws && joined ? ('\u25CF ' + names.length) : '';
    el.title = names.join(', ');
  }
  function sysLine(text){ line('', text, true); }
  /* UI-room delta: when the server does not respond, say once that the
     chat is local-only (the world script's own echo keeps working). */
  function maybeNotifyLocal(){
    if (localNoticeShown || everJoined) return;
    localNoticeShown = true;
    sysLine('Chat server is not responding - local chat only.');
  }
  function r2(n){ return Math.round((+n || 0) * 100) / 100; }

  var _lastPosSent=null;
  function startPos(){
    stopPos();
    posTimer = setInterval(function(){
      if (!ws || ws.readyState !== 1 || !joined) return;
      var p = null;
      try { p = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch(_){}
      if (!p) return;
      var _now=Date.now(), _vx=0, _vz=0;
      if(_lastPosSent&&_now>_lastPosSent.at){ var _dt=(_now-_lastPosSent.at)/1000; _vx=Math.max(-16,Math.min(16,(p.x-_lastPosSent.x)/_dt)); _vz=Math.max(-16,Math.min(16,(p.z-_lastPosSent.z)/_dt)); }
      _lastPosSent={x:p.x,z:p.z,at:_now};
      try { ws.send(JSON.stringify({ t: 'pos', x: r2(p.x), y: r2(p.y), z: r2(p.z), a: r2(p.a), vx: r2(_vx), vz: r2(_vz) })); } catch(_){}
    }, 1000);
  }
  function stopPos(){ if (posTimer) { clearInterval(posTimer); posTimer = null; } }
  /* Server hardening v1.1: sockets idle for 5 minutes are closed. The
     1 s position send normally keeps the socket warm; this 60 s ping
     covers any gap (spec: ping or pos at least every 60 s). */
  function startPing(){
    stopPing();
    pingTimer = setInterval(function(){
      if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ t: 'ping' })); } catch(_){} }
    }, 60000);
  }
  function stopPing(){ if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }

  function connect(r){
    room = r;
    clearTimeout(retryTimer);
    if (ws) { try { ws.onclose = null; ws.close(); } catch(_){} ws = null; }
    joined = false; myId = null; users = {}; renderPresence();
    var url = ENDPOINT + (ENDPOINT.indexOf('?') >= 0 ? '&' : '?') + 'room=' + encodeURIComponent(r);
    try { ws = new WebSocket(url); } catch(e){ scheduleRetry(); return; }
    ws.onopen = function(){
      backoff = 1000;
      startPing();
      var nm = myName();
      /* Record the name the guest typed into the character panel this
         session under the game's own display-name key (espil_username,
         read by the friends panel but written nowhere in the build -
         Architecture finding, 2026-10-24). A later visit whose panel
         is skipped then joins with that name via myName()'s fallback
         instead of 'Guest'. Only a panel-typed value is recorded; the
         fallback itself never rewrites storage. */
      try {
        var inp = $('char-name');
        if (inp && inp.value.trim()) localStorage.setItem('espil_username', nm);
      } catch(_){}
      try { ws.send(JSON.stringify({ t: 'join', name: nm, gender: myGender(), look: myLook() })); } catch(_){}
    };
    ws.onmessage = function(ev){
      var m; try { m = JSON.parse(ev.data); } catch(_){ return; }
      if (!m || !m.t) return;
      if (m.t === 'welcome') {
        myId = m.id; users = {}; joined = true; everJoined = true;
        (m.users || []).forEach(function(u){ users[u.id] = u; });
        try { if (window.__espilMinimapClear) window.__espilMinimapClear(); } catch(_){}
        try { if (window.__espilAvatarClear) window.__espilAvatarClear(); } catch(_){}
        renderPresence(); startPos();
        sysLine('- ' + Object.keys(users).length + ' here -');
      } else if (m.t === 'join' && m.user) {
        users[m.user.id] = m.user; renderPresence();
      } else if (m.t === 'leave') {
        delete users[m.id]; renderPresence(); markDmGone(m.id);
        try { if (window.__espilMinimapRemove) window.__espilMinimapRemove(m.id); } catch(_){}
        try { if (window.__espilAvatarRemove) window.__espilAvatarRemove(m.id); } catch(_){}
      } else if (m.t === 'pos') {
        var u = users[m.id];
        if (u) {
          u.pos = { x: m.x, y: m.y, z: m.z, a: m.a };
          try { if (window.__espilMinimapSet) window.__espilMinimapSet(m.id, m.x, m.z, u); } catch(_){}
          try { if (window.__espilAvatarSet) window.__espilAvatarSet(m.id, m.x, m.y, m.z, m.a, u, m.vx, m.vz); } catch(_){}
        }
      } else if (m.t === 'chat' && m.from) {
        /* UI-room delta: drop an exact re-delivery (same sender session,
           timestamp and text) so a line can never render twice. */
        var key = m.from.id + '|' + m.ts + '|' + m.text;
        if (seenChats[key]) return;
        if (Object.keys(seenChats).length > 500) seenChats = {};
        seenChats[key] = 1;
        line(m.from.name || 'Guest', String(m.text || ''), false);
        /* overhead speech bubble over the sender's avatar (own bubble
           is the world script's DOM bubble on send) */
        try { if (window.__espilAvatarBubble && m.from.id !== myId) window.__espilAvatarBubble(m.from.id, String(m.text || '')); } catch(_){}
      } else if (m.t === 'dm' && m.from) {
        onDmFrame(m);
      } else if (m.t === 'stall_update' && m.user) {
        var u3 = users[m.user.id];
        if (u3) u3.stall = m.user.stall || null;
      } else if (m.t && (m.t.indexOf('party_') === 0 || m.t.indexOf('stall_') === 0 || m.t.indexOf('fly_') === 0)) {
        try { window.dispatchEvent(new CustomEvent('espil-party-frame', { detail: m })); } catch(_){}
      } else if (m.t === 'error') {
        if (m.code && String(m.code).indexOf('party_') === 0) {
          try { window.dispatchEvent(new CustomEvent('espil-party-frame', { detail: { t: 'party_error', code: m.code, to: m.to || null } })); } catch(_){}
        }
        if (m.code === 'room_full') { sysLine('This city is full right now (100). Chat unavailable.'); stopRetry(); }
        else if (m.code === 'rate_limited') { sysLine('Slow down a little.'); }
        else if (m.code === 'dm_target_gone') { onDmTargetGone(m); }
        else if (m.code === 'not_joined' && ws) {
          try { ws.send(JSON.stringify({ t: 'join', name: myName(), gender: myGender(), look: myLook() })); } catch(_){}
        }
      }
    };
    ws.onclose = function(){ joined = false; stopPos(); stopPing(); renderPresence(); resetDmState(); try { if (window.__espilAvatarClear) window.__espilAvatarClear(); } catch(_){} maybeNotifyLocal(); scheduleRetry(); };
    ws.onerror = function(){ try { ws.close(); } catch(_){} };
  }
  function scheduleRetry(){
    if (!room) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function(){ if (room) connect(room); }, backoff);
    backoff = Math.min(15000, backoff * 2);
  }
  function stopRetry(){ clearTimeout(retryTimer); room = null; stopPos(); stopPing(); }

  /* Send hook used by the chat window's sendChat (world script). Returns
     true when the message went to the server; the server echoes it back
     to everyone including the sender, so no local echo is added. */
  window.__espilChatSend = function(text){
    if (!ws || ws.readyState !== 1 || !joined) { if (room) maybeNotifyLocal(); return false; }
    var now = Date.now();
    sendWindow = sendWindow.filter(function(t){ return now - t < 5000; });
    if (sendWindow.length >= 5) { sysLine('Slow down a little.'); return true; }
    sendWindow.push(now);
    try { ws.send(JSON.stringify({ t: 'chat', text: String(text).slice(0, 300) })); return true; }
    catch(_){ return false; }
  };
  /* Social send bridge (Han 2026-10-27): the party layer in
     __espilSocial sends its frames over this same socket
     (party_invite / party_accept / party_decline / party_leave /
     party_chat, served by the Worker's CityRoom party layer). */
  window.__espilSocialSend = function(obj){
    if (!ws || ws.readyState !== 1 || !joined) return false;
    try { ws.send(JSON.stringify(obj)); return true; } catch(_){ return false; }
  };
  window.__espilChatState = function(){
    return { connected: !!(ws && ws.readyState === 1), joined: joined, room: room, myId: myId,
             users: Object.keys(users).map(function(k){ return users[k]; }) };
  };

  var lastArrivalAt = 0;
  window.addEventListener('espil-arrival', function(e){
    var city = e && e.detail && e.detail.city;
    if (city) { lastArrivalAt = Date.now(); connect(String(city).toLowerCase()); }
  });

  /* UI-room delta: do not haunt the room from the globe. While joined,
     if the page has been out of the in-map state for over 3 s (the user
     returned to orbit), leave the room; the next arrival rejoins. */
  setInterval(function(){
    if (!joined && !room) return;
    if (Date.now() - lastArrivalAt < 6000) { window.__espilOutSince = 0; return; }
    var inMap = document.body && document.body.classList.contains('in-map');
    if (inMap) { window.__espilOutSince = 0; return; }
    if (!window.__espilOutSince) { window.__espilOutSince = Date.now(); return; }
    if (Date.now() - window.__espilOutSince > 3000 && room) {
      var old = ws;
      stopRetry(); users = {}; joined = false; renderPresence();
      try { if (window.__espilMinimapClear) window.__espilMinimapClear(); } catch(_){}
        try { if (window.__espilAvatarClear) window.__espilAvatarClear(); } catch(_){}
      if (old) { try { old.onclose = null; old.close(); } catch(_){} }
      if (ws === old) ws = null;
    }
  }, 1000);

  function wirePanel(){
    var inp = $('char-name');
    if (inp) {
      var applyPh = function(){ inp.placeholder = NAME_PH[lang()] || NAME_PH.en; };
      applyPh(); setInterval(applyPh, 1500);
      inp.addEventListener('keydown', function(e){
        e.stopPropagation();
        /* UI-room delta: Enter in the name field presses the panel's
           confirm button, so the entry flow works keyboard-only. */
        if (e.key === 'Enter') { var c = $('char-confirm'); if (c) { e.preventDefault(); c.click(); } }
      });
    }
    var male = $('char-male'), female = $('char-female');
    if (male) male.addEventListener('click', function(){ window.__espilGuestGender = 'm'; });
    if (female) female.addEventListener('click', function(){ window.__espilGuestGender = 'f'; });
    var input = $('chat-input');
    if (input) input.setAttribute('maxlength', '300');
    presenceEl();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wirePanel);
  else wirePanel();

  /* Mobile chat guard (live feedback item 2, 2026-10-24): the chat
     input's 12 px font makes iOS Safari auto-zoom the page on focus,
     and the zoom/scroll offset survives the keyboard closing - the
     fixed joystick ends up outside the visible area and "never comes
     back". Two-part guard: (1) on touch devices, text inputs render at
     16 px so the focus zoom never triggers; (2) when chat typing ends
     (blur after send/Escape), any residual page scroll is reset so the
     fixed controls land back on their anchors. Desktop is untouched. */
  function wireMobileChatGuard(){
    try {
      var st = document.createElement('style');
      st.id = 'espil-mobile-chat-guard';
      st.textContent = '@media (pointer: coarse){ input, textarea, select { font-size: 16px !important; } }';
      (document.head || document.documentElement).appendChild(st);
    } catch(_){}
    var inp = $('chat-input');
    if (!inp || inp.__espilMobileGuard) return;
    inp.__espilMobileGuard = true;
    inp.addEventListener('blur', function(){
      var reset = function(){
        try { window.scrollTo(0, 0); } catch(_){}
        try { document.documentElement.scrollTop = 0; } catch(_){}
        try { if (document.body) document.body.scrollTop = 0; } catch(_){}
      };
      reset();
      setTimeout(reset, 60); setTimeout(reset, 320);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMobileChatGuard);
  else wireMobileChatGuard();

  /* __espilDM begin */
  /* ---- Proximity interact + 1:1 DM (live feedback item 4; DM rides
     spec v1.2, server live 2026-10-24). Proximity is client-side: the
     module already holds every user's last pos frame. Conversations
     are keyed by peer SESSION id (names may duplicate; a reconnect is
     a new id, so a conversation dies with its session). Own DM lines
     render only from the server's echo frame, per the confirmed
     client commitments; sends share the chat budget (5 per 5 s). ---- */
  var DM_RANGE = 3.5;
  var dmConvs = {}, activeDmPeer = null, dmPanelOpen = false, pendingEcho = [];
  var nearPeer = null, menuPeer = null, dmDomReady = false;
  var DM_T = {
    en: { interact: 'Interact', dm: '1:1 Chat', trade: 'Trade', profile: 'Profile', close: 'Close',
          gone: 'This user has left.', tradeSoon: 'Trading opens with the stall economy update.',
          msgPh: 'Message - Enter to send', here: 'here now', away: 'left' },
    ko: { interact: '상호작용', dm: '둘이채팅', trade: '거래', profile: '프로필', close: '닫기',
          gone: '상대방이 나갔습니다.', tradeSoon: '거래는 노점 경제 업데이트와 함께 열립니다.',
          msgPh: '메시지 - Enter로 전송', here: '접속 중', away: '나감' }
  };
  function dmT(k){ var d = DM_T[lang()] || DM_T.en; return (d && d[k]) || DM_T.en[k] || k; }
  function escT(t){ return String(t).replace(/[<>&"']/g, function(c){ return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function ensureDmDom(){
    if (dmDomReady) return; dmDomReady = true;
    var st = document.createElement('style'); st.id = 'espil-dm-style';
    st.textContent = [
      '#espil-interact-prompt{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(118px + env(safe-area-inset-bottom,0px));z-index:58;display:none;padding:9px 16px;border-radius:999px;border:1px solid rgba(142,247,232,.55);background:rgba(8,14,12,.82);color:#eafff8;font:600 13px Manrope,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45)}',
      '#espil-interact-prompt b{color:#8ef7e8}',
      '#espil-interact-menu{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(164px + env(safe-area-inset-bottom,0px));z-index:59;display:none;width:min(280px,88vw);border:2px solid #6b4a2f;border-radius:18px;background:linear-gradient(160deg,rgba(20,35,20,.96),rgba(10,20,12,.96));color:#f3e9d2;padding:14px;box-shadow:0 14px 34px rgba(0,0,0,.55)}',
      '#espil-interact-menu h4{margin:0 0 10px;font-size:14px;letter-spacing:.06em;color:#ffd97a}',
      '#espil-interact-menu button{display:block;width:100%;margin:6px 0;padding:10px;border-radius:10px;border:1px solid rgba(255,217,122,.35);background:rgba(255,255,255,.06);color:#fff;font:600 14px Manrope,sans-serif;cursor:pointer}',
      '#espil-dm-panel{position:fixed;top:76px;right:14px;z-index:59;display:none;width:min(324px,88vw);max-height:min(66vh,560px);border:2px solid #6b4a2f;border-radius:18px;background:linear-gradient(160deg,rgba(20,35,20,.97),rgba(10,20,12,.97));color:#f3e9d2;box-shadow:0 14px 34px rgba(0,0,0,.55);display:none;flex-direction:column;overflow:hidden}',
      '#espil-dm-panel.open{display:flex}',
      '#espil-dm-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,217,122,.25)}',
      '#espil-dm-head b{color:#ffd97a;font-size:14px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#espil-dm-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px 0}',
      '.espil-dm-tab{padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#dfe9d8;font:600 12px Manrope,sans-serif;cursor:pointer}',
      '.espil-dm-tab.on{border-color:#ffd97a;color:#ffd97a}',
      '.espil-dm-tab .dot{display:inline-block;min-width:16px;margin-left:5px;padding:0 4px;border-radius:8px;background:#e2543e;color:#fff;font-size:10px;text-align:center}',
      '#espil-dm-lines{flex:1;overflow-y:auto;padding:10px 12px;min-height:110px}',
      '.espil-dm-line{margin:5px 0;font-size:13px;line-height:1.45;word-break:break-word}',
      '.espil-dm-line .who{color:#8ef7e8;font-weight:700}',
      '.espil-dm-line.me .who{color:#ffd97a}',
      '.espil-dm-line.sys{color:#c9b98a;font-style:italic}',
      '#espil-dm-row{display:flex;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,217,122,.25)}',
      '#espil-dm-input{flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,221,140,.4);background:rgba(0,0,0,.3);color:#fff4cf;font:600 13px Manrope,sans-serif}',
      '#espil-dm-send{padding:8px 12px;border-radius:8px;border:1px solid rgba(142,247,232,.5);background:rgba(20,60,50,.6);color:#eafff8;font:700 13px Manrope,sans-serif;cursor:pointer}',
      '#espil-dm-chip{position:fixed;right:14px;top:76px;z-index:58;display:none;padding:8px 13px;border-radius:999px;border:1px solid rgba(255,217,122,.6);background:rgba(30,40,16,.92);color:#ffd97a;font:700 12px Manrope,sans-serif;cursor:pointer}',
      '#espil-peer-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;display:none;width:min(340px,90vw);border:2px solid #6b4a2f;border-radius:20px;background:linear-gradient(160deg,rgba(20,35,20,.97),rgba(10,20,12,.97));color:#f3e9d2;padding:18px;box-shadow:0 18px 40px rgba(0,0,0,.6)}',
      '#espil-peer-card h4{margin:0 0 8px;color:#ffd97a;font-size:16px;letter-spacing:.05em}',
      '#espil-peer-card p{margin:5px 0;font-size:13.5px;line-height:1.55}',
      '.espil-x{float:right;border:none;background:rgba(255,255,255,.1);color:#fff;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:14px}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
    var b = document.body; if (!b) return;
    var prompt = document.createElement('button'); prompt.id = 'espil-interact-prompt'; prompt.type = 'button';
    prompt.addEventListener('click', function(){ if (nearPeer) openInteractMenu(nearPeer); });
    b.appendChild(prompt);
    var menu = document.createElement('div'); menu.id = 'espil-interact-menu';
    menu.innerHTML = '<h4></h4>' +
      '<button type="button" data-act="dm"></button>' +
      '<button type="button" data-act="trade"></button>' +
      '<button type="button" data-act="profile"></button>' +
      '<button type="button" data-act="close"></button>';
    menu.addEventListener('click', function(e){
      var btn = e.target && e.target.closest ? e.target.closest('button') : null; if (!btn || !menuPeer) return;
      var act = btn.getAttribute('data-act'), peer = menuPeer;
      closeInteractMenu();
      if (act === 'dm') openDmPanel(peer.id, peer.name);
      else if (act === 'trade') showPeerCard(peer, 'trade');
      else if (act === 'profile') showPeerCard(peer, 'profile');
    });
    b.appendChild(menu);
    var chip = document.createElement('button'); chip.id = 'espil-dm-chip'; chip.type = 'button';
    chip.addEventListener('click', function(){
      for (var id in dmConvs) if (dmConvs[id].unread > 0) { openDmPanel(id, dmConvs[id].name); return; }
    });
    b.appendChild(chip);
    var panel = document.createElement('div'); panel.id = 'espil-dm-panel';
    panel.innerHTML = '<div id="espil-dm-head"><b></b><button type="button" class="espil-x" id="espil-dm-close" aria-label="Close">×</button></div>' +
      '<div id="espil-dm-tabs"></div><div id="espil-dm-lines"></div>' +
      '<div id="espil-dm-row"><input id="espil-dm-input" type="text" maxlength="300" autocomplete="off"><button type="button" id="espil-dm-send">OK</button></div>';
    b.appendChild(panel);
    $('espil-dm-close').addEventListener('click', closeDmPanel);
    $('espil-dm-send').addEventListener('click', sendDmFromInput);
    var din = $('espil-dm-input');
    din.setAttribute('placeholder', dmT('msgPh'));
    din.addEventListener('keydown', function(e){
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); sendDmFromInput(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeDmPanel(); }
    });
    din.addEventListener('keyup', function(e){ e.stopPropagation(); });
    var card = document.createElement('div'); card.id = 'espil-peer-card';
    card.innerHTML = '<button type="button" class="espil-x" id="espil-peer-close" aria-label="Close">×</button><h4></h4><div class="espil-peer-body"></div>';
    b.appendChild(card);
    $('espil-peer-close').addEventListener('click', function(){ card.style.display = 'none'; });
  }

  function setNear(peer){
    nearPeer = peer;
    ensureDmDom();
    var p = $('espil-interact-prompt'); if (!p) return;
    if (peer && !menuPeer && !dmPanelOpen) {
      p.innerHTML = '<b>F</b> · ' + escT(peer.name) + ' · ' + escT(dmT('interact'));
      p.style.display = 'block';
    } else p.style.display = 'none';
  }
  setInterval(function(){
    if (!joined || !document.body || !document.body.classList.contains('in-map')) { if (nearPeer) setNear(null); return; }
    var me = null; try { me = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch(_){}
    if (!me) { if (nearPeer) setNear(null); return; }
    var best = null, bd = DM_RANGE;
    for (var id in users) {
      if (id === myId) continue; var u = users[id]; if (!u || !u.pos) continue;
      var dx = u.pos.x - me.x, dz = u.pos.z - me.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d <= bd) { bd = d; best = { id: id, name: u.name || 'Guest', dist: d }; }
    }
    if ((best && (!nearPeer || nearPeer.id !== best.id)) || (!best && nearPeer)) setNear(best);
    else if (best) nearPeer = best;
  }, 500);

  function openInteractMenu(peer){
    ensureDmDom(); menuPeer = peer;
    var m = $('espil-interact-menu'); if (!m) return;
    m.querySelector('h4').textContent = peer.name;
    m.querySelector('[data-act="dm"]').textContent = dmT('dm');
    m.querySelector('[data-act="trade"]').textContent = dmT('trade');
    m.querySelector('[data-act="profile"]').textContent = dmT('profile');
    m.querySelector('[data-act="close"]').textContent = dmT('close');
    m.style.display = 'block';
    var p = $('espil-interact-prompt'); if (p) p.style.display = 'none';
  }
  function closeInteractMenu(){ menuPeer = null; var m = $('espil-interact-menu'); if (m) m.style.display = 'none'; }

  function ensureConv(id, name){
    if (!dmConvs[id]) dmConvs[id] = { name: name || 'Guest', lines: [], unread: 0, gone: false };
    if (name) dmConvs[id].name = name;
    return dmConvs[id];
  }
  function renderDmTabs(){
    var t = $('espil-dm-tabs'); if (!t) return; var h = '';
    for (var id in dmConvs) {
      var c = dmConvs[id];
      h += '<button type="button" class="espil-dm-tab' + (id === activeDmPeer ? ' on' : '') + '" data-peer="' + escT(id) + '">' +
           escT(c.name) + (c.unread > 0 ? '<span class="dot">' + c.unread + '</span>' : '') + '</button>';
    }
    t.innerHTML = h;
    Array.prototype.forEach.call(t.querySelectorAll('.espil-dm-tab'), function(el){
      el.addEventListener('click', function(){ openDmPanel(el.getAttribute('data-peer'), dmConvs[el.getAttribute('data-peer')].name); });
    });
  }
  function renderDmLines(){
    var box = $('espil-dm-lines'); if (!box || !activeDmPeer) return;
    var c = dmConvs[activeDmPeer]; if (!c) { box.innerHTML = ''; return; }
    var h = '';
    c.lines.forEach(function(l){
      if (l.sys) h += '<div class="espil-dm-line sys">' + escT(l.text) + '</div>';
      else h += '<div class="espil-dm-line' + (l.me ? ' me' : '') + '"><span class="who">' + escT(l.who) + ':</span> ' + escT(l.text) + '</div>';
    });
    box.innerHTML = h; box.scrollTop = box.scrollHeight;
    var head = document.querySelector('#espil-dm-head b'); if (head) head.textContent = c.name;
    var inp = $('espil-dm-input'); if (inp) inp.disabled = !!c.gone;
  }
  function renderDmChip(){
    ensureDmDom(); var chip = $('espil-dm-chip'); if (!chip) return;
    var n = 0; for (var id in dmConvs) n += dmConvs[id].unread;
    if (n > 0 && !dmPanelOpen) { chip.textContent = 'DM · ' + n; chip.style.display = 'block'; }
    else chip.style.display = 'none';
  }
  function openDmPanel(peerId, name){
    ensureDmDom();
    var c = ensureConv(peerId, name); c.unread = 0;
    activeDmPeer = peerId; dmPanelOpen = true;
    var p = $('espil-dm-panel'); if (p) p.classList.add('open');
    renderDmTabs(); renderDmLines(); renderDmChip();
    var pr = $('espil-interact-prompt'); if (pr) pr.style.display = 'none';
    var inp = $('espil-dm-input'); if (inp) { try { inp.focus({ preventScroll: true }); } catch(_){ inp.focus(); } }
  }
  function closeDmPanel(){
    dmPanelOpen = false;
    var p = $('espil-dm-panel'); if (p) p.classList.remove('open');
    var inp = $('espil-dm-input'); if (inp) { try { inp.blur(); } catch(_){} }
    renderDmChip();
  }
  function appendDm(peerId, who, text, mine, sys){
    var c = ensureConv(peerId, who);
    c.lines.push({ who: who, text: text, me: !!mine, sys: !!sys });
    if (c.lines.length > 100) c.lines.splice(0, c.lines.length - 100);
    if (dmPanelOpen && activeDmPeer === peerId) { renderDmLines(); renderDmTabs(); }
  }
  function noticeDm(peerId, text){ appendDm(peerId, '', text, false, true); }

  function dmBudgetOk(){
    var now = Date.now();
    sendWindow = sendWindow.filter(function(t){ return now - t < 5000; });
    if (sendWindow.length >= 5) { sysLine('Slow down a little.'); return false; }
    sendWindow.push(now); return true;
  }
  function sendDmFromInput(){
    var inp = $('espil-dm-input'); if (!inp || !activeDmPeer) return;
    var text = inp.value.trim(); if (!text) return;
    var c = dmConvs[activeDmPeer];
    if (c && c.gone) { noticeDm(activeDmPeer, dmT('gone')); inp.value = ''; return; }
    if (!ws || ws.readyState !== 1 || !joined) { sysLine('Not connected.'); return; }
    if (!dmBudgetOk()) return;
    pendingEcho.push({ to: activeDmPeer, text: text.slice(0, 300) });
    try { ws.send(JSON.stringify({ t: 'dm', to: activeDmPeer, text: text.slice(0, 300) })); inp.value = ''; }
    catch(_){ pendingEcho.pop(); }
  }
  function onDmFrame(m){
    var text = String(m.text || '');
    var key = 'dm|' + m.from.id + '|' + m.ts + '|' + text + '|' + (m.echo ? 'e' : 'r');
    if (seenChats[key]) return;
    if (Object.keys(seenChats).length > 500) seenChats = {};
    seenChats[key] = 1;
    if (m.echo) {
      var rec = pendingEcho.shift();
      var peerId = rec ? rec.to : activeDmPeer;
      if (peerId) { ensureConv(peerId, (users[peerId] && users[peerId].name) || undefined); appendDm(peerId, myName(), text, true); }
    } else {
      ensureConv(m.from.id, m.from.name);
      appendDm(m.from.id, m.from.name || 'Guest', text, false);
      if (!(dmPanelOpen && activeDmPeer === m.from.id)) { dmConvs[m.from.id].unread++; renderDmChip(); if (dmPanelOpen) renderDmTabs(); }
    }
  }
  function onDmTargetGone(m){
    var peerId = null;
    if (m && m.to) {
      /* spec v1.2 revision (server, 2026-10-24): the error frame names
         the target session id - attribute directly, no order guessing.
         Drop that peer's oldest un-echoed send. */
      peerId = String(m.to);
      for (var i = 0; i < pendingEcho.length; i++) {
        if (pendingEcho[i].to === peerId) { pendingEcho.splice(i, 1); break; }
      }
    } else {
      /* fallback for frames without a target id: last pending send */
      var rec = pendingEcho.pop();
      peerId = rec ? rec.to : activeDmPeer;
    }
    if (!peerId) return;
    var c = ensureConv(peerId, (users[peerId] && users[peerId].name) || undefined);
    c.gone = true; noticeDm(peerId, dmT('gone'));
    if (dmPanelOpen && activeDmPeer === peerId) renderDmLines();
  }
  function markDmGone(id){
    if (menuPeer && menuPeer.id === id) closeInteractMenu();
    if (!dmConvs[id]) return;
    var c = dmConvs[id];
    if (!c.gone) { c.gone = true; noticeDm(id, dmT('gone')); }
    if (dmPanelOpen && activeDmPeer === id) renderDmLines();
  }
  function resetDmState(){
    dmConvs = {}; activeDmPeer = null; pendingEcho = []; menuPeer = null;
    dmPanelOpen = false;
    var p = $('espil-dm-panel'); if (p) p.classList.remove('open');
    var m = $('espil-interact-menu'); if (m) m.style.display = 'none';
    var chip = $('espil-dm-chip'); if (chip) chip.style.display = 'none';
  }
  function showPeerCard(peer, mode){
    ensureDmDom();
    var card = $('espil-peer-card'); if (!card) return;
    card.querySelector('h4').textContent = peer.name;
    var body = card.querySelector('.espil-peer-body');
    if (mode === 'trade') {
      body.innerHTML = '<p>' + escT(dmT('tradeSoon')) + '</p>';
    } else {
      var u = users[peer.id] || {};
      var g = u.gender === 'f' ? '♀' : '♂';
      body.innerHTML = '<p>' + escT(peer.name) + ' ' + g + ' · ' + escT(dmT('here')) + '</p>' +
        '<p>' + (room ? escT(room) : '') + (typeof peer.dist === 'number' ? ' · ' + peer.dist.toFixed(1) + ' m' : '') + '</p>';
    }
    card.style.display = 'block';
  }
  document.addEventListener('keydown', function(e){
    var ae = document.activeElement;
    var typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
    if ((e.key === 'f' || e.key === 'F') && nearPeer && !typing && document.body.classList.contains('in-map')) {
      openInteractMenu(nearPeer);
    } else if (e.key === 'Escape') {
      if (menuPeer) closeInteractMenu();
      var card = $('espil-peer-card'); if (card && card.style.display === 'block') card.style.display = 'none';
    }
  });
  window.__espilDmState = function(){
    return { near: nearPeer ? nearPeer.id : null, convs: Object.keys(dmConvs), active: activeDmPeer,
             unread: (function(){ var n = 0; for (var id in dmConvs) n += dmConvs[id].unread; return n; })(),
             lines: activeDmPeer && dmConvs[activeDmPeer] ? dmConvs[activeDmPeer].lines.length : 0 };
  };
  /* __espilDM end */
})();

