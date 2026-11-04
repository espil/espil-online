/* __espilCustomizer v1 - character look DATA hooks only.
   History: this module was the pair's own look customizer
   (Han 2026-10-28): it injected skin-tone / hair-style /
   hair-colour / outfit-colour pickers into the #char-custom gate
   panel, with a live painted preview, and an in-game edit mode
   behind the profile window's Customize button
   (window.__espilOpenCustomizer).
   Han 2026-11-04: that selection UI is REMOVED - the web
   character step is the REAL default character with the male /
   female cards only. No face, hairstyle or clothes selection
   remains anywhere in the web flow, and no editor opens from
   any trigger. What stays in this module is data support only:
   • window.__espilPendingLook() now returns the DEFAULT look
     for the gender picked on the cards, so the gate's confirm
     keeps writing the espil_character record in its usual shape
     ({gender, name, look, ts}) with default values.
   • window.__espilPaintLook / __espilOutfitHex stay as pure
     painters of a SAVED record's look (the profile portrait,
     the nameplate accent for peers) - they render data, they
     select nothing.
   • window.__espilOpenCustomizer stays defined as a NO-OP, so
     the profile Customize button and the custmerge wrapper land
     on a dead end instead of an editor.
   The v3 customizer merge (custmerge.js + customizer.html) is
   suspended separately by its own flag (Batch D2) and is not
   touched here. __espilCustomizer END */
(function () {
  'use strict';
  if (window.__espilCustomizer) return;
  window.__espilCustomizer = true;

  var SK = ['#ffe3c2', '#f2c49b', '#dca26b', '#a8703c', '#6f4525'];
  var HC = ['#3a2a1c', '#7a4a2b', '#b3764a', '#e3c188', '#ececec', '#23262b', '#c94f4f', '#4a6ac9', '#5da873'];
  var OF = ['#3f7fbf', '#c94f4f', '#57a773', '#e0a83c', '#7a5fc0', '#e77fc0', '#37b8a5', '#e8e4da'];

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

  /* ---- the portrait painter (112-space; same recipe as the
     profile panel and the social card) - renders a saved look,
     unchanged from the selection era ---- */
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

  function selectedCardGender() {
    var sel = document.querySelector('.char-card.is-selected');
    return (sel && sel.getAttribute('data-gender') === 'female') ? 'female' : 'male';
  }
  function defaultLook(gender) { return sanitize(null, gender); }

  /* ---- data hooks (no UI is built, no editor ever opens) ---- */
  window.__espilPendingLook = function () { return defaultLook(selectedCardGender()); };
  window.__espilOutfitHex = function (i) { return OF[clampIdx(i, 7, 0)]; };
  window.__espilPaintLook = function (cv, gender, look) {
    if (!cv) return;
    var c = cv.getContext('2d'); if (!c) return;
    paintInto(c, gender, look);
  };
  window.__espilOpenCustomizer = function () { return false; };
  window.__espilCustomizerState = function () {
    var g = selectedCardGender();
    return { built: false, editMode: false, suspended: true, gender: g, look: defaultLook(g) };
  };
})();
/* __espilCustomizer END */
