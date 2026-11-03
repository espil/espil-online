
/* __espilMMOHud v1 - the in-game UI in Zealandia's own skin.
   First mirror (2026-10-30 morning): the client's cream storybook
   skin + its v36 wooden tray. Second mirror (Han, 2026-10-30
   evening: "zealandia의 UI도 가져와주세요"): the client's CURRENT
   bottom bar as it stands in zealandia-client (z.css + the
   paintTrayShape geometry in its game.js) -
   - the tray is a LOG: an inline SVG under the centre panel whose
     outline follows each flask's margin circle (orb radius + 26)
     and joins the tray edges where the circle crosses them, filled
     with the client's own log texture (assets/tex/logwood.jpg,
     copied from the client) over a #6d4c2c under-path, stroke
     #3a2817; the centre panel itself is transparent and only casts
     a drop-shadow in the tray's silhouette;
   - left: the shortcut rows as the keys column (5px pitch);
   - right column, dropped one row (margin-top 44px) and pushed
     right (margin-left 14px): the menu as ONE row of 34px round
     pastel buttons (icon showing, name hidden, key letter as a
     dark corner badge) over the level gauge - a dark Lv-style pill
     (espil's pill carries the city name) and a green track whose
     fill and text are espil's real tutorial progress + position
     (no values are invented);
   - flasks 112px, OUTSIDE the tray, painted above it (z-index 2),
     showing the game's own percentages;
   - the whole cluster centred, scaled to 80%, flush with the
     bottom edge (bottom 0, no margin);
   - chat transparent in the client's values (rgba(10,10,16,.16),
     light text) above the bar, and a dark location pill above the
     circular minimap in the client's #z-loc form (city name only -
     espil has no channels).
   Kept from the first pass: the cream storybook panels/minimap,
   the status cluster (portrait from the character record - since
   the customizer merge it prefers the v3 portrait art - name, real
   Leo balance), and the completed MAP / CHAR menu buttons (real
   map-stage cycle, real self-profile). On touch screens the bar
   keeps the first pass's plain wooden tray (the client uses a
   different touch layout entirely; a dedicated mobile pass is a
   separate job). */
