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
   the room, guests included; writing is open to everyone joined
   to the room too (NAME-ONLY ENTRY 2026-11-24 opened the Worker
   side; GUESTS WRITE TOO, Han 2026-11-26 directive 3, removed
   this module's sign-in mirror) - the Worker stamps the author's
   join-confirmed name (a session-less join's name passed the
   join backstops), so the composer below is rendered for every
   entrant and the frame carries no name of its own. Text
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

   Widget form (2026-11-25, Han 17:27 item 2; comm-widget/
   DESIGN.md): the portal is no longer a centred modal - the
   SAME window is now a right-side DOCK the player toggles from
   a 48 px HUD button (mmo-hud.js owns the button and calls
   toggle() below). No backdrop dim: the world stays visible
   beside it and the game does not pause. There is still exactly
   one surface, one state and one buy path; the book keeps
   hosting this same node on coarse pointers. The market tab
   speaks Marketplace grammar: a left rail (search, category
   list, city list, price range - the one new filter, client-
   side only - and the sell/buy split), a square card grid, and
   a detail SHEET over the grid instead of the inline row
   expand. Card images follow the design's 3-tier rule: an
   exact panels-DB title match paints the item's real icon
   (via the __espilGear.iconLookup seam in panels.js), anything
   else gets an honest category glyph tile, and nothing else is
   ever painted - listings carry no photo and none is invented.
   The buy flow itself (confirm copy, nonce frame, 15 s wait,
   stall_sold matching, stall2 settlement, the separate
   counters, both beacons) is byte-for-byte the phase-2 flow;
   only the vessel changed. The widget closes when a dive
   starts; tab and filter state survive in-session, the open
   state is never persisted. state() also reports the mount
   (dock / book / sheet) and open()/close() broadcast an
   'espil-portal-state' window event so the HUD toggle's
   active face never forks from the real state.

   Module sources are TAGLESS (house rule) - no script tags here.

   V2 (2026-11-26, Han items 8 + 9): every string this module
   renders routes through the language tables (__espilT, cc*
   keys in language.js) - the center renders in the selected
   pack, English included, and Korean appears only under the
   Korean pack. The window is restyled to OUR MINIHOMPY form
   (the han.espil.online/minihome tokens): white frame, blue
   border, colour tabs, and a MAIN tab whose stage stands the
   player's real avatar (a compact transplant of panels.js's
   verified character-stage pattern - same selection record,
   same body routes, same grounding) over a miniroom frame.
   The main also carries the visit box: the people in this
   city from presence, each row riding the one real visit
   that exists today (their stall view, in-room, stall up -
   the feed's rule). Center-to-center visiting has no seam
   yet; see comm-center-v2/CENSUS.md section 4. The market
   data path, the buy frame, the counters and the feed's
   posting rules are untouched by this build (the composer
   renders for every entrant since the guest-posts ship -
   this build only routes its strings). */
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
      open: function () {}, close: function () {}, toggle: function () {},
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
  /* Language routing (v2): every rendered string reads the
     CURRENT pack at render time through language.js's table.
     The fallback (table absent - a load order that cannot
     occur on the production page, where language.js is a
     static script) is the key itself, never a frozen string. */
  function T(k) { try { return window.__espilT ? window.__espilT(k) : k; } catch (e) { return k; } }
  function TF(k, ph, val) { return T(k).split(ph).join(String(val == null ? '' : val)); }
  /* The name this player wears - the nameplate law's exact
     resolution (#char-name, then espil_username, then Guest),
     read from the same sources presence.myName() reads. */
  function myDisplayName() {
    try {
      var inp = document.getElementById('char-name');
      var v = inp ? String(inp.value || '').trim() : '';
      if (!v) { try { v = String(localStorage.getItem('espil_username') || '').trim(); } catch (e) { v = ''; } }
      return (v || 'Guest').slice(0, 16);
    } catch (e) { return 'Guest'; }
  }
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
      /* MINIHOMPY FORM (v2, Han directive 2 + item 8b): the
         han.espil.online/minihome tokens - white frame, blue
         border #5f87a8, line #b7c9d8, ink #33383d, soft
         #6b7683, orange #f26d21 / orange-dk #d35400, blue
         #3b6ea5, the colour tab set, dotted box heads, the
         miniroom tint #fdf6ec for the market ground. The dock
         geometry (mount, size) is the widget build's own. */
      '#espil-portal-window{position:fixed;top:174px;right:10px;width:min(920px,96vw);height:min(84vh,860px,calc(100vh - 184px));z-index:44;display:none}' +
      '#espil-portal-window.open{display:block}' +
      '.epw-card{background:#fff;border:2px solid #5f87a8;border-radius:12px;' +
      'width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:18px 22px 14px;color:#33383d;' +
      'font-family:"Malgun Gothic","Apple SD Gothic Neo",Dotum,"Manrope",sans-serif;' +
      'box-shadow:0 14px 40px rgba(23,48,74,.4)}' +
      '.epw-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px double #b7c9d8;padding-bottom:8px;margin-bottom:10px}' +
      '.epw-title{font-size:19px;font-weight:bold;color:#33383d}' +
      '.epw-title .epw-house{color:#f26d21;margin-right:6px}' +
      '.epw-close{border:1px solid #d35400;background:#f26d21;color:#fff;border-radius:4px;padding:8px 14px;cursor:pointer;font-weight:bold;min-width:48px;min-height:48px;font-size:12px}' +
      '.epw-close:hover{background:#d35400}' +
      '.epw-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}' +
      '.epw-tab{border:none;color:#fff;border-radius:6px;padding:9px 18px;cursor:pointer;font-weight:bold;font-size:13px;min-height:48px;box-shadow:2px 2px 5px rgba(23,48,74,.25)}' +
      '.epw-tab[data-ep-tab="main"]{background:#f26d21}' +
      '.epw-tab[data-ep-tab="feed"]{background:#5b8c5a}' +
      '.epw-tab[data-ep-tab="market"]{background:#3b6ea5}' +
      '.epw-tab[data-ep-tab="cash"]{background:#7a5ba6}' +
      '.epw-tab.on{filter:brightness(1.13);box-shadow:3px 3px 8px rgba(23,48,74,.4);outline:2px solid rgba(51,56,61,.35)}' +
      '.epw-pane{display:none;flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#8fb0cc #e8eff5}' +
      '.epw-pane.on{display:block}' +
      '#ep-pane-feed>*{max-width:640px;margin-left:auto;margin-right:auto}' +
      '#ep-pane-market{position:relative;overflow:hidden}' +
      '#ep-market-root{height:100%}' +
      '.epw-city{font-size:14px;font-weight:bold;color:#d35400;border-bottom:2px solid #f26d21;padding-bottom:4px;margin-bottom:10px}' +
      '.epf-post{border:1px solid #b7c9d8;border-radius:6px;background:#fff;margin-bottom:12px;overflow:hidden}' +
      '.epf-meta{font-size:11.5px;color:#6b7683;background:#fdf6ee;border-bottom:1px dotted #b7c9d8;padding:7px 12px}' +
      '.epf-meta b{color:#3b6ea5;font-size:12.5px}' +
      '.epf-text{font-size:13.5px;line-height:1.55;color:#33383d;word-break:break-word;white-space:pre-wrap;padding:9px 12px 2px}' +
      '.epf-stall{margin:8px 12px 10px;border:1px solid #d35400;background:#f26d21;color:#fff;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:12px;min-height:48px}' +
      '.epf-empty{font-size:13.5px;color:#6b7683;line-height:1.6;padding:14px 2px}' +
      '.epw-comp{border-top:3px double #b7c9d8;padding-top:10px;margin-top:2px}' +
      '.epw-comp textarea{width:100%;box-sizing:border-box;min-height:52px;resize:vertical;border:1px solid #b7c9d8;border-radius:4px;' +
      'background:#fff;color:#33383d;font:600 13.5px "Malgun Gothic",sans-serif;padding:9px 11px}' +
      '.epw-comp-row{display:flex;align-items:center;gap:10px;margin-top:8px}' +
      '.epw-post-btn{border:1px solid #d35400;background:#f26d21;color:#fff;border-radius:4px;padding:8px 18px;cursor:pointer;font-weight:bold;min-height:48px}' +
      '.epw-sale{font-size:12.5px;color:#33383d;display:flex;align-items:center;gap:5px;cursor:pointer}' +
      '.epw-note{font-size:12.5px;color:#6b7683;line-height:1.55}' +
      '.epw-market{font-size:14px;color:#33383d;line-height:1.65;padding:16px 4px}' +
      /* main tab: the minihome columns - rail + main, the
         avatar window over a miniroom frame */
      '.eph-cols{display:flex;gap:0}' +
      '.eph-rail{width:208px;flex:none;padding-right:14px;border-right:1px dotted #b7c9d8}' +
      '.eph-main{flex:1;padding-left:16px;min-width:0}' +
      '.eph-box{border:1px solid #b7c9d8;border-radius:6px;padding:9px 10px;margin-bottom:12px;background:#fff}' +
      '.eph-box h4{font-size:11px;color:#d35400;border-bottom:1px dotted #b7c9d8;padding-bottom:4px;margin-bottom:7px;letter-spacing:.4px}' +
      '.eph-name{font-size:16px;font-weight:bold;color:#33383d;margin-bottom:4px;word-break:break-word}' +
      '.eph-line{font-size:12px;color:#6b7683;padding:2.5px 0;border-bottom:1px dotted #e3ebf2}' +
      '.eph-line:last-child{border-bottom:none}' +
      '.eph-links{display:flex;flex-direction:column;gap:6px}' +
      '.eph-link{border:none;color:#fff;border-radius:6px;padding:9px 12px;cursor:pointer;font-weight:bold;font-size:13px;min-height:48px;text-align:left}' +
      '.eph-link[data-ep-goto="feed"]{background:#5b8c5a}' +
      '.eph-link[data-ep-goto="market"]{background:#3b6ea5}' +
      '.eph-link[data-ep-goto="cash"]{background:#7a5ba6}' +
      '.eph-avatarwin{border:1px solid #b7c9d8;border-radius:6px;padding:6px;background:#fdfdf8;margin-bottom:14px}' +
      '.eph-stage{position:relative;height:190px;border:1px solid #d8e2ec;overflow:hidden;background:linear-gradient(180deg,#dfeaf3 0%,#dfeaf3 60%,#efdfba 60.2%,#e2c892 100%)}' +
      '.eph-stage canvas{display:block;width:100%;height:100%}' +
      '.eph-nametag{position:absolute;left:12px;bottom:10px;background:rgba(255,255,255,.88);border:1px solid #b7c9d8;border-radius:3px;padding:1px 7px;font-weight:bold;color:#33383d;font-size:12px;z-index:3}' +
      '.eph-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;font-size:12px;color:#6b7683;z-index:2}' +
      '.eph-openbar{display:flex;justify-content:space-between;align-items:center;padding-top:6px;font-size:11px;gap:8px}' +
      '.eph-openbar .lbl{color:#d35400;font-weight:bold}' +
      '.eph-openbar .city{color:#6b7683;white-space:nowrap}' +
      '.eph-visit-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 2px;border-bottom:1px dotted #b7c9d8}' +
      '.eph-visit-row:last-child{border-bottom:none}' +
      '.eph-visit-name{font-weight:bold;color:#3b6ea5;font-size:12.5px;word-break:break-word}' +
      '.eph-visit-btn{border:1px solid #d35400;background:#f26d21;color:#fff;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:12px;min-height:48px;flex:none}' +
      '.eph-visit-none{color:#6b7683;font-size:11.5px}' +
      /* market: the miniroom ground carries the tab */
      '.epm-wrap{display:flex;gap:14px;height:100%;background:#fdf6ec;border:1px solid #e8d3ae;border-radius:6px;padding:10px;box-sizing:border-box}' +
      '.epm-rail{width:220px;flex:none;overflow-y:auto;padding:10px 12px;background:#fff;border:1px solid #b7c9d8;border-radius:6px}' +
      '.epm-rail-h{font-size:11px;font-weight:bold;color:#d35400;letter-spacing:.4px;border-bottom:1px dotted #b7c9d8;padding-bottom:4px;margin:14px 0 7px}' +
      '.epm-rail-h:first-child{margin-top:0}' +
      '.epm-cats{display:flex;flex-direction:column;gap:5px}' +
      '.epm-catbtn{border:1px solid #b7c9d8;background:#fff;color:#33383d;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:bold;font-size:13px;min-height:48px;text-align:left}' +
      '.epm-catbtn.on{border-color:#3b6ea5;background:#3b6ea5;color:#fff}' +
      '.epm-cities{display:flex;flex-direction:column;gap:5px;max-height:264px;overflow-y:auto}' +
      '.epm-sides{display:flex;gap:5px}' +
      '.epm-sides .epm-catbtn{flex:1;text-align:center;padding:6px 4px}' +
      '.epm-prices{display:flex;gap:6px;align-items:center}' +
      '.epm-prices span{color:#6b7683;font-size:13px}' +
      '.epm-pin{flex:1;min-width:0;border:1px solid #b7c9d8;border-radius:4px;background:#fff;color:#33383d;font:600 13px "Malgun Gothic",sans-serif;padding:6px 8px;min-height:48px;box-sizing:border-box}' +
      '.epm-main{flex:1;min-width:0;min-height:0;overflow-y:auto;padding-right:2px}' +
      '.epm-mainhead{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}' +
      '.epm-sel{border:1px solid #b7c9d8;background:#fff;color:#33383d;border-radius:4px;padding:6px 8px;font-size:13px;font-weight:bold;min-height:48px}' +
      '.epm-q{width:100%;border:1px solid #b7c9d8;border-radius:4px;background:#fff;color:#33383d;font:600 13px "Malgun Gothic",sans-serif;padding:6px 10px;min-height:48px;box-sizing:border-box}' +
      '.epm-leo{font-size:12.5px;color:#d35400;font-weight:bold;margin-left:auto}' +
      '.epm-status{font-size:13px;color:#6b7683;line-height:1.6;padding:10px 2px}' +
      '.epm-note{font-size:12.5px;color:#d35400;line-height:1.55;margin-bottom:8px}' +
      '.epm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}' +
      '.epm-card{border:1px solid #b7c9d8;border-radius:6px;background:#fff;overflow:hidden;cursor:pointer;display:flex;flex-direction:column}' +
      '.epm-card:active{filter:brightness(1.06)}' +
      '.epm-img{position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:#fdfdf8}' +
      '.epm-img svg{width:64%;height:64%}' +
      '.epm-glyph{font-size:64px;line-height:1}' +
      '.epm-img .epm-badges{position:absolute;top:6px;left:6px;margin-bottom:0}' +
      '.epm-adslot{height:0;overflow:hidden}' +
      '.epm-card .epm-price{font-size:19px;font-weight:800;color:#d35400;margin:8px 10px 0}' +
      '.epm-card .epm-title{font-size:13.5px;font-weight:bold;color:#33383d;margin:3px 10px 0;line-height:1.35;min-height:2.7em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.epm-card .epm-meta{font-size:11.5px;color:#6b7683;margin:3px 10px 0}' +
      '.epm-card .epm-seller{font-size:11.5px;color:#3b6ea5;margin:2px 10px 10px}' +
      '.epm-sheet{position:absolute;inset:0;z-index:5;background:#fff;overflow-y:auto;padding:14px 16px}' +
      '.epm-back{border:1px solid #d35400;background:#f26d21;color:#fff;border-radius:4px;padding:8px 16px;cursor:pointer;font-weight:bold;font-size:13.5px;min-width:48px;min-height:48px;margin-bottom:12px}' +
      '.epm-sheet .epm-img{width:min(300px,80vw);border-radius:6px;border:1px solid #b7c9d8;margin-bottom:12px}' +
      '.epm-sheet .epm-glyph{font-size:110px}' +
      '.epm-sheet .epm-price{font-size:24px;font-weight:800;color:#d35400}' +
      '.epm-sheet .epm-title{font-size:17px;font-weight:bold;color:#33383d;margin-top:4px}' +
      '.epm-sheet .epm-meta{font-size:12.5px;color:#6b7683;margin-top:5px;line-height:1.65}' +
      '@media (max-width:820px){' +
      '.epm-wrap{flex-direction:column;overflow-y:auto}' +
      '.epm-rail{width:auto;flex:none;overflow:visible;padding-right:12px}' +
      '.epm-cats{flex-direction:row;flex-wrap:wrap}' +
      '.epm-cities{flex-direction:row;flex-wrap:wrap;max-height:none;overflow:visible}' +
      '.epm-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}' +
      '.eph-cols{flex-direction:column}' +
      '.eph-rail{width:auto;border-right:none;padding-right:0}' +
      '.eph-main{padding-left:0}' +
      '}' +
      '.epm-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px}' +
      '.epm-badge{padding:1px 7px;border-radius:99px;font-size:10px;font-weight:800;color:#fff;background:#8a97a5}' +
      '.epm-badge.sell{background:#f26d21}' +
      '.epm-badge.buy{background:#3b6ea5}' +
      '.epm-badge.svc{background:#7a5ba6}' +
      '.epm-badge.cat{background:#fdf1e7;color:#d35400;border:1px solid #e8d3ae}' +
      '.epm-badge.mine{background:#5b8c5a}' +
      '.epm-detail{margin-top:10px;border-top:1px dotted #b7c9d8;padding-top:10px}' +
      '.epm-pnote{font-size:12.5px;color:#454c53;line-height:1.55;white-space:pre-wrap;word-break:break-word}' +
      '.epm-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}' +
      '.epm-btn{border:1px solid #d35400;background:#f26d21;color:#fff;border-radius:4px;padding:8px 16px;cursor:pointer;font-weight:bold;font-size:13.5px;min-height:48px}' +
      '.epm-btn.sub{border-color:#3b6ea5;background:#fff;color:#3b6ea5}' +
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
      '<div class="epw-card" role="dialog" id="ep-card">' +
      '<div class="epw-head"><div class="epw-title"><span class="epw-house">\u2302</span><span id="ep-title"></span></div>' +
      '<button class="epw-close" id="espil-portal-close" type="button"></button></div>' +
      '<div class="epw-tabs">' +
      '<button class="epw-tab" data-ep-tab="main" type="button"></button>' +
      '<button class="epw-tab" data-ep-tab="feed" type="button"></button>' +
      '<button class="epw-tab" data-ep-tab="market" type="button"></button>' +
      '<button class="epw-tab" data-ep-tab="cash" type="button"></button>' +
      '</div>' +
      '<div class="epw-pane" id="ep-pane-main">' +
      '<div class="eph-cols">' +
      '<div class="eph-rail">' +
      '<div class="eph-box"><div class="eph-name" id="ep-main-name"></div><div id="ep-main-info"></div></div>' +
      '<div class="eph-box"><h4 id="ep-main-quickh"></h4><div class="eph-links">' +
      '<button class="eph-link" data-ep-goto="feed" type="button"></button>' +
      '<button class="eph-link" data-ep-goto="market" type="button"></button>' +
      '<button class="eph-link" data-ep-goto="cash" type="button"></button>' +
      '</div></div>' +
      '</div>' +
      '<div class="eph-main">' +
      '<div class="eph-avatarwin"><div class="eph-stage" id="ep-main-stage">' +
      '<div class="eph-msg" id="ep-main-msg" style="display:none"></div>' +
      '<div class="eph-nametag" id="ep-main-nametag"></div>' +
      '</div>' +
      '<div class="eph-openbar"><span class="lbl" id="ep-main-bodylabel"></span><span class="city" id="ep-main-cityline"></span></div>' +
      '</div>' +
      '<div class="eph-box"><h4 id="ep-main-visith"></h4><div id="ep-main-visit"></div></div>' +
      '</div>' +
      '</div>' +
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
    /* No backdrop click-to-close: the dock has no backdrop. The
       window box IS the card now, so a click landing on winEl
       itself is a click on the card's own padding, not on a dim. */
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-tab]'), function (b) {
      b.addEventListener('click', function () { selectTab(b.getAttribute('data-ep-tab')); });
    });
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-goto]'), function (b) {
      b.addEventListener('click', function () { selectTab(b.getAttribute('data-ep-goto')); });
    });
    renderChrome();
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

  /* The static chrome (title, close, tab + quick-link labels,
     box heads) is re-read from the language table whenever it
     is (re)painted - on build, on open, and on a language
     switch - so no pack is ever frozen into the DOM. */
  function renderChrome() {
    if (!winEl) return;
    var card = winEl.querySelector('#ep-card');
    if (card) card.setAttribute('aria-label', T('ccTitle'));
    var tt = winEl.querySelector('#ep-title');
    if (tt) tt.textContent = T('ccTitle');
    var cl = winEl.querySelector('#espil-portal-close');
    if (cl) cl.textContent = T('ccClose');
    var tabKeys = { main: 'ccTabMain', feed: 'ccTabFeed', market: 'ccTabMarket', cash: 'ccTabCash' };
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-tab]'), function (b) {
      var k = tabKeys[b.getAttribute('data-ep-tab')];
      if (k) b.textContent = T(k);
    });
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-goto]'), function (b) {
      var k = tabKeys[b.getAttribute('data-ep-goto')];
      if (k) b.textContent = T(k);
    });
    var qh = winEl.querySelector('#ep-main-quickh');
    if (qh) qh.textContent = T('ccQuickGo');
    var vh = winEl.querySelector('#ep-main-visith');
    if (vh) vh.textContent = T('ccVisitTitle');
  }

  /* ---------------- tabs ---------------- */
  function selectTab(tab) {
    if (tab !== 'main' && tab !== 'feed' && tab !== 'market' && tab !== 'cash') tab = 'feed';
    if (tab !== 'cash' && cashHosted) unhostCash();
    curTab = tab;
    try { localStorage.setItem(LS_TAB, tab); } catch (e) {}
    Array.prototype.forEach.call(winEl.querySelectorAll('[data-ep-tab]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-ep-tab') === tab);
    });
    ['main', 'feed', 'market', 'cash'].forEach(function (t) {
      var p = winEl.querySelector('#ep-pane-' + t);
      if (p) p.classList.toggle('on', t === tab);
    });
    if (tab === 'main') renderMain(); else ccsSetOpen(false);
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
    pane.innerHTML = '<div class="epw-note" style="padding:14px 2px">' + esc(T('ccCashLoading')) + '</div>';
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
    cityEl.textContent = label ? TF('ccFeedOf', '{city}', label) : T('ccTabFeed');
    prunePosts();
    if (!st || !st.joined) {
      listEl.innerHTML = '<div class="epf-empty">' + esc(T('ccFeedJoinFirst')) + '</div>';
      return;
    }
    if (!posts.length) {
      listEl.innerHTML = '<div class="epf-empty">' + esc(T('ccFeedEmpty')) + '</div>';
      return;
    }
    listEl.innerHTML = '';
    posts.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'epf-post';
      var stallBtn = '';
      if (p.sale && p.sid && stallFor(p.sid) && window.__espilStallView) {
        stallBtn = '<button class="epf-stall" type="button" data-ep-stall="' + esc(p.sid) + '">' + esc(T('ccViewStall')) + '</button>';
      }
      d.innerHTML =
        '<div class="epf-meta"><b>' + esc(p.authorName || 'Guest') + '</b> · ' + hhmm(p.ts) + (p.sale ? ' · ' + esc(T('ccSalePost')) : '') + '</div>' +
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
    /* GUESTS WRITE TOO (Han 2026-11-26 directive 3): the
       composer renders for every entrant, signed-in or not. The
       old sign-in mirror is gone - the Worker has accepted
       session-less feed_post frames since NAME-ONLY ENTRY
       (2026-11-24) and stamps the join-confirmed name itself,
       so a guest's post carries the guest's own room name
       exactly like an account post. signedIn() survives only
       as a state() report (below); it gates nothing here. */
    compEl.innerHTML =
      '<textarea id="ep-feed-input" maxlength="300" placeholder="' + esc(T('ccFeedPh')) + '"></textarea>' +
      '<div class="epw-comp-row">' +
      '<button class="epw-post-btn" id="ep-feed-send" type="button">' + esc(T('ccPost')) + '</button>' +
      '<label class="epw-sale"><input type="checkbox" id="ep-feed-sale"> ' + esc(T('ccSalePost')) + '</label>' +
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
      if (noteEl) noteEl.textContent = T('ccNotJoined');
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
    /* The widget closes on a dive (comm-widget DESIGN section
       3): the feed is bound to the old city and the market must
       take a fresh snapshot in the new one. Tab and filter
       state stay; only the open state ends. This listener is
       registered when the module lands - the arrival bundle is
       what loads it - so the entry dive itself never trips it. */
    if (winEl && winEl.classList.contains('open')) close();
  });
  window.addEventListener('espil-dive-start', function () {
    if (winEl && winEl.classList.contains('open')) close();
  });

  /* ---------------- market (phase 2) ----------------
     One row per POST across every live stall in every city (the
     design's row rule). Filters are client-side over the whole
     snapshot so they answer instantly; the snapshot refetches on
     tab entry, on a 20 s cadence while the tab is open, and after
     a trade settles. The buy itself is one presence frame -
     settlement (Leo movement, item grant, counts) stays in
     stall2.js, this tab only asks and watches for the answer. */
  var MKT_CAT_KEYS = ['all', 'service', 'food', 'furniture', 'clothing',
    'equipment', 'books', 'consumables', 'materials', 'misc'];
  var MKT_CAT_T = {
    all: 'ccAll', service: 'ccCatService', food: 'ccCatFood',
    furniture: 'ccCatFurniture', clothing: 'ccCatClothing',
    equipment: 'ccCatEquipment', books: 'ccCatBooks',
    consumables: 'ccCatConsumables', materials: 'ccCatMaterials',
    misc: 'ccCatMisc'
  };
  function catLabel(k) { return T(MKT_CAT_T[k] || 'ccCatMisc'); }
  /* The market notice is stored as a language KEY (+ an
     optional {n} fill), never as a baked string, so a pack
     switch after the fact still renders it in the live pack. */
  function noticeText() {
    var n = mkt.notice;
    if (!n) return '';
    if (typeof n === 'string') return n;
    var s = T(n.k);
    if (n.n != null) s = s.split('{n}').join(String(n.n));
    return s;
  }
  var mkt = {
    rows: null, fetchedAt: 0, loading: false, error: false,
    cat: 'all', side: 'all', city: 'all', q: '', sort: 'new',
    minP: '', maxP: '',
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
      /* Price range (the widget's one new filter, comm-widget
         DESIGN section 6): client-side over the fetched
         snapshot; the listings protocol is untouched. A
         negotiated post (price 0) is not a number, so a
         minimum drops it and a maximum keeps it. */
      var mn = parseFloat(mkt.minP), mx = parseFloat(mkt.maxP);
      if (!isNaN(mn) && !(p.price >= mn)) return false;
      if (!isNaN(mx) && !(p.price <= mx)) return false;
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
  /* Card images (comm-widget DESIGN section 5, the 3-tier
     rule): tier 1 is an exact DB title match painted by
     panels.js's own icon painter through the __espilGear
     seam; tier 2 is an honest category glyph tile; there is
     no tier 3 - no seller faces, no title guesses, no photos
     (listings carry none and none is invented). */
  var MKT_GLYPH = {
    service: '🛠️', food: '🍙', furniture: '🪑', clothing: '👕',
    equipment: '⚔️', books: '📚', consumables: '🧪',
    materials: '🧱', misc: '📦'
  };
  function mktImageHtml(r, sheet) {
    var p = r.post;
    var badges =
      '<div class="epm-badges">' +
      '<span class="epm-badge ' + (p.side === 'buy' ? 'buy' : 'sell') + '">' + esc(p.side === 'buy' ? T('ccBadgeBuy') : T('ccBadgeSell')) + '</span>' +
      (p.kind === 'service' ? '<span class="epm-badge svc">' + esc(T('ccBadgeSvc')) + '</span>' : '') +
      '<span class="epm-badge cat">' + esc(catLabel(p.cat)) + '</span>' +
      (isMine(r) ? '<span class="epm-badge mine">' + esc(T('ccBadgeMine')) + '</span>' : '') +
      '</div>';
    var look = null;
    try { look = (p.kind === 'item' && window.__espilGear && window.__espilGear.iconLookup) ? window.__espilGear.iconLookup(p.title) : null; } catch (e) { look = null; }
    var inner;
    if (look && look.svg) {
      inner = '<div class="epm-img" data-epm-img="icon" style="background:linear-gradient(135deg,' + esc(look.c1 || '#57402a') + ',' + esc(look.c2 || '#2e2114') + ')">' + look.svg + badges + '</div>';
    } else {
      var glyph = p.kind === 'service' ? MKT_GLYPH.service : (MKT_GLYPH[p.cat] || MKT_GLYPH.misc);
      inner = '<div class="epm-img" data-epm-img="glyph"><span class="epm-glyph">' + glyph + '</span>' + badges + '</div>';
    }
    /* The labelled sponsor slot the design reserves under the
       card image (section 5): present in the grammar at zero
       height today; promoted listings are a Profit decision
       that has not been made, so nothing is ever put in it. */
    return inner + (sheet ? '' : '<div class="epm-adslot" aria-hidden="true"></div>');
  }
  function mktCardHtml(r) {
    var p = r.post;
    var priceLine = (p.price > 0 ? esc(p.price) + ' Leo' : esc(T('ccNegotiable')));
    var meta = esc(cityName(r.city)) + (r.stallName ? ' · ' + esc(r.stallName) : '');
    var seller = esc(r.sellerName || 'Guest') + ' · ' + esc(TF('ccLeft', '{n}', p.count || 1)) + (p.ts ? ' · ' + tsLabel(p.ts) : '');
    return '<div class="epm-card" data-epm-row="' + esc(r.key) + '" role="button" tabindex="0">' +
      mktImageHtml(r, false) +
      '<div class="epm-price">' + priceLine + '</div>' +
      '<div class="epm-title">' + esc(p.title) + '</div>' +
      '<div class="epm-meta">' + meta + '</div>' +
      '<div class="epm-seller">' + seller + '</div>' +
      '</div>';
  }
  function mktSheetHtml(r) {
    var p = r.post;
    var priceLine = (p.price > 0 ? esc(p.price) + ' Leo' : esc(T('ccNegotiable'))) + ' · ' + esc(TF('ccLeft', '{n}', p.count || 1));
    var meta = esc(cityName(r.city)) + (r.stallName ? ' · ' + esc(r.stallName) : '') +
      '<br>' + esc(r.sellerName || 'Guest') + (p.ts ? ' · ' + tsLabel(p.ts) : '');
    return '<div class="epm-sheet">' +
      '<button class="epm-back" type="button" data-epm-back="1">' + esc(T('ccBackToList')) + '</button>' +
      mktImageHtml(r, true) +
      '<div class="epm-price">' + priceLine + '</div>' +
      '<div class="epm-title">' + esc(p.title) + '</div>' +
      '<div class="epm-meta">' + meta + '</div>' +
      mktDetailHtml(r) +
      '</div>';
  }
  function renderMarket() {
    if (!mktRoot) return;
    var catBtns = MKT_CAT_KEYS.map(function (c) {
      return '<button class="epm-catbtn' + (mkt.cat === c ? ' on' : '') + '" type="button" data-epm-cat="' + c + '">' + esc(catLabel(c)) + '</button>';
    }).join('');
    var cityBtns = ['all'].concat(mktCities()).map(function (c) {
      return '<button class="epm-catbtn' + (mkt.city === c ? ' on' : '') + '" type="button" data-epm-city="' + esc(c) + '">' + (c === 'all' ? esc(T('ccAllCities')) : esc(cityName(c))) + '</button>';
    }).join('');
    var rail =
      '<div class="epm-rail">' +
      '<input class="epm-q" id="epm-q" type="text" placeholder="' + esc(T('ccSearchPh')) + '" value="' + esc(mkt.q) + '">' +
      '<div class="epm-rail-h">' + esc(T('ccRailCategory')) + '</div>' +
      '<div class="epm-cats">' + catBtns + '</div>' +
      '<div class="epm-rail-h">' + esc(T('ccRailCity')) + '</div>' +
      '<div class="epm-cities">' + cityBtns + '</div>' +
      '<div class="epm-rail-h">' + esc(T('ccRailPrice')) + '</div>' +
      '<div class="epm-prices">' +
      '<input class="epm-pin" id="epm-minp" type="number" min="0" inputmode="numeric" placeholder="' + esc(T('ccPriceMin')) + '" value="' + esc(mkt.minP) + '"><span>~</span>' +
      '<input class="epm-pin" id="epm-maxp" type="number" min="0" inputmode="numeric" placeholder="' + esc(T('ccPriceMax')) + '" value="' + esc(mkt.maxP) + '">' +
      '</div>' +
      '<div class="epm-rail-h">' + esc(T('ccRailSide')) + '</div>' +
      '<div class="epm-sides">' +
      '<button class="epm-catbtn' + (mkt.side === 'all' ? ' on' : '') + '" type="button" data-epm-side="all">' + esc(T('ccAll')) + '</button>' +
      '<button class="epm-catbtn' + (mkt.side === 'sell' ? ' on' : '') + '" type="button" data-epm-side="sell">' + esc(T('ccBadgeSell')) + '</button>' +
      '<button class="epm-catbtn' + (mkt.side === 'buy' ? ' on' : '') + '" type="button" data-epm-side="buy">' + esc(T('ccBadgeBuy')) + '</button>' +
      '</div>' +
      '</div>';
    var mainHead =
      '<div class="epm-mainhead">' +
      '<select class="epm-sel" id="epm-sort">' +
      '<option value="new"' + (mkt.sort === 'new' ? ' selected' : '') + '>' + esc(T('ccSortNew')) + '</option>' +
      '<option value="low"' + (mkt.sort === 'low' ? ' selected' : '') + '>' + esc(T('ccSortLow')) + '</option>' +
      '<option value="high"' + (mkt.sort === 'high' ? ' selected' : '') + '>' + esc(T('ccSortHigh')) + '</option>' +
      '</select>' +
      '<span class="epm-leo">' + esc(TF('ccMyLeo', '{n}', leoBalance())) + '</span>' +
      '</div>' +
      (mkt.notice ? '<div class="epm-note">' + esc(noticeText()) + '</div>' : '');
    var body = '';
    if (mkt.rows === null && mkt.loading) {
      body = '<div class="epm-status">' + esc(T('ccMktLoading')) + '</div>';
    } else if (mkt.rows === null && mkt.error) {
      body = '<div class="epm-status">' + esc(T('ccMktLoadFail')) + '<br><button class="epm-btn sub" type="button" id="epm-retry">' + esc(T('ccRetry')) + '</button></div>';
    } else if (!mkt.rows || !mkt.rows.length) {
      body = '<div class="epm-status">' + esc(T('ccMktEmpty')) + '</div>';
    } else {
      var rows = mktFiltered();
      if (!rows.length) {
        body = '<div class="epm-status">' + esc(T('ccMktNoMatch')) + '</div>';
      } else {
        body = '<div class="epm-grid">' + rows.map(function (r) { return mktCardHtml(r); }).join('') + '</div>';
      }
      if (mkt.error) body = '<div class="epm-note">' + esc(T('ccMktStale')) + '</div>' + body;
    }
    var sheetHtml = '';
    if (mkt.expanded) {
      var er = null;
      (mkt.rows || []).forEach(function (r) { if (r.key === mkt.expanded) er = r; });
      if (er) sheetHtml = mktSheetHtml(er);
    }
    mktRoot.innerHTML = '<div class="epm-wrap">' + rail + '<div class="epm-main">' + mainHead + body + '</div></div>' + sheetHtml;
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-cat]'), function (b) {
      b.addEventListener('click', function () { mkt.cat = b.getAttribute('data-epm-cat'); renderMarket(); });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-city]'), function (b) {
      b.addEventListener('click', function () { mkt.city = b.getAttribute('data-epm-city'); renderMarket(); });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-side]'), function (b) {
      b.addEventListener('click', function () { mkt.side = b.getAttribute('data-epm-side'); renderMarket(); });
    });
    var sortSel = mktRoot.querySelector('#epm-sort');
    if (sortSel) sortSel.addEventListener('change', function () { mkt.sort = sortSel.value; renderMarket(); });
    function bindText(id, get, set) {
      var el = mktRoot.querySelector(id);
      if (!el) return;
      el.addEventListener('input', function () {
        set(el.value);
        var pos = null;
        try { pos = el.selectionStart; } catch (e) {}
        renderMarket();
        var n = mktRoot.querySelector(id);
        if (n) { n.focus(); if (pos !== null) { try { n.setSelectionRange(pos, pos); } catch (e) {} } }
      });
      el.addEventListener('keydown', function (e) { e.stopPropagation(); });
      el.addEventListener('keyup', function (e) { e.stopPropagation(); });
    }
    bindText('#epm-q', function () { return mkt.q; }, function (v) { mkt.q = v; });
    bindText('#epm-minp', function () { return mkt.minP; }, function (v) { mkt.minP = v; });
    bindText('#epm-maxp', function () { return mkt.maxP; }, function (v) { mkt.maxP = v; });
    var retry = mktRoot.querySelector('#epm-retry');
    if (retry) retry.addEventListener('click', function () { fetchListings(); });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-row]'), function (el) {
      function openSheet() {
        var key = el.getAttribute('data-epm-row');
        if (mkt.expanded === key) return; /* the sheet is already this card; a card never toggles shut */
        mkt.expanded = key; mkt.confirmKey = null; centerBeacon('listing_click');
        renderMarket();
      }
      el.addEventListener('click', function (e) {
        if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
        openSheet();
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); }
      });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-back]'), function (b) {
      b.addEventListener('click', function () { mkt.expanded = null; mkt.confirmKey = null; renderMarket(); });
    });
    Array.prototype.forEach.call(mktRoot.querySelectorAll('[data-epm-buy]'), function (b) {
      b.addEventListener('click', function () { mkt.confirmKey = b.getAttribute('data-epm-buy'); mkt.notice = null; renderMarket(); });
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
  function mktDetailHtml(r) {
    var p = r.post;
    var st = chatState();
    var joined = !!(st && st.joined);
    var pending = mkt.pending && mkt.pending.key === r.key;
    var canBuy = p.side === 'sell' && p.price > 0 && !isMine(r);
    var acts = '';
    if (pending) {
      acts = '<span class="epw-note">' + esc(T('ccBuyPending')) + '</span>';
    } else if (mkt.confirmKey === r.key) {
      acts =
        '<span class="epw-note">' + esc(TF('ccBuyConfirmQ', '{title}', p.title).split('{price}').join(String(p.price))) + '</span>' +
        '<button class="epm-btn" type="button" data-epm-confirm="' + esc(r.key) + '">' + esc(T('ccBuyConfirm')) + '</button>' +
        '<button class="epm-btn sub" type="button" data-epm-cancel="1">' + esc(T('ccCancel')) + '</button>';
    } else {
      if (canBuy) acts += '<button class="epm-btn" type="button" data-epm-buy="' + esc(r.key) + '"' + (joined ? '' : ' disabled') + '>' + esc(T('ccBuyNow')) + '</button>';
      if (inMyRoom(r) && window.__espilStallView) acts += '<button class="epm-btn sub" type="button" data-epm-visit="' + esc(r.sid) + '">' + esc(T('ccViewStall')) + '</button>';
      if (p.side === 'buy') acts += '<span class="epw-note">' + esc(T('ccBuyPostNote')) + '</span>';
      else if (p.price <= 0) acts += '<span class="epw-note">' + esc(T('ccNegotPostNote')) + '</span>';
      else if (isMine(r)) acts += '<span class="epw-note">' + esc(T('ccMineNote')) + '</span>';
      if (canBuy && !joined) acts += '<span class="epw-note">' + esc(T('ccJoinToBuy')) + '</span>';
    }
    return '<div class="epm-detail">' +
      (p.note ? '<div class="epm-pnote">' + esc(p.note) + '</div>' : '') +
      (p.kind === 'service' ? '<div class="epm-pnote" style="opacity:.7">' + esc(T('ccSvcNote')) + '</div>' : '') +
      '<div class="epm-actions">' + acts + '</div></div>';
  }
  function doBuy(key) {
    var row = null;
    (mkt.rows || []).forEach(function (r) { if (r.key === key) row = r; });
    if (!row || mkt.pending) return;
    var p = row.post;
    var price = parseInt(p.price, 10) || 0;
    if (leoBalance() < price) { mkt.notice = { k: 'ccLeoShort', n: leoBalance() }; mkt.confirmKey = null; renderMarket(); return; }
    var nonce = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
    var sent = false;
    try { sent = !!(window.__espilSocialSend && window.__espilSocialSend({ t: 'stall_buy', to: row.sid, postId: p.id, via: 'center', city: row.city, nonce: nonce })); } catch (e) {}
    mkt.confirmKey = null;
    if (!sent) { mkt.notice = { k: 'ccNotJoinedBuy' }; renderMarket(); return; }
    mkt.notice = null;
    mkt.pending = {
      key: key, nonce: nonce,
      timer: setTimeout(function () {
        if (!mkt.pending || mkt.pending.key !== key) return;
        mkt.pending = null;
        mkt.notice = { k: 'ccSellerNoAnswer' };
        /* the sheet closes with the settle so the notice is
           what the buyer sees (the buy itself is untouched) */
        if (mkt.expanded === key) mkt.expanded = null;
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
    var settledKey = mkt.pending.key;
    mkt.pending = null;
    if (mkt.expanded === settledKey) mkt.expanded = null;
    mkt.notice = { k: m.ok ? 'ccBuyDone' : 'ccBuyFailed' };
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

  /* ---------------- main (minihome) ----------------
     The center's main: the player's own minihome face. The
     rail carries the name + state lines and the quick links;
     the main column carries the avatar window (the real body
     on a miniroom frame) and the visit box. The visit box
     lists the other people in this city from presence; a
     row's action rides __espilStallView under the feed's
     exact rule (in-room, stall up). Nothing else exists to
     visit yet - see CENSUS section 4. */
  function renderMain() {
    if (!winEl) return;
    renderChrome();
    var name = myDisplayName();
    var nm = winEl.querySelector('#ep-main-name');
    if (nm) nm.textContent = name;
    var tag = winEl.querySelector('#ep-main-nametag');
    if (tag) tag.textContent = name;
    var label = cityLabel();
    var cityTxt = label ? TF('ccNowIn', '{city}', label) : T('ccNowhere');
    var cl = winEl.querySelector('#ep-main-cityline');
    if (cl) cl.textContent = cityTxt;
    var info = winEl.querySelector('#ep-main-info');
    if (info) {
      info.innerHTML =
        '<div class="eph-line">' + esc(cityTxt) + '</div>' +
        '<div class="eph-line">' + esc(TF('ccMyLeo', '{n}', leoBalance())) + '</div>' +
        '<div class="eph-line">' + esc(signedIn() ? T('ccSignedIn') : T('ccGuestState')) + '</div>';
    }
    var box = winEl.querySelector('#ep-main-visit');
    if (box) {
      var st = chatState();
      var me = mySid();
      var others = ((st && st.users) || []).filter(function (u) { return u && String(u.id) !== me; });
      if (!st || !st.joined || !others.length) {
        box.innerHTML = '<div class="eph-visit-none">' + esc(T('ccVisitEmpty')) + '</div>';
      } else {
        box.innerHTML = '';
        others.forEach(function (u) {
          var row = document.createElement('div');
          row.className = 'eph-visit-row';
          var canVisit = !!(u.stall && window.__espilStallView);
          row.innerHTML = '<span class="eph-visit-name">' + esc(u.name || 'Guest') + '</span>' +
            (canVisit
              ? '<button class="eph-visit-btn" type="button" data-ep-visit="' + esc(u.id) + '">' + esc(T('ccViewStall')) + '</button>'
              : '<span class="eph-visit-none">' + esc(T('ccVisitNone')) + '</span>');
          box.appendChild(row);
        });
        Array.prototype.forEach.call(box.querySelectorAll('[data-ep-visit]'), function (b) {
          b.addEventListener('click', function () {
            var sid = b.getAttribute('data-ep-visit');
            close();
            if (window.__espilStallView) window.__espilStallView(sid);
          });
        });
      }
    }
    ccsSetOpen(true);
  }

  /* ---------------- main avatar stage ----------------
     A compact transplant of panels.js's verified character
     stage (the __espilCustPreview pattern): the same
     selection record (espil_character + espil_session_v1,
     the session record's designated Lunaris mark included),
     the same three body routes - style1-4 / kaykit through
     monolith's __espilBuildGateAvatar, master through the
     same GLB pair the gate preview loads, Lunaris through
     assets/zealandia/lunaris.glb - and the same grounding
     (bind-pose bbox, then a posed re-ground). Idle only; the
     renderer runs only while the center stands open on the
     main tab. A body that cannot stand shows the routed
     note - never a substitute character. */
  var CCS = {
    mounted: false, open: false, raf: 0, lastTs: 0,
    renderer: null, scene: null, camera: null, pivot: null,
    cur: null, selKey: '', cache: {}, pollTimer: 0
  };
  function ccsLs(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function ccsLsJson(k) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function ccsSelection() {
    var rec = ccsLsJson('espil_character') || {};
    var ses = ccsLsJson('espil_session_v1');
    var gender = rec.gender === 'female' ? 'female' : 'male';
    if (ses && ses.designatedBody === 'lunaris') return { gender: gender, body: 'lunaris', designated: 'lunaris' };
    var bc = rec.bodyChoice;
    if (/^(master|style[1-4]|kaykit)$/.test(bc || '')) return { gender: gender, body: bc, designated: null };
    if (!ses) {
      var mode = 'chibi';
      try {
        if (window.__espilGuestBodyState) mode = window.__espilGuestBodyState().mode || mode;
        else if (window.__ESPIL_GUEST_BODY__) mode = window.__ESPIL_GUEST_BODY__;
      } catch (e) {}
      if (mode === 'kaykit') return { gender: gender, body: 'kaykit', designated: null };
      if (mode === 'sprite') return { gender: gender, body: 'sprite', designated: null };
      return { gender: gender, body: 'style1', designated: null };
    }
    return { gender: gender, body: 'master', designated: null };
  }
  function ccsSelKey(sel) { return sel.designated ? 'lunaris' : sel.gender + '|' + sel.body; }
  function ccsBodyLabel(sel) {
    if (sel.designated) return T('ccBodyLunaris');
    var g = T(sel.gender === 'female' ? 'female' : 'male');
    var b = sel.body === 'master' ? 'Master' : sel.body === 'kaykit' ? 'KayKit' : sel.body === 'sprite' ? 'Sprite' : 'Style ' + sel.body.slice(-1);
    return g + ' · ' + b;
  }
  function ccsStripRootMotion(clip) {
    clip.tracks = clip.tracks.filter(function (t) {
      var n = (t.name || '').toLowerCase();
      var isPos = n.indexOf('.position') >= 0;
      var isRoot = /^(mixamorig[_:]?hips|hips|armature|root)/.test(n);
      return !(isPos && isRoot);
    });
    return clip;
  }
  function ccsNoCull(group) { group.traverse(function (o) { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; }); }
  function ccsGroundPosed(model) {
    try {
      var bbox = new THREE.Box3().setFromObject(model);
      if (isFinite(bbox.min.y)) model.position.y -= bbox.min.y;
    } catch (e) {}
  }
  function ccsBuildMasterEntry(gender) {
    var ent = { kind: 'master', ready: false, failed: false, group: new THREE.Group(), mixer: null, actions: {}, curAnim: null };
    var loader = new THREE.GLTFLoader();
    try { if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); } catch (e) {}
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
        if (gender === 'female' && idleClip) idleClip = ccsStripRootMotion(idleClip);
        if (idleClip) { ent.actions.idle = mixer.clipAction(idleClip); ent.actions.idle.play(); ent.curAnim = 'idle'; }
        try { mixer.update(0); } catch (e) {}
        ccsGroundPosed(model);
        ent.ready = true;
        if (gender === 'male') {
          loader.load('assets/character/male_idle.glb', function (g2) {
            var cs = g2.animations || [];
            if (!cs.length || !ent.mixer) return;
            var act = ent.mixer.clipAction(ccsStripRootMotion(cs[0]));
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
  function ccsBuildLunarisEntry() {
    var ent = { kind: 'lunaris', ready: false, failed: false, group: new THREE.Group(), mixer: null, actions: {}, curAnim: null };
    var loader = new THREE.GLTFLoader();
    try { if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); } catch (e) {}
    loader.load('assets/zealandia/lunaris.glb', function (gltf) {
      try {
        var model = gltf.scene;
        model.rotation.y = Math.PI;
        var bbox = new THREE.Box3().setFromObject(model);
        model.position.y -= bbox.min.y;
        model.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        ent.group.add(model);
        var mixer = new THREE.AnimationMixer(model);
        ent.mixer = mixer;
        (gltf.animations || []).forEach(function (clip) { ent.actions[clip.name] = mixer.clipAction(clip); });
        if (ent.actions.Idle) { ent.actions.Idle.play(); ent.curAnim = 'Idle'; }
        try { mixer.update(0); } catch (e) {}
        ccsGroundPosed(model);
        ent.ready = true;
      } catch (e) { ent.failed = true; }
    }, undefined, function () { ent.failed = true; });
    return ent;
  }
  function ccsBuildGameEntry(sel) {
    var av = null;
    try { av = window.__espilBuildGateAvatar ? window.__espilBuildGateAvatar(sel.gender, sel.body) : null; } catch (e) {}
    if (!av) return { kind: 'game', ready: false, failed: true, group: new THREE.Group(), mixer: null, actions: {}, curAnim: null, av: null };
    return { kind: 'game', ready: false, failed: false, group: av.group, av: av,
             get mixer() { return av.mixer; }, get actions() { return av.actions || {}; },
             get curAnim() { return av.curAnim; } };
  }
  function ccsEntryFor(sel) {
    var key = ccsSelKey(sel);
    if (CCS.cache[key]) return CCS.cache[key];
    var ent;
    if (sel.designated) ent = ccsBuildLunarisEntry();
    else if (sel.body === 'master') ent = ccsBuildMasterEntry(sel.gender);
    else ent = ccsBuildGameEntry(sel);
    ent.key = key;
    CCS.cache[key] = ent;
    return ent;
  }
  function ccsEntryReady(ent) {
    if (!ent || ent.failed) return false;
    if (ent.kind === 'game') return !!(ent.av && ent.av.ready && ent.av.mixer);
    return !!ent.ready;
  }
  function ccsEntryPlayIdle(ent) {
    if (!ent) return;
    try {
      if (ent.kind === 'game') { if (ent.av && ent.av.playAnim) ent.av.playAnim('idle'); return; }
      if (ent.kind === 'lunaris') {
        var w = ent.actions.Wave, id = ent.actions.Idle;
        if (w && ent.curAnim === 'Wave') w.fadeOut(.15);
        if (id) { id.reset().fadeIn(.15).play(); ent.curAnim = 'Idle'; }
        return;
      }
      var a = ent.actions.idle;
      if (a && ent.curAnim !== 'idle') { a.reset().fadeIn(.15).play(); ent.curAnim = 'idle'; }
    } catch (e) {}
  }
  function ccsMount() {
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return false;
    var stage = winEl.querySelector('#ep-main-stage');
    if (!stage) return false;
    var cv = document.createElement('canvas');
    stage.insertBefore(cv, stage.firstChild);
    var renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    CCS.renderer = renderer;
    var scene = new THREE.Scene();
    CCS.scene = scene;
    var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    camera.position.set(0, 1.04, 3.35);
    camera.lookAt(0, 0.88, 0);
    CCS.camera = camera;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a3b, 1.05));
    var key = new THREE.DirectionalLight(0xfff2dd, 1.6); key.position.set(1.6, 3.0, 2.4); scene.add(key);
    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-2.0, 1.2, 1.4); scene.add(fill);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28),
      new THREE.MeshBasicMaterial({ color: 0x8a6a3b, transparent: true, opacity: 0.35, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002;
    scene.add(disc);
    var pivot = new THREE.Group();
    pivot.rotation.y = Math.PI;
    scene.add(pivot);
    CCS.pivot = pivot;
    CCS.mounted = true;
    return true;
  }
  function ccsSizeRenderer() {
    if (!CCS.renderer || !CCS.camera) return;
    var cv = CCS.renderer.domElement;
    var w = cv.clientWidth || 260, h = cv.clientHeight || 190;
    CCS.renderer.setSize(w, h, false);
    CCS.camera.aspect = w / h;
    CCS.camera.updateProjectionMatrix();
  }
  function ccsShowSelection() {
    if (!CCS.mounted) return;
    var sel = ccsSelection();
    CCS.sel = sel;
    var key = ccsSelKey(sel);
    var labelEl = winEl.querySelector('#ep-main-bodylabel');
    if (labelEl) labelEl.textContent = sel.body === 'sprite' ? '' : ccsBodyLabel(sel);
    var msgEl = winEl.querySelector('#ep-main-msg');
    if (sel.body === 'sprite') {
      if (CCS.cur && CCS.cur.group && CCS.cur.group.parent === CCS.pivot) CCS.pivot.remove(CCS.cur.group);
      CCS.cur = null; CCS.selKey = key;
      if (msgEl) { msgEl.style.display = ''; msgEl.textContent = T('ccAvatarSprite'); }
      return;
    }
    var ent = ccsEntryFor(sel);
    if (ent.failed) {
      if (msgEl) { msgEl.style.display = ''; msgEl.textContent = T('ccAvatarFail'); }
    } else if (msgEl) msgEl.style.display = 'none';
    if (key !== CCS.selKey || CCS.cur !== ent) {
      if (CCS.cur && CCS.cur.group && CCS.cur.group.parent === CCS.pivot) CCS.pivot.remove(CCS.cur.group);
      if (CCS.pivot) { CCS.pivot.rotation.y = Math.PI; CCS.pivot.position.y = 0; }
      ccsNoCull(ent.group);
      CCS.pivot.add(ent.group);
      CCS.cur = ent;
      ccsEntryPlayIdle(ent);
      CCS.selKey = key;
    }
  }
  function ccsTick(ts) {
    if (!CCS.open) { CCS.raf = 0; return; }
    CCS.raf = requestAnimationFrame(ccsTick);
    var dt = Math.min(0.05, CCS.lastTs ? (ts - CCS.lastTs) / 1000 : 0.016);
    CCS.lastTs = ts;
    var ent = CCS.cur;
    if (ent && ent.mixer && ccsEntryReady(ent)) { try { ent.mixer.update(dt); } catch (e) {} }
    if (CCS.renderer && CCS.scene && CCS.camera) CCS.renderer.render(CCS.scene, CCS.camera);
  }
  function ccsSetOpen(on) {
    if (on === CCS.open) { if (on && CCS.mounted) ccsShowSelection(); return; }
    CCS.open = on;
    if (on) {
      if (!CCS.mounted && !ccsMount()) {
        var msgEl = winEl.querySelector('#ep-main-msg');
        if (msgEl) { msgEl.style.display = ''; msgEl.textContent = T('ccAvatarFail'); }
        return;
      }
      CCS.lastTs = 0;
      ccsSizeRenderer();
      ccsShowSelection();
      if (!CCS.raf) CCS.raf = requestAnimationFrame(ccsTick);
      if (CCS.pollTimer) clearInterval(CCS.pollTimer);
      CCS.pollTimer = setInterval(function () {
        if (!CCS.open) return;
        if (ccsSelKey(ccsSelection()) !== CCS.selKey) ccsShowSelection();
      }, 900);
    } else {
      if (CCS.raf) cancelAnimationFrame(CCS.raf);
      CCS.raf = 0;
      if (CCS.pollTimer) { clearInterval(CCS.pollTimer); CCS.pollTimer = 0; }
    }
  }

  /* A language switch while the center stands open repaints
     the open surfaces in the new pack. The two real controls
     are the landing language menu (.lang-opt) and the
     settings select (#opt-lang); both are delegated here so
     the hook survives their DOM living outside this module.
     A composer draft in the feed textarea does not survive
     the repaint - the same trade open() itself makes. */
  function rerenderOpen() {
    if (!winEl || !winEl.classList.contains('open')) return;
    renderChrome();
    renderComposer();
    if (curTab === 'main') renderMain();
    else if (curTab === 'feed') renderFeed();
    else if (curTab === 'market') renderMarket();
  }
  document.addEventListener('click', function (e) {
    var t = e && e.target;
    if (t && t.closest && t.closest('.lang-opt')) setTimeout(rerenderOpen, 0);
  });
  document.addEventListener('change', function (e) {
    if (e && e.target && e.target.id === 'opt-lang') setTimeout(rerenderOpen, 0);
  });

  /* ---------------- open / close ---------------- */
  function portalEvent() {
    try {
      window.dispatchEvent(new CustomEvent('espil-portal-state', {
        detail: { open: !!(winEl && winEl.classList.contains('open')), tab: curTab }
      }));
    } catch (e) {}
  }
  function open(tab) {
    ensureDom();
    centerBeacon('center_view');
    winEl.classList.add('open');
    winEl.setAttribute('aria-hidden', 'false');
    if (!tab) {
      /* v2: a first open lands on the minihome main (the
         avatar); a stored tab still restores, and explicit-tab
         callers are untouched. */
      try { tab = localStorage.getItem(LS_TAB) || 'main'; } catch (e) { tab = 'main'; }
    }
    renderChrome();
    renderComposer();
    selectTab(tab);
    portalEvent();
  }
  function close() {
    if (!winEl) return;
    ccsSetOpen(false);
    stopMarketTimer();
    if (cashHosted) unhostCash();
    winEl.classList.remove('open');
    winEl.setAttribute('aria-hidden', 'true');
    portalEvent();
  }
  function toggle(tab) {
    if (winEl && winEl.classList.contains('open')) close();
    else open(tab);
  }
  function mountOf() {
    if (!winEl) return 'dock';
    if (winEl.classList.contains('espil-booked')) return 'book';
    try { if (window.innerWidth <= 820) return 'sheet'; } catch (e) {}
    return 'dock';
  }

  window.__espilPortal = {
    open: open,
    close: close,
    toggle: toggle,
    state: function () {
      return {
        open: !!(winEl && winEl.classList.contains('open')),
        tab: curTab,
        mount: mountOf(),
        posts: posts.length,
        room: roomKey(),
        cashHosted: cashHosted,
        signedIn: signedIn(),
        market: {
          rows: mkt.rows ? mkt.rows.length : -1,
          fetchedAt: mkt.fetchedAt,
          cat: mkt.cat,
          minP: mkt.minP,
          maxP: mkt.maxP,
          expanded: mkt.expanded,
          pending: !!mkt.pending,
          error: mkt.error
        }
      };
    }
  };
})();
