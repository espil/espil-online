/* __espilPortal v1 - the COMMUNITY COMMUNICATION PORTAL
   (espil.online room, 2026-11-20). Han directives 2026-11-19 +
   2026-11-20 (amendment A): the cash shop button no longer floats
   over the map; the portal is entered from the character window
   (panels.js #eg-portal), and this window wraps the communication
   center: three FIXED tabs - the city feed, the market (center,
   lands in a later phase; an honest placeholder until then), and
   the cash shelf, which HOSTS the existing cash shop window
   (#espil-cash-window) unchanged. The cash shop does not
   disappear; it lives in the fixed cash tab (Profit boundary,
   settled 2026-11-19). Design: comm-portal/DESIGN.md + amendment A.

   Form: a lazy module in the cashshop arrival family (loaded by
   modules/lazyload.js at the in-map arrival seam). Self-contained
   DOM in the cash shop palette. Place-space child windows never
   load it (the lazyload allowlists), and the module bolts itself
   shut if it is ever pulled into one anyway.

   Feed rules (design 4.2/4.3, drafts standing): the feed is the
   CURRENT city room's board. Posts live in the CityRoom's memory
   only (ring buffer, last 50, 24 h) and are replayed at join;
   NOTHING is stored server-side. Reading is open to everyone in
   the room, guests included; writing is signed-in only - the
   Worker refuses guest frames and stamps the author's confirmed
   name, so this module only mirrors that gate in the UI. Text
   cap 300 (the chat cap). A post may carry a sale flag; when the
   author's stall is up in the same room, the post links to the
   stall board (__espilStallView) - the trade itself settles
   through the existing stall paths, never inside the feed.

   Public interface:
     window.__espilPortal = {
       open(tab?), close(), state()
     }
   open() with no tab restores the last viewed tab (a light
   device-local value, espil_portal_tab) or the feed. Callers
   whose intent is the shop (the book portal page, the arena rest
   action, the customizer lock panel) pass 'cash' and land on the
   cash tab; the character window's center button passes 'feed'.

   Phase 2 (2026-11-24, Han "구축해"): the market tab is real.
   It reads the global snapshot (GET /market/listings, the
   MarketRegistry mirror of every live stall in every city),
   filters by the listing-standard categories, and buys IN the
   center: the buy frame rides the presence relay with
   via "center" (the Worker routes it across rooms), settlement
   itself stays in stall2.js exactly as at a stall - same Leo
   movement, no fee, buyer charged only on the seller's ok.
   Center trades are counted separately (trade_center beacon,
   comm-center DESIGN §6); the tab also fires center_view on
   open and listing_click on a row expand. Browsing is open to
   everyone (the snapshot is public); buying inherits the stall
   population rule - anyone joined to a city room, guests and
   name entrants included, with device-local Leo.

   Module sources are TAGLESS (house rule) - no script tags here. */