(function () {
  'use strict';
  if (window.__espilMMOHud) return;
  window.__espilMMOHud = true;

  var st = document.createElement('style');
  st.id = 'espil-mmo-hud-style';
  st.textContent =
    /* ---- quickbar: the client's current bottom bar (fine pointers) - */
    '@media (pointer:fine){' +
      '#quickbar{display:flex;align-items:flex-end;gap:12px;left:50%;right:auto;' +
        'transform:translateX(-50%) scale(.8);transform-origin:bottom center;' +
        'bottom:0;margin-bottom:0;' +
        'background:transparent;border:none;box-shadow:none;' +
        'backdrop-filter:none;-webkit-backdrop-filter:none;padding:0 4px}' +
      /* the centre panel is transparent: the log SVG is its skin */
      '#quickbar .kb-main{position:relative;display:flex;flex-direction:row;flex-wrap:nowrap;' +
        'width:max-content;max-width:97vw;align-items:flex-start;gap:10px;order:2;padding:10px 12px;' +
        'background:none;border-color:transparent;border-radius:18px;box-shadow:none;' +
        'filter:drop-shadow(0 12px 16px rgba(20,10,0,.45))}' +
      '#espil-tray{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;overflow:visible}' +
      '#quickbar .mmo-keys{display:flex;flex-direction:column;gap:5px;position:relative;z-index:1;flex:none}' +
      '#quickbar .kb-main #item-row{display:flex;gap:5px}' +
      '#quickbar .kb-main #move-row{display:flex;gap:5px}' +
      /* right column: dropped one row, pushed right (client values) */
      '#espil-right{display:flex;flex-direction:column;gap:10px;justify-content:flex-start;' +
        'position:relative;z-index:1;flex:none;margin-top:44px;margin-left:14px}' +
      '#quickbar .kb-main #kb-menu{display:flex;gap:5px;order:0;flex:none}' +
      '#quickbar #hp-flask-wrap{order:1}#quickbar #mp-flask-wrap{order:3}' +
      '#quickbar .flask-wrap{position:relative;z-index:2;width:118px;height:auto;background:none;border-radius:50%}' +
      '#quickbar .flask{width:112px;height:112px;border:2px solid rgba(255,255,255,.75);' +
        'box-shadow:0 8px 20px rgba(40,25,8,.35)}' +
      '#quickbar .flask .pct{display:flex;font-size:20px}' +
      /* menu: one row of 34px round pastels, icon shown, key badged */
      '#quickbar #kb-menu .move-slot{position:relative;width:34px;height:34px;min-width:34px;border-radius:50%;' +
        'padding:0;display:flex;align-items:center;justify-content:center;' +
        'border:2px solid #b98a4a;box-shadow:0 3px 6px rgba(30,15,0,.35),inset 0 1px 2px rgba(255,255,255,.9);' +
        'background:radial-gradient(circle at 33% 28%,#fffdf4,#ffe9b8 58%,#f5cf87)}' +
      '#quickbar #kb-menu .move-slot .sicon{font-size:15px;line-height:1}' +
      '#quickbar #kb-menu .move-slot .mn{display:none}' +
      '#quickbar #kb-menu .move-slot .key{position:absolute;top:-5px;left:-5px;z-index:2;min-width:15px;height:15px;' +
        'padding:0 3px;border-radius:8px;background:#3a2817;color:#ffe9a8;font-size:9px;font-weight:800;' +
        'display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,233,168,.5)}' +
      '#quickbar #kb-menu .move-slot.mmo-set-icon .key{position:static;min-width:0;height:auto;padding:0;' +
        'border-radius:0;background:none;border:none;color:#6b4a1f;font-size:15px}' +
      '#quickbar #kb-menu .move-slot:nth-child(2){background:radial-gradient(circle at 33% 28%,#ffffff,#cfe6ff 58%,#9cc4ee);border-color:#6d94bd}' +
      '#quickbar #kb-menu .move-slot:nth-child(3){background:radial-gradient(circle at 33% 28%,#ffffff,#d8f3c8 58%,#a5d68d);border-color:#77a75c}' +
      '#quickbar #kb-menu .move-slot:nth-child(4){background:radial-gradient(circle at 33% 28%,#ffffff,#ffd9e4 58%,#f2a9c0);border-color:#bd7d95}' +
      '#quickbar #kb-menu .move-slot:nth-child(5){background:radial-gradient(circle at 33% 28%,#ffffff,#e6dcff 58%,#bda9ec);border-color:#8d7ab8}' +
      '#quickbar #kb-menu .move-slot:nth-child(6){background:radial-gradient(circle at 33% 28%,#ffffff,#e8e8e8 58%,#c2c2c2);border-color:#8a8a8a}' +
      /* the gauge: city pill + green track (client #z-expbar form) */
      '#espil-mmo-strip{position:relative;left:auto;transform:none;bottom:auto;width:268px;height:auto;' +
        'display:flex;align-items:center;gap:8px;background:none;border:none;box-shadow:none;overflow:visible;z-index:1}' +
      '#espil-mmo-city{background:#3a2817;color:#ffe9a8;font-size:11px;font-weight:800;letter-spacing:.04em;' +
        'padding:3px 8px;border-radius:9px;border:1px solid rgba(255,233,168,.4);white-space:nowrap;max-width:96px;' +
        'overflow:hidden;text-overflow:ellipsis}' +
      '#espil-mmo-track{flex:1;height:14px;background:#2c1d10;border:2px solid #17100a;border-radius:8px;' +
        'position:relative;overflow:hidden}' +
      '#espil-mmo-fill{position:absolute;left:0;top:0;bottom:0;width:0%;' +
        'background:linear-gradient(180deg,#b2e67e,#69b93a);transition:width .6s ease}' +
      '#espil-mmo-zone{position:absolute;inset:0;text-align:center;font-size:10px;font-weight:700;' +
        'line-height:11px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.65);letter-spacing:.02em}' +
    '}' +
    /* ---- quickbar on touch screens: first-pass wooden tray --------- */
    '@media (pointer:coarse){' +
      '#quickbar{background:linear-gradient(180deg,#7c5a36,#5e4023);' +
        'border:3px solid #3a2817;box-shadow:0 12px 28px rgba(40,25,8,.4)}' +
      '#quickbar .flask .pct{display:block;font-size:8.5px}' +
      '#espil-mmo-strip{display:none}' +
      '#espil-tray{display:none}' +
    '}' +
    /* ---- slots: cream storybook ------------------------------------ */
    '#quickbar .move-slot{background:linear-gradient(180deg,#fffdf6,#ffeecd);' +
      'border:2px solid #cfa96f;border-radius:12px;color:#6b4a1f;' +
      'box-shadow:inset 0 -3px 0 rgba(207,169,111,.35),0 2px 4px rgba(90,60,20,.16);text-shadow:none}' +
    '#quickbar .mmo-keys .move-slot .key{color:#b3854d;text-shadow:none}' +
    '#quickbar .move-slot .mn{color:#8a6a3b;text-shadow:none}' +
    '#quickbar .move-slot .cd{color:#a05a2c}' +
    '#quickbar .move-slot:hover{border-color:#b57708}' +
    '#quickbar .move-slot.is-locked{background:linear-gradient(180deg,#f1ebdb,#e6ddc9);' +
      'border-color:#c9bb9d;opacity:.62;box-shadow:none}' +
    /* ---- minimap: circular, gold rim (stages 1-2) ------------------- */
    '#minimap-wrap[data-stage="1"],#minimap-wrap[data-stage="2"]{border:3px solid #e7c88f;' +
      'border-radius:50%;overflow:hidden;box-shadow:0 8px 20px rgba(90,60,20,.3)}' +
    /* ---- location pill above the minimap (client #z-loc form) ------- */
    '#espil-loc{position:fixed;top:calc(30px + env(safe-area-inset-top));right:14px;width:148px;z-index:31;' +
      'pointer-events:none;text-align:center;font-family:"Manrope",sans-serif;font-size:13.5px;font-weight:700;' +
      'letter-spacing:.02em;color:#fff6e0;background:rgba(24,18,10,.52);' +
      'border:1.5px solid rgba(231,200,143,.65);border-radius:999px;padding:5px 4px;' +
      'text-shadow:0 1px 2px rgba(0,0,0,.5)}' +
    'body:not(.in-map) #espil-loc{display:none}' +
    /* ---- chat: transparent, the client's values ---------------------- */
    '.chat-window{background:rgba(10,10,16,.16);border:1.5px solid rgba(255,221,140,.22);border-radius:14px;' +
      'color:#fff6da;box-shadow:0 8px 18px rgba(0,0,0,.12)}' +
    '.chat-window .chat-log{color:#fff6da;text-shadow:0 1px 3px rgba(0,0,0,.5)}' +
    '.chat-window .chat-log .sys{color:#ffe9a8}' +
    '.chat-channel{color:rgba(255,246,218,.85);border-radius:999px}' +
    '.chat-channel.is-active{background:rgba(255,221,140,.25);color:#fff6da}' +
    '#chat-input{background:rgba(10,10,16,.25);border:1.5px solid rgba(255,221,140,.3);border-radius:10px;color:#fff6da}' +
    '#chat-bubble{background:rgba(10,10,16,.55);color:#fff6da;border:1.5px solid rgba(255,221,140,.35)}' +
    '#espil-chat{background:transparent;border:none;border-radius:0;padding:2px 4px;box-shadow:none}' +
    '.espil-chat-line{background:rgba(10,10,16,.28);border:1px solid rgba(255,221,140,.18);color:#fff6da;' +
      'text-shadow:0 1px 3px rgba(0,0,0,.55)}' +
    '@media (pointer:fine){' +
      '.chat-window{bottom:calc(198px + env(safe-area-inset-bottom))}' +
      '#espil-chat{bottom:calc(386px + env(safe-area-inset-bottom))}}' +
    /* the top-left EXP readout stays gone - the bar carries the gauge */
    '#map-status{display:none}' +
    /* ---- tutorial objective chip: cream card ------------------------- */
    '#espil-tut{background:rgba(255,251,240,.93);color:#6b4a1f;border:2px solid #d9b380;' +
      'border-radius:14px;box-shadow:0 8px 18px rgba(90,60,20,.22);text-shadow:none}' +
    '#espil-tut .kb{background:#fffdf6;border:1.5px solid #cfa96f;color:#6b4a1f;box-shadow:none}' +
    /* ---- status cluster: cream pill ----------------------------------- */
    '#espil-mmo-status{position:fixed;left:14px;bottom:calc(15px + env(safe-area-inset-bottom));z-index:31;' +
      'display:flex;align-items:center;gap:10px;padding:7px 15px 7px 8px;border-radius:999px;' +
      'background:rgba(255,251,240,.94);border:2px solid #d9b380;' +
      'box-shadow:0 6px 16px rgba(90,60,20,.25),inset 0 1px 0 rgba(255,255,255,.9);' +
      'font-family:"Manrope",sans-serif;color:#5a4020;pointer-events:none}' +
    '#espil-mmo-status .mmo-medallion{width:52px;height:52px;border-radius:50%;flex:none;overflow:hidden;' +
      'border:2.5px solid #d9b380;box-shadow:0 2px 6px rgba(90,60,20,.3);background:#12242f}' +
    '#espil-mmo-status .mmo-medallion canvas{width:100%;height:100%;display:block}' +
    '#espil-mmo-status .mmo-who{display:flex;flex-direction:column;gap:1px;min-width:0}' +
    '#espil-mmo-status .mmo-name{font-weight:900;font-size:14.5px;letter-spacing:.02em;color:#6b4a1f;white-space:nowrap}' +
    '#espil-mmo-status .mmo-sub{font-size:10.5px;font-weight:700;color:#8a6a3b;white-space:nowrap}' +
    '#espil-mmo-status .mmo-leo{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;color:#a8742c}' +
    '#espil-mmo-status .mmo-coin{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block;' +
      'background:radial-gradient(circle at 35% 30%,#ffe9a8,#d9a441 60%,#8a6a34);border:1px solid #8a6a34}' +
    '@media (pointer:coarse){#espil-mmo-status{padding:5px 11px 5px 6px;gap:7px}' +
      '#espil-mmo-status .mmo-medallion{width:40px;height:40px}' +
      '#espil-mmo-status .mmo-name{font-size:12.5px}#espil-mmo-status .mmo-sub{display:none}}' +
    'body:not(.in-map) #espil-mmo-status{display:none!important}';
  document.head.appendChild(st);

  /* ---- portrait painter (same recipe as the customizer previews) - */
  var SK = ['#ffe3c2', '#f2c49b', '#dca26b', '#a8703c', '#6f4525'];
  var HC = ['#3a2a1c', '#7a4a2b', '#b3764a', '#e3c188', '#ececec', '#23262b', '#c94f4f', '#4a6ac9', '#5da873'];
  var OF = ['#3f7fbf', '#c94f4f', '#57a773', '#e0a83c', '#7a5fc0', '#e77fc0', '#37b8a5', '#e8e4da'];
  function paintFace(c, gender, look) {
    /* Han 2026-10-30 (customizer merge): when the character record
       carries the v3 customizer's rendered portrait, the medallion
       shows the real character art instead of the painted face. */
    var PI = window.__espilPortraitImg;
    if (PI && PI.complete && PI.naturalWidth > 0) {
      c.clearRect(0, 0, 112, 112);
      c.save(); c.beginPath(); c.arc(56, 56, 54, 0, Math.PI * 2); c.clip();
      var pg = c.createLinearGradient(0, 0, 0, 112); pg.addColorStop(0, '#d9edf0'); pg.addColorStop(1, '#faf3e0');
      c.fillStyle = pg; c.fillRect(0, 0, 112, 112);
      var psc = Math.max(112 / PI.naturalWidth, 112 / PI.naturalHeight);
      c.drawImage(PI, (112 - PI.naturalWidth * psc) / 2, (112 - PI.naturalHeight * psc) / 2, PI.naturalWidth * psc, PI.naturalHeight * psc);
      c.restore();
      return;
    }
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

  /* ---- the log tray outline (the client's paintTrayShape, ported) - */
  function paintEspilTray() {
    var main = document.querySelector('#quickbar .kb-main');
    var svg = document.getElementById('espil-tray');
    if (!main || !svg) return;
    var W = main.offsetWidth, H = main.offsetHeight;
    if (W < 60 || H < 40) return;
    var keys = main.querySelector('.mmo-keys');
    var stepY = 44;
    var stepX = W * 0.44;
    var right = document.getElementById('espil-right');
    if (keys && right && keys.offsetParent === main && right.offsetParent === main)
      stepX = (keys.offsetLeft + keys.offsetWidth + right.offsetLeft) / 2;
    var mr = main.getBoundingClientRect();
    var scale = mr.width / W;
    var flasks = document.querySelectorAll('#quickbar .flask');
    var L = null, Rr = null;
    if (flasks.length === 2 && scale > 0) {
      var info = Array.prototype.map.call(flasks, function (f) {
        var fr = f.getBoundingClientRect();
        return { gx: (fr.left + fr.width / 2 - mr.left) / scale, gy: (fr.top + fr.height / 2 - mr.top) / scale, r: (fr.width / 2) / scale };
      });
      L = info[0]; Rr = info[1];
    }
    var gy = L ? L.gy : H / 2, orad = L ? L.r : 56;
    var gxL = L ? L.gx : -80, gxR = Rr ? Rr.gx : W + 80;
    var r = 16;
    var rho = orad + 26;
    var dxStep = Math.round(Math.sqrt(Math.max(0, rho * rho - (gy - stepY) * (gy - stepY))));
    var dxBot = Math.round(Math.sqrt(Math.max(0, rho * rho - (H - gy) * (H - gy))));
    var dxEdge = Math.round(Math.sqrt(Math.max(0, rho * rho - gxL * gxL)));
    var d = 'M ' + r + ' 0 L ' + (stepX - 22) + ' 0 C ' + (stepX - 9.8) + ' 0, ' + stepX + ' 9.8, ' + stepX + ' 22 C ' + stepX + ' 34.2, ' + (stepX + 9.8) + ' ' + stepY + ', ' + (stepX + 22) + ' ' + stepY
      + ' L ' + (gxR - dxStep) + ' ' + stepY
      + ' A ' + rho + ' ' + rho + ' 0 0 1 ' + gxR + ' ' + (gy - rho)
      + ' A ' + rho + ' ' + rho + ' 0 0 1 ' + (gxR + rho) + ' ' + gy
      + ' A ' + rho + ' ' + rho + ' 0 0 1 ' + (gxR + dxBot) + ' ' + H
      + ' L ' + (gxL - dxBot) + ' ' + H
      + ' A ' + rho + ' ' + rho + ' 0 0 1 ' + (gxL - rho) + ' ' + gy
      + ' A ' + rho + ' ' + rho + ' 0 0 1 ' + gxL + ' ' + (gy - rho)
      + ' A ' + rho + ' ' + rho + ' 0 0 1 0 ' + (gy - dxEdge)
      + ' L 0 ' + r + ' Q 0 0, ' + r + ' 0 Z';
    ['espil-tray-fill', 'espil-tray-wood'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.setAttribute('d', d);
    });
    var pat = document.getElementById('espilwood');
    if (pat) {
      pat.setAttribute('width', W); pat.setAttribute('height', H);
      var img = pat.querySelector('image');
      if (img) { img.setAttribute('width', W); img.setAttribute('height', H); }
    }
  }
  window.addEventListener('resize', paintEspilTray);

  /* ---- DOM -------------------------------------------------------- */
  var status = document.createElement('div');
  status.id = 'espil-mmo-status';
  status.setAttribute('aria-hidden', 'true');
  status.innerHTML = '<div class="mmo-medallion"><canvas id="espil-mmo-face" width="112" height="112"></canvas></div>' +
    '<div class="mmo-who"><div class="mmo-name" id="espil-mmo-name">Guest</div>' +
    '<div class="mmo-sub" id="espil-mmo-sub">espil.online</div>' +
    '<div class="mmo-leo"><span class="mmo-coin"></span><span id="espil-mmo-leo">Leo 1,000</span></div></div>';
  var strip = document.createElement('div');
  strip.id = 'espil-mmo-strip';
  strip.setAttribute('aria-hidden', 'true');
  strip.innerHTML = '<span id="espil-mmo-city">VANCOUVER</span>' +
    '<div id="espil-mmo-track"><div id="espil-mmo-fill"></div><span id="espil-mmo-zone"></span></div>';
  var loc = document.createElement('div');
  loc.id = 'espil-loc';
  loc.textContent = 'Vancouver';
  function mount() {
    if (!document.body) return;
    if (!document.getElementById('espil-mmo-status')) document.body.appendChild(status);
    if (!document.getElementById('espil-loc')) document.body.appendChild(loc);
    /* the gauge strip lives in the tray's right column once the
       quickbar structure is assembled (see the wiring below); until
       then it waits at the body level, hidden by the coarse rule and
       by not being in the tray. */
    if (!document.getElementById('espil-mmo-strip')) document.body.appendChild(strip);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var CITY_NAMES = { vancouver: 'Vancouver', auckland: 'Auckland', tokyo: 'Tokyo', newyork: 'New York', paris: 'Paris', london: 'London', seoul: 'Seoul' };
  var TUT_STEPS = ['landingNav', 'landingEnter', 'move', 'jump', 'nav', 'enter', 'buy', 'stall', 'map'];
  var lastRec = '';
  function refresh() {
    mount();
    var inMap = document.body && document.body.classList.contains('in-map');
    status.setAttribute('aria-hidden', inMap ? 'false' : 'true');
    if (!inMap) return;
    /* portrait follows the saved character record */
    var recRaw = null, rec = null;
    try { recRaw = localStorage.getItem('espil_character'); rec = recRaw ? JSON.parse(recRaw) : null; } catch (_) {}
    if (recRaw !== lastRec) {
      lastRec = recRaw;
      var cv = document.getElementById('espil-mmo-face');
      if (cv && cv.getContext) { var c2 = cv.getContext('2d'); if (c2) paintFace(c2, rec && rec.gender === 'female' ? 'f' : 'm', rec ? rec.look : null); }
    }
    /* name: display name for accounts, the adopted Guest N for guests */
    var un = ''; try { un = localStorage.getItem('espil_username') || ''; } catch (_) {}
    var disp = un;
    try {
      var accts = JSON.parse(localStorage.getItem('espil_accounts_v1') || '{}');
      var a = accts[(un || '').toLowerCase()];
      if (a && a.display) disp = a.display;
    } catch (_) {}
    var nameEl = document.getElementById('espil-mmo-name');
    if (nameEl) nameEl.textContent = disp || 'Guest';
    var subEl = document.getElementById('espil-mmo-sub');
    if (subEl) subEl.textContent = (un && un !== disp) ? ('@' + un) : (/^guest/i.test(un) ? 'Guest traveler' : 'espil.online');
    /* Leo balance */
    var bal = 1000;
    try { var v = parseInt(localStorage.getItem('espil_leo_balance'), 10); if (!isNaN(v)) bal = v; } catch (_) {}
    var leoEl = document.getElementById('espil-mmo-leo');
    if (leoEl) leoEl.textContent = 'Leo ' + bal.toLocaleString('en-US');
    /* gauge: city pill + tutorial progress fill + position text */
    var key = window.__espilCityKey || 'vancouver';
    var zone = CITY_NAMES[key] || 'Vancouver';
    var cityEl = document.getElementById('espil-mmo-city');
    if (cityEl) cityEl.textContent = zone.toUpperCase();
    if (loc) loc.textContent = zone;
    var pose = null;
    try { pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch (_) {}
    var pct = 100, tutTxt = '';
    try {
      var ts = window.__espilTutorialState ? window.__espilTutorialState() : null;
      if (ts && !ts.done && ts.step) { var ix = TUT_STEPS.indexOf(ts.step); if (ix >= 0) { pct = Math.round(ix / TUT_STEPS.length * 100); tutTxt = 'Tutorial ' + ix + '/' + TUT_STEPS.length; } }
      else if (ts && ts.done) tutTxt = 'Tutorial done';
    } catch (_) {}
    var fill = document.getElementById('espil-mmo-fill');
    if (fill) fill.style.width = pct + '%';
    var zoneEl = document.getElementById('espil-mmo-zone');
    if (zoneEl) zoneEl.textContent = (pose ? Math.round(pose.x) + ', ' + Math.round(-pose.z) : '') + (tutTxt ? '  ·  ' + tutTxt : '');
    paintEspilTray();
  }
  refresh();
  setInterval(refresh, 600);

  /* ---- quickbar structure + the two stub menu buttons ------------- */
  function sendKey(key, code) {
    ['keydown', 'keyup'].forEach(function (t) {
      document.dispatchEvent(new KeyboardEvent(t, { key: key, code: code, bubbles: true, cancelable: true }));
    });
  }
  var MENU_ICONS = { SKILL: '⚔️', MAP: '🗺️', INV: '🎒', CHAR: '👤', HOME: '🏠' };
  var kbTries = 0;
  var kbTimer = setInterval(function () {
    kbTries++;
    if (kbTries > 150) { clearInterval(kbTimer); return; }
    var kbm = document.getElementById('kb-menu');
    if (!kbm || !kbm.children.length) return;
    var kbMain = document.querySelector('#quickbar .kb-main');
    if (!kbMain) return;
    /* the log tray SVG sits under everything in the centre panel */
    if (!document.getElementById('espil-tray')) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'espil-tray';
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = '<defs><pattern id="espilwood" patternUnits="userSpaceOnUse" width="440" height="140">' +
        '<image href="assets/tex/logwood.jpg" width="440" height="140" preserveAspectRatio="none"></image></pattern></defs>' +
        '<path id="espil-tray-fill" fill="#6d4c2c"></path>' +
        '<path id="espil-tray-wood" fill="url(#espilwood)" stroke="#3a2817" stroke-width="3"></path>';
      kbMain.insertBefore(svg, kbMain.firstChild);
    }
    /* keys column wrapping the two shortcut rows */
    if (!kbMain.querySelector('.mmo-keys')) {
      var keys = document.createElement('div');
      keys.className = 'mmo-keys';
      kbMain.appendChild(keys);
      ['item-row', 'move-row'].forEach(function (id) {
        var row = document.getElementById(id);
        if (row) keys.appendChild(row);
      });
    }
    /* right column: menu row over the gauge */
    var right = document.getElementById('espil-right');
    if (!right) {
      right = document.createElement('div');
      right.id = 'espil-right';
      kbMain.appendChild(right);
    }
    if (kbm.parentNode !== right) right.appendChild(kbm);
    var stripEl = document.getElementById('espil-mmo-strip');
    if (stripEl && stripEl.parentNode !== right) right.appendChild(stripEl);
    /* menu buttons: icons in, SET's gear key becomes its icon */
    Array.prototype.forEach.call(kbm.children, function (b) {
      var mn = b.querySelector('.mn');
      var label = mn ? mn.textContent : '';
      if (!b.querySelector('.sicon')) {
        var ic = document.createElement('span');
        ic.className = 'sicon';
        if (MENU_ICONS[label]) { ic.textContent = MENU_ICONS[label]; b.insertBefore(ic, b.firstChild); }
        else if (label === 'SET') { b.classList.add('mmo-set-icon'); ic.textContent = ''; b.insertBefore(ic, b.firstChild); }
      }
      if (label === 'MAP' && !b.__mmoWired) {
        var nb = b.cloneNode(true);
        nb.__mmoWired = true;
        nb.addEventListener('pointerdown', function (e) { e.preventDefault(); sendKey('m', 'KeyM'); });
        b.parentNode.replaceChild(nb, b);
      } else if (label === 'CHAR' && !b.__mmoWired) {
        b.__mmoWired = true;
        b.disabled = false;
        b.classList.remove('is-off');
        b.removeAttribute('aria-disabled');
        b.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (window.__espilOpenSelfProfile) window.__espilOpenSelfProfile();
          else sendKey('p', 'KeyP');
        });
      }
    });
    requestAnimationFrame(paintEspilTray);
  }, 800);

  window.__espilMMOHudState = function () {
    return {
      built: true,
      status: !!document.getElementById('espil-mmo-status'),
      strip: !!document.getElementById('espil-mmo-strip'),
      name: (document.getElementById('espil-mmo-name') || {}).textContent || '',
      leo: (document.getElementById('espil-mmo-leo') || {}).textContent || ''
    };
  };
})();
/* __espilMMOHud END */

