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

  var winEl = null, listEl = null, noteEl = null, compEl = null, inputEl = null, saleEl = null, cityEl = null;
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
      '<div class="epw-market">마켓은 준비 중입니다.<br>센터 마켓이 열리면 이곳에서 모든 도시의 좌판을 보고 그 자리에서 구매할 수 있습니다.</div>' +
      '</div>' +
      '<div class="epw-pane" id="ep-pane-cash"></div>' +
      '</div>';
    document.body.appendChild(winEl);
    listEl = winEl.querySelector('#ep-feed-list');
    compEl = winEl.querySelector('#ep-feed-comp');
    cityEl = winEl.querySelector('#ep-feed-city');
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

  /* ---------------- open / close ---------------- */
  function open(tab) {
    ensureDom();
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
        signedIn: signedIn()
      };
    }
  };
})();
