/* __espilCashShop v1 - the CASH SHOP (espil.online room, 2026-11-09).
   Han decision round 3 (2026-11-09): the shop is a CASH shop - open
   the cash window; paid items are fashion cosmetics first, with
   pay-to-win elements at the room's discretion. This supersedes the
   2026-11-06 order that kept the cash shop closed. Design:
   ~/workspace/espil-online-room/cashshop/DESIGN-v1.md.

   Form: a lazy module in the npcs/monsters arrival family (loaded
   by modules/lazyload.js at the in-map arrival seam). Self-contained
   DOM in the panels palette; panels.js is NOT edited and neither is
   monolith.js or mmo-hud.js. Entry: a floating CASH button shown
   while in the map (any context, not just inside the Konbiniya),
   plus window.__espilCash.open() for other systems (the arena gate
   and the between-round rest open this same window).

   Money rules (design section 3): cash is real-money currency and
   is NEVER mixed with Leo - nothing Leo-priced is sold here and no
   purchase here touches espil_leo_balance. Ledger localStorage
   espil_cash_v1 { v, balanceCents, owned: [catalogue ids],
   entitlements: { arenaRevives }, txns: [...] }.

   Item grants land in the game's ONE item store, the
   espil_owned_items name list - the same list panels.js renders in
   the bag and the S1 death UI counts. In particular the revival
   potion stock is NOT forked: the death UI counts the string
   'Revival Potion' inside espil_owned_items, so potion purchases
   push exactly that name there, and state().potionStock reads the
   same list back live.

   Fashion application path (honest, no faking): a bought fashion
   item becomes an owned bag item whose name resolves a slot in
   panels (slotOf patterns), so the player wears it through the
   character window's fashion (치장) layer - the bag's 치장 착용
   button / the profile 치장 아이템 tab. The in-world sprite
   consumer does not read espil_equipped_look yet (documented
   limitation of the current character line); the shop copy says
   exactly that and nothing more.

   Top-up / payment leg: the Stripe connector status at build time
   is NOT CONNECTED (auth_status: not_connected, checked 2026-11-09),
   so there is no live charge path in this build. The top-up button
   says plainly that payment opens at the deploy step and never
   simulates a charge. Fulfilment enters through
   __espilCash.credit(cents, label) - the single entry a verified
   payment return calls at deploy time.

   Arena interface (stable, the arena build consumes it):
     window.__espilCash = {
       balanceCents() -> int cents,
       charge(cents, label) -> true/false (false = insufficient,
         balance untouched; never goes negative),
       credit(cents, label) -> new balance (payment fulfilment),
       grant(itemId) -> { ok, ... } applies a catalogue entry's
         contents without charging (shop buy() = charge+grant),
       buy(itemId) -> { ok, why? } atomic charge+grant w/ guards,
       open(), close(), state()
     }
   Module sources are TAGLESS (house rule) - no script tags here. */