(function () {
  'use strict';
  if (window.__espilPortal) return; /* once per page */

  /* Place-space bolt: a child window (store or arena) never gets
     a working portal - presence is off or arena-scoped there, so
     neither the feed nor the market can exist. A stub interface
     keeps any stray caller harmless. */
  var placeMark = null;
  try { placeMark = JSON.parse(sessionStorage.getItem('espil_store_space_v1') || 'null'); } catch (e) {}
  if (placeMark) {
    window.__espilPortal = {
      open: function () {}, close: function () {},
      state: function () { return { child: true, open: false }; }
    };
    return;
  }

  var LS_TAB = 'espil_portal_tab';
  var FEED_KEEP = 50;
  var FEED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  var winEl = null, listEl = null, noteEl = null, compEl = null, inputEl = null, saleEl = null, cityEl = null, mktRoot = null;
  var curTab = 'feed';
  var posts = [];           /* newest first; this tab's memory only */
  var seenIds = {};
  var cashHosted = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function chatState() { try { return window.__espilChatState ? window.__espilChatState() : null; } catch (e) { return null; } }
  function signedIn() { try { return !!localStorage.getItem('espil_session_v1'); } catch (e) { return false; } }
  function roomKey() { var st = chatState(); return st && st.room ? String(st.room) : ''; }
  function cityLabel() {
    var r = roomKey();
    if (!r) return '';
    return r.charAt(0).toUpperCase() + r.slice(1);
  }
  function hhmm(ts) {
    var d = new Date(ts || 0);
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* ---------------- DOM ---------------- */
  function ensureDom() {
    if (winEl) return;
    var st = document.createElement('style');
    st.id = 'espil-portal-style';
    st.textContent =
      '#espil-portal-window{position:fixed;inset:0;z-index:9990;display:none;align-items:center;justify-content:center;background:rgba(10,6,4,.55)}' +
      '#espil-portal-window.open{display:flex}' +
      '.epw-card{background:linear-gradient(180deg,#3a2a1c,#241a10);border:2px solid #8a6a44;border-radius:14px;' +
      'width:min(680px,94vw);height:min(76vh,720px);max-height:88vh;display:flex;flex-direction:column;padding:18px 20px;color:#f2e3c2;font-family:sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
      '.epw-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}' +
      '.epw-title{font-size:21px;font-weight:800;color:#ffe9bd}' +
      '.epw-close{border:1px solid #8a6a44;background:#57402a;color:#ffe9bd;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700}' +
      '.epw-tabs{display:flex;gap:8px;border-bottom:1px solid #57402a;padding-bottom:10px;margin-bottom:10px}' +
      '.epw-tab{border:1px solid #6d5836;background:#2e2114;color:#d8c49a;border-radius:999px;padding:7px 16px;cursor:pointer;font-weight:700;font-size:13.5px}' +
      '.epw-tab.on{border-color:#c9a227;background:#6d5836;color:#ffe9bd}' +
      '.epw-pane{display:none;flex:1;min-height:0;overflow-y:auto}' +
      '.epw-pane.on{display:block}' +
      '.epw-city{font-size:15px;font-weight:800;color:#ffd76a;margin-bottom:8px}' +
      '.epf-post{border:1px solid #57402a;border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.22);margin-bottom:8px}' +
      '.epf-meta{font-size:11.5px;color:#b8a888;margin-bottom:3px}' +
      '.epf-meta b{color:#ffe9bd;font-size:12.5px}' +
      '.epf-text{font-size:13.5px;line-height:1.5;color:#f2e3c2;word-break:break-word;white-space:pre-wrap}' +
      '.epf-stall{margin-top:6px;border:1px solid #c9a227;background:#6d5836;color:#ffe9bd;border-radius:8px;padding:4px 11px;cursor:pointer;font-weight:700;font-size:12px}' +
      '.epf-empty{font-size:13.5px;color:#b8a888;line-height:1.6;padding:14px 2px}' +
      '.epw-comp{border-top:1px solid #57402a;padding-top:10px;margin-top:2px}' +
      '.epw-comp textarea{width:100%;box-sizing:border-box;min-height:52px;resize:vertical;border:1px solid #6d5836;border-radius:10px;' +
      'background:rgba(0,0,0,.3);color:#fff4cf;font:600 13.5px sans-serif;padding:9px 11px}' +
      '.epw-comp-row{display:flex;align-items:center;gap:10px;margin-top:8px}' +
      '.epw-post-btn{border:1px solid #c9a227;background:#6d5836;color:#ffe9bd;border-radius:8px;padding:7px 18px;cursor:pointer;font-weight:800}' +
      '.epw-sale{font-size:12.5px;color:#d8c49a;display:flex;align-items:center;gap:5px;cursor:pointer}' +
      '.epw-note{font-size:12.5px;color:#b8a888;line-height:1.55}' +
      '.epw-market{font-size:14px;color:#d8c49a;line-height:1.65;padding:16px 4px}' +
      '.epm-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}' +
      '.epm-chip{border:1px solid #6d5836;background:#2e2114;color:#d8c49a;border-radius:999px;padding:6px 14px;cursor:pointer;font-weight:700;font-size:13px;min-height:48px}' +
      '.epm-chip.on{border-color:#c9a227;background:#6d5836;color:#ffe9bd}' +
      '.epm-row2{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}' +
      '.epm-sel{border:1px solid #6d5836;background:#2e2114;color:#ffe9bd;border-radius:8px;padding:6px 8px;font-size:13px;font-weight:700;min-height:48px}' +
      '.epm-q{flex:1;min-width:120px;border:1px solid #6d5836;border-radius:8px;background:rgba(0,0,0,.3);color:#fff4cf;font:600 13px sans-serif;padding:6px 10px;min-height:48px;box-sizing:border-box}' +
      '.epm-leo{font-size:12.5px;color:#ffd76a;font-weight:700;margin-left:auto}' +
      '.epm-status{font-size:13px;color:#b8a888;line-height:1.6;padding:10px 2px}' +
      '.epm-note{font-size:12.5px;color:#ffd76a;line-height:1.55;margin-bottom:8px}' +
      '.epm-row{border:1px solid #57402a;border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.22);margin-bottom:8px;cursor:pointer}' +
      '.epm-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px}' +
      '.epm-badge{padding:1px 7px;border-radius:99px;font-size:10px;font-weight:800;color:#fff;background:rgba(90,110,140,.6)}' +
      '.epm-badge.sell{background:rgba(255,150,60,.55)}' +
      '.epm-badge.buy{background:rgba(90,140,255,.55)}' +
      '.epm-badge.svc{background:rgba(150,110,255,.55)}' +
      '.epm-badge.cat{background:rgba(201,162,39,.45);color:#ffe9bd}' +
      '.epm-badge.mine{background:rgba(70,160,90,.55)}' +
      '.epm-title{font-size:14px;font-weight:700;color:#f2e3c2}' +
      '.epm-meta{font-size:12px;color:#b8a888;margin-top:2px}' +
      '.epm-price{font-size:12.5px;color:#ffe9a8;margin-top:2px}' +
      '.epm-detail{margin-top:8px;border-top:1px solid #57402a;padding-top:8px}' +
      '.epm-pnote{font-size:12.5px;color:#d8c49a;line-height:1.55;white-space:pre-wrap;word-break:break-word}' +
      '.epm-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}' +
      '.epm-btn{border:1px solid #c9a227;background:#6d5836;color:#ffe9bd;border-radius:8px;padding:7px 16px;cursor:pointer;font-weight:800;font-size:13.5px;min-height:48px}' +
      '.epm-btn.sub{border-color:#6d5836;background:#2e2114;color:#d8c49a}' +
      '.epm-btn[disabled]{opacity:.45;cursor:default}' +
      '#espil-cash-window.ep-hosted{position:static!important;inset:auto!important;width:100%!important;height:100%!important;background:none!important;z-index:auto!important}' +
      '#espil-cash-window.ep-hosted.open{display:block!important}' +
      '.ep-hosted .ecw-card{width:100%!important;max-width:none!important;height:100%;max-height:none!important;overflow-y:auto}' +
      '.ep-hosted .ecw-close{display:none!important}';
    document.head.appendChild(st);

    winEl = document.createElement('div');
    winEl.id = 'espil-portal-window';
    winEl.setAttribute('aria-hidden', 'true');
    winEl.innerHTML =
      '<div class="epw-card" role="dialog" aria-label="커뮤니티 센터">' +
      '<div class="epw-head"><div class="epw-title">커뮤니티 센터</div>' +
      '<button class="epw-close" id="espil-portal-close" type="button">닫기</button></div>' +
      '<div class="epw-tabs">' +
      '<button class="epw-tab" data-ep-tab="feed" type="button">피드</button>' +
      '<button class="epw-tab" data-ep-tab="market" type="button">마켓</button>' +
      '<button class="epw-tab" data-ep-tab="cash" type="button">캐시 상점</button>' +
      '</div>' +
      '<div class="epw-pane" id="ep-pane-feed">' +
      '<div class="epw-city" id="ep-feed-city"></div>' +
      '<div id="ep-feed-list"></div>' +
      '<div class="epw-comp" id="ep-feed-comp"></div>' +
      '</div>' +
      '<div class="epw-pane" id="ep-pane-market">' +
      '<div id="ep-market-root"></div>' +
      '</div>' +
      '<div class="epw-pane" id="ep-pane-cash"></div>' +
      '</div>';
    document.body.appendChild(winEl);
    listEl = winEl.querySelector('#ep-feed-list');
    compEl = winEl.querySelector('#ep-feed-comp');
    cityEl = winEl.querySelector('#ep-feed-city');
    mktRoot = winEl.querySelector('#ep-market-root');
    winEl.querySelector('#espil-portal-close').addEventListener('click', function () { close(); });
    winEl.addEventListener('click', function (e) { if (e.target === winEl) close(); });
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-tab]'), function (b) {
      b.addEventListener('click', function () { selectTab(b.getAttribute('data-ep-tab')); });
    });
    /* While the cash window is hosted in the cash pane, its own
       backdrop-click close must not fire: the pane is an ancestor,
       so this capture listener sees a click aimed at the hosted
       window's own backdrop area first and stops it here. The
       shop's card clicks pass through untouched. */
    winEl.querySelector('#ep-pane-cash').addEventListener('click', function (e) {
      if (cashHosted && e.target && e.target.id === 'espil-cash-window') {
        e.stopPropagation(); e.preventDefault();
      }
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && winEl && winEl.classList.contains('open')) close();
    });
    renderComposer();
  }

  /* ---------------- tabs ---------------- */
  function selectTab(tab) {
    if (tab !== 'feed' && tab !== 'market' && tab !== 'cash') tab = 'feed';
    if (tab !== 'cash' && cashHosted) unhostCash();
    curTab = tab;
    try { localStorage.setItem(LS_TAB, tab); } catch (e) {}
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-tab]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-ep-tab') === tab);
    });
    ['feed', 'market', 'cash'].forEach(function (t) {
      var p = winEl.querySelector('#ep-pane-' + t);
      if (p) p.classList.toggle('on', t === tab);
    });
    if (tab === 'feed') renderFeed();
    if (tab === 'market') enterMarket(); else stopMarketTimer();
    if (tab === 'cash') hostCash();
  }

  /* ---------------- cash tab hosting ----------------
     The cash window keeps its own DOM, ledger and open()/close();
     hosting only moves the node into the pane and restyles it
     (the book's espil-booked pattern, scoped to this module).
     open() runs first so the ledger re-read the arena guard
     relies on happens exactly as a standalone open. */
  function hostCash() {
    var pane = winEl.querySelector('#ep-pane-cash');
    if (window.__espilCash && window.__espilCash.open) {
      window.__espilCash.open();
      var n = document.getElementById('espil-cash-window');
      if (n && n.parentNode !== pane) {
        pane.appendChild(n);
        n.classList.add('ep-hosted');
        cashHosted = true;
      }
      return;
    }
    /* The cash shop rides the arrival bundle; if it has not
       landed yet on this page, pull it in directly (the lock
       panel's established fallback pattern). */
    pane.innerHTML = '<div class="epw-note" style="padding:14px 2px">캐시 상점을 불러오는 중입니다...</div>';
    var s = document.createElement('script');
    s.src = 'modules/cashshop.js';
    s.onload = function () { if (curTab === 'cash' && winEl.classList.contains('open')) hostCash(); };
    document.head.appendChild(s);
  }
  function unhostCash() {
    var n = document.getElementById('espil-cash-window');
    if (n) {
      n.classList.remove('ep-hosted');
      if (n.parentNode !== document.body) document.body.appendChild(n);
    }
    cashHosted = false;
    if (window.__espilCash && window.__espilCash.close) window.__espilCash.close();
  }

  /* ---------------- feed ---------------- */
  function prunePosts() {
    var now = Date.now();
    posts = posts.filter(function (p) { return p && (now - (p.ts || 0)) <= FEED_MAX_AGE_MS; });
    if (posts.length > FEED_KEEP) posts = posts.slice(0, FEED_KEEP);
    seenIds = {};
    posts.forEach(function (p) { if (p.id) seenIds[p.id] = 1; });
  }
  function stallFor(sid) {
    var st = chatState();
    if (!st || !st.users) return null;
    for (var i = 0; i < st.users.length; i++) {
      if (st.users[i].id === sid) return st.users[i].stall || null;
    }
    return null;
  }
  function renderFeed() {
    if (!listEl) return;
    var st = chatState();
    var label = cityLabel();
    cityEl.textContent = label ? (label + ' 피드') : '피드';
    prunePosts();
    if (!st || !st.joined) {
      listEl.innerHTML = '<div class="epf-empty">도시에 접속하면 피드가 열립니다.</div>';
      return;
    }
    if (!posts.length) {
      listEl.innerHTML = '<div class="epf-empty">아직 글이 없습니다. 첫 글을 남겨 보십시오.</div>';
      return;
    }
    listEl.innerHTML = '';
    posts.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'epf-post';
      var stallBtn = '';
      if (p.sale && p.sid && stallFor(p.sid) && window.__espilStallView) {
        stallBtn = '<button class="epf-stall" type="button" data-ep-stall="' + esc(p.sid) + '">좌판 보기</button>';
      }
      d.innerHTML =
        '<div class="epf-meta"><b>' + esc(p.authorName || 'Guest') + '</b> · ' + hhmm(p.ts) + (p.sale ? ' · 판매 글' : '') + '</div>' +
        '<div class="epf-text">' + esc(p.text || '') + '</div>' + stallBtn;
      listEl.appendChild(d);
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-ep-stall]'), function (b) {
      b.addEventListener('click', function () {
        var sid = b.getAttribute('data-ep-stall');
        close();
        if (window.__espilStallView) window.__espilStallView(sid);
      });
    });
  }
  function renderComposer() {
    if (!compEl) return;
    if (!signedIn()) {
      compEl.innerHTML = '<div class="epw-note">글을 쓰려면 로그인이 필요합니다. 읽기는 누구나 할 수 있습니다.</div>';
      inputEl = null; saleEl = null;
      return;
    }
    compEl.innerHTML =
      '<textarea id="ep-feed-input" maxlength="300" placeholder="이 도시에 글 남기기 (300자)"></textarea>' +
      '<div class="epw-comp-row">' +
      '<button class="epw-post-btn" id="ep-feed-send" type="button">게시</button>' +
      '<label class="epw-sale"><input type="checkbox" id="ep-feed-sale"> 판매 글</label>' +
      '<span class="epw-note" id="ep-feed-note"></span>' +
      '</div>';
    inputEl = compEl.querySelector('#ep-feed-input');
    saleEl = compEl.querySelector('#ep-feed-sale');
    noteEl = compEl.querySelector('#ep-feed-note');
    compEl.querySelector('#ep-feed-send').addEventListener('click', sendPost);
    inputEl.addEventListener('keydown', function (e) { e.stopPropagation(); });
    inputEl.addEventListener('keyup', function (e) { e.stopPropagation(); });
  }
  function sendPost() {
    if (!inputEl) return;
    var text = (inputEl.value || '').trim().slice(0, 300);
    if (!text) return;
    var ok = false;
    try { ok = !!(window.__espilSocialSend && window.__espilSocialSend({ t: 'feed_post', text: text, sale: !!(saleEl && saleEl.checked) })); } catch (e) {}
    if (!ok) {
      if (noteEl) noteEl.textContent = '아직 도시에 연결되지 않았습니다.';
      return;
    }
    /* no local echo: the room broadcasts the post back to
       everyone including the author (the chat pattern), and the
       espil-feed-recv branch below renders it once. */
    inputEl.value = '';
    if (saleEl) saleEl.checked = false;
    if (noteEl) noteEl.textContent = '';
  }
  window.addEventListener('espil-feed-recv', function (e) {
    var m = e && e.detail;
    if (!m) return;
    if (m.t === 'feed_replay' && Array.isArray(m.posts)) {
      posts = m.posts.slice();
      prunePosts();
    } else if (m.t === 'feed' && m.post) {
      if (m.post.id && seenIds[m.post.id]) return;
      posts.unshift(m.post);
      prunePosts();
    } else { return; }
    if (winEl && winEl.classList.contains('open') && curTab === 'feed') renderFeed();
  });
  window.addEventListener('espil-arrival', function () {
    /* a new city means a new room board */
    posts = []; seenIds = {};
    if (winEl && winEl.classList.contains('open') && curTab === 'feed') renderFeed();
  });

  /* ---------------- market (phase 2) ----------------
     One row per POST across every live stall in every city (the
     design's row rule). Filters are client-side over the whole
     snapshot so they answer instantly; the snapshot refetches on
     tab entry, on a 20 s cadence while the tab is open, and after
     a trade settles. The buy itself is one presence frame -
     settlement (Leo movement, item grant, counts) stays in
     stall2.js, this tab only asks and watches for the answer. */
  var MKT_CATS = [
    ['all', '전체'], ['service', '서비스'], ['food', '음식'], ['furniture', '가구'],
    ['clothing', '의류'], ['equipment', '장비'], ['books', '책'], ['consumables', '소모품'],
    ['materials', '재료'], ['misc', '기타']
  ];
  var MKT_CAT_LABEL = {};
  MKT_CATS.forEach(function (c) { MKT_CAT_LABEL[c[0]] = c[1]; });
  var mkt = {
    rows: null, fetchedAt: 0, loading: false, error: false,
    cat: 'all', side: 'all', city: 'all', q: '', sort: 'new',
    expanded: null, confirmKey: null, pending: null, notice: '', timer: null
  };
  function apiBase() { return window.__espilAuthApiBase || 'https://api.espil.online'; }
  function centerBeacon(event) {
    try {
      var body = JSON.stringify({ event: event });
      var url = apiBase() + '/center/event';
      var sent = false;
      if (navigator.sendBeacon) { try { sent = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' })); } catch (e) {} }
      if (!sent) { fetch(url, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, keepalive: true }).catch(function () {}); }
    } catch (e) {}
  }
  function leoBalance() { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); return isNaN(v) ? 1000 : v; }
  function cityName(key) { return key ? (key.charAt(0).toUpperCase() + key.slice(1)) : ''; }
  function tsLabel(ts) {
    if (!ts) return '';
    var d = new Date(ts), now = new Date();
    var hm = hhmm(ts);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return hm;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }
  function mySid() { var st = chatState(); return st && st.myId ? String(st.myId) : ''; }
  function isMine(row) { return !!row.sid && row.sid === mySid() && row.city === roomKey(); }
  function inMyRoom(row) {
    if (!row.sid || row.city !== roomKey()) return false;
    var st = chatState();
    if (!st || !st.users) return false;
    for (var i = 0; i < st.users.length; i++) if (st.users[i].id === row.sid) return true;
    return false;
  }
  function fetchListings() {
    if (mkt.loading) return;
    mkt.loading = true;
    fetch(apiBase() + '/market/listings')
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (snap) {
        var rows = [];
        ((snap && snap.listings) || []).forEach(function (e) {
          (e.posts || []).forEach(function (p) {
            rows.push({
              key: String(e.sid || '') + '|' + String(p.id || ''),
              sid: e.sid || '', sellerName: e.sellerName || '', stallName: e.stallName || e.name || '',
              city: e.city || '', post: p
            });
          });
        });
        mkt.rows = rows;
        mkt.fetchedAt = (snap && snap.ts) || Date.now();
        mkt.error = false;
        mkt.loading = false;
        if (mkt.expanded && !rows.some(function (r) { return r.key === mkt.expanded; })) mkt.expanded = null;
        renderMarket();
      })
      .catch(function () {
        mkt.error = true;
        mkt.loading = false;
        renderMarket();
      });
  }
  function mktCities() {
    var seen = {}, out = [];
    (mkt.rows || []).forEach(function (r) { if (r.city && !seen[r.city]) { seen[r.city] = 1; out.push(r.city); } });
    return out.sort();
  }
  function mktFiltered() {
    var q = mkt.q.trim().toLowerCase();
    var rows = (mkt.rows || []).filter(function (r) {
      var p = r.post;
      if (mkt.cat !== 'all' && p.cat !== mkt.cat) return false;
      if (mkt.side !== 'all' && p.side !== mkt.side) return false;
      if (mkt.city !== 'all' && r.city !== mkt.city) return false;
      if (q) {
        var hay = (String(p.title || '') + ' ' + r.sellerName + ' ' + r.stallName).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    rows.sort(function (a, b) {
      if (mkt.sort === 'low') return (a.post.price || 0) - (b.post.price || 0);
      if (mkt.sort === 'high') return (b.post.price || 0) - (a.post.price || 0);
      return (b.post.ts || 0) - (a.post.ts || 0);
    });
    return rows;
  }
  function renderMarket() {
    if (!mktRoot) return;
    var chips = MKT_CATS.map(function (c) {
      return '<button class="epm-chip' + (mkt.cat === c[0] ? ' on' : '') + '" type="button" data-epm-cat="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
    var cityOpts = '<option value="all">모든 도시</option>' + mktCities().map(function (c) {
      return '<option value="' + esc(c) + '"' + (mkt.city === c ? ' selected' : '') + '>' + esc(cityName(c)) + '</option>';
    }).join('');
    var head =
      '<div class="epm-tools">' + chips + '</div>' +
      '<div class="epm-row2">' +
      '<select class="epm-sel" id="epm-city">' + cityOpts + '</select>' +
      '<select class="epm-sel" id="epm-side">' +
      '<option value="all"' + (mkt.side === 'all' ? ' selected' : '') + '>전체</option>' +
      '<option value="sell"' + (mkt.side === 'sell' ? ' selected' : '') + '>판매</option>' +
      '<option value="buy"' + (mkt.side === 'buy' ? ' selected' : '') + '>매입</option>' +
      '</select>' +
      '<select class="epm-sel" id="epm-sort">' +
      '<option value="new"' + (mkt.sort === 'new' ? ' selected' : '') + '>최신순</option>' +
      '<option value="low"' + (mkt.sort === 'low' ? ' selected' : '') + '>가격 낮은순</option>' +
      '<option value="high"' + (mkt.sort === 'high' ? ' selected' : '') + '>가격 높은순</option>' +
      '</select>' +
      '<input class="epm-q" id="epm-q" type="text" placeholder="제목 · 판매자 검색" value="' + esc(mkt.q) + '">' +
      '<span class="epm-leo">내 Leo ' + leoBalance() + '</span>' +
      '</div>' +
      (mkt.notice ? '<div class="epm-note">' + esc(mkt.notice) + '</div>' : '');
    var body = '';
    if (mkt.rows === null && mkt.loading) {
      body = '<div class="epm-status">목록을 불러오는 중입니다...</div>';
    } else if (mkt.rows === null && mkt.error) {
      body = '<div class="epm-status">목록을 불러오지 못했습니다.<br><button class="epm-btn sub" type="button" id="epm-retry">다시 시도</button></div>';
    } else if (!mkt.rows || !mkt.rows.length) {
      body = '<div class="epm-status">지금 올라온 좌판이 없습니다. 좌판을 연 판매자가 접속하면 이곳에 나타납니다.</div>';
    } else {
      var rows = mktFiltered();
      if (!rows.length) {
        body = '<div class="epm-status">이 조건에 맞는 게시가 없습니다.</div>';
      } else {
        body = rows.map(function (r) { return mktRowHtml(r); }).join('');
      }
      if (mkt.error) body = '<div class="epm-note">새 목록을 불러오지 못해 이전 목록을 보여 드립니다.</div>' + body;
    }
    mktRoot.innerHTML = head + body;
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-cat]'), function (b) {
      b.addEventListener('click', function () { mkt.cat = b.getAttribute('data-epm-cat'); renderMarket(); });
    });
    var citySel = mktRoot.querySelector('#epm-city');
    if (citySel) citySel.addEventListener('change', function () { mkt.city = citySel.value; renderMarket(); });
    var sideSel = mktRoot.querySelector('#epm-side');
    if (sideSel) sideSel.addEventListener('change', function () { mkt.side = sideSel.value; renderMarket(); });
    var sortSel = mktRoot.querySelector('#epm-sort');
    if (sortSel) sortSel.addEventListener('change', function () { mkt.sort = sortSel.value; renderMarket(); });
    var qEl = mktRoot.querySelector('#epm-q');
    if (qEl) {
      qEl.addEventListener('input', function () {
        mkt.q = qEl.value;
        var pos = qEl.selectionStart;
        renderMarket();
        var nq = mktRoot.querySelector('#epm-q');
        if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} }
      });
      qEl.addEventListener('keydown', function (e) { e.stopPropagation(); });
      qEl.addEventListener('keyup', function (e) { e.stopPropagation(); });
    }
    var retry = mktRoot.querySelector('#epm-retry');
    if (retry) retry.addEventListener('click', function () { fetchListings(); });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-row]'), function (el) {
      el.addEventListener('click', function (e) {
        if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
        var key = el.getAttribute('data-epm-row');
        if (mkt.expanded === key) { mkt.expanded = null; }
        else { mkt.expanded = key; mkt.confirmKey = null; centerBeacon('listing_click'); }
        renderMarket();
      });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-buy]'), function (b) {
      b.addEventListener('click', function () { mkt.confirmKey = b.getAttribute('data-epm-buy'); mkt.notice = ''; renderMarket(); });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-cancel]'), function (b) {
      b.addEventListener('click', function () { mkt.confirmKey = null; renderMarket(); });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-confirm]'), function (b) {
      b.addEventListener('click', function () { doBuy(b.getAttribute('data-epm-confirm')); });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-visit]'), function (b) {
      b.addEventListener('click', function () {
        var sid = b.getAttribute('data-epm-visit');
        close();
        if (window.__espilStallView) window.__espilStallView(sid);
      });
    });
  }
  function mktRowHtml(r) {
    var p = r.post;
    var svc = p.kind === 'service';
    var mine = isMine(r);
    var badges =
      '<span class="epm-badge ' + (p.side === 'buy' ? 'buy' : 'sell') + '">' + (p.side === 'buy' ? '매입' : '판매') + '</span>' +
      (svc ? '<span class="epm-badge svc">서비스 · TESTING</span>' : '') +
      '<span class="epm-badge cat">' + esc(MKT_CAT_LABEL[p.cat] || '기타') + '</span>' +
      (mine ? '<span class="epm-badge mine">내 게시</span>' : '');
    var priceLine = (p.price > 0 ? esc(p.price) + ' Leo' : '가격 협의') + ' · ' + (p.count || 1) + '개 남음';
    var meta = esc(r.sellerName || 'Guest') + (r.stallName ? ' · ' + esc(r.stallName) : '') + ' · ' + esc(cityName(r.city)) + (p.ts ? ' · ' + tsLabel(p.ts) : '');
    var html =
      '<div class="epm-row" data-epm-row="' + esc(r.key) + '">' +
      '<div class="epm-badges">' + badges + '</div>' +
      '<div class="epm-title">' + esc(p.title) + '</div>' +
      '<div class="epm-price">' + priceLine + '</div>' +
      '<div class="epm-meta">' + meta + '</div>';
    if (mkt.expanded === r.key) html += mktDetailHtml(r);
    html += '</div>';
    return html;
  }
  function mktDetailHtml(r) {
    var p = r.post;
    var st = chatState();
    var joined = !!(st && st.joined);
    var pending = mkt.pending && mkt.pending.key === r.key;
    var canBuy = p.side === 'sell' && p.price > 0 && !isMine(r);
    var acts = '';
    if (pending) {
      acts = '<span class="epw-note">구매를 요청했습니다. 판매자의 응답을 기다리는 중입니다...</span>';
    } else if (mkt.confirmKey === r.key) {
      acts =
        '<span class="epw-note">' + esc(p.title) + '을(를) ' + esc(p.price) + ' Leo에 구매하시겠습니까? 수수료는 없습니다.</span>' +
        '<button class="epm-btn" type="button" data-epm-confirm="' + esc(r.key) + '">구매 확정</button>' +
        '<button class="epm-btn sub" type="button" data-epm-cancel="1">취소</button>';
    } else {
      if (canBuy) acts += '<button class="epm-btn" type="button" data-epm-buy="' + esc(r.key) + '"' + (joined ? '' : ' disabled') + '>구매하기</button>';
      if (inMyRoom(r) && window.__espilStallView) acts += '<button class="epm-btn sub" type="button" data-epm-visit="' + esc(r.sid) + '">좌판 보기</button>';
      if (p.side === 'buy') acts += '<span class="epw-note">매입 게시입니다. 판매는 좌판에서 직접 거래해 주십시오.</span>';
      else if (p.price <= 0) acts += '<span class="epw-note">가격 협의 게시입니다. 좌판에서 직접 거래해 주십시오.</span>';
      else if (isMine(r)) acts += '<span class="epw-note">내 게시입니다.</span>';
      if (canBuy && !joined) acts += '<span class="epw-note">도시에 접속하면 구매할 수 있습니다.</span>';
    }
    return '<div class="epm-detail">' +
      (p.note ? '<div class="epm-pnote">' + esc(p.note) + '</div>' : '') +
      (p.kind === 'service' ? '<div class="epm-pnote" style="opacity:.7">서비스는 구매 후 판매자와 채팅으로 전달 방식을 정합니다. (TESTING)</div>' : '') +
      '<div class="epm-actions">' + acts + '</div></div>';
  }
  function doBuy(key) {
    var row = null;
    (mkt.rows || []).forEach(function (r) { if (r.key === key) row = r; });
    if (!row || mkt.pending) return;
    var p = row.post;
    var price = parseInt(p.price, 10) || 0;
    if (leoBalance() < price) { mkt.notice = 'Leo가 부족합니다. (보유 ' + leoBalance() + ' Leo)'; mkt.confirmKey = null; renderMarket(); return; }
    var nonce = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
    var sent = false;
    try { sent = !!(window.__espilSocialSend && window.__espilSocialSend({ t: 'stall_buy', to: row.sid, postId: p.id, via: 'center', city: row.city, nonce: nonce })); } catch (e) {}
    mkt.confirmKey = null;
    if (!sent) { mkt.notice = '아직 도시에 연결되지 않아 구매할 수 없습니다.'; renderMarket(); return; }
    mkt.notice = '';
    mkt.pending = {
      key: key, nonce: nonce,
      timer: setTimeout(function () {
        if (!mkt.pending || mkt.pending.key !== key) return;
        mkt.pending = null;
        mkt.notice = '판매자의 응답이 없습니다. 목록을 새로고침합니다.';
        fetchListings();
        renderMarket();
      }, 15000)
    };
    renderMarket();
  }
  window.addEventListener('espil-party-frame', function (e) {
    var m = e && e.detail;
    if (!m || m.t !== 'stall_sold' || !mkt.pending) return;
    if (m.nonce !== mkt.pending.nonce) return;
    clearTimeout(mkt.pending.timer);
    mkt.pending = null;
    mkt.notice = m.ok ? '구매가 완료됐습니다.' : '거래를 완료할 수 없습니다. 판매가 끝났거나 판매자가 없습니다.';
    fetchListings();
    renderMarket();
  });
  function enterMarket() {
    renderMarket();
    fetchListings();
    stopMarketTimer();
    mkt.timer = setInterval(function () {
      if (winEl && winEl.classList.contains('open') && curTab === 'market') fetchListings();
      else stopMarketTimer();
    }, 20000);
  }
  function stopMarketTimer() {
    if (mkt.timer) { clearInterval(mkt.timer); mkt.timer = null; }
  }

  /* ---------------- open / close ---------------- */
  function open(tab) {
    ensureDom();
    centerBeacon('center_view');
    winEl.classList.add('open');
    winEl.setAttribute('aria-hidden', 'false');
    if (!tab) {
      try { tab = localStorage.getItem(LS_TAB) || 'feed'; } catch (e) { tab = 'feed'; }
    }
    renderComposer();
    selectTab(tab);
  }
  function close() {
    if (!winEl) return;
    stopMarketTimer();
    if (cashHosted) unhostCash();
    winEl.classList.remove('open');
    winEl.setAttribute('aria-hidden', 'true');
  }

  window.__espilPortal = {
    open: open,
    close: close,
    state: function () {
      return {
        open: !!(winEl && winEl.classList.contains('open')),
        tab: curTab,
        posts: posts.length,
        room: roomKey(),
        cashHosted: cashHosted,
        signedIn: signedIn(),
        market: {
          rows: mkt.rows ? mkt.rows.length : -1,
          fetchedAt: mkt.fetchedAt,
          cat: mkt.cat,
          pending: !!mkt.pending,
          error: mkt.error
        }
      };
    }
  };
})();
