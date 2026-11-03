
/* __espilPanels v1 - profile (P) + inventory (I) content on ONE shared
   equipment model (live feedback items 5+6). The build already ships
   both panels (.skill-tree skin, subtitles, I key + close wiring); what
   was missing is the content: the owned-items mirror (the UI room's
   stall bridge logic, integrated here) rendered into #inv-grid, and a
   real profile in #char-grid. The world's P toggle is disabled by the
   2026-10-18 character-custom-off flag, so P is handled here as a
   profile VIEW (customisation itself stays off). __espilPanels END */
(function () {
  'use strict';
  var LS_OWN = 'espil_owned_items', LS_EQ = 'espil_equipped';
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ownedList() { try { var a = JSON.parse(localStorage.getItem(LS_OWN) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveOwned(a) { try { localStorage.setItem(LS_OWN, JSON.stringify(a)); } catch (e) {} }
  function ownedCounts() { var m = {}, order = []; ownedList().forEach(function (n) { if (!(n in m)) order.push(n); m[n] = (m[n] || 0) + 1; }); return order.map(function (n) { return { name: n, n: m[n] }; }); }
  function equippedMap() { try { var o = JSON.parse(localStorage.getItem(LS_EQ) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function saveEq(m) { try { localStorage.setItem(LS_EQ, JSON.stringify(m)); } catch (e) {} }
  var SLOT_DEFS = [
    { key: 'weapon', label: 'WEAPON', re: /sword|blade|bow|staff|wand|axe|dagger|spear|hammer|mace|gun|pistol/i },
    { key: 'head', label: 'HEAD', re: /hat|helm|hood|cap|crown|circlet/i },
    { key: 'body', label: 'BODY', re: /armor|armour|robe|coat|shirt|vest|outfit|suit|tunic/i },
    { key: 'accessory', label: 'ACCESSORY', re: /ring|amulet|necklace|charm|bracelet|gem|pendant/i }
  ];
  function slotOf(name) { for (var i = 0; i < SLOT_DEFS.length; i++) if (SLOT_DEFS[i].re.test(name)) return SLOT_DEFS[i].key; return null; }
  function equip(name) { var s = slotOf(name); if (!s) return null; var m = equippedMap(); m[s] = name; saveEq(m); renderInv(); renderProfile(); return s; }
  function unequip(slot) { var m = equippedMap(); delete m[slot]; saveEq(m); renderInv(); renderProfile(); }
  window.__espilGear = { owned: ownedCounts, equipped: equippedMap, slotOf: slotOf, equip: equip, unequip: unequip };

  /* purchase mirror: the shop fires espil-guide 'bought' (the UI room
     bridge semantics) - record the item so the inventory shows it */
  window.addEventListener('espil-guide', function (e) {
    var d = e.detail || {}; if (d.__fromGuide) return;
    if (d.type === 'bought' && d.item) { var a = ownedList(); a.push(String(d.item)); saveOwned(a); renderInv(); }
  });

  var CELL = 'border:1px solid rgba(134,238,228,.3);border-radius:8px;padding:10px;background:rgba(20,60,60,.35);color:#ddfffc;font-size:13px;';
  function renderInv() {
    var g = document.getElementById('inv-grid'); if (!g) return;
    var cs = ownedCounts(), eq = equippedMap();
    g.innerHTML = '';
    if (!cs.length) { g.innerHTML = '<p class="st-foot">Empty for now.</p>'; return; }
    cs.forEach(function (it) {
      var slot = slotOf(it.name), isEq = slot && eq[slot] === it.name;
      var d = document.createElement('div');
      d.style.cssText = CELL + (isEq ? 'outline:2px solid #ffd97a;' : '') + (slot ? 'cursor:pointer;' : '');
      d.innerHTML = esc(it.name) + (it.n > 1 ? ' <span style="opacity:.75">x ' + it.n + '</span>' : '') +
        (isEq ? ' <span style="color:#ffd97a;font-size:11px">EQUIPPED</span>' : (slot ? ' <span style="opacity:.65;font-size:11px">click to equip</span>' : ''));
      if (slot) d.addEventListener('click', function () { if (isEq) unequip(slot); else equip(it.name); });
      g.appendChild(d);
    });
  }

  function myInfo() {
    var name = 'Guest'; try { name = localStorage.getItem('espil_username') || 'Guest'; } catch (e) {}
    var gender = 'm'; try { var rec = JSON.parse(localStorage.getItem('espil_character') || 'null'); if (rec && rec.gender === 'female') gender = 'f'; } catch (e) {}
    var leo = 1000; try { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); if (!isNaN(v)) leo = v; } catch (e) {}
    var city = null;
    try { var st = window.__espilChatState && window.__espilChatState(); if (st && st.room) city = st.room.charAt(0).toUpperCase() + st.room.slice(1); } catch (e) {}
    var look = null; try { var rec2 = JSON.parse(localStorage.getItem('espil_character') || 'null'); if (rec2 && rec2.look) look = rec2.look; } catch (e) {}
    return { name: name, gender: gender, leo: leo, city: city, look: look };
  }
  function paintAvatar(cv, gender, look) {
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
  function renderProfile() {
    var g = document.getElementById('char-grid'); if (!g) return;
    var info = myInfo(), eq = equippedMap();
    g.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'grid-column:1/-1;display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;';
    var left = document.createElement('div');
    left.style.cssText = 'text-align:center;flex:none;';
    left.innerHTML = '<canvas id="espil-profile-face" width="112" height="112" style="width:96px;height:96px;border-radius:50%;border:2px solid rgba(142,247,232,.5);background:#17303a;"></canvas>' +
      '<div style="margin-top:8px;color:#ffd97a;font-weight:700">' + esc(info.name) + '</div>' +
      '<div style="font-size:12px;opacity:.8">' + (info.gender === 'f' ? 'Female' : 'Male') + '</div>' +
      '<button id="espil-profile-custom" type="button" style="margin-top:10px;padding:6px 16px;border-radius:999px;border:1px solid rgba(201,168,106,.85);background:rgba(201,168,106,.16);color:#ffd97a;font:700 12px Manrope,sans-serif;letter-spacing:.06em;cursor:pointer">Customize</button>';
    var right = document.createElement('div');
    right.style.cssText = 'flex:1;min-width:220px;';
    var slots = SLOT_DEFS.map(function (sd) {
      var item = eq[sd.key];
      return '<div data-slot="' + sd.key + '" style="' + CELL + (item ? 'outline:2px solid #ffd97a;cursor:pointer;' : '') + 'margin-bottom:8px">' +
        '<span style="color:#ffd97a;font-size:11px;letter-spacing:.08em">' + sd.label + '</span><br>' +
        (item ? esc(item) + ' <span style="opacity:.65;font-size:11px">click to unequip</span>' : '<span style="opacity:.6">Empty</span>') + '</div>';
    }).join('');
    right.innerHTML = slots +
      '<p class="st-foot" style="margin:6px 0 0">Leo Coin: ' + info.leo + (info.city ? ' &middot; Now in: ' + esc(info.city) : '') + '</p>';
    wrap.appendChild(left); wrap.appendChild(right);
    g.appendChild(wrap);
    var cv = document.getElementById('espil-profile-face');
    if (cv) paintAvatar(cv, info.gender, info.look);
    var cb = document.getElementById('espil-profile-custom');
    if (cb) cb.addEventListener('click', function () { toggleProfile(false); if (window.__espilOpenCustomizer) window.__espilOpenCustomizer(); });
    Array.prototype.forEach.call(right.querySelectorAll('[data-slot]'), function (el) {
      el.addEventListener('click', function () { var s = el.getAttribute('data-slot'); if (equippedMap()[s]) unequip(s); });
    });
  }

  /* render each panel as it opens (the world toggles aria-hidden) */
  function watch(panelId, fn) {
    var p = document.getElementById(panelId); if (!p) return;
    new MutationObserver(function () { if (p.getAttribute('aria-hidden') === 'false') fn(); })
      .observe(p, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
  watch('inventory-panel', function () { var p = charPanel(); if (p) p.setAttribute('aria-hidden', 'true'); renderInv(); });
  watch('character-panel', renderProfile);

  /* P opens the profile view (the world's own P toggle stays disabled
     with character custom, per the 2026-10-18 flag - this only flips
     the panel + renders; the close button and backdrop click already
     wired by the world call toggleCharacterPanel(false), which works) */
  function charPanel() { return document.getElementById('character-panel'); }
  function toggleProfile(force) {
    var p = charPanel(); if (!p) return;
    var open = typeof force === 'boolean' ? force : p.getAttribute('aria-hidden') !== 'false';
    if (open) { var ip = document.getElementById('inventory-panel'); if (ip) ip.setAttribute('aria-hidden', 'true'); renderProfile(); }
    p.setAttribute('aria-hidden', String(!open));
  }
  document.addEventListener('keydown', function (e) {
    var ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var k = (e.key || '').toLowerCase();
    /* P moved to the Party/Friend window (Han 2026-10-27,
       __espilSocial); the self profile opens from the right-click
       menu on your own character instead. */
    if (k === 'escape') { var p = charPanel(); if (p && p.getAttribute('aria-hidden') === 'false') toggleProfile(false); }
  });
  window.__espilPanelsState = function () {
    return { owned: ownedCounts(), equipped: equippedMap(),
             profileOpen: (charPanel() || {}).getAttribute ? charPanel().getAttribute('aria-hidden') === 'false' : false };
  };
  window.__espilOpenSelfProfile = function () { toggleProfile(true); };
})();
/* __espilPanels END */

