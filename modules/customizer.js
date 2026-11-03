
/* __espilCustomizer v1 - the character customizer, completed
   (Han 2026-10-28, espil.online room).

   The entry gate offered only male/female; this module turns the
   #char-custom panel into a real customizer:
   • skin tone (5), hair style (4 per gender), hair colour (9) and
     outfit colour (8), with a live painted preview - the same
     portrait recipe the profile panel and the social card use.
   • The pick is the "look" {skin, hair, hairColor, outfit}. At the
     gate, the world's confirmCharacter merges it into the
     espil_character record via window.__espilPendingLook(). In game,
     the profile window's Customize button reopens the panel in edit
     mode (window.__espilOpenCustomizer): saving rewrites the record
     and re-applies a changed gender in place - no re-entry.
   • The look rides the presence join frame; the Worker sanitizes and
     relays it, so other players' portraits and nameplate accents show
     the same choices. The 3D body is one textured GLB per gender, so
     the look lives on the portrait + nameplate, not the mesh.
   __espilCustomizer END */
(function () {
  'use strict';
  if (window.__espilCustomizer) return;
  window.__espilCustomizer = true;

  var SK = ['#ffe3c2', '#f2c49b', '#dca26b', '#a8703c', '#6f4525'];
  var HC = ['#3a2a1c', '#7a4a2b', '#b3764a', '#e3c188', '#ececec', '#23262b', '#c94f4f', '#4a6ac9', '#5da873'];
  var OF = ['#3f7fbf', '#c94f4f', '#57a773', '#e0a83c', '#7a5fc0', '#e77fc0', '#37b8a5', '#e8e4da'];
  var STYLES = {
    male: {
      en: ['Short', 'Spiky', 'Buzz', 'Swept'], ko: ['짧게', '스파이키', '버즈', '넘김'],
      fr: ['Court', 'Pics', 'Rasé', 'Balayé'], zh: ['短发', '刺头', '圆寸', '侧分']
    },
    female: {
      en: ['Long', 'Bob', 'Ponytail', 'Bun'], ko: ['긴 머리', '단발', '포니테일', '올림머리'],
      fr: ['Longs', 'Carré', 'Queue de cheval', 'Chignon'], zh: ['长发', '波波头', '马尾', '发髻']
    }
  };
  var T = {
    en: { skin: 'SKIN', hair: 'HAIR', hairColor: 'HAIR COLOUR', outfit: 'OUTFIT', save: 'SAVE', saved: 'Look saved' },
    ko: { skin: '피부', hair: '머리', hairColor: '머리 색', outfit: '옷 색', save: '저장', saved: '모습이 저장되었습니다' },
    fr: { skin: 'PEAU', hair: 'CHEVEUX', hairColor: 'COULEUR', outfit: 'TENUE', save: 'ENREGISTRER', saved: 'Apparence enregistrée' },
    zh: { skin: '肤色', hair: '发型', hairColor: '发色', outfit: '服装色', save: '保存', saved: '外观已保存' }
  };
  function lang() { try { return window.__espilLang ? window.__espilLang() : 'en'; } catch (_) { return 'en'; } }
  function t(k) { var L = T[lang()] || T.en; return L[k] || T.en[k] || k; }
  function $(id) { return document.getElementById(id); }

  function clampIdx(v, max, dflt) { return (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max) ? Math.floor(v) : dflt; }
  function sanitize(lk, gender) {
    lk = lk || {};
    return {
      skin: clampIdx(lk.skin, 4, 1),
      hair: clampIdx(lk.hair, 3, 0),
      hairColor: clampIdx(lk.hairColor, 8, gender === 'female' ? 1 : 0),
      outfit: clampIdx(lk.outfit, 7, 0)
    };
  }
  function readRecord() { try { return JSON.parse(localStorage.getItem('espil_character') || 'null'); } catch (_) { return null; } }

  /* ---- the portrait painter (112-space; same recipe as the profile
     panel and the social card) ---- */
  function paintInto(c, gender, look) {
    var lk = look || {};
    var skin = SK[typeof lk.skin === 'number' ? lk.skin : 1] || SK[1];
    var hairCol = HC[typeof lk.hairColor === 'number' ? lk.hairColor : (gender === 'f' ? 1 : 0)] || HC[0];
    var outfit = OF[typeof lk.outfit === 'number' ? lk.outfit : 0] || OF[0];
    var hs = typeof lk.hair === 'number' ? lk.hair : 0;
    var f = (gender === 'f' || gender === 'female');
    c.clearRect(0, 0, 112, 112);
    c.save(); c.beginPath(); c.arc(56, 56, 54, 0, Math.PI * 2); c.clip();
    var grd = c.createLinearGradient(0, 0, 0, 112); grd.addColorStop(0, '#1d4256'); grd.addColorStop(1, '#12242f');
    c.fillStyle = grd; c.fillRect(0, 0, 112, 112);
    c.fillStyle = outfit; c.beginPath(); c.moveTo(22, 112); c.quadraticCurveTo(56, 82, 90, 112); c.closePath(); c.fill();
    c.fillStyle = skin; c.fillRect(50, 74, 12, 16);
    c.beginPath(); c.arc(56, 58, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = hairCol;
    if (f) {
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
    c.restore();
  }

  /* ---- state ---- */
  var pending = { gender: 'male', look: sanitize(null, 'male') };
  var hairColorTouched = false;
  var editMode = false;
  var built = false;
  var box = null, previewCv = null;

  function selectedCardGender() {
    var sel = document.querySelector('.char-card.is-selected');
    return (sel && sel.getAttribute('data-gender') === 'female') ? 'female' : 'male';
  }
  function loadFromRecordOrCards() {
    var rec = readRecord();
    if (rec && (rec.gender === 'female' || rec.gender === 'male')) {
      pending.gender = rec.gender;
      pending.look = sanitize(rec.look, rec.gender);
      hairColorTouched = !!(rec.look && typeof rec.look.hairColor === 'number');
    } else {
      pending.gender = selectedCardGender();
      pending.look = sanitize(null, pending.gender);
      hairColorTouched = false;
    }
  }

  /* ---- UI ---- */
  var CSS = [
    '#espil-cust-box{display:flex;gap:16px;align-items:center;margin-top:16px;text-align:left}',
    '#espil-cust-box .ecb-preview{flex:none}',
    '#espil-cust-preview{width:118px;height:118px;border-radius:50%;border:2px solid #d9b380;background:#12242f;display:block}',
    '#espil-cust-box .ecb-rows{flex:1;display:flex;flex-direction:column;gap:9px;min-width:0}',
    '.ecb-row{display:flex;align-items:center;gap:10px}',
    '.ecb-label{flex:none;width:74px;color:#8a6a3b;font:700 .6rem/1.3 "Manrope",sans-serif;letter-spacing:.12em}',
    '.ecb-opts{display:flex;gap:6px;flex-wrap:wrap}',
    '.ecb-sw{appearance:none;width:24px;height:24px;border-radius:50%;border:2px solid rgba(90,60,20,.35);cursor:pointer;padding:0}',
    '.ecb-sw.on{border-color:#b57708;box-shadow:0 0 0 2px rgba(181,119,8,.45);transform:scale(1.12)}',
    '.ecb-chip{appearance:none;padding:5px 10px;border-radius:999px;border:1.5px solid #cfa96f;background:#fffdf6;color:#6b4a1f;font:700 .62rem/1 "Manrope",sans-serif;letter-spacing:.05em;cursor:pointer}',
    '.ecb-chip.on{border-color:#b57708;color:#6b4a1f;background:linear-gradient(180deg,#ffe9b8,#ffd98c)}',
    '@media (max-width:560px){#espil-cust-box{flex-direction:column}#espil-cust-box .ecb-rows{width:100%}}'
  ].join('\n');

  function swatchRow(rowEl, colors, key) {
    rowEl.innerHTML = '';
    colors.forEach(function (col, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ecb-sw'; b.style.background = col;
      b.setAttribute('data-k', key); b.setAttribute('data-i', String(i));
      b.setAttribute('aria-label', key + ' ' + (i + 1));
      rowEl.appendChild(b);
    });
  }
  function buildUI() {
    if (built) return;
    var panel = $('char-custom'); if (!panel) return;
    var wrap = panel.querySelector('.char-card-wrap'); if (!wrap) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement('div'); box.id = 'espil-cust-box';
    box.innerHTML =
      '<div class="ecb-preview"><canvas id="espil-cust-preview" width="264" height="264"></canvas></div>' +
      '<div class="ecb-rows">' +
      '<div class="ecb-row"><span class="ecb-label" data-lab="skin"></span><div class="ecb-opts" data-row="skin"></div></div>' +
      '<div class="ecb-row"><span class="ecb-label" data-lab="hair"></span><div class="ecb-opts" data-row="hair"></div></div>' +
      '<div class="ecb-row"><span class="ecb-label" data-lab="hairColor"></span><div class="ecb-opts" data-row="hairColor"></div></div>' +
      '<div class="ecb-row"><span class="ecb-label" data-lab="outfit"></span><div class="ecb-opts" data-row="outfit"></div></div>' +
      '</div>';
    var nameInp = $('char-name');
    if (nameInp && nameInp.parentElement === wrap) wrap.insertBefore(box, nameInp.nextSibling);
    else wrap.appendChild(box);
    previewCv = $('espil-cust-preview');
    swatchRow(box.querySelector('[data-row="skin"]'), SK, 'skin');
    swatchRow(box.querySelector('[data-row="hairColor"]'), HC, 'hairColor');
    swatchRow(box.querySelector('[data-row="outfit"]'), OF, 'outfit');
    box.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-k]') : null;
      if (!b) return;
      var k = b.getAttribute('data-k'), i = parseInt(b.getAttribute('data-i'), 10);
      if (isNaN(i)) return;
      if (k === 'hairColor') hairColorTouched = true;
      pending.look[k] = i;
      refresh();
    });
    ['char-male', 'char-female'].forEach(function (id) {
      var card = $(id);
      if (card) card.addEventListener('click', function () {
        var g = card.getAttribute('data-gender') === 'female' ? 'female' : 'male';
        if (g !== pending.gender) {
          pending.gender = g;
          if (!hairColorTouched) pending.look.hairColor = g === 'female' ? 1 : 0;
        }
        refresh();
      });
    });
    /* Edit mode intercepts confirm/back before the world's own
       handlers (capture phase on the panel, stopPropagation). */
    panel.addEventListener('click', function (e) {
      if (!editMode) return;
      var tg = e.target;
      if (tg && tg.closest && tg.closest('#char-confirm')) { e.preventDefault(); e.stopPropagation(); saveEdit(); }
      else if (tg && tg.closest && tg.closest('#char-back')) { e.preventDefault(); e.stopPropagation(); closeEdit(); }
    }, true);
    built = true;
  }

  function refresh() {
    if (!built) buildUI();
    if (!box) return;
    var L = lang();
    box.querySelectorAll('.ecb-label').forEach(function (el) { el.textContent = t(el.getAttribute('data-lab')); });
    /* hair style chips follow the gender */
    var hairRow = box.querySelector('[data-row="hair"]');
    var names = (STYLES[pending.gender] || STYLES.male)[L] || STYLES[pending.gender].en;
    var cur = Array.prototype.map.call(hairRow.children, function (ch) { return ch.textContent; }).join('|');
    if (cur !== names.join('|')) {
      hairRow.innerHTML = '';
      names.forEach(function (nm, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'ecb-chip'; b.textContent = nm;
        b.setAttribute('data-k', 'hair'); b.setAttribute('data-i', String(i));
        hairRow.appendChild(b);
      });
    }
    box.querySelectorAll('[data-k]').forEach(function (b) {
      var k = b.getAttribute('data-k');
      b.classList.toggle('on', pending.look[k] === parseInt(b.getAttribute('data-i'), 10));
    });
    if (previewCv) {
      var c = previewCv.getContext('2d');
      if (c) { var s = 264 / 112; c.setTransform(s, 0, 0, s, 0, 0); paintInto(c, pending.gender, pending.look); c.setTransform(1, 0, 0, 1, 0, 0); }
    }
    if (editMode) { var cf = $('char-confirm'); if (cf) cf.textContent = t('save'); }
  }

  /* ---- edit mode (in-game re-customization) ---- */
  function closeEdit() {
    var panel = $('char-custom');
    if (panel) panel.setAttribute('aria-hidden', 'true');
    var ni = $('char-name'); if (ni) ni.style.display = '';
    editMode = false;
    /* resync the world's confirm label for the gate flow */
    var card = $(pending.gender === 'female' ? 'char-female' : 'char-male');
    if (card) card.click();
  }
  function saveEdit() {
    var rec = readRecord() || {};
    rec.gender = pending.gender;
    rec.look = sanitize(pending.look, pending.gender);
    rec.ts = Date.now();
    try { localStorage.setItem('espil_character', JSON.stringify(rec)); } catch (_) {}
    try { if (window.__espilApplyAvatarGender) window.__espilApplyAvatarGender(pending.gender); } catch (_) {}
    closeEdit();
    try { if (window.__espilToast) window.__espilToast(t('saved')); } catch (_) {}
  }
  window.__espilOpenCustomizer = function () {
    buildUI();
    loadFromRecordOrCards();
    editMode = true;
    var ni = $('char-name'); if (ni) ni.style.display = 'none';
    var panel = $('char-custom');
    refresh();
    if (panel) panel.setAttribute('aria-hidden', 'false');
  };

  /* ---- gate flow wiring ---- */
  window.__espilPendingLook = function () { return sanitize(pending.look, pending.gender); };
  window.__espilOutfitHex = function (i) { return OF[clampIdx(i, 7, 0)]; };
  window.__espilPaintLook = function (cv, gender, look) {
    if (!cv) return;
    var c = cv.getContext('2d'); if (!c) return;
    paintInto(c, gender, look);
  };
  window.__espilCustomizerState = function () {
    return { built: built, editMode: editMode, gender: pending.gender, look: sanitize(pending.look, pending.gender) };
  };

  function watchPanel() {
    var panel = $('char-custom');
    if (!panel) { setTimeout(watchPanel, 600); return; }
    buildUI();
    loadFromRecordOrCards();
    refresh();
    new MutationObserver(function () {
      var open = panel.getAttribute('aria-hidden') === 'false';
      if (open && !editMode) { loadFromRecordOrCards(); refresh(); }
      if (!open && editMode) { var ni = $('char-name'); if (ni) ni.style.display = ''; editMode = false; }
    }).observe(panel, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchPanel);
  else watchPanel();
})();
/* __espilCustomizer END */

