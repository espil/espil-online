
/* __espilStall2 v1 - stall Phase B (Han 2026-10-31): posts carry
   counts and can be picked from the inventory; the stall's first
   post rides over the owner's head as a speech bubble (for example
   "Onigiri(Sell)"); other users open the stall from the character
   menu and trade in Leo - a sale moves the item into the buyer's
   inventory, pays the seller, drops the count, and the post
   disappears at zero. Services sell too, marked TESTING (delivery
   and information services; files limited to pdf/doc/txt/mp4/mp3).
   Settlement is client-to-client over the presence relay while
   accounts are device-local - the Worker carries only the bounded
   public stall summary (cleanStall) and relays the two trade
   frames, storing nothing. */
(function () {
  'use strict';
  var SERVICE_FILES = 'pdf / doc / txt / mp4 / mp3';
  var pushedSig = '', lastFormPatch = 0;

  function stallKey() { return 'espil_stall_' + (window.__espilCityKey || 'vancouver'); }
  function load() { try { var s = JSON.parse(localStorage.getItem(stallKey()) || 'null'); return (s && typeof s.x === 'number') ? s : null; } catch (e) { return null; } }
  function save(s) { try { if (s) localStorage.setItem(stallKey(), JSON.stringify(s)); } catch (e) {} }
  function leoBalance() { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); return isNaN(v) ? 1000 : v; }
  function leoSet(v) { try { localStorage.setItem('espil_leo_balance', String(v)); } catch (e) {} }
  function toast(m) { if (window.__espilToast) window.__espilToast(m); }
  function chatState() { try { return window.__espilChatState ? window.__espilChatState() : null; } catch (e) { return null; } }
  function send(obj) { try { return window.__espilSocialSend ? window.__espilSocialSend(obj) : false; } catch (e) { return false; } }
  function owned() { try { var a = JSON.parse(localStorage.getItem('espil_owned_items') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function publicStall(s) {
    if (!s || !s.posts || !s.posts.length) return null;
    return {
      name: s.name || '',
      posts: s.posts.map(function (p) {
        return { id: p.id || '', side: p.side === 'buy' ? 'buy' : 'sell', kind: p.kind === 'service' ? 'service' : 'item',
                 title: p.title || '', price: parseInt(p.price, 10) || 0, count: Math.max(1, parseInt(p.count, 10) || 1), note: p.note || '' };
      })
    };
  }

  /* ---------- counts + inventory picker in the stall form ------- */
  function augmentForm() {
    var form = document.getElementById('stall-form');
    if (!form || document.getElementById('stall2-count')) return;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;';
    var sel = document.createElement('select');
    sel.id = 'stall2-inv';
    sel.style.cssText = 'flex:1;min-width:0;';
    sel.innerHTML = '<option value="">From inventory…</option>';
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      var t = document.getElementById('stall-title'); if (t) t.value = sel.value;
      var counts = {}; owned().forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
      var c = document.getElementById('stall2-count'); if (c) c.value = counts[sel.value] || 1;
    });
    var cnt = document.createElement('input');
    cnt.id = 'stall2-count'; cnt.type = 'number'; cnt.min = '1'; cnt.max = '999'; cnt.value = '1';
    cnt.style.cssText = 'width:64px;';
    cnt.title = 'How many';
    var lab = document.createElement('span'); lab.textContent = '×'; lab.style.cssText = 'opacity:.7;';
    row.appendChild(sel); row.appendChild(lab); row.appendChild(cnt);
    form.appendChild(row);
    refreshInvPicker();
  }
  function refreshInvPicker() {
    var sel = document.getElementById('stall2-inv');
    if (!sel) return;
    var counts = {}; owned().forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
    var cur = sel.value;
    sel.innerHTML = '<option value="">From inventory…</option>' + Object.keys(counts).map(function (n) {
      return '<option value="' + esc(n) + '">' + esc(n) + ' ×' + counts[n] + '</option>';
    }).join('');
    sel.value = cur;
  }
  var pendingPost = null;
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'stall-add-btn') {
      var t = document.getElementById('stall-title');
      var c = document.getElementById('stall2-count');
      pendingPost = { title: t ? t.value.trim() : '', count: c ? Math.max(1, Math.min(999, parseInt(c.value, 10) || 1)) : 1, at: Date.now() };
    }
  }, true);
  document.addEventListener('click', function (e) {
    if (!pendingPost || !e.target || e.target.id !== 'stall-add-btn') return;
    var pp = pendingPost; pendingPost = null;
    setTimeout(function () {
      var s = load(); if (!s || !s.posts) return;
      var best = null;
      s.posts.forEach(function (p) { if (p.title === pp.title) best = p; });
      if (best) { best.count = pp.count; save(s); pushStall(true); }
    }, 60);
  }, false);

  /* ---------- presence: publish my stall ------------------------ */
  function pushStall(force) {
    var st = chatState();
    if (!st || !st.joined) return;
    var pub = publicStall(load());
    var sig = JSON.stringify(pub);
    if (!force && sig === pushedSig) return;
    pushedSig = sig;
    send({ t: 'stall_update', stall: pub });
  }

  /* ---------- speech bubbles ------------------------------------ */
  var bubbleBox = null, bubbleEls = {};
  function ensureBubbleBox() {
    if (bubbleBox) return;
    bubbleBox = document.createElement('div');
    bubbleBox.id = 'stall2-bubbles';
    bubbleBox.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:36;overflow:hidden;';
    document.body.appendChild(bubbleBox);
  }
  function bubbleText(stall) {
    if (!stall || !stall.posts || !stall.posts.length) return '';
    var p = stall.posts[0];
    var t = (p.title || '') + (p.side === 'buy' ? '(Buy)' : '(Sell)');
    if ((p.count || 1) > 1) t += ' ×' + p.count;
    if (stall.posts.length > 1) t += ' +' + (stall.posts.length - 1);
    return t;
  }
  function project(x, y, z) {
    var cam = window.__espilMapCameraObj ? window.__espilMapCameraObj() : null;
    if (!cam || typeof THREE === 'undefined') return null;
    var v = new THREE.Vector3(x, y, z).project(cam);
    if (v.z > 1 || v.z < -1) return null;
    return { sx: (v.x * 0.5 + 0.5) * window.innerWidth, sy: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }
  function bubblesTick() {
    ensureBubbleBox();
    var inMap = document.body.classList.contains('in-map') && !window.__espilInside;
    var st = chatState();
    var want = {};
    if (inMap && st) {
      var mine = bubbleText(publicStall(load()));
      var pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null;
      if (mine && pose) want.me = { text: mine, x: pose.x, y: pose.y, z: pose.z };
      (st.users || []).forEach(function (u) {
        if (!u || u.id === st.myId || !u.stall || !u.pos) return;
        var t = bubbleText(u.stall);
        if (t) want[u.id] = { text: t, x: u.pos.x, y: u.pos.y, z: u.pos.z };
      });
    }
    Object.keys(bubbleEls).forEach(function (id) { if (!want[id]) { bubbleEls[id].remove(); delete bubbleEls[id]; } });
    Object.keys(want).forEach(function (id) {
      var w = want[id];
      var el = bubbleEls[id];
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);background:#fffdf6;color:#24303a;border:1.5px solid rgba(36,48,58,.55);border-radius:12px;padding:3px 9px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.3);';
        bubbleBox.appendChild(el);
        bubbleEls[id] = el;
      }
      el.textContent = w.text;
      var p = project(w.x, (w.y || 0) + 2.42, w.z);
      if (!p || p.sx < -80 || p.sx > window.innerWidth + 80 || p.sy < -30 || p.sy > window.innerHeight + 30) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = p.sx + 'px';
      el.style.top = p.sy + 'px';
    });
  }

  /* ---------- visitor board + trade ----------------------------- */
  var boardEl = null, boardUserId = null;
  function closeBoard() { if (boardEl) { boardEl.remove(); boardEl = null; boardUserId = null; } }
  function openBoard(userId) {
    var st = chatState(); if (!st) return;
    var user = (st.users || []).filter(function (u) { return u && u.id === userId; })[0];
    if (!user || !user.stall) { toast('That stall is not open'); return; }
    closeBoard();
    boardUserId = userId;
    boardEl = document.createElement('div');
    boardEl.id = 'stall2-board';
    boardEl.style.cssText = 'position:fixed;right:14px;top:96px;width:min(320px,92vw);max-height:70vh;overflow:auto;z-index:220;background:rgba(13,24,32,.94);border:1.5px solid rgba(142,247,232,.5);border-radius:14px;padding:12px 14px;color:#eaf6ff;box-shadow:0 14px 40px rgba(0,0,0,.5);';
    var rows = user.stall.posts.map(function (p) {
      var svc = p.kind === 'service';
      var canBuy = p.side === 'sell' && (parseInt(p.price, 10) || 0) > 0;
      return '<div style="border:1px solid rgba(142,247,232,.25);border-radius:10px;padding:8px;margin-top:8px;">'
        + '<span style="padding:1px 7px;border-radius:99px;font-size:10px;font-weight:800;background:' + (p.side === 'buy' ? 'rgba(90,140,255,.55)' : 'rgba(255,150,60,.55)') + ';color:#fff;">' + (p.side === 'buy' ? 'BUYING' : 'SELLING') + '</span>'
        + (svc ? '<span style="margin-left:6px;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:800;background:rgba(150,110,255,.55);color:#fff;">SERVICE · TESTING</span>' : '')
        + '<div style="margin-top:5px;font-size:14px;font-weight:700;">' + esc(p.title) + '</div>'
        + '<div style="font-size:12px;color:#ffe9a8;">' + (p.price ? esc(p.price) + ' Leo' : 'Negotiable') + ' · ' + (p.count || 1) + ' available</div>'
        + (p.note ? '<div style="font-size:12px;opacity:.8;margin-top:2px;">' + esc(p.note) + '</div>' : '')
        + (svc ? '<div style="font-size:11px;opacity:.65;margin-top:2px;">Testing: delivery / information service. Files: ' + SERVICE_FILES + '.</div>' : '')
        + (canBuy ? '<button class="pill-btn" data-stall2-buy="' + esc(p.id) + '" style="margin-top:7px;">Buy for Leo ' + esc(p.price) + '</button>' : '')
        + '</div>';
    }).join('');
    boardEl.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<b style="font-size:15px;">' + esc(user.stall.name || (user.name + "'s stall")) + '</b>'
      + '<button class="pill-btn" id="stall2-board-close">Close</button></div>'
      + '<div style="font-size:12px;opacity:.75;margin-top:2px;">by ' + esc(user.name || 'Guest') + ' · your Leo: ' + leoBalance() + '</div>'
      + rows;
    document.body.appendChild(boardEl);
    boardEl.querySelector('#stall2-board-close').addEventListener('click', closeBoard);
    boardEl.querySelectorAll('[data-stall2-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var post = user.stall.posts.filter(function (p) { return p.id === btn.getAttribute('data-stall2-buy'); })[0];
        if (!post) return;
        var price = parseInt(post.price, 10) || 0;
        if (leoBalance() < price) { toast('Not enough Leo for ' + post.title); return; }
        if (send({ t: 'stall_buy', to: userId, postId: post.id })) { toast('Asking ' + (user.name || 'the stall') + ' for ' + post.title + '…'); btn.disabled = true; }
        else toast('Not connected');
      });
    });
  }

  /* character menu: add "View stall" for users who run one */
  var ctxObs = new MutationObserver(function () {
    var ctx = document.getElementById('espil-ctx');
    if (!ctx || ctx.style.display !== 'block' || document.getElementById('stall2-ctx-btn')) return;
    var nameEl = ctx.querySelector('b, .ctx-name, [data-name]');
    var st = chatState(); if (!st) return;
    var nm = nameEl ? nameEl.textContent.trim() : '';
    var user = (st.users || []).filter(function (u) { return u && u.id !== st.myId && u.stall && u.name === nm; })[0];
    if (!user) return;
    var b = document.createElement('button');
    b.id = 'stall2-ctx-btn';
    b.textContent = 'View stall';
    b.style.cssText = 'display:block;width:100%;margin-top:6px;';
    b.className = 'pill-btn';
    b.addEventListener('click', function () {
      ctx.style.display = 'none';
      openBoard(user.id);
    });
    ctx.appendChild(b);
  });

  /* ---------- trade settlement ----------------------------------- */
  window.addEventListener('espil-party-frame', function (e) {
    var m = e && e.detail; if (!m || !m.t) return;
    if (m.t === 'stall_buy' && m.from) {
      var s = load(); if (!s || !s.posts) { replySold(m, null, false); return; }
      var post = null;
      s.posts.forEach(function (p) { if (p.id === m.postId) post = p; });
      if (!post || post.side !== 'sell' || (parseInt(post.count, 10) || 1) < 1 || !(parseInt(post.price, 10) > 0)) { replySold(m, post, false); return; }
      post.count = (parseInt(post.count, 10) || 1) - 1;
      if (post.count <= 0) s.posts = s.posts.filter(function (p) { return p !== post; });
      save(s);
      leoSet(leoBalance() + (parseInt(post.price, 10) || 0));
      replySold(m, post, true);
      pushStall(true);
      toast('Sold ' + post.title + ' for Leo ' + post.price);
    }
    if (m.t === 'stall_sold' && m.from) {
      if (!m.ok) { toast('That trade could not be completed'); if (boardEl) { var u = boardUserId; closeBoard(); if (u) openBoard(u); } return; }
      var price = parseInt(m.price, 10) || 0;
      leoSet(Math.max(0, leoBalance() - price));
      if (m.kind === 'service') toast('Service purchased (TESTING): ' + m.title + ' - arrange delivery with the seller. Files: ' + SERVICE_FILES + '.');
      else {
        try { window.dispatchEvent(new CustomEvent('espil-guide', { detail: { type: 'bought', item: m.title } })); } catch (err) {}
        toast('Bought ' + m.title + ' for Leo ' + price);
      }
      if (boardEl) { var u2 = boardUserId; closeBoard(); if (u2) setTimeout(function () { openBoard(u2); }, 350); }
    }
  });
  function replySold(m, post, ok) {
    send({ t: 'stall_sold', to: m.from.id, postId: m.postId, title: post ? post.title : '', price: post ? (parseInt(post.price, 10) || 0) : 0, ok: !!ok, kind: post ? post.kind : 'item' });
  }

  /* ---------- main tick ------------------------------------------ */
  setInterval(function () {
    augmentForm();
    if (document.getElementById('stall2-inv') && Math.random() < 0.2) refreshInvPicker();
    /* normalize legacy posts to carry a count */
    var s = load();
    if (s && s.posts) {
      var dirty = false;
      s.posts.forEach(function (p) { if (!(parseInt(p.count, 10) >= 1)) { p.count = 1; dirty = true; } });
      if (dirty) save(s);
    }
    pushStall(false);
    bubblesTick();
  }, 450);
  window.addEventListener('DOMContentLoaded', function () {
    var ctx = document.getElementById('espil-ctx');
    if (ctx) ctxObs.observe(ctx, { attributes: true, childList: true, subtree: true });
  });

  window.__espilStallView = openBoard;
  window.__espilStall2State = function () {
    var st = chatState();
    return {
      myStall: publicStall(load()),
      pushedSig: pushedSig,
      usersWithStalls: st ? (st.users || []).filter(function (u) { return u && u.stall; }).map(function (u) { return u.name; }) : [],
      boardOpen: !!boardEl,
      bubbles: Object.keys(bubbleEls).length
    };
  };
})();
