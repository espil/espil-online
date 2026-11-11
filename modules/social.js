
/* __espilSocial v1 - right-click character menu, party, friends and
   account sign-in (Han 2026-10-27, espil.online room).

   • Right-click a character (yours included): Profile (ID + the
     character's appearance), Party Invite, Trade (disabled, Coming
     Soon), Add Friend (added to the friend list).
   • A party invite arrives as an accept/decline bar; once the other
     player accepts, the party exists on the server (the Worker's
     CityRoom party layer, memory-only) and party members can talk
     through the chat window's Party channel.
   • P opens one window with Party and Friend tabs (the build's own
     #friends-panel, re-rendered here). U still opens it too.
   • The sign-in modal's Sign Up / Sign In run on device-local
     accounts (salted SHA-256 in localStorage, never the plain
     password), and a session feeds the game's own display name.
     Server account sync arrives with the D1/auth backend step.
   __espilSocial END */
(function () {
  'use strict';
  if (window.__espilSocial) return;
  window.__espilSocial = true;

  function $(id) { return document.getElementById(id); }
  function escT(t) { return String(t == null ? '' : t).replace(/[<>&"']/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lang() { try { return window.__espilLang ? window.__espilLang() : 'en'; } catch (_) { return 'en'; } }
  function toast(msg) { try { if (window.__espilToast) { window.__espilToast(msg); return; } } catch (_) {} }
  function sysLine(text) { try { window.dispatchEvent(new CustomEvent('espil-chat-recv', { detail: { who: '', text: text, sys: true } })); } catch (_) {} }
  function inMap() { return !!(document.body && document.body.classList.contains('in-map')); }

  var T = {
    en: { profile: 'Profile', party: 'Party Invite', trade: 'Trade', friend: 'Add Friend', soon: 'COMING SOON', close: 'Close',
          invited: 'Party invite sent to ', notConnected: 'Not connected to the city yet.', declined: ' declined the party invite.',
          partyFull: 'That party is full.', gone: 'That player has left.', alreadyMember: 'Already in your party.',
          invTitle: ' invites you to a party.', accept: 'Accept', decline: 'Decline',
          noParty: 'You are not in a party yet.', leave: 'Leave Party', partyChatHint: 'Party chat: pick the Party channel in the chat window.',
          invite: 'Invite', remove: 'Remove', online: 'Online now', offline: 'Offline',
          noFriends: 'No friends yet. Right-click a character in the world, or add by name:',
          add: 'ADD', namePh: 'Name', you: 'You', idLabel: 'ID', lookLabel: 'Appearance',
          maleLook: 'Male traveller', femaleLook: 'Female traveller', statusLabel: 'Status', here: 'Here now',
          cityLabel: 'City', distLabel: 'Distance', partyNow: 'Party', membersWord: 'members',
          needPartyForChat: 'Party chat: join a party first (right-click a character, or press O).' },
    ko: { profile: '프로필', party: '파티 초대', trade: '거래', friend: '친구 등록', soon: 'COMING SOON', close: '닫기',
          invited: '파티 초대를 보냈습니다: ', notConnected: '아직 도시에 연결되지 않았습니다.', declined: '님이 파티 초대를 거절했습니다: ',
          partyFull: '파티가 가득 찼습니다.', gone: '상대방이 나갔습니다.', alreadyMember: '이미 같은 파티입니다.',
          invTitle: '님이 파티에 초대했습니다.', accept: '수락', decline: '거절',
          noParty: '아직 파티가 없습니다.', leave: '파티 나가기', partyChatHint: '파티 대화는 채팅창의 Party 채널에서 할 수 있습니다.',
          invite: '초대', remove: '삭제', online: '접속 중', offline: '오프라인',
          noFriends: '아직 친구가 없습니다. 월드에서 캐릭터를 우클릭하거나, 이름으로 추가하세요:',
          add: '추가', namePh: '이름', you: '나', idLabel: '아이디', lookLabel: '캐릭터 외형',
          maleLook: '남자 여행자', femaleLook: '여자 여행자', statusLabel: '상태', here: '접속 중',
          cityLabel: '도시', distLabel: '거리', partyNow: '파티', membersWord: '명',
          needPartyForChat: '파티 대화: 먼저 파티에 들어가세요 (캐릭터 우클릭, 또는 O키).' }
  };
  function t(k) { var d = T[lang()] || T.en; return d[k] || T.en[k] || k; }

  /* ---------------- friends (device-local list) ---------------- */
  var LS_FRIENDS = 'espil_friends_v1';
  function loadFriends() { try { var a = JSON.parse(localStorage.getItem(LS_FRIENDS) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function saveFriends(a) { try { localStorage.setItem(LS_FRIENDS, JSON.stringify(a)); } catch (_) {} }
  function isFriend(name) { var n = String(name || '').toLowerCase(); return loadFriends().some(function (f) { return String(f.name).toLowerCase() === n; }); }
  function addFriend(name, gender) {
    name = String(name || '').trim().slice(0, 16); if (!name) return false;
    if (isFriend(name)) return false;
    var a = loadFriends(); a.push({ name: name, gender: gender === 'f' ? 'f' : 'm', at: Date.now() }); saveFriends(a); return true;
  }
  function removeFriend(name) { var n = String(name || '').toLowerCase(); saveFriends(loadFriends().filter(function (f) { return String(f.name).toLowerCase() !== n; })); }

  /* ---------------- shared state from the presence client ------- */
  function chatState() { try { return window.__espilChatState ? window.__espilChatState() : null; } catch (_) { return null; } }
  function myId() { var st = chatState(); return st ? st.myId : null; }
  function onlineUsers() { var st = chatState(); return st && st.users ? st.users : []; }
  function userById(id) { var us = onlineUsers(); for (var i = 0; i < us.length; i++) if (us[i].id === id) return us[i]; return null; }
  function userByName(name) { var n = String(name || '').toLowerCase(); var us = onlineUsers(); for (var i = 0; i < us.length; i++) if (String(us[i].name || '').toLowerCase() === n) return us[i]; return null; }
  function myDisplayName() {
    var id = myId(), u = id ? userById(id) : null;
    if (u && u.name) return u.name;
    try { return (localStorage.getItem('espil_username') || 'Guest').slice(0, 16); } catch (_) { return 'Guest'; }
  }
  function myGender() {
    try { var rec = JSON.parse(localStorage.getItem('espil_character') || 'null'); if (rec && rec.gender) return rec.gender === 'female' ? 'f' : 'm'; } catch (_) {}
    var id = myId(), u = id ? userById(id) : null; return u && u.gender === 'f' ? 'f' : 'm';
  }
  function myLook() {
    try { var rec = JSON.parse(localStorage.getItem('espil_character') || 'null'); if (rec && rec.look) return rec.look; } catch (_) {}
    var id = myId(), u = id ? userById(id) : null; return (u && u.look) || null;
  }

  /* ---------------- party state -------------------------------- */
  var party = null;              // {id, members:[{id,name,gender}]}
  var pendingInvite = null;      // {id,name}
  function inPartyWith(id) { return !!(party && party.members.some(function (m) { return m.id === id; })); }
  function sendParty(obj) { try { return window.__espilSocialSend ? window.__espilSocialSend(obj) : false; } catch (_) { return false; } }
  function inviteToParty(peer) {
    if (!peer || peer.self) return;
    if (inPartyWith(peer.id)) { toast(t('alreadyMember')); return; }
    if (!sendParty({ t: 'party_invite', to: peer.id })) { toast(t('notConnected')); return; }
    toast(t('invited') + peer.name);
  }

  /* ---------------- DOM: styles, menu, card, invite bar --------- */
  var domReady = false, ctxEl = null, ctxPeer = null, cardEl = null, inviteEl = null, inviteTimer = null;
  function ensureDom() {
    if (domReady) return; domReady = true;
    var st = document.createElement('style'); st.id = 'espil-social-style';
    st.textContent = [
      '#espil-ctx{position:fixed;z-index:80;display:none;width:min(230px,86vw);border:2px solid #54381f;border-radius:14px;background-image:linear-gradient(160deg,rgba(62,42,22,.97),rgba(38,25,12,.98)),url("assets/tex/logwood.jpg");background-size:cover,280px;color:#f3e9d2;padding:10px;box-shadow:0 14px 34px rgba(0,0,0,.55)}',
      '#espil-ctx h4{margin:0 0 8px;font-size:13.5px;letter-spacing:.04em;color:#ffd97a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#espil-ctx button{display:flex;align-items:center;width:100%;margin:5px 0;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,217,122,.35);background:rgba(202,160,106,.14);color:#fff;font:600 13.5px Manrope,sans-serif;cursor:pointer;text-align:left}',
      '#espil-ctx button:disabled{opacity:.45;cursor:default}',
      '#espil-ctx .soon{margin-left:auto;font-size:.56rem;font-weight:800;letter-spacing:.12em;color:#0b1518;background:#ffd97a;border-radius:999px;padding:3px 7px}',
      '#espil-social-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:81;display:none;width:min(340px,90vw);max-height:94vh;overflow:hidden;border:2px solid rgba(201,168,106,.78);border-radius:18px;background-image:linear-gradient(168deg,rgba(62,42,22,.98),rgba(38,25,12,.98)),url("assets/tex/logwood.jpg");background-size:cover,320px;color:#f3e9d2;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,217,122,.28)}',
      '.espil-card-head{display:flex;align-items:center;gap:14px;margin:0 0 10px;padding-bottom:10px;border-bottom:1px solid rgba(201,168,106,.38)}',
      '.espil-card-face{flex:none;width:76px;height:76px;border-radius:50%;border:2px solid rgba(245,197,66,.75);background:#3a2817;box-shadow:0 4px 14px rgba(0,0,0,.4)}',
      '#espil-social-card h4{margin:0;color:#ffd97a;font-size:16px;letter-spacing:.04em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#espil-social-card p{margin:5px 0;font-size:13.5px;line-height:1.55}',
      '#espil-social-card p b{color:#e8b04b;font-weight:700}',
      '.espil-social-x{float:right;border:none;background:rgba(255,255,255,.1);color:#fff;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:14px}',
      '#espil-invite-bar{position:fixed;left:50%;transform:translateX(-50%);top:calc(70px + env(safe-area-inset-top,0px));z-index:82;display:none;align-items:center;gap:10px;max-width:min(480px,92vw);border:2px solid #54381f;border-radius:999px;background-image:linear-gradient(160deg,rgba(62,42,22,.97),rgba(38,25,12,.98)),url("assets/tex/logwood.jpg");background-size:cover,300px;color:#f3e9d2;padding:9px 12px 9px 18px;box-shadow:0 14px 34px rgba(0,0,0,.55);font:600 13.5px Manrope,sans-serif}',
      '#espil-invite-bar button{border-radius:999px;padding:7px 14px;border:1px solid rgba(255,217,122,.5);background:rgba(255,217,122,.16);color:#ffd97a;font:700 13px Manrope,sans-serif;cursor:pointer}',
      '#espil-invite-bar button.no{background:transparent;color:#e8dcc0;border-color:rgba(202,160,106,.5)}',
      '.espil-social-row{display:flex;align-items:center;gap:8px;border:1px solid rgba(202,160,106,.45);border-radius:8px;padding:6px 9px;margin:0 0 6px;background:rgba(62,42,22,.5);color:#f5e6c8;font-size:13.5px}',
      '.espil-social-row .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.espil-social-row .st{font-size:11.5px;opacity:.75}',
      '.espil-tab-btn{padding:8px 16px;border-radius:999px;border:1px solid rgba(202,160,106,.5);background:transparent;color:#e8dcc0;font:800 12.5px Manrope,sans-serif;letter-spacing:.06em;cursor:pointer}',
      '.espil-tab-btn.on{background:rgba(255,221,140,.18);color:#fff4cf;border-color:rgba(255,221,140,.6)}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
    var b = document.body; if (!b) return;

    ctxEl = document.createElement('div'); ctxEl.id = 'espil-ctx';
    ctxEl.innerHTML = '<h4></h4>' +
      '<button type="button" data-act="profile"></button>' +
      '<button type="button" data-act="party"></button>' +
      '<button type="button" data-act="trade" disabled></button>' +
      '<button type="button" data-act="friend"></button>' +
      '<button type="button" data-act="close"></button>';
    ctxEl.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn || btn.disabled || !ctxPeer) return;
      var act = btn.getAttribute('data-act'), peer = ctxPeer;
      closeCtx();
      if (act === 'profile') showProfile(peer);
      else if (act === 'party') inviteToParty(peer);
      else if (act === 'friend') {
        if (addFriend(peer.name, peer.gender)) toast(peer.name + ' - ' + t('friend') + ' OK');
        renderPanel();
      }
    });
    ctxEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    b.appendChild(ctxEl);

    cardEl = document.createElement('div'); cardEl.id = 'espil-social-card';
    cardEl.innerHTML = '<button type="button" class="espil-social-x" aria-label="Close">×</button>' +
      '<div class="espil-card-head"><canvas class="espil-card-face" width="112" height="112"></canvas><h4></h4></div>' +
      '<div class="espil-social-body"></div>';
    cardEl.querySelector('.espil-social-x').addEventListener('click', function () { cardEl.style.display = 'none'; });
    b.appendChild(cardEl);

    inviteEl = document.createElement('div'); inviteEl.id = 'espil-invite-bar';
    inviteEl.innerHTML = '<span class="espil-invite-txt"></span>' +
      '<button type="button" class="yes"></button><button type="button" class="no"></button>';
    inviteEl.querySelector('.yes').addEventListener('click', function () {
      if (pendingInvite) sendParty({ t: 'party_accept', from: pendingInvite.id });
      hideInvite();
    });
    inviteEl.querySelector('.no').addEventListener('click', function () {
      if (pendingInvite) sendParty({ t: 'party_decline', from: pendingInvite.id });
      hideInvite();
    });
    b.appendChild(inviteEl);
  }
  function openCtx(peer, x, y) {
    ensureDom(); if (!ctxEl) return;
    ctxPeer = peer;
    ctxEl.querySelector('h4').textContent = peer.name + (peer.self ? ' (' + t('you') + ')' : '');
    ctxEl.querySelector('[data-act="profile"]').textContent = t('profile');
    var pb = ctxEl.querySelector('[data-act="party"]');
    pb.textContent = t('party'); pb.disabled = !!peer.self || inPartyWith(peer.id);
    var tb = ctxEl.querySelector('[data-act="trade"]');
    tb.innerHTML = escT(t('trade')) + '<span class="soon">' + escT(t('soon')) + '</span>'; tb.disabled = true;
    var fb = ctxEl.querySelector('[data-act="friend"]');
    fb.textContent = t('friend'); fb.disabled = !!peer.self || isFriend(peer.name);
    ctxEl.querySelector('[data-act="close"]').textContent = t('close');
    ctxEl.style.display = 'block';
    var w = 230, h = 265;
    ctxEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x)) + 'px';
    ctxEl.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y)) + 'px';
  }
  function closeCtx() { ctxPeer = null; if (ctxEl) ctxEl.style.display = 'none'; }
  function showInvite(from) {
    ensureDom(); if (!inviteEl) return;
    pendingInvite = from;
    inviteEl.querySelector('.espil-invite-txt').textContent = from.name + t('invTitle');
    inviteEl.querySelector('.yes').textContent = t('accept');
    inviteEl.querySelector('.no').textContent = t('decline');
    inviteEl.style.display = 'flex';
    clearTimeout(inviteTimer);
    inviteTimer = setTimeout(hideInvite, 25000);
  }
  function hideInvite() { pendingInvite = null; clearTimeout(inviteTimer); if (inviteEl) inviteEl.style.display = 'none'; }

  /* ---------------- profile card -------------------------------- */
  /* The profile portrait (Han 2026-10-28): the character's current
     look, painted with the same recipe the world's own profile panel
     uses (the guide-face borrow, else the gendered face). */
  function paintFace(cv, gender, look) {
    if (!cv) return;
    var c = cv.getContext('2d'); if (!c) return;
    var src = document.getElementById('guide-face'), painted = false;
    if (src) { try { var px = src.getContext('2d').getImageData(6, 6, 1, 1).data; painted = px[3] > 0; } catch (e) {} }
    c.clearRect(0, 0, 112, 112);
    c.save(); c.beginPath(); c.arc(56, 56, 54, 0, Math.PI * 2); c.clip();
    if (painted) { c.drawImage(src, 0, 0, 112, 112); }
    else {
      /* Customizer look (Han 2026-10-28): skin tone, hair style and
         colour, outfit colour - the defaults reproduce the old face. */
      var SK = ['#ffe3c2', '#f2c49b', '#dca26b', '#a8703c', '#6f4525'];
      var HC = ['#3a2a1c', '#7a4a2b', '#b3764a', '#e3c188', '#ececec', '#23262b', '#c94f4f', '#4a6ac9', '#5da873'];
      var OF = ['#3f7fbf', '#c94f4f', '#57a773', '#e0a83c', '#7a5fc0', '#e77fc0', '#37b8a5', '#e8e4da'];
      var lk = look || {};
      var skin = SK[typeof lk.skin === 'number' ? lk.skin : 1] || SK[1];
      var hairCol = HC[typeof lk.hairColor === 'number' ? lk.hairColor : (gender === 'f' ? 1 : 0)] || HC[0];
      var outfit = OF[typeof lk.outfit === 'number' ? lk.outfit : 0] || OF[0];
      var hs = typeof lk.hair === 'number' ? lk.hair : 0;
      var grd = c.createLinearGradient(0, 0, 0, 112); grd.addColorStop(0, '#1d4256'); grd.addColorStop(1, '#12242f');
      c.fillStyle = grd; c.fillRect(0, 0, 112, 112);
      c.fillStyle = outfit; c.beginPath(); c.moveTo(22, 112); c.quadraticCurveTo(56, 82, 90, 112); c.closePath(); c.fill();
      c.fillStyle = skin; c.fillRect(50, 74, 12, 16);
      c.beginPath(); c.arc(56, 58, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = hairCol;
      if (gender === 'f') {
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
    }
    c.restore();
  }

  function showProfile(peer) {
    if (peer.self) {
      if (window.__espilOpenSelfProfile) { window.__espilOpenSelfProfile(); return; }
    }
    ensureDom(); if (!cardEl) return;
    cardEl.querySelector('h4').textContent = peer.name;
    var st = chatState();
    var body = cardEl.querySelector('.espil-social-body');
    var lines = '';
    lines += '<p><b>' + escT(t('idLabel')) + '</b> ' + escT(peer.accountId || peer.name) + (peer.id && !peer.self ? ' · #' + escT(peer.id) : '') + '</p>';
    lines += '<p><b>' + escT(t('lookLabel')) + '</b> ' + escT(peer.gender === 'f' ? t('femaleLook') : t('maleLook')) + ' ' + (peer.gender === 'f' ? '♀' : '♂') + '</p>';
    lines += '<p><b>' + escT(t('statusLabel')) + '</b> ' + escT(t('here')) + (st && st.room ? ' · ' + escT(t('cityLabel')) + ' ' + escT(st.room) : '') + '</p>';
    if (typeof peer.dist === 'number') lines += '<p><b>' + escT(t('distLabel')) + '</b> ' + peer.dist.toFixed(1) + ' m</p>';
    if (party && !peer.self && inPartyWith(peer.id)) lines += '<p><b>' + escT(t('partyNow')) + '</b> ' + party.members.length + ' ' + escT(t('membersWord')) + '</p>';
    body.innerHTML = lines;
    paintFace(cardEl.querySelector('.espil-card-face'), peer.gender, peer.look);
    cardEl.style.display = 'block';
  }

  /* ---------------- right-click picking -------------------------- */
  function projectPose(x, y, z) {
    var cam = null;
    try { cam = window.__espilMapCameraObj ? window.__espilMapCameraObj() : null; } catch (_) {}
    if (!cam || typeof THREE === 'undefined') return null;
    var drop = 0;
    try { drop = window.__espilGlobeView ? window.__espilGlobeView.dropAt(x, z) : 0; } catch (_) {}
    var v = new THREE.Vector3(x, y - drop, z);
    v.project(cam);
    if (v.z > 1 || v.z < -1) return null;
    return { sx: (v.x * 0.5 + 0.5) * window.innerWidth, sy: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }
  function pickCharacter(cx, cy) {
    var cands = [];
    var me = null;
    try { me = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch (_) {}
    if (me) cands.push({ id: myId() || 'me', name: myDisplayName(), gender: myGender(), look: myLook(), self: true, x: me.x, y: me.y, z: me.z });
    var remotes = [];
    try { remotes = window.__espilRemoteList ? window.__espilRemoteList() : []; } catch (_) {}
    remotes.forEach(function (r) {
      var u = userById(r.id) || {};
      cands.push({ id: r.id, name: u.name || 'Guest', gender: u.gender === 'f' ? 'f' : 'm', look: u.look || null, self: false, x: r.x, y: r.y, z: r.z });
    });
    var best = null, bestScore = 1e9;
    cands.forEach(function (c) {
      var head = projectPose(c.x, c.y + 1.95, c.z), feet = projectPose(c.x, c.y, c.z);
      if (!head || !feet) return;
      var top = Math.min(head.sy, feet.sy) - 16, bottom = Math.max(head.sy, feet.sy) + 14;
      if (cy < top || cy > bottom) return;
      var dx = Math.abs(cx - head.sx);
      if (dx > 58) return;
      var dMe = me ? Math.sqrt((c.x - me.x) * (c.x - me.x) + (c.z - me.z) * (c.z - me.z)) : 0;
      c.dist = c.self ? 0 : dMe;
      var midY = (head.sy + feet.sy) / 2;
      var score = dx * dx + (cy - midY) * (cy - midY) + (c.self ? 25 : 0);
      if (score < bestScore) { bestScore = score; best = c; }
    });
    return best;
  }
  document.addEventListener('contextmenu', function (e) {
    if (!inMap()) { closeCtx(); return; }
    var peer = pickCharacter(e.clientX, e.clientY);
    if (!peer) { closeCtx(); return; }
    e.preventDefault();
    openCtx(peer, e.clientX, e.clientY);
  });
  document.addEventListener('pointerdown', function (e) {
    if (ctxEl && ctxEl.style.display === 'block' && !ctxEl.contains(e.target)) closeCtx();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCtx(); if (cardEl) cardEl.style.display = 'none'; hideInvite(); }
  });

  /* ---------------- party frames ------------------------------- */
  window.addEventListener('espil-party-frame', function (e) {
    var m = e && e.detail; if (!m || !m.t) return;
    if (m.t === 'party_invite' && m.from) {
      showInvite({ id: m.from.id, name: m.from.name || 'Guest' });
    } else if (m.t === 'party_update') {
      var was = party ? party.members.map(function (x) { return x.id; }).join(',') : '';
      party = m.partyId ? { id: m.partyId, members: m.members || [] } : null;
      var now = party ? party.members.map(function (x) { return x.id; }).join(',') : '';
      if (was !== now) {
        if (party) sysLine(t('partyNow') + ': ' + party.members.map(function (x) { return x.name; }).join(', '));
        renderPanel();
      }
    } else if (m.t === 'party_chat' && m.from) {
      try { window.dispatchEvent(new CustomEvent('espil-chat-recv', { detail: { who: '[' + t('partyNow') + '] ' + (m.from.name || 'Guest'), text: String(m.text || ''), sys: false } })); } catch (_) {}
    } else if (m.t === 'party_declined' && m.from) {
      toast((m.from.name || 'Guest') + t('declined'));
    } else if (m.t === 'party_error') {
      if (m.code === 'party_full') toast(t('partyFull'));
      else if (m.code === 'party_target_gone') toast(t('gone'));
      else if (m.code === 'party_already_member') toast(t('alreadyMember'));
      else if (m.code === 'party_none') sysLine(t('needPartyForChat'));
    }
  });

  /* Party channel in the chat window: when the Party chip is the
     active channel, the world's sendChat reaches __espilChatSend -
     route it to party_chat instead of the room channel. */
  function partyChipActive() {
    var chip = document.querySelector('.chat-channel[data-i18n="chatParty"]');
    return !!(chip && chip.classList.contains('is-active'));
  }
  (function wrapChatSend() {
    var orig = window.__espilChatSend;
    if (typeof orig !== 'function') { setTimeout(wrapChatSend, 600); return; }
    if (orig.__espilSocialWrapped) return;
    var wrapped = function (text) {
      if (partyChipActive()) {
        if (!party) { sysLine(t('needPartyForChat')); return true; }
        if (sendParty({ t: 'party_chat', text: String(text).slice(0, 300) })) return true;
        sysLine(t('notConnected')); return true;
      }
      return orig(text);
    };
    wrapped.__espilSocialWrapped = true;
    window.__espilChatSend = wrapped;
  })();

  /* ---------------- P: Party / Friend window -------------------- */
  var activeTab = 'party', panelBuilt = false;
  function panelEl() { return $('friends-panel'); }
  function buildPanel() {
    var grid = $('friends-grid'); if (!grid || panelBuilt) return;
    panelBuilt = true;
    grid.innerHTML =
      '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
        '<button type="button" class="espil-tab-btn" id="espil-tab-party">PARTY</button>' +
        '<button type="button" class="espil-tab-btn" id="espil-tab-friend">FRIEND</button>' +
        '<span class="st-foot" id="espil-social-me" style="margin-left:auto;"></span>' +
      '</div><div id="espil-social-body"></div>';
    $('espil-tab-party').addEventListener('click', function () { activeTab = 'party'; renderPanel(); });
    $('espil-tab-friend').addEventListener('click', function () { activeTab = 'friend'; renderPanel(); });
    grid.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button') : null; if (!btn) return;
      var act = btn.getAttribute('data-pact');
      if (act === 'invite') { var u = userById(btn.getAttribute('data-id')); if (u) inviteToParty({ id: u.id, name: u.name || 'Guest', gender: u.gender, self: false }); }
      else if (act === 'invite-name') { var u2 = userByName(btn.getAttribute('data-name')); if (u2) inviteToParty({ id: u2.id, name: u2.name || 'Guest', gender: u2.gender, self: false }); }
      else if (act === 'leave') { if (sendParty({ t: 'party_leave' })) { party = null; renderPanel(); } }
      else if (act === 'remove-friend') { removeFriend(btn.getAttribute('data-name')); renderPanel(); }
      else if (act === 'add-friend') {
        var inp = $('espil-friend-name');
        var nm = inp ? inp.value.trim() : '';
        if (nm) { if (addFriend(nm, 'm')) toast(nm + ' - ' + t('friend') + ' OK'); renderPanel(); }
      }
    });
    var gridEl = grid;
    gridEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'espil-friend-name') {
        e.preventDefault();
        var nm = e.target.value.trim();
        if (nm) { addFriend(nm, 'm'); renderPanel(); }
      }
      e.stopPropagation();
    });
  }
  function renderPanel() {
    var p = panelEl(); if (!p) return;
    /* The world's own panel refresh can replace #friends-grid wholesale;
       if our skeleton was wiped, rebuild it instead of rendering nowhere. */
    if (!$('espil-social-body')) panelBuilt = false;
    buildPanel();
    var body = $('espil-social-body'); if (!body) return;
    var tp = $('espil-tab-party'), tf = $('espil-tab-friend');
    if (tp) tp.classList.toggle('on', activeTab === 'party');
    if (tf) tf.classList.toggle('on', activeTab === 'friend');
    var me = $('espil-social-me'); if (me) me.textContent = myDisplayName();
    var mid = myId(), h = '';
    if (activeTab === 'party') {
      if (party && party.members.length) {
        party.members.forEach(function (m) {
          h += '<div class="espil-social-row"><span class="grow">' + escT(m.name) + (m.id === mid ? ' (' + escT(t('you')) + ')' : '') + '</span><span class="st">' + (m.gender === 'f' ? '♀' : '♂') + '</span></div>';
        });
        h += '<button type="button" class="pill-btn" data-pact="leave">' + escT(t('leave')) + '</button>';
        h += '<p class="st-foot" style="margin-top:10px;">' + escT(t('partyChatHint')) + '</p>';
      } else {
        h += '<p class="st-foot">' + escT(t('noParty')) + '</p>';
        onlineUsers().forEach(function (u) {
          if (u.id === mid) return;
          h += '<div class="espil-social-row"><span class="grow">' + escT(u.name || 'Guest') + '</span><span class="st">' + escT(t('online')) + '</span><button type="button" class="pill-btn" data-pact="invite" data-id="' + escT(u.id) + '">' + escT(t('invite')) + '</button></div>';
        });
      }
    } else {
      var fr = loadFriends();
      if (!fr.length) h += '<p class="st-foot">' + escT(t('noFriends')) + '</p>';
      fr.forEach(function (f) {
        var u = userByName(f.name);
        h += '<div class="espil-social-row"><span class="grow">' + escT(f.name) + '</span><span class="st">' + (u ? escT(t('online')) : escT(t('offline'))) + '</span>' +
          (u ? '<button type="button" class="pill-btn" data-pact="invite-name" data-name="' + escT(f.name) + '">' + escT(t('invite')) + '</button>' : '') +
          '<button type="button" class="pill-btn" data-pact="remove-friend" data-name="' + escT(f.name) + '">' + escT(t('remove')) + '</button></div>';
      });
      h += '<div style="display:flex;gap:8px;margin:10px 0;">' +
        '<input type="text" id="espil-friend-name" maxlength="16" placeholder="' + escT(t('namePh')) + '" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(134,238,228,.3);background:rgba(0,0,0,.3);color:#ddfffc;" />' +
        '<button type="button" class="pill-btn" data-pact="add-friend">' + escT(t('add')) + '</button></div>';
    }
    /* do not clobber a half-typed add-by-name input on refresh */
    var ae = document.activeElement;
    if (!(ae && ae.id === 'espil-friend-name')) body.innerHTML = h;
  }
  function togglePanel(force) {
    var p = panelEl(); if (!p) return;
    var open = typeof force === 'boolean' ? force : p.getAttribute('aria-hidden') !== 'false';
    if (open) renderPanel();
    p.setAttribute('aria-hidden', String(!open));
  }
  document.addEventListener('keydown', function (e) {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (!inMap()) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'o' && !e.repeat) { e.preventDefault(); e.stopPropagation(); togglePanel(); }
    else if (k === 'escape') { var p = panelEl(); if (p && p.getAttribute('aria-hidden') === 'false') togglePanel(false); }
  }, true);
  (function watchPanel() {
    var p = panelEl(); if (!p) { setTimeout(watchPanel, 800); return; }
    new MutationObserver(function () { if (p.getAttribute('aria-hidden') === 'false') renderPanel(); })
      .observe(p, { attributes: true, attributeFilter: ['aria-hidden'] });
  })();
  setInterval(function () { var p = panelEl(); if (p && p.getAttribute('aria-hidden') === 'false') renderPanel(); }, 3000);

  /* ---------------- accounts: signup / sign in ------------------ */
  var LS_ACCOUNTS = 'espil_accounts_v1', LS_SESSION = 'espil_session_v1';
  /* S0 activation (flip step 1, READINESS 3.6): the account
     authority is the espil-api Worker. espil_accounts_v1 is
     retired as an authority - records are left in place, never
     deleted, and no longer read for auth (device-local records do
     not migrate, PLAN.md D3). espil_session_v1 keeps its shape
     ({id, at}) and is written only from a server response; the
     server:true mark is what entry-flow's isLoggedIn() now reads. */
  var API_BASE = 'https://api.espil.online';
  function serverSessionSync() {
    if (!window.fetch) return;
    fetch(API_BASE + '/auth/session', { credentials: 'include' }).then(function (r) {
      return r.status === 200 ? r.json() : null;
    }).then(function (body) {
      if (body && body.signedIn && body.user && body.user.name) {
        try { localStorage.setItem(LS_SESSION, JSON.stringify({ id: body.user.name, at: Date.now(), server: true })); } catch (_) {}
        try { localStorage.setItem('espil_username', body.user.name); } catch (_) {}
      } else {
        var s = session();
        if (s && s.server) { try { localStorage.removeItem(LS_SESSION); } catch (_) {} }
      }
      paintAuth();
    }).catch(function () {});
  }
  /* ESPIL-AUTH-CLIENT-BEGIN */
  /* Credential helpers, structure (a) (Cybersecurity ruling
     AUTH-REVIEW-2): the password NEVER leaves this device. Only
     K = PBKDF2-HMAC-SHA256(password, salt, iterations) crosses
     the wire; the server stores an HMAC of K under a server-side
     pepper and never sees the password. The breached-password
     check is a k-anonymity range lookup: only the first 5 hex
     characters of the password's SHA-1 are sent to the range
     service - the full hash and the password itself never
     leave. This marked block is extracted and exercised by the
     espil-api test suite; keep it free of module internals. */
  var ESPIL_PBKDF2_ITERATIONS = 600000;
  function espilB64urlEncode(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function espilB64urlDecode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    var padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    var bin = atob(padded);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function espilPasswordPolicyError(password) {
    if (!password || password.length < 8) return 'Password: 8 characters or more.';
    if (password.length > 128) return 'Password: 128 characters or fewer.';
    return null;
  }
  function espilDeriveKey(password, saltB64, iterations) {
    var salt = espilB64urlDecode(saltB64);
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']).then(function (key) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, key, 256);
    }).then(function (bits) { return espilB64urlEncode(new Uint8Array(bits)); });
  }
  function espilPasswordBreached(password) {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(password)).then(function (buf) {
      var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase();
      var prefix = hex.slice(0, 5), suffix = hex.slice(5);
      return fetch('https://api.pwnedpasswords.com/range/' + prefix).then(function (r) { return r.text(); }).then(function (text) {
        return text.split(/\r?\n/).some(function (line) { return line.split(':')[0] === suffix; });
      });
    }).catch(function () { return false; });
  }
  /* ESPIL-AUTH-CLIENT-END */
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
  function authMsg(msg, ok) { var el = $('auth-msg'); if (el) { el.textContent = msg || ''; el.style.color = ok ? '#8ef7e8' : '#ffd97a'; } }
  function paintAuth() {
    var s = session(), el = $('auth-session');
    if (el) {
      if (s) { el.hidden = false; el.textContent = 'Signed in as ' + s.id; }
      else { el.hidden = true; el.textContent = ''; }
    }
  }
  function completeGate() {
    try { if (window.__espilLoginGatePending && window.__espilLoginGatePending()) { window.__espilLoginGateDone(); return; } } catch (_) {}
    try { if (window.__espilLoginBypass && window.__espilLoginBypass()) return; } catch (_) {}
    var m = $('signin-modal'); if (m) m.setAttribute('aria-hidden', 'true');
  }
  function startSession(rec, msg) {
    try { localStorage.setItem(LS_SESSION, JSON.stringify({ id: rec.name, at: Date.now(), server: true })); } catch (_) {}
    try { localStorage.setItem('espil_username', rec.name); } catch (_) {}
    authMsg(msg, true); paintAuth();
    setTimeout(completeGate, 350);
  }
  /* Sign-up name claim (Han 2026-11-10 - an approved account-design
     addition, presentation-frozen otherwise): when the form's name
     field carries a value, registration still happens first (the
     account is created with the server-derived name and the
     session is issued at once, exactly as before); the entered
     name is then claimed via the Worker's POST /auth/name. While a
     claim is unresolved the gate is NOT completed, and the landing
     flow's advance reads nameClaim through __espilAuthState() and
     holds. A rejected claim leaves the user in the form with the
     session live: SIGN UP then retries the claim with the field's
     current value (never a re-register), an emptied field or the
     form's Back entry abandons the claim and keeps the derived
     name. Errors surface mapped and human - never raw payloads. */
  var nameClaimState = 'idle'; /* idle | pending | failed */
  var claimDerivedName = null;
  function readName() { var el = $('auth-name'); return el ? el.value.trim() : ''; }
  function setClaimBackVisible(v) { var b = $('auth-back'); if (b) b.hidden = !v; }
  function holdSession(rec) {
    try { localStorage.setItem(LS_SESSION, JSON.stringify({ id: rec.name, at: Date.now(), server: true })); } catch (_) {}
    try { localStorage.setItem('espil_username', rec.name); } catch (_) {}
    paintAuth();
  }
  function finishClaim(name) {
    nameClaimState = 'idle';
    setClaimBackVisible(false);
    try { localStorage.setItem(LS_SESSION, JSON.stringify({ id: name, at: Date.now(), server: true })); } catch (_) {}
    try { localStorage.setItem('espil_username', name); } catch (_) {}
    authMsg('Account created. Welcome, ' + name + '.', true);
    paintAuth();
    setTimeout(completeGate, 350);
  }
  function failClaim(err) {
    nameClaimState = 'failed';
    setClaimBackVisible(true);
    if (err === 'name_reserved') authMsg('That name is reserved. Enter a different name and press SIGN UP again.');
    else if (err === 'name_taken') authMsg('That name is already taken. Enter a different name and press SIGN UP again.');
    else if (err === 'invalid_name') authMsg('Names use 3 to 16 letters, numbers or underscores. Enter a different name and press SIGN UP again.');
    else authMsg('That name could not be claimed. Press SIGN UP to try again.');
  }
  function claimName(name) {
    nameClaimState = 'pending';
    authMsg('Account created. Claiming your name...', true);
    fetch(API_BASE + '/auth/name', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(function (r) {
      return r.json().then(function (b) { return { status: r.status, body: b }; });
    }).then(function (res) {
      if (res.status === 200 && res.body && res.body.user) finishClaim(res.body.user.name);
      else failClaim(res.body && res.body.error);
    }).catch(function () { failClaim(null); });
  }
  function abandonClaim() {
    if (nameClaimState !== 'failed' && nameClaimState !== 'pending') return;
    nameClaimState = 'idle';
    setClaimBackVisible(false);
    authMsg(claimDerivedName ? ('Account created. Welcome, ' + claimDerivedName + '.') : '', true);
    /* Landing: return to the login/guest selection and stay there
       (the flow is asked to hold its advance). The game-page gate
       has no earlier step, so there the gate completes with the
       derived name instead. */
    if (window.__espilLandingFlow) {
      try { if (window.__espilFlowHoldLogin) window.__espilFlowHoldLogin(); } catch (_) {}
    } else {
      setTimeout(completeGate, 350);
    }
  }
  function readCreds() {
    var idEl = $('auth-id'), pwEl = $('auth-pw');
    return { id: idEl ? idEl.value.trim() : '', pw: pwEl ? pwEl.value : '' };
  }
  /* Batch A (Han 2026-11-02 #2): guest-only entry until the server
     account system lands. The pair's form is disabled in markup;
     these guards keep the handlers inert even if a control is
     re-enabled by another module. Account code and stored accounts
     stay intact for the backend step. */
  var GUEST_ONLY = false; /* S0 activation (flip step 2): server accounts are live. */
  function doSignup() {
    if (GUEST_ONLY) { authMsg('Account sign-in is paused - entry is guest-only until the server account system lands.'); return; }
    /* Name-claim retry (Han 2026-11-10): with a failed claim and a
       live session, SIGN UP is the claim's retry - never a second
       registration. An emptied name field abandons the claim. */
    if (nameClaimState === 'failed' && session()) {
      var retryName = readName();
      if (!retryName) { abandonClaim(); return; }
      claimName(retryName);
      return;
    }
    /* S0 activation: email + password simple sign-up against the
       Worker (D3 as amended, Han 2026-11-08). The server creates
       the account and issues the session at once - no email
       verification gate. The account name is derived server-side
       from the email; claiming a specific name is POST /auth/name.
       Structure (a) (AUTH-REVIEW-2): the password is screened for
       known breaches and turned into K HERE, under a fresh random
       salt - only K, the salt and the iteration count are sent;
       the password itself never leaves this device. */
    var c = readCreds();
    var email = (c.id || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { authMsg('Enter your email address.'); return; }
    var policyError = espilPasswordPolicyError(c.pw);
    if (policyError) { authMsg(policyError); return; }
    authMsg('Creating your account...');
    espilPasswordBreached(c.pw).then(function (breached) {
      if (breached) { authMsg('That password appears in known data breaches. Please choose a different one.'); return; }
      var salt = espilB64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
      return espilDeriveKey(c.pw, salt, ESPIL_PBKDF2_ITERATIONS).then(function (key) {
        return fetch(API_BASE + '/auth/email/register', {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email, key: key, salt: salt, iterations: ESPIL_PBKDF2_ITERATIONS, channel: 'web' })
        });
      }).then(function (r) {
        return r.json().then(function (b) { return { status: r.status, body: b }; });
      }).then(function (res) {
        if (res.status === 200 && res.body && res.body.user) {
          claimDerivedName = res.body.user.name;
          var wantName = readName();
          if (wantName) {
            /* Session first (derived name), then the name claim;
               the gate completes only when the claim resolves. */
            holdSession({ name: res.body.user.name });
            claimName(wantName);
          } else {
            startSession({ name: res.body.user.name }, 'Account created. Welcome, ' + res.body.user.name + '.');
          }
        } else if (res.body && res.body.error === 'email_taken') {
          authMsg('That email is already registered. Sign in instead.');
        } else if (res.status === 429) {
          authMsg('Too many attempts. Please wait a little and try again.');
        } else {
          authMsg('Sign-up failed. Please try again.');
        }
      });
    }).catch(function () { authMsg('Sign-up failed. Please try again.'); });
  }
  function doSignin() {
    if (GUEST_ONLY) { authMsg('Account sign-in is paused - entry is guest-only until the server account system lands.'); return; }
    /* A fresh sign-in supersedes any failed name claim. */
    if (nameClaimState !== 'idle') { nameClaimState = 'idle'; setClaimBackVisible(false); }
    /* S0 activation: email + password sign-in against the Worker.
       The server answers one generic error for unknown email and
       wrong password alike. Structure (a) (AUTH-REVIEW-2): fetch
       the account's salt first (an unknown email gets an
       indistinguishable fake salt), derive K locally with the
       returned salt + iterations, and send only K. */
    var c = readCreds();
    var email = (c.id || '').trim().toLowerCase();
    if (!email || !c.pw) { authMsg('Enter your ID and password.'); return; }
    /* Restructure (Han 2026-11-11): the Login step's ID field also
       accepts the account NAME. Name resolution lives behind the
       Worker's /auth/name/salt + /auth/name/login pair - prepared
       in espil-api but NOT yet deployed; until that deploy lands
       the salt call answers 404 and the form says so honestly
       instead of faking a flow. */
    if (email.indexOf('@') < 0) { doSigninByName(email, c.pw); return; }
    authMsg('Signing in...');
    fetch(API_BASE + '/auth/email/salt?email=' + encodeURIComponent(email), { credentials: 'include' }).then(function (r) {
      return r.json();
    }).then(function (s) {
      if (!s || !s.salt) throw new Error('salt');
      return espilDeriveKey(c.pw, s.salt, s.iterations || ESPIL_PBKDF2_ITERATIONS);
    }).then(function (key) {
      return fetch(API_BASE + '/auth/email/login', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, key: key, channel: 'web' })
      });
    }).then(function (r) {
      return r.json().then(function (b) { return { status: r.status, body: b }; });
    }).then(function (res) {
      if (res.status === 200 && res.body && res.body.user) {
        startSession({ name: res.body.user.name }, 'Welcome back, ' + res.body.user.name + '.');
      } else if (res.status === 401) {
        authMsg('Email or password is incorrect.');
      } else if (res.status === 429) {
        authMsg('Too many attempts. Please wait a little and try again.');
      } else {
        authMsg('Sign-in failed. Please try again.');
      }
    }).catch(function () { authMsg('Sign-in failed. Please try again.'); });
  }
  function doSigninByName(name, pw) {
    authMsg('Signing in...');
    var saltStatus = 0;
    fetch(API_BASE + '/auth/name/salt?name=' + encodeURIComponent(name), { credentials: 'include' }).then(function (r) {
      saltStatus = r.status;
      return r.json();
    }).then(function (s) {
      if (saltStatus === 404) {
        authMsg('Name sign-in arrives with the next server update - please sign in with your email for now.');
        throw new Error('name-login-not-deployed');
      }
      if (!s || !s.salt) throw new Error('salt');
      return espilDeriveKey(pw, s.salt, s.iterations || ESPIL_PBKDF2_ITERATIONS);
    }).then(function (key) {
      if (!key) return null;
      return fetch(API_BASE + '/auth/name/login', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name, key: key, channel: 'web' })
      });
    }).then(function (r) {
      if (!r) return;
      return r.json().then(function (b) { return { status: r.status, body: b }; });
    }).then(function (res) {
      if (!res) return;
      if (res.status === 200 && res.body && res.body.user) {
        startSession({ name: res.body.user.name }, 'Welcome back, ' + res.body.user.name + '.');
      } else if (res.status === 401) {
        authMsg('Name or password is incorrect.');
      } else if (res.status === 429) {
        authMsg('Too many attempts. Please wait a little and try again.');
      } else {
        authMsg('Sign-in failed. Please try again.');
      }
    }).catch(function (e) {
      if (e && e.message === 'name-login-not-deployed') return;
      authMsg('Sign-in failed. Please try again.');
    });
  }
  function wireAuth() {
    var su = $('auth-signup'), si = $('auth-signin'), pw = $('auth-pw');
    if (su && !su.__espilWired) { su.__espilWired = true; su.addEventListener('click', doSignup); }
    if (si && !si.__espilWired) { si.__espilWired = true; si.addEventListener('click', doSignin); }
    if (pw && !pw.__espilWired) {
      pw.__espilWired = true;
      pw.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doSignin(); } });
      pw.addEventListener('keyup', function (e) { e.stopPropagation(); });
    }
    var idEl = $('auth-id');
    if (idEl && !idEl.__espilWired) {
      idEl.__espilWired = true;
      idEl.addEventListener('keydown', function (e) { e.stopPropagation(); });
      idEl.addEventListener('keyup', function (e) { e.stopPropagation(); });
    }
    var nmEl = $('auth-name');
    if (nmEl && !nmEl.__espilWired) {
      nmEl.__espilWired = true;
      nmEl.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doSignup(); } });
      nmEl.addEventListener('keyup', function (e) { e.stopPropagation(); });
    }
    var abEl = $('auth-back');
    if (abEl && !abEl.__espilWired) {
      abEl.__espilWired = true;
      abEl.addEventListener('click', abandonClaim);
    }
    var lo = $('set-logout');
    if (lo && !lo.__espilWired) {
      lo.__espilWired = true;
      lo.addEventListener('click', function () {
        var s = session();
        if (!s) { toast('Sign in first - the sign-in window is on the landing page.'); return; }
        /* S0 activation: logout revokes the session SERVER-side
           (the Worker sets sessions.revoked_at), not just locally. */
        try { fetch(API_BASE + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {}); } catch (_) {}
        try { localStorage.removeItem(LS_SESSION); } catch (_) {}
        nameClaimState = 'idle'; setClaimBackVisible(false);
        paintAuth(); toast('Signed out, ' + s.id + '.');
      });
    }
    paintAuth();
  }
  window.__espilAuthState = function () {
    var s = session();
    /* S0 activation: signedIn reflects the server-written session
       record; the device-local account count is no longer an
       authority and is no longer reported. */
    return { signedIn: !!(s && s.server), id: s && s.server ? s.id : null, accounts: s && s.server ? 1 : 0, nameClaim: nameClaimState };
  };

  /* ---------------- state for rigs ------------------------------ */
  window.__espilSocialState = function () {
    return {
      friends: loadFriends().map(function (f) { return f.name; }),
      party: party ? { id: party.id, members: party.members.map(function (m) { return m.name; }) } : null,
      pendingInvite: pendingInvite ? pendingInvite.name : null,
      ctxOpen: !!(ctxEl && ctxEl.style.display === 'block'),
      panelOpen: (function () { var p = panelEl(); return !!(p && p.getAttribute('aria-hidden') === 'false'); })(),
      auth: window.__espilAuthState()
    };
  };
  window.__espilSocialTogglePanel = togglePanel;
  window.__espilSocialPick = pickCharacter;

  function init() { ensureDom(); wireAuth(); serverSessionSync(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setInterval(wireAuth, 2000);
})();
/* __espilSocial module end */

