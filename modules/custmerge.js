
/* __espilCustMerge v1 - the Character Customizer room's v3 creation
   window, merged into espil.online (Han 2026-10-30).

   The pair's character gate no longer shows its own basic panel
   first: gateCharacter() calls window.__espilCustMergeGate(), which
   opens the v3 customizer (customizer.html, layered 2D art from the
   customizer room) in a fullscreen iframe. Its Create button writes
   the espil character record itself (gender, name, look2 = the
   v0.2 JSON, a mapped pair look, and a rendered portrait) and posts
   espil-cust-done; this module then drives the pair's own confirm
   path (card click + #char-confirm) so the location pick and the
   loading sequence follow exactly as before, and restores the full
   record the customizer wrote (the pair confirm rewrites the record
   with only its own fields). The profile's Customize button routes
   to the same window with from=profile.
   Fallbacks stay honest: the overlay carries a button back to the
   pair's basic gender choice (gate) or the pair's own edit panel
   (profile) if the customizer cannot be used.
   The saved portrait feeds the two painted faces: the MMO status
   medallion (mmo_hud_module's paintFace prefers
   window.__espilPortraitImg) and the self-profile canvas (overdrawn
   here while it exists). The in-map 3D avatar remains the gender
   model, as the web avatar has always been. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function readRec() { try { return JSON.parse(localStorage.getItem('espil_character') || 'null'); } catch (e) { return null; } }

  var st = document.createElement('style');
  st.textContent = [
    '#espil-custmerge{position:fixed;inset:0;z-index:500;background:#0d1512;display:none}',
    '#espil-custmerge.open{display:block}',
    '#espil-custmerge iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#79c7d8}',
    '#espil-custmerge-fallback{position:absolute;left:14px;top:14px;z-index:2;padding:9px 16px;border-radius:999px;border:2px solid #d9b380;background:linear-gradient(180deg,#fffbf0,#fff3dc);color:#5a4020;font:700 13px Manrope,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}'
  ].join('');
  document.head.appendChild(st);

  /* ---- portrait sync (medallion + profile painters read it) ----- */
  var lastPortrait = null;
  function syncPortrait() {
    var rec = readRec();
    var p = rec && rec.portrait ? rec.portrait : null;
    if (p === lastPortrait) return;
    lastPortrait = p;
    if (!p) { window.__espilPortraitImg = null; return; }
    var im = new Image();
    im.src = p;
    window.__espilPortraitImg = im;
  }
  syncPortrait();
  setInterval(syncPortrait, 1500);
  window.addEventListener('storage', syncPortrait);

  /* ---- self-profile face: paint the portrait over the canvas ---- */
  setInterval(function () {
    var img = window.__espilPortraitImg;
    if (!img || !img.complete || !img.naturalWidth) return;
    var cv = $('espil-profile-face');
    if (!cv || !cv.getContext) return;
    var c = cv.getContext('2d'); if (!c) return;
    c.save();
    c.beginPath(); c.arc(56, 56, 55, 0, Math.PI * 2); c.clip();
    var grd = c.createLinearGradient(0, 0, 0, 112);
    grd.addColorStop(0, '#d9edf0'); grd.addColorStop(1, '#faf3e0');
    c.fillStyle = grd; c.fillRect(0, 0, 112, 112);
    var sc = Math.max(112 / img.naturalWidth, 112 / img.naturalHeight);
    c.drawImage(img, (112 - img.naturalWidth * sc) / 2, (112 - img.naturalHeight * sc) / 2, img.naturalWidth * sc, img.naturalHeight * sc);
    c.restore();
  }, 800);

  /* ---- overlay --------------------------------------------------- */
  var overlay = null, frame = null, mode = null, doneHandled = false;
  var origOpenCustomizer = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'espil-custmerge';
    var fb = document.createElement('button');
    fb.id = 'espil-custmerge-fallback';
    fb.type = 'button';
    overlay.appendChild(fb);
    frame = document.createElement('iframe');
    frame.id = 'espil-custmerge-frame';
    frame.setAttribute('title', 'Character customizer');
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
    fb.addEventListener('click', function () {
      var m = mode;
      closeOverlay();
      if (m === 'gate') {
        gateFallbackOpen = true;
        var panel = $('char-custom');
        if (panel) panel.setAttribute('aria-hidden', 'false');
      } else if (m === 'profile' && origOpenCustomizer) {
        origOpenCustomizer();
      }
    });
    return overlay;
  }
  function openOverlay(m) {
    mode = m;
    doneHandled = false;
    ensureOverlay();
    var fb = overlay.querySelector('#espil-custmerge-fallback');
    if (fb) fb.textContent = (m === 'gate') ? '기본 선택으로 계속하기' : '닫기';
    frame.src = 'customizer.html?from=' + m;
    overlay.classList.add('open');
    return true;
  }
  function closeOverlay() {
    if (overlay) overlay.classList.remove('open');
    if (frame) { try { frame.removeAttribute('src'); frame.blur(); } catch (_) {} }
    /* Return keyboard focus to the page: without this the (now
       blank) iframe keeps focus after the gate and the arrow keys
       are dead until the user clicks the view (found by the rig,
       2026-11-02 - the tutorial probe walked 0.0 m). */
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (_) {}
    mode = null;
  }
  /* Han 2026-11-02: a character created in the customizer is
     registered to the account (espil_accounts_v1[id].character,
     written by the merge layer at Create). At the gate, the signed-in
     account's registered character becomes the working record, so on
     later sign-ins it loads as the default and pre-fills the
     customizer. Guests and accounts without a character keep the
     device record as-is. */
  function adoptAccountCharacter() {
    try {
      var ses = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      if (!ses || !ses.id) return;
      var accs = JSON.parse(localStorage.getItem('espil_accounts_v1') || '{}');
      var acc = accs[ses.id] || accs[String(ses.id).toLowerCase()];
      if (!acc || !acc.character) return;
      var cur = null;
      try { cur = JSON.parse(localStorage.getItem('espil_character') || 'null'); } catch (e) {}
      if (cur && cur.look2 && JSON.stringify(cur.look2) === JSON.stringify(acc.character)) return;
      var rec = cur || {};
      rec.gender = acc.character.gender || rec.gender;
      rec.name = acc.character.name || rec.name;
      rec.look2 = acc.character;
      if (acc.look) rec.look = acc.look;
      if (acc.portrait) rec.portrait = acc.portrait;
      rec.ts = Date.now();
      localStorage.setItem('espil_character', JSON.stringify(rec));
    } catch (e) {}
  }
  window.__espilCustMergeGate = function () { adoptAccountCharacter(); return openOverlay('gate'); };
  window.__espilCustMergeGoEdit = function () { adoptAccountCharacter(); return openOverlay('profile'); };

  /* ---- profile Customize routes here (basic panel = fallback) --- */
  (function wrapOpen() {
    if (window.__espilOpenCustomizer && !window.__espilOpenCustomizer.__custWrapped) {
      origOpenCustomizer = window.__espilOpenCustomizer;
      var w = function () { if (window.__espilCustMergeGoEdit()) return; origOpenCustomizer(); };
      w.__custWrapped = true;
      window.__espilOpenCustomizer = w;
    } else if (!window.__espilOpenCustomizer) { setTimeout(wrapOpen, 700); }
  })();

  /* ---- gate rescue -------------------------------------------------
     gateCharacter() runs the moment the login gate completes, which
     on a slow parse of the pair can be BEFORE this body-end module
     has executed: window.__espilCustMergeGate is still undefined at
     that moment, the guard in gateCharacter falls through, and the
     pair's basic panel opens instead of the customizer (reproduced
     in the rig: readyState 'loading', panel open, overlay never).
     As soon as this module is alive, take such a gate over: close
     the panel and open the customizer. The fallback button's own
     panel opening is deliberate (gateFallbackOpen) and is never
     rescued, and an in-map panel is the profile edit surface, not
     the gate. */
  var gateFallbackOpen = false, gateRescued = false;
  setInterval(function () {
    if (gateRescued || gateFallbackOpen || mode) return;
    if (document.body.classList.contains('in-map')) return;
    var panel = $('char-custom');
    if (panel && panel.getAttribute('aria-hidden') === 'false') {
      gateRescued = true;
      panel.setAttribute('aria-hidden', 'true');
      openOverlay('gate');
    }
  }, 400);

  /* ---- the customizer's Create result ---------------------------- */
  /* Two completion signals exist for one Create: this room's layer
     posts espil-cust-done after saving, and the customizer app itself
     posts its embed contract {type:'zealandia-character', data}
     (customizer room, 2026-11-02). Both are accepted; the completion
     runs once (doneHandled), and for the embed contract the pair is
     the receiver that saves data to the account, per the handoff. */
  function persistEmbedData(data) {
    if (!data || data.spec !== 'zealandia-customizer v0.2') return;
    try {
      var rec = readRec() || {};
      rec.gender = data.gender || rec.gender;
      rec.name = data.name || rec.name;
      rec.look2 = data;
      rec.ts = Date.now();
      localStorage.setItem('espil_character', JSON.stringify(rec));
      var ses = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      if (ses && ses.id) {
        var accs = JSON.parse(localStorage.getItem('espil_accounts_v1') || '{}');
        var key = accs[ses.id] ? ses.id : String(ses.id).toLowerCase();
        if (accs[key]) {
          accs[key].character = data;
          if (rec.look) accs[key].look = rec.look;
          if (rec.portrait) accs[key].portrait = rec.portrait;
          accs[key].characterTs = Date.now();
          localStorage.setItem('espil_accounts_v1', JSON.stringify(accs));
        }
      }
    } catch (_) {}
  }
  function onCustDone(m) {
    if (doneHandled) return;
    doneHandled = true;
    var recRaw = null;
    try { recRaw = localStorage.getItem('espil_character'); } catch (_) {}
    closeOverlay();
    syncPortrait();
    if (m === 'gate') {
      var rec = readRec();
      var g = rec && rec.gender === 'female' ? 'female' : 'male';
      var card = $(g === 'female' ? 'char-female' : 'char-male');
      if (card) card.click();
      var cf = $('char-confirm');
      if (cf) cf.click();
      if (recRaw) {
        var keep = recRaw;
        setTimeout(function () {
          try { localStorage.setItem('espil_character', keep); } catch (_) {}
          syncPortrait();
        }, 120);
      }
    }
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    var d = e.data || {};
    if (d.type === 'zealandia-character') { persistEmbedData(d.data); onCustDone(mode || 'gate'); return; }
    if (d.type !== 'espil-cust-done') return;
    onCustDone(mode || d.from);
  });

  window.__espilCustMergeState = function () {
    return { open: !!(overlay && overlay.classList.contains('open')), mode: mode, portrait: !!lastPortrait };
  };
})();
/* __espilCustMerge END */