(function () {
  'use strict';
  if (window.__espilCash) return; /* once per page */

  var LS_CASH = 'espil_cash_v1';
  var LS_OWN = 'espil_owned_items';

  /* ---------------- catalogue ----------------
     price in USD cents. grants = item names pushed into
     espil_owned_items (the panels DB / RECOVERY names, verbatim).
     Fashion names are chosen so panels' slotOf() resolves a slot
     (hood->head, outfit->top, shoes->shoes, blade/staff/sword->
     weapon), which is what makes them wearable as look items. */
  function rep(name, n) { var a = []; for (var i = 0; i < n; i++) a.push(name); return a; }
  var CATALOGUE = [
    { id: 'fashion-hoodie', shelf: 'fashion', name: 'Cozy Hoodie', kr: '코지 후디', price: 300, once: true,
      grants: ['Cozy Hoodie'], blurb: '치장 아이템 (머리). 능력치와 무관한 외형 아이템입니다.' },
    { id: 'fashion-dress', shelf: 'fashion', name: 'One-Piece Dress Outfit', kr: '원피스 드레스', price: 500, once: true,
      grants: ['One-Piece Dress Outfit'], blurb: '치장 아이템 (상의). 능력치와 무관한 외형 아이템입니다.' },
    { id: 'fashion-shoes', shelf: 'fashion', name: 'Dress Shoes', kr: '드레스 슈즈', price: 200, once: true,
      grants: ['Dress Shoes'], blurb: '치장 아이템 (신발). 능력치와 무관한 외형 아이템입니다.' },
    { id: 'fashion-skateboard', shelf: 'fashion', name: 'Skateboard Blade', kr: '스케이트보드 블레이드', price: 400, once: true,
      grants: ['Skateboard Blade'], blurb: '무기 치장. 들고 있는 무기의 겉모습만 바꿉니다.' },
    { id: 'fashion-frog', shelf: 'fashion', name: 'Frog Staff', kr: '개구리 스태프', price: 400, once: true,
      grants: ['Frog Staff'], blurb: '무기 치장. 들고 있는 무기의 겉모습만 바꿉니다.' },
    { id: 'fashion-umbrella', shelf: 'fashion', name: 'Umbrella Sword', kr: '우산 소드', price: 400, once: true,
      grants: ['Umbrella Sword'], blurb: '무기 치장. 들고 있는 무기의 겉모습만 바꿉니다.' },
    { id: 'revival-potion-10', shelf: 'potion', name: 'Revival Potion x10', kr: '부활 포션 10개', price: 100,
      grants: rep('Revival Potion', 10), blurb: '쓰러졌을 때 그 자리에서 HP/MP 50%로 부활합니다. (10개에 $1 - S1 기준 가격)' },
    { id: 'bundle-recovery', shelf: 'convenience', name: 'Recovery Bundle', kr: '회복 묶음', price: 200,
      grants: ['Burger', 'Burger', 'Fried Chicken', 'Banana Milk', 'Banana Milk'],
      blurb: '버거 2, 프라이드치킨 1, 바나나우유 2. 가방에서 바로 먹을 수 있습니다.' },
    { id: 'bundle-materials', shelf: 'convenience', name: 'Crafting Material Bundle', kr: '제작 재료 묶음', price: 300,
      grants: ['Copper Ingot', 'Copper Ingot', 'Copper Plate', 'Copper Plate', 'Jade Bead', 'Jade Bead', 'Steel Ingot', 'Steel Plate', 'Sapphire Bead'],
      blurb: '구리 주괴 2, 구리 판 2, 비취 구슬 2, 강철 주괴 1, 강철 판 1, 사파이어 구슬 1.' },
    { id: 'arena-revive-credit', shelf: 'convenience', name: 'Arena Extra Revive', kr: '아레나 추가 부활', price: 100,
      grants: [], entitlement: 'arenaRevives', blurb: '아레나에서 기본 부활 횟수를 다 쓴 뒤 추가로 부활할 수 있는 권리 1회.' }
  ];
  var BY_ID = {};
  CATALOGUE.forEach(function (c) { BY_ID[c.id] = c; });
  var SHELVES = [
    { key: 'fashion', title: '패션 치장' },
    { key: 'potion', title: '부활 포션' },
    { key: 'convenience', title: '편의 (방 재량)' }
  ];
  var TOPUP_PACKS = [100, 500, 1000]; /* cents; display only until payment opens */

  /* ---------------- ledger ---------------- */
  function loadLedger() {
    var d = { v: 1, balanceCents: 0, owned: [], entitlements: { arenaRevives: 0 }, txns: [] };
    try {
      var raw = JSON.parse(localStorage.getItem(LS_CASH) || 'null');
      if (raw && typeof raw === 'object') {
        if (typeof raw.balanceCents === 'number' && isFinite(raw.balanceCents)) d.balanceCents = Math.max(0, Math.floor(raw.balanceCents));
        if (Array.isArray(raw.owned)) d.owned = raw.owned.filter(function (x) { return typeof x === 'string'; });
        if (raw.entitlements && typeof raw.entitlements.arenaRevives === 'number') d.entitlements.arenaRevives = Math.max(0, Math.floor(raw.entitlements.arenaRevives));
        if (Array.isArray(raw.txns)) d.txns = raw.txns.slice(-60);
      }
    } catch (e) {}
    return d;
  }
  var ledger = loadLedger();
  function saveLedger() { try { localStorage.setItem(LS_CASH, JSON.stringify(ledger)); } catch (e) {} }
  function logTxn(type, cents, label) {
    ledger.txns.push({ t: Date.now(), type: type, cents: cents, label: String(label || '') });
    if (ledger.txns.length > 60) ledger.txns = ledger.txns.slice(-60);
  }

  /* ---------------- the one item store ---------------- */
  function ownedItems() {
    try { var a = JSON.parse(localStorage.getItem(LS_OWN) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function saveOwnedItems(a) { try { localStorage.setItem(LS_OWN, JSON.stringify(a)); } catch (e) {} }
  function potionStock() {
    var a = ownedItems(), n = 0;
    for (var i = 0; i < a.length; i++) if (a[i] === 'Revival Potion') n++;
    return n;
  }
  function grantNames(names) {
    if (!names || !names.length) return [];
    var a = ownedItems();
    names.forEach(function (n) { a.push(String(n)); });
    saveOwnedItems(a);
    return names.slice();
  }

  /* ---------------- money ---------------- */
  function balanceCents() { return ledger.balanceCents; }
  function charge(cents, label) {
    cents = Math.floor(Number(cents));
    if (!isFinite(cents) || cents <= 0) return false;
    if (ledger.balanceCents < cents) return false;
    ledger.balanceCents -= cents;
    logTxn('charge', -cents, label);
    saveLedger();
    render();
    return true;
  }
  function credit(cents, label) {
    cents = Math.floor(Number(cents));
    if (!isFinite(cents) || cents <= 0) return ledger.balanceCents;
    ledger.balanceCents += cents;
    logTxn('credit', cents, label);
    saveLedger();
    render();
    return ledger.balanceCents;
  }

  /* ---------------- grants + atomic buy ---------------- */
  function grant(itemId) {
    var c = BY_ID[itemId];
    if (!c) return { ok: false, why: 'unknown-item' };
    var granted = grantNames(c.grants || []);
    if (c.entitlement) {
      ledger.entitlements[c.entitlement] = (ledger.entitlements[c.entitlement] || 0) + 1;
    }
    if (c.once && ledger.owned.indexOf(c.id) < 0) ledger.owned.push(c.id);
    logTxn('grant', 0, c.id);
    saveLedger();
    render();
    return { ok: true, id: c.id, granted: granted, entitlement: c.entitlement || null };
  }
  var buyLock = false;
  var spentTokens = {};
  function buy(itemId, token) {
    var c = BY_ID[itemId];
    if (!c) return { ok: false, why: 'unknown-item' };
    if (buyLock) return { ok: false, why: 'busy' };
    if (token) {
      if (spentTokens[token]) return { ok: false, why: 'duplicate' };
    }
    if (c.once && ledger.owned.indexOf(c.id) >= 0) return { ok: false, why: 'owned' };
    buyLock = true;
    try {
      if (!charge(c.price, c.id)) { setMsg('캐시가 부족합니다. 충전은 배포 단계에서 열립니다.', true); return { ok: false, why: 'insufficient' }; }
      if (token) spentTokens[token] = 1;
      var g = grant(c.id);
      setMsg(c.kr + ' 구매 완료. 가방에 들어갔습니다.', false);
      return { ok: true, id: c.id, granted: g.granted };
    } finally {
      buyLock = false;
    }
  }

  /* ---------------- DOM ---------------- */
  var winEl = null, btnEl = null, msgEl = null, balEl = null, bodyEl = null;
  var renderSeq = 0;
  function fmt(cents) { return '$' + (cents / 100).toFixed(2); }
  function ensureDom() {
    if (btnEl) return;
    var st = document.createElement('style');
    st.id = 'espil-cash-style';
    st.textContent =
      '#espil-cash-btn{position:fixed;right:14px;top:118px;z-index:9000;display:none;align-items:center;gap:6px;' +
      'padding:8px 14px;border-radius:999px;border:1px solid #c9a227;background:linear-gradient(180deg,#5a4126,#3a2a1a);' +
      'color:#ffd76a;font-family:sans-serif;font-size:13px;font-weight:800;letter-spacing:1px;cursor:pointer;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.45)}' +
      '#espil-cash-btn.show{display:flex}' +
      '#espil-cash-window{position:fixed;inset:0;z-index:9990;display:none;align-items:center;justify-content:center;background:rgba(10,6,4,.55)}' +
      '#espil-cash-window.open{display:flex}' +
      '.ecw-card{background:linear-gradient(180deg,#3a2a1c,#241a10);border:2px solid #8a6a44;border-radius:14px;' +
      'width:min(680px,94vw);max-height:88vh;overflow:auto;padding:20px 22px;color:#f2e3c2;font-family:sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
      '.ecw-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.ecw-title{font-size:22px;font-weight:800;color:#ffe9bd}' +
      '.ecw-bal{font-size:15px;font-weight:700;color:#ffd76a}' +
      '.ecw-close{border:1px solid #8a6a44;background:#57402a;color:#ffe9bd;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700}' +
      '.ecw-topup{display:flex;gap:8px;align-items:center;margin:8px 0 4px;flex-wrap:wrap}' +
      '.ecw-pack{border:1px solid #6d5836;background:#2e2114;color:#d8c49a;}' +
      '.ecw-shelf{font-size:16px;font-weight:800;color:#ffd76a;margin:16px 0 8px;border-bottom:1px solid #57402a;padding-bottom:4px}' +
      '.ecw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}' +
      '.ecw-item{border:1px solid #57402a;border-radius:10px;padding:10px 12px;background:rgba(0,0,0,.22)}' +
      '.ecw-name{font-weight:700;font-size:14px;color:#ffe9bd}' +
      '.ecw-kr{font-size:12px;color:#b8a888}' +
      '.ecw-blurb{font-size:12px;line-height:1.45;color:#d8c49a;margin:6px 0 8px;min-height:34px}' +
      '.ecw-row{display:flex;align-items:center;justify-content:space-between}' +
      '.ecw-price{font-weight:800;color:#ffd76a}' +
      '.ecw-buy{border:1px solid #c9a227;background:#6d5836;color:#ffe9bd;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:700}' +
      '.ecw-buy[disabled]{opacity:.45;cursor:not-allowed}' +
      '.ecw-owned{font-size:12px;font-weight:700;color:#9fd48a}' +
      '.ecw-msg{min-height:20px;font-size:13px;margin-top:10px;color:#ffd76a}' +
      '.ecw-msg.err{color:#ff9d9d}' +
      '.ecw-note{font-size:12px;color:#b8a888;line-height:1.5;margin-top:8px}';
    document.head.appendChild(st);

    btnEl = document.createElement('button');
    btnEl.id = 'espil-cash-btn';
    btnEl.type = 'button';
    btnEl.textContent = '💰 CASH 상점';
    btnEl.addEventListener('click', function () { open(); });
    document.body.appendChild(btnEl);

    winEl = document.createElement('div');
    winEl.id = 'espil-cash-window';
    winEl.setAttribute('aria-hidden', 'true');
    winEl.innerHTML =
      '<div class="ecw-card" role="dialog" aria-label="Cash Shop">' +
      '<div class="ecw-head"><div class="ecw-title">캐시 상점</div>' +
      '<div><span class="ecw-bal" id="espil-cash-bal"></span> ' +
      '<button class="ecw-close" id="espil-cash-close" type="button">닫기</button></div></div>' +
      '<div class="ecw-topup" id="espil-cash-topup"></div>' +
      '<div id="espil-cash-body"></div>' +
      '<div class="ecw-msg" id="espil-cash-msg"></div>' +
      '<p class="ecw-note">패션 치장은 가방에 들어가며, 캐릭터 창(P)의 치장 아이템 탭에서 착용할 수 있습니다. ' +
      '인게임 캐릭터에 바로 입혀지는 적용은 캐릭터 개편 라인에서 이어집니다. 등급이 붙은 무기와 방어구 자체는 팔지 않습니다.</p>' +
      '</div>';
    document.body.appendChild(winEl);
    balEl = winEl.querySelector('#espil-cash-bal');
    bodyEl = winEl.querySelector('#espil-cash-body');
    msgEl = winEl.querySelector('#espil-cash-msg');
    winEl.querySelector('#espil-cash-close').addEventListener('click', function () { close(); });
    winEl.addEventListener('click', function (e) { if (e.target === winEl) close(); });
    renderTopup();
  }
  function setMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'ecw-msg' + (isErr ? ' err' : '');
  }
  function renderTopup() {
    var t = winEl.querySelector('#espil-cash-topup');
    if (!t) return;
    t.innerHTML = '';
    var label = document.createElement('span');
    label.style.cssText = 'font-size:13px;color:#d8c49a';
    label.textContent = '캐시 충전:';
    t.appendChild(label);
    TOPUP_PACKS.forEach(function (cents) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ecw-buy';
      b.textContent = fmt(cents) + ' 충전';
      b.addEventListener('click', function () {
        setMsg('결제는 배포 단계에서 열립니다. 지금은 충전할 수 없습니다.', true);
      });
      t.appendChild(b);
    });
  }
  function render() {
    if (!winEl || !winEl.classList.contains('open')) return;
    if (balEl) balEl.textContent = '보유 캐시 ' + fmt(ledger.balanceCents);
    if (!bodyEl) return;
    renderSeq++;
    bodyEl.innerHTML = '';
    SHELVES.forEach(function (sh) {
      var h = document.createElement('div');
      h.className = 'ecw-shelf';
      h.textContent = sh.title;
      bodyEl.appendChild(h);
      var grid = document.createElement('div');
      grid.className = 'ecw-grid';
      CATALOGUE.filter(function (c) { return c.shelf === sh.key; }).forEach(function (c) {
        var card = document.createElement('div');
        card.className = 'ecw-item';
        card.setAttribute('data-cash-item', c.id);
        var owned = c.once && ledger.owned.indexOf(c.id) >= 0;
        var name = document.createElement('div');
        name.className = 'ecw-name';
        name.textContent = c.name;
        var kr = document.createElement('div');
        kr.className = 'ecw-kr';
        kr.textContent = c.kr;
        var blurb = document.createElement('div');
        blurb.className = 'ecw-blurb';
        blurb.textContent = c.blurb;
        var row = document.createElement('div');
        row.className = 'ecw-row';
        var price = document.createElement('span');
        price.className = 'ecw-price';
        price.textContent = fmt(c.price);
        row.appendChild(price);
        if (owned) {
          var badge = document.createElement('span');
          badge.className = 'ecw-owned';
          badge.textContent = '보유 중';
          row.appendChild(badge);
        } else {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'ecw-buy';
          b.setAttribute('data-cash-buy', c.id);
          b.textContent = '구매';
          /* one gesture = one purchase: the token is minted per
             render and spent by buy(); a second click landing on
             this same (now detached) node after a re-render still
             carries the spent token and is rejected as duplicate.
             A FAILED buy charged nothing (every not-ok path in
             buy() returns before or at the charge gate), so the
             button re-enables: without this, a first click at
             balance 0 (insufficient) left the button greyed out
             on a still-attached node until the window re-rendered. */
          var token = c.id + '@' + renderSeq;
          b.addEventListener('click', function () {
            if (b.disabled) return;
            b.disabled = true;
            var r = buy(c.id, token);
            if (!r.ok) b.disabled = false;
          });
          row.appendChild(b);
        }
        card.appendChild(name);
        card.appendChild(kr);
        card.appendChild(blurb);
        card.appendChild(row);
        grid.appendChild(card);
      });
      bodyEl.appendChild(grid);
    });
  }
  function open() {
    ensureDom();
    winEl.classList.add('open');
    winEl.setAttribute('aria-hidden', 'false');
    setMsg('', false);
    render();
  }
  function close() {
    if (!winEl) return;
    winEl.classList.remove('open');
    winEl.setAttribute('aria-hidden', 'true');
  }

  /* ---------------- visibility: in-map only ---------------- */
  function tickBtn() {
    if (!document.body) return;
    ensureDom();
    var inMap = document.body.classList.contains('in-map');
    btnEl.classList.toggle('show', inMap);
    if (!inMap) close();
  }
  if (document.body) tickBtn();
  setInterval(tickBtn, 800);

  /* ---------------- public interface ---------------- */
  window.__espilCash = {
    balanceCents: balanceCents,
    charge: charge,
    credit: credit,
    grant: grant,
    buy: function (itemId) { return buy(itemId, null); },
    open: open,
    close: close,
    state: function () {
      return {
        balanceCents: ledger.balanceCents,
        owned: ledger.owned.slice(),
        entitlements: { arenaRevives: ledger.entitlements.arenaRevives || 0 },
        potionStock: potionStock(),
        txns: ledger.txns.slice(-10),
        payment: 'stripe_not_connected',
        catalogue: CATALOGUE.map(function (c) { return c.id; })
      };
    }
  };
})();
