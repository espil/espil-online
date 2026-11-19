
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
   Kept from the first pass: the cream storybook panels/minimap
   and the completed MAP / CHAR menu buttons (real map-stage cycle,
   real self-profile). On touch screens the bar keeps the first
   pass's plain wooden tray (the client uses a different touch
   layout entirely; a dedicated mobile pass is a separate job).
   STATUS CLUSTER (Han correction 2026-11-03 07:46 MST, superseding
   the round 2 item 9 / round 3 item 6 whole-box reading): the
   bottom-left cream pill (#espil-mmo-status) STAYS with its guest
   name, role line and Leo balance text; only the portrait/photo
   (the medallion canvas and its painter) is removed. The P-key
   profile PANEL (modules/panels.js) is a different element and
   stays untouched. */
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
      '#espil-tray{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;overflow:visible;' +
        'filter:drop-shadow(0 5px 4px rgba(15,8,0,.45))}' +
      '#quickbar .mmo-keys{display:flex;flex-direction:column;gap:5px;position:relative;z-index:1;flex:none}' +
      '#quickbar .kb-main #item-row{display:flex;gap:5px}' +
      '#quickbar .kb-main #move-row{display:flex;gap:5px}' +
      /* right column: dropped one row, pushed right (client values) */
      '#espil-right{display:flex;flex-direction:column;gap:10px;justify-content:flex-start;' +
        'position:relative;z-index:1;flex:none;margin-top:44px;margin-left:14px}' +
      '#quickbar .kb-main #kb-menu{display:flex;gap:5px;order:0;flex:none}' +
      '#quickbar #hp-flask-wrap{order:1}#quickbar #mp-flask-wrap{order:3}' +
      '#quickbar .flask-wrap{position:relative;z-index:2;width:118px;height:auto;background:none;border-radius:50%}' +
      '#quickbar .flask{width:112px;height:112px;border:3px solid #54381f;' +
        'box-shadow:0 8px 20px rgba(40,25,8,.4),inset 0 0 0 2px rgba(255,235,200,.22)}' +
      '#quickbar .flask .pct{display:flex;font-size:20px}' +
      /* menu: one row of 34px round pastels, icon shown, key badged */
      '#quickbar #kb-menu .move-slot{position:relative;width:34px;height:34px;min-width:34px;border-radius:50%;' +
        'padding:0;display:flex;align-items:center;justify-content:center;' +
        'border:2px solid #54381f;box-shadow:0 3px 6px rgba(30,15,0,.35),inset 0 1px 2px rgba(255,255,255,.9);' +
        'background:radial-gradient(circle at 33% 28%,#fff6dd,#ecd3a0 58%,#cfa96f)}' +
      '#quickbar #kb-menu .move-slot .sicon{font-size:15px;line-height:1}' +
      '#quickbar #kb-menu .move-slot .mn{display:none}' +
      '#quickbar #kb-menu .move-slot .key{position:absolute;top:-5px;left:-5px;z-index:2;min-width:15px;height:15px;' +
        'padding:0 3px;border-radius:8px;background:#3a2817;color:#ffe9a8;font-size:9px;font-weight:800;' +
        'display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,233,168,.5)}' +
      '#quickbar #kb-menu .move-slot.mmo-set-icon .key{position:static;min-width:0;height:auto;padding:0;' +
        'border-radius:0;background:none;border:none;color:#6b4a1f;font-size:15px}' +
      '#quickbar #kb-menu .move-slot:nth-child(2){background:radial-gradient(circle at 33% 28%,#fdf6ec,#e3d3ae 58%,#c2a878);border-color:#54381f}' +
      '#quickbar #kb-menu .move-slot:nth-child(3){background:radial-gradient(circle at 33% 28%,#f6f0dc,#dccfa4 58%,#b3a06b);border-color:#54381f}' +
      '#quickbar #kb-menu .move-slot:nth-child(4){background:radial-gradient(circle at 33% 28%,#fbf0e2,#e6cfae 58%,#c09a6b);border-color:#54381f}' +
      '#quickbar #kb-menu .move-slot:nth-child(5){background:radial-gradient(circle at 33% 28%,#f3ecdd,#d8c8a4 58%,#ac9060);border-color:#54381f}' +
      '#quickbar #kb-menu .move-slot:nth-child(6){background:radial-gradient(circle at 33% 28%,#f7efdf,#e0d0aa 58%,#bfa26e);border-color:#54381f}' +
      /* the gauge: city pill + green track (client #z-expbar form) */
      '#espil-mmo-status{position:fixed;left:14px;bottom:86px;z-index:46;display:flex;align-items:center;' +
        'gap:10px;padding:8px 15px;border-radius:999px;' +
        'background-image:linear-gradient(180deg,rgba(84,56,31,.93),rgba(52,35,19,.95)),url("assets/tex/logwood.jpg");' +
        'background-size:cover,260px;' +
        'border:2px solid #3a2817;box-shadow:inset 0 1px 0 rgba(255,224,170,.38),inset 0 -4px 7px rgba(0,0,0,.5),0 10px 24px rgba(40,25,8,.38);' +
        'font-family:"Baloo 2","Manrope",sans-serif;color:#f5e6c8;max-width:min(78vw,340px)}' +
      '#espil-mmo-status .mmo-who{min-width:0}' +
      '#espil-mmo-status .mmo-name{font-weight:800;font-size:.92rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#espil-mmo-status .mmo-sub{font-size:.66rem;letter-spacing:.08em;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#espil-mmo-status .mmo-leo{display:flex;align-items:center;gap:5px;font-size:.74rem;font-weight:800;color:#ffd97a;margin-top:1px}' +
      '#espil-mmo-status .mmo-coin{width:11px;height:11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a8,#f5b301 60%,#c77f02);border:1px solid #a86a00;flex:0 0 11px}' +
      'body:not(.in-map) #espil-mmo-status{display:none}' +
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
      '#quickbar{background-image:linear-gradient(180deg,rgba(124,90,54,.93),rgba(94,64,35,.95)),url("assets/tex/logwood.jpg");' +
        'background-size:cover,300px;' +
        'border:3px solid #3a2817;box-shadow:0 12px 28px rgba(40,25,8,.4)}' +
      '#quickbar .flask .pct{display:block;font-size:8.5px}' +
      '#espil-mmo-status{bottom:calc(118px + var(--kb-shift,0px))}' +
      '#espil-mmo-strip{display:none}' +
      '#espil-tray{display:none}' +
    '}' +
    /* ---- slots: cream storybook ------------------------------------ */
    '#quickbar .move-slot{background-image:linear-gradient(180deg,rgba(232,207,159,.96),rgba(202,160,106,.96)),url("assets/tex/logwood.jpg");' +
      'background-size:cover,120px;' +
      'border:2px solid #6b4a2f;border-radius:12px;color:#3a2817;' +
      'box-shadow:inset 0 1px 0 rgba(255,244,214,.75),inset 0 -3px 0 rgba(84,56,31,.4),0 2px 4px rgba(40,25,8,.3);text-shadow:none}' +
    '#quickbar .mmo-keys .move-slot .key{color:#7a5a30;text-shadow:none}' +
    '#quickbar .move-slot .mn{color:#5e4023;text-shadow:none}' +
    '#quickbar .move-slot .cd{color:#a05a2c}' +
    '#quickbar .move-slot:hover{border-color:#54381f}' +
    '#quickbar .move-slot.is-locked{background:linear-gradient(180deg,#d8c8a6,#c3ab7d);' +
      'border-color:#8a6f45;opacity:.62;box-shadow:none}' +
    /* ---- minimap: circular, gold rim (stages 1-2) ------------------- */
    '#minimap-wrap[data-stage="1"],#minimap-wrap[data-stage="2"]{border:4px solid #3a2416;' +
      'border-radius:50%;overflow:hidden;box-shadow:inset 0 0 0 3px #d9b678,0 12px 28px rgba(0,0,0,.45),0 0 0 2px rgba(255,244,207,.24)}' +
    /* ---- location pill above the minimap (client #z-loc form) ------- */
    '#espil-loc{position:fixed;top:calc(30px + env(safe-area-inset-top));right:14px;width:148px;z-index:31;' +
      'pointer-events:none;text-align:center;font-family:"Manrope",sans-serif;font-size:13.5px;font-weight:700;' +
      'letter-spacing:.02em;color:#fff6e0;background-image:linear-gradient(180deg,rgba(84,56,31,.9),rgba(52,35,19,.92)),url("assets/tex/logwood.jpg");' +
      'background-size:cover,200px;' +
      'border:1.5px solid #a97e46;border-radius:999px;padding:5px 4px;' +
      'text-shadow:0 1px 2px rgba(0,0,0,.5)}' +
    'body:not(.in-map) #espil-loc{display:none}' +
    /* ---- chat: transparent, the client's values ---------------------- */
    '.chat-window{background-image:linear-gradient(180deg,rgba(52,35,19,.82),rgba(36,24,12,.86)),url("assets/tex/logwood.jpg");' +
      'background-size:cover,300px;border:1.5px solid #a97e46;border-radius:14px;' +
      'color:#fff6da;box-shadow:inset 0 1px 0 rgba(255,224,170,.25),0 8px 18px rgba(20,10,0,.35)}' +
    '.chat-window .chat-log{color:#fff6da;text-shadow:0 1px 3px rgba(0,0,0,.5)}' +
    '.chat-window .chat-log .sys{color:#ffe9a8}' +
    '.chat-channel{color:rgba(255,246,218,.85);border-radius:999px}' +
    '.chat-channel.is-active{background:rgba(202,160,106,.38);color:#fff6da}' +
    '#chat-input{background:rgba(24,15,7,.55);border:1.5px solid rgba(202,160,106,.75);border-radius:10px;color:#fff6da}' +
    '#chat-bubble{background:rgba(42,29,16,.9);color:#fff6da;border:1.5px solid #caa06a}' +
    '#espil-chat{background:transparent;border:none;border-radius:0;padding:2px 4px;box-shadow:none}' +
    '.espil-chat-line{background:rgba(35,22,11,.55);border:1px solid rgba(202,160,106,.4);color:#fff6da;' +
      'text-shadow:0 1px 3px rgba(0,0,0,.55)}' +
    '@media (pointer:fine){' +
      '.chat-window{bottom:calc(198px + env(safe-area-inset-bottom))}' +
      '#espil-chat{bottom:calc(386px + env(safe-area-inset-bottom))}}' +
    /* the top-left EXP readout stays gone - the bar carries the gauge */
    '#map-status{display:none}' +
    /* ---- tutorial objective chip: cream card ------------------------- */
    '#espil-tut{background-image:linear-gradient(180deg,rgba(84,56,31,.94),rgba(52,35,19,.96)),url("assets/tex/logwood.jpg");' +
      'background-size:cover,240px;color:#f5e6c8;border:2px solid #54381f;' +
      'border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,224,170,.3),0 8px 18px rgba(40,25,8,.35);text-shadow:none}' +
    '#espil-tut .kb{background:linear-gradient(180deg,#e8cf9f,#caa06a);border:1.5px solid #54381f;color:#3a2817;box-shadow:none}' +
    /* Mobile revert (Han 2026-11-04): the Batch M (M2 status-box
       move, M3 key-row/menu/right-column hiding) and Batch E (E1
       100px minimap, E3 collapsed chat + pill, E4 bottom-centre
       flasks, E5 QWER row) coarse-pointer style blocks are REMOVED -
       one HUD layout for every pointer type again. */
    '';
  document.head.appendChild(st);

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
    ['espil-tray-fill', 'espil-tray-wood', 'espil-tray-edge'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.setAttribute('d', d);
    });
    /* Item 6 (Han 2026-11-04): the edge copy rides 6px lower, so the
       log shows a dark underside - the tray reads as a thick plank,
       not a flat sticker. */
    var edge = document.getElementById('espil-tray-edge');
    if (edge) edge.setAttribute('transform', 'translate(0 6)');
    var pat = document.getElementById('espilwood');
    if (pat) {
      pat.setAttribute('width', W); pat.setAttribute('height', H);
      var img = pat.querySelector('image');
      if (img) { img.setAttribute('width', W); img.setAttribute('height', H); }
    }
  }
  window.addEventListener('resize', paintEspilTray);

  /* ---- DOM -------------------------------------------------------- */
  /* the status pill: name + role + Leo text only (no portrait -
     Han correction 2026-11-03, see the header note) */
  var status = document.createElement('div');
  status.id = 'espil-mmo-status';
  status.setAttribute('aria-hidden', 'true');
  status.innerHTML = '<div class="mmo-who"><div class="mmo-name" id="espil-mmo-name">Guest</div>' +
    '<div class="mmo-sub" id="espil-mmo-sub">Guest Traveler</div>' +
    '<div class="mmo-leo"><span class="mmo-coin"></span><span id="espil-mmo-leo">Leo 1,000</span></div></div>';
  var strip = document.createElement('div');
  strip.id = 'espil-mmo-strip';
  strip.setAttribute('aria-hidden', 'true');
  strip.innerHTML = '<span id="espil-mmo-city">VANCOUVER</span>' +
    '<div id="espil-mmo-track"><div id="espil-mmo-fill"></div><span id="espil-mmo-zone"></span></div>';
  var loc = document.createElement('div');
  loc.id = 'espil-loc';
  loc.textContent = 'Vancouver';
  /* Mobile revert (Han 2026-11-04): the Batch E3 top-centre chat
     button, its chat-open toggle and the unread-badge listener are
     REMOVED - the chat window rests visible, as on desktop. */
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
  function refresh() {
    mount();
    var inMap = document.body && document.body.classList.contains('in-map');
    if (!inMap) return;
    if (status) status.setAttribute('aria-hidden', 'false');
    /* status pill text: guest name + role + Leo balance */
    var nm = 'Guest';
    try { nm = localStorage.getItem('espil_username') || 'Guest'; } catch (_) {}
    var nameEl = document.getElementById('espil-mmo-name');
    if (nameEl && nameEl.textContent !== nm) nameEl.textContent = nm;
    var subEl = document.getElementById('espil-mmo-sub');
    if (subEl) { var subTxt = /^Guest/.test(nm) ? 'Guest Traveler' : 'Traveler'; if (subEl.textContent !== subTxt) subEl.textContent = subTxt; }
    var leo = 1000;
    try { var lv = parseInt(localStorage.getItem('espil_leo_balance') || '1000', 10); if (!isNaN(lv)) leo = lv; } catch (_) {}
    var leoEl = document.getElementById('espil-mmo-leo');
    var leoTxt = 'Leo ' + leo.toLocaleString('en-US');
    if (leoEl && leoEl.textContent !== leoTxt) leoEl.textContent = leoTxt;
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
      /* Batch D5 hardening (Han 2026-11-03: the logwood tray vanished
         on his PC in the W build): the pattern image carries BOTH the
         SVG2 href and the legacy xlink:href (with the xlink namespace
         declared on the svg), so WebKit/Safari builds that ignore a
         bare href on SVG <image> still load the log texture. */
      svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      svg.innerHTML = '<defs><pattern id="espilwood" patternUnits="userSpaceOnUse" width="440" height="140">' +
        '<image href="assets/tex/logwood.jpg" xlink:href="assets/tex/logwood.jpg" width="440" height="140" preserveAspectRatio="none"></image></pattern></defs>' +
        '<path id="espil-tray-edge" fill="#1d1106"></path>' +
        '<path id="espil-tray-fill" fill="#6d4c2c"></path>' +
        '<path id="espil-tray-wood" fill="url(#espilwood)" stroke="#2c1c0d" stroke-width="3.5"></path>';
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

  /* ---- mobile minimap tap-to-expand (Han 2026-11-06) -------------
     Coarse pointers only, and only while the wrap sits at stage 1:
     a tap on the minimap toggles the .mm-big expanded view (sized
     in pair.css); a tap anywhere else on screen collapses it back.
     The tutorial chip is excluded from the collapse - its own tap
     keeps meaning minimize/restore - and the chip paints above the
     expanded map (z-60 over the wrap's z-30), so it is never
     trapped under it. A drag still pans the Leaflet map: only a
     short, near-stationary press counts as a tap. Leaflet learns
     the new CSS size through the monolith's own resize path -
     synthetic window resize events feed its 200ms-debounced
     invalidateSize on the same 60/350/800ms ladder setMapStage
     uses, so the map re-measures the settled size instead of
     stretching. A watchdog drops the class if the stage ladder
     ever leaves stage 1 (M key / zoom buttons on a hybrid device),
     so .mm-big can never leak into the district/fullscreen stages.
     Desktop never sees any of this: every handler gates on coarse. */
  var mmBig = false;
  function mmCoarse() {
    try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) { return false; }
  }
  function mmWrap() { return document.getElementById('minimap-wrap'); }
  function mmKickResize() {
    [60, 350, 800].forEach(function (ms) {
      setTimeout(function () {
        try { window.dispatchEvent(new Event('resize')); }
        catch (e) {
          try { var ev = document.createEvent('Event'); ev.initEvent('resize', true, true); window.dispatchEvent(ev); } catch (e2) {}
        }
      }, ms);
    });
  }
  function mmSetBig(on) {
    var w = mmWrap(); if (!w) return;
    if (on && w.getAttribute('data-stage') !== '1') on = false;
    mmBig = !!on;
    if (w.classList.contains('mm-big') === mmBig) return;
    w.classList.toggle('mm-big', mmBig);
    mmKickResize();
  }
  var mmDownAt = null;
  document.addEventListener('pointerdown', function (e) {
    if (!mmCoarse()) return;
    var w = mmWrap(); if (!w) return;
    if (w.contains(e.target)) { mmDownAt = { x: e.clientX, y: e.clientY, t: Date.now() }; return; }
    if (mmBig && !(e.target && e.target.closest && e.target.closest('#espil-tut'))) mmSetBig(false);
  }, true);
  document.addEventListener('pointerup', function (e) {
    if (!mmCoarse() || !mmDownAt) return;
    var d = mmDownAt; mmDownAt = null;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (dx * dx + dy * dy > 100 || Date.now() - d.t > 500) return; /* a drag pans; only a tap toggles */
    var w = mmWrap(); if (!w || !w.contains(e.target)) return;
    if (w.getAttribute('data-stage') !== '1') return;
    mmSetBig(!mmBig);
  }, true);
  setInterval(function () {
    if (!mmBig) return;
    var w = mmWrap();
    if (w && w.getAttribute('data-stage') !== '1') mmSetBig(false);
  }, 500);

  /* ---- Batch 5 (Han 2026-11-07): mobile combat cluster + menu row --
     Item 3: a left-side shortcut cluster on coarse pointers -
     PUNCH / KICK / THROW (the desktop move set), DEFENSE (the
     Defense move / guard) and TELEPORT (the fly toggle, key B -
     summonVehicle in the monolith). Moves go through the exact
     desktop path, window.__espilSkills.move === doMove.
     Item 4: four SAME-SIZE buttons beside the HP/MP flasks -
     bag (I), profile (P / panels), skill tree (K), stall (Y) -
     each opening the existing window through its existing route.
     Inside the store interior the attack trio renders disabled
     and inert (item 5c: the store keeps the HUD pattern, attacks
     do not fire indoors). */
  var b5Style = document.createElement('style');
  b5Style.id = 'espil-mmo-b5-style';
  b5Style.textContent =
    '#espil-mmo-combat{display:none}' +
    '#espil-mmo-menu4{display:none}' +
    '@media (pointer:coarse){' +
      'body.in-map #espil-mmo-combat{display:flex;position:fixed;left:10px;top:50%;' +
        'transform:translateY(-50%);z-index:34;flex-direction:column;gap:9px}' +
      '#espil-mmo-combat button{width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,233,168,.55);' +
        'background:rgba(30,20,8,.62);color:#ffe9ad;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:1px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;' +
        'box-shadow:0 0 14px rgba(255,217,122,.18);padding:0}' +
      '#espil-mmo-combat button .ci{font-size:19px;line-height:1}' +
      '#espil-mmo-combat button .cl{font:800 8px/1 "Manrope",sans-serif;letter-spacing:.06em}' +
      '#espil-mmo-combat button:active{background:rgba(90,60,20,.8)}' +
      '#espil-mmo-combat button.b5-off{opacity:.38;border-color:rgba(200,200,200,.35);color:#cfd4d8;' +
        'box-shadow:none;pointer-events:none}' +
      '#espil-mmo-menu4{display:flex;gap:6px;order:6;flex:0 0 auto;align-items:center}' +
      '#espil-mmo-menu4 button{width:46px;height:46px;min-width:46px;border-radius:50%;' +
        'border:2px solid #54381f;padding:0;display:flex;align-items:center;justify-content:center;' +
        'background:radial-gradient(circle at 33% 28%,#fff6dd,#ecd3a0 58%,#cfa96f);' +
        'box-shadow:0 3px 6px rgba(30,15,0,.35),inset 0 1px 2px rgba(255,255,255,.9);' +
        'font-size:19px;line-height:1;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '}';
  document.head.appendChild(b5Style);

  function b5Move(id) {
    return function (e) {
      e.preventDefault();
      if (e.currentTarget.classList.contains('b5-off')) return;
      try {
        if (window.__espilSkills && window.__espilSkills.move) window.__espilSkills.move(id);
        else sendKey(id === 'punch' ? 'q' : id === 'kick' ? 'w' : id === 'throw' ? 'e' : 'r',
                     id === 'punch' ? 'KeyQ' : id === 'kick' ? 'KeyW' : id === 'throw' ? 'KeyE' : 'KeyR');
      } catch (err) {}
    };
  }
  var b5Combat = null;
  function b5BuildCombat() {
    if (b5Combat || !document.body) return;
    b5Combat = document.createElement('div');
    b5Combat.id = 'espil-mmo-combat';
    b5Combat.setAttribute('aria-label', 'Combat shortcuts');
    var defs = [
      { move: 'punch', icon: '👊', label: 'PUNCH' },
      { move: 'kick', icon: '🦵', label: 'KICK' },
      { move: 'throw', icon: '「」', label: 'THROW' },
      /* Batch 6 Item C: the tree-gated skills join the cluster;
         doMove itself refuses (with a toast) until each is learned. */
      { move: 'dash', icon: '💨', label: 'DASH' },
      { move: 'spin', icon: '🌀', label: 'SPIN' },
      { move: 'wave', icon: '🌊', label: 'WAVE' },
      { move: 'art', icon: '⚔️', label: 'ART' },
      { move: 'defense', icon: '🛡️', label: 'DEFENSE' },
      { fly: true, icon: '✈️', label: 'TELEPORT' }
    ];
    defs.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      if (d.move) { b.setAttribute('data-move', d.move); b.addEventListener('pointerdown', b5Move(d.move)); }
      if (d.fly) {
        b.setAttribute('data-fly', '1');
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); sendKey('b', 'KeyB'); });
      }
      b.setAttribute('aria-label', d.label);
      b.innerHTML = '<span class="ci">' + d.icon + '</span><span class="cl">' + d.label + '</span>';
      b5Combat.appendChild(b);
    });
    document.body.appendChild(b5Combat);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', b5BuildCombat);
  else b5BuildCombat();

  var b5Menu4 = null;
  var b5MenuTimer = setInterval(function () {
    if (b5Menu4) { clearInterval(b5MenuTimer); return; }
    var qb = document.getElementById('quickbar');
    var mp = document.getElementById('mp-flask-wrap');
    if (!qb || !mp || !mp.parentNode) return;
    b5Menu4 = document.createElement('div');
    b5Menu4.id = 'espil-mmo-menu4';
    b5Menu4.setAttribute('aria-label', 'Menu shortcuts');
    var defs = [
      { id: 'bag', icon: '🎒', label: 'Bag', fn: function () { sendKey('i', 'KeyI'); } },
      { id: 'profile', icon: '👤', label: 'Profile', fn: function () {
          if (window.__espilOpenSelfProfile) window.__espilOpenSelfProfile();
          else sendKey('p', 'KeyP');
        } },
      { id: 'skill', icon: '⚔️', label: 'Skill tree', fn: function () {
          if (window.__espilSkills && window.__espilSkills.tree) window.__espilSkills.tree();
          else sendKey('k', 'KeyK');
        } },
      { id: 'stall', icon: '🧺', label: 'Stall', fn: function () { sendKey('y', 'KeyY'); } }
    ];
    defs.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-menu', d.id);
      b.setAttribute('aria-label', d.label);
      b.textContent = d.icon;
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); try { d.fn(); } catch (err) {} });
      b5Menu4.appendChild(b);
    });
    mp.parentNode.insertBefore(b5Menu4, mp.nextSibling);
    clearInterval(b5MenuTimer);
  }, 700);

  /* store-interior sync: the attack trio goes disabled + inert
     while the player is inside (item 5c) or the store page holds
     the world; DEFENSE / TELEPORT keep their own indoor rules in
     the monolith (fly summon already refuses indoors). */
  setInterval(function () {
    if (!b5Combat) return;
    var off = false;
    try { off = !!window.__espilInside || !!window.__espilStorePaused; } catch (e) {}
    Array.prototype.forEach.call(b5Combat.children, function (b) {
      var mv = b.getAttribute('data-move');
      if (mv && mv !== 'defense') b.classList.toggle('b5-off', off);
    });
  }, 400);

  window.__espilMMOHudState = function () {
    var mw = document.getElementById('minimap-wrap');
    return {
      built: true,
      status: !!document.getElementById('espil-mmo-status'),
      strip: !!document.getElementById('espil-mmo-strip'),
      name: (document.getElementById('espil-mmo-name') || {}).textContent || '',
      leo: (document.getElementById('espil-mmo-leo') || {}).textContent || '',
      minimapBig: mmBig,
      minimapStage: mw ? mw.getAttribute('data-stage') : null,
      combatCluster: !!document.getElementById('espil-mmo-combat'),
      menu4: !!document.getElementById('espil-mmo-menu4'),
      attacksOff: (function () {
        var b = document.querySelector('#espil-mmo-combat button[data-move="punch"]');
        return !!b && b.classList.contains('b5-off');
      })()
    };
  };
})();

/* =====================================================================
   HUD2 (Han 2026-11-08): the mobile HUD rework. Two references, one
   component set, two orientation arrangements:
   - LANDSCAPE (reference 1, mobile action-RPG): coin top-left, score
     bar top-centre, SQUARE minimap top-right with a time/FPS bar
     directly beneath it, joystick bottom-left, action arc
     bottom-right.
   - PORTRAIT (reference 2, Genshin-style): CIRCULAR minimap top-left
     (time/FPS folded as a tiny readout beneath it), a small icon row
     across the top (menu functions + the Leo coin as a chip), the
     score trio folded as a compact line under that row, a vertical
     nearby-character list on the right, HP/MP bars bottom-centre
     (level at the HP bar's left end), joystick bottom-left (faint
     until touched) + a chat button at the far bottom-left corner,
     action cluster bottom-right.
   Score semantics (chosen mapping of reference 1's two-scores-plus-
   centre form, stated): left = player kill count (skull), centre =
   current zone name, right = active monster count. Kills are counted
   from the game's own 'espil-guide' monster-kill events (the same
   events that grant Leo per kill) - session count, no invented
   numbers. The largest action button (ATK, sword glyph) fires the
   game's existing touch attack surface (#map-attack, which is
   doMove('punch')) - the same move the PUNCH button reaches through
   __espilSkills.move, exactly as the two surfaces behaved before.
   BUTTON SIZE STANDARD (Han 2026-11-08, overriding the references'
   large-button grammar): the old cluster's main buttons measured
   56px; ATK is 28px (half), secondary actions 23px, utility 20px,
   teleport 18px, menu chips 20px. The JOYSTICK is a drag SURFACE,
   not a button, and stays a large translucent area as both
   references show it.
   SIZE + FORM REVISION (Han 2026-11-11, superseding the size
   standard above - "the buttons are too small to see"): every
   control is now in the 44px+ class (ATK 56, quick slots 52,
   USE/JUMP 48, menu icon 48, chat 44, TELEPORT 44). The eight
   fixed move buttons are replaced by a 4-slot QUICK BAR: any of
   the eight moves registers into a slot (tap fires, long-press
   opens the assign sheet, cooldowns paint from the game's own
   cooldown map; assignments persist with the skill state). The
   five menu chips collapse into ONE menu icon whose sheet holds
   the fixed shortcuts (skill tree, items, bag, map, stall). The
   portrait score bar drops to top:66 to clear the 48px icon.
   PORTRAIT SEPARATION (Han correction 2026-11-09): the portrait
   arrangement is a fully separate mobile presentation - it must
   NOT import the PC version's log-style (통나무) UI. A portrait-
   only skin block at the end of the portrait media query drops
   every inherited piece of the desktop log skin from portrait:
   the minimap's 4px dark-wood border + gold inset ring, the
   action buttons' brown radial wood/leather gradient + gold rim,
   the HP flask-liquid red-orange gradient (now a flat green
   fill), the gold Leo medallion treatment, the gold-rimmed menu
   chips, the chevron score bar, and the logwood-textured chat
   window / chat lines / tutorial chip. Portrait uses thin light
   rings, flat translucent dark glass and white glyphs throughout,
   per the Genshin-style reference. Landscape is untouched: it
   keeps the reference-1 skin exactly as landed.
   HUD3 COMPOSITION (Han 2026-11-09, after checking production on
   his phone: the minimap, chat, buttons and quest UI overlapped):
   the mobile layout is recomposed WHOLESALE on the two references,
   chat window included - every standing surface owns a fixed zone
   and no two zones intersect, in both orientations:
   - LANDSCAPE: coin TL column; score TC; menu chips as a row
     centred under the score (was: a column down the left edge);
     square minimap TR with the time/FPS bar under it; the quest
     chip in the right column under that bar; the chat window in
     the left column under the coin (top:86, its bottom edge 170px
     off the bottom, clear of the joystick); joystick BL; HP/MP
     bars bottom-centre (was: bottom-left, where the chat zone now
     sits); action arc BR.
   - PORTRAIT: circular minimap TL with the time/FPS chip under
     it; coin chip beside it; menu row TR; the folded score line
     under the top row; the quest chip in the LEFT column under
     the time/FPS chip (was: the right column, across the screen
     from the minimap stack it belongs to); the chat window in the
     left column under the chip (top:200 - it used to rest as a
     full-width band across the very top, over the minimap, coin,
     score and menu); nearby list R; joystick BL (faint); chat
     button far BL corner; HP/MP bars bottom-centre; the action
     cluster RAISED to bottom:64 (was bottom:6, where its left
     buttons sat on the centred HP/MP bars' right end).
   The presence transients take zones in pair.css (DM chip,
   interact prompt). Button sizes and every behaviour are exactly
   as landed - this pass moves placement only.
   The Batch 5/6 mobile cluster (#espil-mmo-combat), the menu4 row
   and the quickbar tray are hidden on coarse pointers - this layout
   is the single mobile scheme. Desktop (fine pointer) never sees
   any of it. Inside the store the attack family renders disabled
   and inert, same rule as the old cluster (DEFENSE / TELEPORT /
   USE / JUMP keep their own indoor behaviour in the monolith). */
(function () {
  'use strict';
  if (window.__espilHud2) return;
  window.__espilHud2 = true;

  var css =
    '#espil-hud2-coin,#espil-hud2-score,#espil-hud2-timefps,#espil-hud2-menu,' +
    '#espil-hud2-bars,#espil-hud2-actions,#espil-hud2-chars,#espil-hud2-chat,#espil-hud2-chat-tab{display:none}' +
    '@media (pointer:coarse){' +
      /* the superseded mobile scheme retires on touch screens */
      '#espil-mmo-combat{display:none!important}' +
      '#espil-mmo-menu4{display:none!important}' +
      '#quickbar{display:none!important}' +
      '#espil-mmo-status{display:none!important}' +
      '#espil-loc{display:none!important}' +
      '#map-attack,#map-jump,#map-interact{display:none!important}' +
      /* joystick: the pair's own stick, moved bottom-left, kept LARGE
         (a drag surface, not a button) */
      'body.in-map .joystick{left:12px!important;right:auto!important;bottom:12px!important;' +
        'width:148px!important;height:148px!important;opacity:.5!important;z-index:34;' +
        'background:radial-gradient(circle,rgba(8,12,16,.16),rgba(8,12,16,.42));' +
        'border:2px solid rgba(255,255,255,.28);box-shadow:0 4px 18px rgba(0,0,0,.3)}' +
      'body.in-map .joystick.joy-live{opacity:.78!important}' +
      'body.in-map .joy-knob{background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.55),rgba(160,180,200,.30));' +
        'box-shadow:0 2px 8px rgba(0,0,0,.35)}' +
      /* coin (Leo) */
      'body.in-map #espil-hud2-coin{display:flex;position:fixed;z-index:36;align-items:center;gap:5px}' +
      '#espil-hud2-coin .h2-medal{border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a8,#f5b301 55%,#b97a02);' +
        'border:2px solid #7a5200;color:#5a3a00;display:flex;align-items:center;justify-content:center;font-weight:900;flex:none}' +
      '#espil-hud2-coin .h2-num{background:rgba(8,10,14,.72);color:#ffd97a;font:800 11px/1.5 "Manrope",sans-serif;' +
        'padding:1px 7px;border-radius:8px}' +
      /* score bar */
      'body.in-map #espil-hud2-score{display:flex;position:fixed;z-index:36;left:50%;transform:translateX(-50%);' +
        'align-items:center;justify-content:space-between;background:rgba(10,12,16,.84);color:#fff;' +
        'font:800 12px "Manrope",sans-serif;clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,12px 100%,0 50%)}' +
      '#espil-hud2-score .h2-zone-t{color:#ffe9a8;letter-spacing:.04em}' +
      /* time / FPS readout */
      'body.in-map #espil-hud2-timefps{display:flex;position:fixed;z-index:36;justify-content:space-between;' +
        'background:rgba(8,10,14,.78);color:#e8f2ee;font:700 10px/1.6 "Manrope",sans-serif;' +
        'padding:2px 7px;border-radius:6px;box-sizing:border-box}' +
      /* menu chips */
      'body.in-map #espil-hud2-menu{display:flex;position:fixed;z-index:36;gap:6px}' +
      /* menu: ONE menu icon button (Han 2026-11-11: the fixed
         shortcuts gather behind this single icon, in the sheet) */
      '#espil-hud2-menu button{width:48px;height:48px;border-radius:50%;border:2px solid rgba(255,233,168,.55);' +
        'background:rgba(16,20,26,.72);color:#ffe9ad;font-size:23px;line-height:1;display:flex;align-items:center;' +
        'justify-content:center;padding:0;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}' +
      /* HP / MP bars */
      'body.in-map #espil-hud2-bars{display:block;position:fixed;z-index:36}' +
      '#espil-hud2-bars .h2-hprow{display:flex;align-items:center}' +
      '#espil-hud2-bars .h2-lv{font:800 9px "Manrope",sans-serif;color:#ffe9a8;background:rgba(8,10,14,.72);' +
        'border-radius:6px;padding:2px 4px;margin-right:4px;flex:none}' +
      '#espil-hud2-bars .h2-track{position:relative;flex:1;height:12px;background:rgba(6,8,10,.72);' +
        'border:1px solid rgba(255,255,255,.35);border-radius:7px;overflow:hidden}' +
      '#espil-hud2-bars .h2-track i{position:absolute;left:0;top:0;bottom:0;width:100%;' +
        'background:linear-gradient(90deg,#d92c2c,#ff8a3c)}' +
      '#espil-hud2-bars .h2-track.mp{height:6px;margin-top:3px}' +
      '#espil-hud2-bars .h2-track.mp i{background:linear-gradient(90deg,#2277dd,#6fd8ff)}' +
      '#espil-hud2-bars .h2-hp-num{position:absolute;inset:0;text-align:center;font:800 9px/12px "Manrope",sans-serif;' +
        'color:#fff;text-shadow:0 1px 2px #000}' +
      /* action cluster */
      'body.in-map #espil-hud2-actions{display:block;position:fixed;z-index:36}' +
      '#espil-hud2-actions button{position:absolute;border-radius:50%;border:2px solid rgba(255,220,150,.55);' +
        'background:radial-gradient(circle at 35% 30%,rgba(122,72,30,.92),rgba(48,29,11,.94));color:#ffe9ad;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;cursor:pointer;' +
        'touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 2px 7px rgba(0,0,0,.4)}' +
      '#espil-hud2-actions button .ci{line-height:1}' +
      '#espil-hud2-actions button .al{font:800 8px/1.2 "Manrope",sans-serif;letter-spacing:.02em}' +
      /* BUTTON SIZE REVISION (Han 2026-11-11, superseding the
         2026-11-08 small-button standard: "the buttons are too
         small to see"): every mobile control lands in the 44px+
         tap-target class - ATK 56, quick slots 52, USE/JUMP 48,
         TELEPORT 44, menu icon 48, chat button 44. */
      '#espil-hud2-actions button[data-atk]{width:56px;height:56px}' +
      '#espil-hud2-actions button[data-atk] .ci{font-size:26px}' +
      '#espil-hud2-actions button.h2-util{width:48px;height:48px;background:radial-gradient(circle at 35% 30%,rgba(52,66,80,.92),rgba(18,24,32,.94));border-color:rgba(180,220,255,.5)}' +
      '#espil-hud2-actions button.h2-util .ci{font-size:20px}' +
      '#espil-hud2-actions button[data-fly]{width:44px;height:44px;background:radial-gradient(circle at 35% 30%,rgba(20,90,96,.92),rgba(8,36,44,.94));border-color:rgba(125,252,230,.55)}' +
      '#espil-hud2-actions button[data-fly] .ci{font-size:18px}' +
      '#espil-hud2-actions button:active{filter:brightness(1.35)}' +
      '#espil-hud2-actions button.h2-off{opacity:.35;border-color:rgba(200,200,200,.3);color:#cfd4d8;pointer-events:none}' +
      /* nearby-character list + chat button (portrait forms) */
      '#espil-hud2-chars .h2-char{display:flex;align-items:center;gap:4px}' +
      '#espil-hud2-chars .h2-chip{width:24px;height:24px;border-radius:50%;border:1.5px solid rgba(255,255,255,.6);flex:none}' +
      '#espil-hud2-chars .h2-cname{font:700 9px "Manrope",sans-serif;color:#fff;text-shadow:0 1px 3px #000;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62px}' +
      '#espil-hud2-chat{border-radius:50%;border:1.5px solid rgba(255,255,255,.5);background:rgba(16,20,26,.68);' +
        'color:#fff;font-size:11px;line-height:1;align-items:center;justify-content:center;padding:0;cursor:pointer;touch-action:none}' +
      /* minimap marker layer */
      '#espil-hud2-mmlayer{position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden}' +
      '#espil-hud2-mmlayer .h2-mk{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;' +
        'clip-path:polygon(50% 0,100% 100%,0 100%)}' +
      '#espil-hud2-mmlayer .h2-mk.mon{background:#ff4747}' +
      '#espil-hud2-mmlayer .h2-mk.blu{background:#57a8ff}' +
      '#espil-hud2-mmlayer .h2-mkp{position:absolute;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;' +
        'background:#fff;clip-path:polygon(50% 0,100% 100%,0 100%);filter:drop-shadow(0 0 2px #000)}' +
    '}' +
    /* ---- LANDSCAPE arrangement (reference 1) ---- */
    '@media (pointer:coarse) and (orientation:landscape){' +
      'body.in-map #espil-hud2-coin{left:10px;top:10px;flex-direction:column;gap:3px}' +
      '#espil-hud2-coin .h2-medal{width:30px;height:30px;font-size:13px}' +
      'body.in-map #espil-hud2-score{top:10px;width:320px;height:30px;padding:0 22px}' +
      'body.in-map #minimap-wrap[data-stage="1"]{top:10px!important;right:10px!important;left:auto!important;' +
        'width:118px!important;height:118px!important;border-radius:12px!important;transform:none}' +
      'body.in-map #espil-hud2-timefps{top:132px;right:10px;width:118px}' +
      'body.in-map #espil-hud2-menu{left:50%;transform:translateX(-50%);top:46px;flex-direction:row}' +
      'body.in-map #espil-hud2-bars{left:50%;transform:translateX(-50%);bottom:14px;width:min(210px,32vw)}' +
      'body.in-map #espil-hud2-actions{right:8px;bottom:8px;width:236px;height:132px}' +
      'body.in-map #espil-hud2-chars{display:none!important}' +
      /* chat toggle (Han 2026-11-17): landscape gains the chat
         open/close button too - the coin column ends ~59px down
         (top:10 + 30px medal + 3px gap + the number line), so a
         44px button at top:62 clears it and stops 2px above the
         chat window's own top edge (108). Portrait keeps its
         bottom-left spot (see the portrait block). */
      'body.in-map #espil-hud2-chat{display:flex;position:fixed;z-index:36;left:12px;top:62px;width:44px;height:44px;font-size:19px}' +
      /* __espilChatSwipe v1: the restore tab rests at the chat
         zone's top edge (zone top 108 + 12) while it is hidden. */
      '#espil-hud2-chat-tab{top:120px}' +
    '}' +
    /* ---- PORTRAIT arrangement (reference 2) ---- */
    '@media (pointer:coarse) and (orientation:portrait){' +
      'body.in-map .joystick{width:118px!important;height:118px!important;left:14px!important;bottom:56px!important;opacity:.22!important}' +
      'body.in-map .joystick.joy-live{opacity:.55!important}' +
      'body.in-map #minimap-wrap[data-stage="1"]{top:10px!important;left:10px!important;right:auto!important;' +
        'width:92px!important;height:92px!important;border-radius:50%!important;transform:none}' +
      'body.in-map #espil-hud2-timefps{top:106px;left:10px;right:auto;width:92px;font-size:9px;padding:1px 5px}' +
      'body.in-map #espil-hud2-coin{left:110px;top:10px;flex-direction:row}' +
      '#espil-hud2-coin .h2-medal{width:20px;height:20px;font-size:9px}' +
      '#espil-hud2-coin .h2-num{font-size:10px}' +
      'body.in-map #espil-hud2-menu{top:10px;right:10px;flex-direction:row}' +
      'body.in-map #espil-hud2-score{top:66px;left:110px;transform:none;width:250px;height:22px;padding:0 16px;font-size:10px}' +
      'body.in-map #espil-hud2-chars{display:flex;position:fixed;z-index:36;right:8px;top:32%;width:94px;flex-direction:column;gap:5px}' +
      'body.in-map #espil-hud2-bars{left:50%;transform:translateX(-50%);bottom:12px;width:172px}' +
      'body.in-map #espil-hud2-actions{right:6px;bottom:64px;width:238px;height:132px}' +
      'body.in-map #espil-hud2-chat{display:flex;position:fixed;z-index:36;left:8px;bottom:6px;width:44px;height:44px;font-size:19px}' +
      /* __espilChatSwipe v1: the restore tab rests at the chat
         zone's top edge (zone top 200 + 12) while it is hidden. */
      '#espil-hud2-chat-tab{top:212px}' +
      /* Genshin separation (Han 2026-11-09): portrait drops every
         inherited piece of the PC log skin - thin light rings, flat
         translucent glass, white glyphs, a flat green HP fill, plain
         white level text. Every rule below lives inside the portrait
         media block only; landscape keeps the reference-1 skin. */
      'body.in-map #minimap-wrap[data-stage="1"]{border:1.5px solid rgba(255,255,255,.55)!important;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.35)!important}' +
      'body.in-map #espil-hud2-timefps{background:rgba(18,22,28,.45);border:1px solid rgba(255,255,255,.22);color:#fff}' +
      '#espil-hud2-coin .h2-medal{background:#f5b301;border:1px solid rgba(255,255,255,.65);color:#4a3200;box-shadow:none}' +
      '#espil-hud2-coin .h2-num{background:rgba(18,22,28,.45);color:#fff}' +
      '#espil-hud2-menu button{border:1px solid rgba(255,255,255,.4);background:rgba(18,22,28,.45);color:#fff}' +
      'body.in-map #espil-hud2-score{clip-path:none;border-radius:11px;background:rgba(18,22,28,.45)}' +
      'body.in-map #espil-hud2-score .h2-zone-t{color:#fff}' +
      '#espil-hud2-bars .h2-lv{background:none;color:#fff;text-shadow:0 1px 2px #000;padding:2px 2px}' +
      '#espil-hud2-bars .h2-track{background:rgba(10,12,14,.5);border:1px solid rgba(255,255,255,.4)}' +
      '#espil-hud2-bars .h2-track.hp i{background:#79d93b}' +
      '#espil-hud2-bars .h2-track.mp i{background:#57b6f0}' +
      '#espil-hud2-actions button{background:rgba(18,22,28,.5);border:1.5px solid rgba(255,255,255,.55);' +
        'color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3)}' +
      '#espil-hud2-actions button.h2-util{background:rgba(18,22,28,.5);border-color:rgba(255,255,255,.55)}' +
      '#espil-hud2-actions button[data-fly]{background:rgba(18,22,28,.5);border-color:rgba(255,255,255,.55)}' +
      '#espil-hud2-chat{background:rgba(18,22,28,.45);border:1px solid rgba(255,255,255,.4)}' +
      '#espil-hud2-chat-tab{background:rgba(18,22,28,.55);border-color:rgba(255,255,255,.4)}' +
      '.chat-window{background:rgba(14,17,22,.8);border:1px solid rgba(255,255,255,.3);color:#fff;' +
        'box-shadow:0 8px 18px rgba(0,0,0,.35)}' +
      '.chat-window .chat-log{color:#fff;text-shadow:none}' +
      '.chat-channel{color:rgba(255,255,255,.85)}' +
      '.chat-channel.is-active{background:rgba(255,255,255,.2);color:#fff}' +
      '#chat-input{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.35);color:#fff}' +
      '#chat-bubble{background:rgba(18,22,28,.6);border:1px solid rgba(255,255,255,.4);color:#fff}' +
      '.espil-chat-line{background:rgba(18,22,28,.45);border:1px solid rgba(255,255,255,.22);color:#fff}' +
      '#espil-tut{background:rgba(18,22,28,.55)!important;color:#fff!important;border:1px solid rgba(255,255,255,.35)!important;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.3)!important;text-shadow:none!important}' +
      '#espil-tut .kb{background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.4)!important;color:#fff!important;box-shadow:none!important}' +
    '}' +
    /* ---- MINIMAP EXPAND COUNTER-PIN + CHAT OFF (Han 2026-11-17) ---
       The two orientation blocks above pin the stage-1 wrap size
       with !important (118px landscape / 92px portrait), and
       pair.css's .mm-big rule carries no !important - so the
       2026-11-06 tap handler's class landed but the wrap never
       grew, and the tap read as dead on phones. This counter-pin
       (same body.in-map + attribute ladder plus the .mm-big class,
       later in this sheet) restores pair.css's expanded size while
       .mm-big is on; the resting pins are untouched when it is off.
       .chat-off is the chat toggle's hidden state: display:none on
       the window only - the node, its log and its scroll survive. */
    '@media (pointer:coarse){' +
      'body.in-map #minimap-wrap[data-stage="1"].mm-big{width:min(78vw,78dvh,calc(100dvh - 136px))!important;height:min(78vw,78dvh,calc(100dvh - 136px))!important}' +
      '.chat-window.chat-off{display:none!important}' +
      /* __espilChatSwipe v1 (Han 2026-11-19): the chat window takes
         vertical pans natively (the log scrolls) while horizontal
         drags reach the swipe recogniser below; the drag classes
         carry the finger-follow and the snap-back. The "채팅" tab
         is display:none unless .chat-tab-on (the swipe-hidden
         state) - its per-orientation top offsets live in the two
         orientation blocks, at the chat zone's own top edge. */
      '.chat-window{touch-action:pan-y}' +
      '.chat-window.chat-drag{transition:none!important}' +
      '.chat-window.chat-snap{transition:transform .18s ease-out!important}' +
      '#espil-hud2-chat-tab{display:none;position:fixed;left:0;z-index:36;height:48px;min-width:60px;' +
        'padding:0 16px 0 12px;border-radius:0 24px 24px 0;border:1.5px solid rgba(255,255,255,.5);border-left:none;' +
        'background:rgba(16,20,26,.82);color:#fff;font:700 14px "Manrope",sans-serif;align-items:center;' +
        'justify-content:center;cursor:pointer;touch-action:manipulation;box-shadow:2px 2px 9px rgba(0,0,0,.4)}' +
      '#espil-hud2-chat-tab.chat-tab-on{display:flex}' +
      '#espil-hud2-chat{position:fixed}' +
      '#espil-hud2-chat .h2-chat-badge{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 5px;' +
        'border-radius:10px;background:#e5484d;border:1.5px solid #fff;color:#fff;font:800 10px/16px "Manrope",sans-serif;' +
        'display:none;align-items:center;justify-content:center;pointer-events:none;box-sizing:border-box}' +
      '#espil-hud2-chat.has-unread .h2-chat-badge{display:flex}' +
    '}' +
    /* ---- QUICK SLOTS + MENU SHEET (Han 2026-11-11) ----------------
       The 4-slot quick bar lives inside the action box as a flex
       row; the menu sheet and the slot-assign sheet are HUD2-owned
       overlays (coarse only in practice - the fine block below
       hard-hides them on desktop). Slot buttons opt out of the
       action box's absolute positioning. */
    '#espil-hud2-quick{position:absolute;right:2px;bottom:68px;display:flex;gap:6px}' +
    '#espil-hud2-quick button{position:relative!important;width:52px;height:52px;flex:none}' +
    '#espil-hud2-quick button .ci{font-size:22px}' +
    '#espil-hud2-quick button .h2-slotn{position:absolute;top:-4px;left:-4px;z-index:2;min-width:16px;height:16px;' +
      'padding:0 4px;border-radius:8px;background:#3a2817;color:#ffe9a8;font-size:10px;font-weight:800;' +
      'display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,233,168,.5)}' +
    '#espil-hud2-quick button .h2-cd{position:absolute;inset:0;border-radius:50%;display:none;' +
      'align-items:center;justify-content:center;font:800 13px "Manrope",sans-serif;color:#fff;' +
      'text-shadow:0 1px 2px #000;pointer-events:none;z-index:1}' +
    '#espil-hud2-quick button.h2-empty{opacity:.55;border-style:dashed}' +
    '#espil-hud2-sheet,#espil-hud2-assign{position:fixed;inset:0;z-index:88;display:none;' +
      'align-items:center;justify-content:center;background:rgba(5,7,10,.55)}' +
    '#espil-hud2-sheet.open,#espil-hud2-assign.open{display:flex}' +
    '.h2-sheet-card{width:min(330px,88vw);max-height:82dvh;overflow-y:auto;background:rgba(14,17,22,.95);' +
      'border:1.5px solid rgba(255,233,168,.45);border-radius:16px;padding:14px;color:#fff;' +
      'font-family:"Manrope",sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.5)}' +
    '.h2-sheet-title{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'font:800 15px "Manrope",sans-serif;margin-bottom:10px}' +
    '.h2-sheet-close{width:48px;height:48px;flex:none;border-radius:50%;border:1px solid rgba(255,255,255,.4);' +
      'background:rgba(255,255,255,.08);color:#fff;font-size:19px;line-height:1;display:flex;align-items:center;' +
      'justify-content:center;padding:0;cursor:pointer;touch-action:manipulation}' +
    '.h2-sheet-row{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;margin:0 0 8px;' +
      'padding:10px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.28);' +
      'border-radius:12px;color:#fff;font:800 15px "Manrope",sans-serif;cursor:pointer;text-align:left;' +
      'touch-action:manipulation;user-select:none;-webkit-user-select:none}' +
    '.h2-sheet-row .si{font-size:24px;line-height:1;flex:none}' +
    '.h2-sheet-row .sk{margin-left:auto;font:800 10px "Manrope",sans-serif;color:#ffe9a8;' +
      'background:rgba(0,0,0,.4);border-radius:6px;padding:2px 6px;flex:none}' +
    '.h2-sheet-row.h2-locked{opacity:.55}' +
    '.h2-sheet-row.h2-cur{border-color:#ffd97a;background:rgba(255,217,122,.14)}' +
    '@media (pointer:fine){' +
      '#espil-hud2-sheet,#espil-hud2-assign{display:none!important}' +
    '}' +
    /* compact phones: the wider control grid tightens so no zone
       is touched - portrait <=430px (bars stay bottom-centre, the
       joystick keeps its left column), landscape <=700px (the
       bars slide into the gap between joystick and action box) */
    '@media (pointer:coarse) and (orientation:portrait) and (max-width:430px){' +
      'body.in-map #espil-hud2-actions{width:216px;height:120px}' +
      '#espil-hud2-quick{bottom:62px}' +
      '#espil-hud2-quick button{width:48px;height:48px}' +
    '}' +
    '@media (pointer:coarse) and (orientation:landscape) and (max-width:700px){' +
      'body.in-map #espil-hud2-actions{width:222px;height:124px}' +
      'body.in-map #espil-hud2-bars{left:186px;transform:none;width:144px}' +
      '#espil-hud2-quick{bottom:64px}' +
      '#espil-hud2-quick button{width:48px;height:48px}' +
    '}' +
    /* ---- HUD3 composition: chat window + quest chip zones ---------
       The chat window and the tutorial chip are not HUD2 elements,
       but the composition owns their placement on coarse pointers:
       pair.css carries their structure, tutorial.js carries the
       chip's own anchor (the same values, in its sheet), and the
       pins below hold the zones regardless of sheet order. */
    '@media (pointer:coarse){' +
      '.chat-window{display:flex;flex-direction:column;pointer-events:auto}' +
      '.chat-window .chat-log{flex:1 1 auto;min-height:0;max-height:none}' +
      '.chat-window .chat-input{display:block}' +
      '.chat-window.is-expanded{z-index:70}' +
    '}' +
    '@media (pointer:coarse) and (orientation:landscape){' +
      /* chat zone: the left column under the coin; its bottom edge
         rests 170px off the bottom, above the joystick's top edge
         (160px). Expanding changes nothing geometrically here -
         the zone is already the full resting size. */
      '.chat-window{left:12px;right:auto;top:108px;bottom:calc(170px + env(safe-area-inset-bottom,0px));width:min(320px,40vw);max-height:none}' +
      '.chat-window.is-expanded{width:min(320px,40vw);height:auto}' +
      /* quest chip: the right column under the time/FPS bar
         (minimap 10..128, bar 132..~154, chip from 160) */
      'body.in-map #espil-tut{top:160px!important;right:14px!important;left:auto!important;transform:none!important;max-width:40vw}' +
    '}' +
    '@media (pointer:coarse) and (orientation:portrait){' +
      /* chat zone: the left column under the quest chip (chip
         132..~191 worst case, chat from 200). Resting, the log
         shows up to ~6 lines and the window hugs its content;
         expanded, it stretches inside the zone down to a bottom
         edge 190px off the bottom - clear of the joystick's top
         edge (174px) and of the raised action cluster (the chat's
         right edge is at 52vw+10, the cluster starts further
         right on every phone width). */
      '.chat-window{left:10px;right:auto;top:200px;bottom:auto;width:min(300px,52vw);max-height:none}' +
      '.chat-window .chat-log{flex:0 1 auto;max-height:96px}' +
      '.chat-window.is-expanded{width:min(300px,52vw);height:calc(100dvh - 390px)}' +
      '.chat-window.is-expanded .chat-log{flex:1 1 auto;max-height:none}' +
      /* quest chip: the left column under the time/FPS chip
         (minimap 10..102, chip 106..~126, quest from 132) */
      'body.in-map #espil-tut{top:132px!important;left:10px!important;right:auto!important;transform:none!important;max-width:54vw;text-align:left}' +
    '}' +
    /* ---- FLIP BOOK MENU (Han 2026-11-16) -------------------------
       The mobile menu as a bound book of pages: the hbi form
       re-implemented natively (no turn.js, no jQuery - the pattern
       only). A frame rail owns the ONLY close button; pages host
       the existing panels so state never forks; shell geometry is
       vw/vh only. Built and shown under coarse pointers only -
       this whole block is inert on desktop. */
    '@media (pointer:coarse){' +
      '#espil-hud2-book{position:fixed;inset:0;z-index:9995;display:none;align-items:center;justify-content:center;background:rgba(5,7,10,.55)}' +
      '#espil-hud2-book.open{display:flex}' +
      '.bk-frame{display:flex;flex-direction:column;width:94vw;height:84dvh;border:2px solid #54381f;border-radius:14px;' +
        'background:linear-gradient(180deg,#3a2817,#241708);box-shadow:0 18px 50px rgba(0,0,0,.6);overflow:hidden;color:#fff;' +
        'font-family:"Manrope",sans-serif}' +
      '.bk-rail{flex:none;height:9dvh;display:flex;align-items:center;gap:2.5vw;padding:0 2.5vw;' +
        'border-bottom:1px solid rgba(255,233,168,.35)}' +
      '.bk-nav{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.4);' +
        'background:rgba(255,255,255,.08);color:#fff;font-size:22px;line-height:1;display:flex;align-items:center;' +
        'justify-content:center;padding:0;cursor:pointer;touch-action:manipulation}' +
      '.bk-nav[disabled]{opacity:.35;cursor:default}' +
      '.bk-title{flex:1;font:800 15px "Manrope",sans-serif;color:#ffe9a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.bk-pos{flex:none;font:800 11px "Manrope",sans-serif;color:rgba(255,255,255,.75)}' +
      '.bk-close{flex:none;width:clamp(44px,11vw,54px);height:clamp(44px,11vw,54px);border-radius:50%;' +
        'border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.08);color:#fff;font-size:19px;line-height:1;' +
        'display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;touch-action:manipulation}' +
      '.bk-view{flex:1;position:relative;overflow:hidden;perspective:1400px;touch-action:pan-y}' +
      '.bk-page{position:absolute;left:2.5vw;right:2.5vw;top:2dvh;bottom:2dvh;display:none;touch-action:pan-y}' +
      '.bk-page.cur{display:block}' +
      '.bk-view.flipping .bk-page{pointer-events:none}' +
      '.bk-slot{position:absolute;inset:0}' +
      '.bk-scroll{height:100%;overflow-y:auto}' +
      '.bk-status{font:800 13px "Manrope",sans-serif;color:#ffe9a8;margin:2px 2px 12px}' +
      '.bk-map-cur{font:700 14px "Manrope",sans-serif;margin:4px 2px 12px}' +
      '.bk-map-note{font:600 12px/1.5 "Manrope",sans-serif;color:rgba(255,255,255,.7);margin:10px 2px}' +
      '.bk-pocket{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,rgba(0,0,0,.5),rgba(0,0,0,.12) 70%);opacity:0;pointer-events:none;z-index:4}' +
      '.bk-leaf{position:absolute;left:2.5vw;right:2.5vw;top:2dvh;bottom:2dvh;display:none;z-index:6;pointer-events:none;transform-style:preserve-3d;will-change:transform}' +
      '.bk-face{position:absolute;inset:0;overflow:hidden;border-radius:10px;backface-visibility:hidden;-webkit-backface-visibility:hidden;' +
        'background:linear-gradient(180deg,#43301b,#2b1c0d);border:1.5px solid #54381f}' +
      '.bk-face.back{transform:rotateY(180deg)}' +
      '.bk-clone{position:absolute;inset:0}' +
      '.bk-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,0) 60%);opacity:0;pointer-events:none}' +
      '.bk-face.back .bk-shade{background:linear-gradient(270deg,rgba(0,0,0,.5),rgba(0,0,0,0) 60%)}' +
      /* booked presentation: a hosted window fills its page; the
         frame X is the only close, so per-window closes hide.
         Desktop rules are untouched - none of this can match
         outside a coarse-pointer session with the book open. */
      '.skill-tree.espil-booked{position:static!important;inset:auto!important;width:100%!important;height:100%!important;' +
        'background:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;z-index:auto!important}' +
      '.skill-tree.espil-booked[aria-hidden="false"]{display:block!important}' +
      '#settings-panel.espil-booked{position:static!important;inset:auto!important;width:100%!important;height:100%!important;background:none!important;z-index:auto!important}' +
      '#settings-panel.espil-booked.open{display:block!important}' +
      '#espil-cash-window.espil-booked{position:static!important;inset:auto!important;width:100%!important;height:100%!important;background:none!important;z-index:auto!important}' +
      '#espil-cash-window.espil-booked.open{display:block!important}' +
      '.espil-booked .st-card{width:100%!important;max-width:none!important;height:100%;max-height:none!important;transform:none!important;overflow-y:auto!important}' +
      '.espil-booked .set-card{width:100%!important;max-width:none!important;height:100%;max-height:none!important}' +
      '.espil-booked .ecw-card{width:100%!important;max-width:none!important;height:100%;max-height:none!important}' +
      '.espil-booked .st-close,.espil-booked .ecw-close{display:none!important}' +
      '.espil-booked .st-grid{overflow-y:auto!important}' +
      '#skill-tree.espil-booked .st-treeview{height:44dvh;flex:none}' +
      /* flex:none matters: game-ui makes .st-card a column
         flex box, and the treeview's automatic minimum is 0
         (its nodes are absolutely positioned), so on short
         screens it shrinks to a 2px strip and its nodes
         become unhittable. Unshrunk, the card's own
         overflow-y:auto scrolls the rest of the page. */
      '#skill-tree.espil-booked .st-desc{min-height:0}' +
    '}' +
    /* landscape: the ledger form - height-led sizing, rail in dvh */
    '@media (pointer:coarse) and (orientation:landscape){' +
      '.bk-frame{height:92dvh;width:min(96vw,150dvh)}' +
      '.bk-rail{height:13dvh;gap:2.5dvh;padding:0 2.5dvh}' +
      '.bk-close{width:clamp(44px,12dvh,54px);height:clamp(44px,12dvh,54px)}' +
      '.bk-page{left:2.5dvh;right:2.5dvh}' +
      '.bk-leaf{left:2.5dvh;right:2.5dvh}' +
      /* the tree's node rows are positioned in % of the
         treeview, so at the portrait-led 44dvh on a 390px-tall
         screen the layout compresses ~2.6x and sibling nodes
         overlap each other's centres (measured). Landscape
         restores the tree's natural 440px design height
         (112dvh at 390px); the booked card scrolls to it. */
      '#skill-tree.espil-booked .st-treeview{height:112dvh}' +
    '}';
  var styleEl = document.createElement('style');
  styleEl.id = 'espil-hud2-style';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  function sendKey(key, code) {
    ['keydown', 'keyup'].forEach(function (t) {
      document.dispatchEvent(new KeyboardEvent(t, { key: key, code: code, bubbles: true, cancelable: true }));
    });
  }
  function coarse() { try { return !!(window.matchMedia && matchMedia('(pointer:coarse)').matches); } catch (e) { return false; } }
  function portrait() { try { return !!(window.matchMedia && matchMedia('(orientation:portrait)').matches); } catch (e) { return false; } }
  function el(id) { return document.getElementById(id); }
  function mk(tag, id, html) { var d = document.createElement(tag); if (id) d.id = id; if (html != null) d.innerHTML = html; return d; }

  /* ---- DOM ---- */
  var coin = mk('div', 'espil-hud2-coin', '<span class="h2-medal">L</span><span class="h2-num">1,000</span>');
  coin.setAttribute('aria-label', 'Leo balance');
  var score = mk('div', 'espil-hud2-score',
    '<span class="h2-sk">💀 <span class="h2-kills-n">0</span></span>' +
    '<span class="h2-zone-t">-</span>' +
    '<span class="h2-act">👾 <span class="h2-act-n">0</span></span>');
  score.setAttribute('aria-label', 'Score');
  var timefps = mk('div', 'espil-hud2-timefps', '<span class="h2-clock">--:--</span><span class="h2-fps">FPS -</span>');
  var bars = mk('div', 'espil-hud2-bars',
    '<div class="h2-hprow"><span class="h2-lv">Lv 1</span>' +
    '<div class="h2-track hp"><i></i><span class="h2-hp-num">100/100</span></div></div>' +
    '<div class="h2-track mp"><i></i></div>');
  var chars = mk('div', 'espil-hud2-chars');
  chars.setAttribute('aria-label', 'Nearby characters');
  var chatBtn = mk('button', 'espil-hud2-chat', '💬');
  chatBtn.type = 'button';
  chatBtn.setAttribute('aria-label', 'Chat');
  /* ---- chat open/close toggle (Han 2026-11-17) -------------------
     This button used to toggle the window's .is-expanded size; the
     2026-11-17 order makes it the chat window's open/close toggle
     (the window covered too much of the map on phones). Closing
     only adds .chat-off (display:none) - the window node, its log,
     its scroll position and its .is-expanded state all survive,
     and the monolith keeps appending incoming lines while it is
     hidden, so reopening restores the same window as it was.
     Lines that arrive while it is closed are counted on the
     button's unread badge; opening clears the count. Expanding
     itself is untouched: the window tap and #chat-expand still
     toggle .is-expanded exactly as before. The window starts
     open, exactly as it did before this toggle existed. */
  var chatBadge = mk('span', null, '0');
  chatBadge.className = 'h2-chat-badge';
  chatBtn.appendChild(chatBadge);
  var chatUnread = 0, chatOff = false, chatObs = null;
  /* __espilChatSwipe v1: provenance of the current hidden state -
     'swipe' | 'toggle' | null. chatOff stays the ONE visibility
     boolean; this flag only decides whether the "채팅" restore
     tab shows (it belongs to the swipe interaction, Han
     2026-11-19). Session-only, like chatOff itself. */
  var chatHiddenBy = null;
  function chatWin() { return document.querySelector('.chat-window'); }
  function chatPaintBadge() {
    chatBadge.textContent = chatUnread > 9 ? '9+' : String(chatUnread);
    chatBtn.classList.toggle('has-unread', chatOff && chatUnread > 0);
    chatBtn.setAttribute('aria-expanded', chatOff ? 'false' : 'true');
  }
  function chatSetOff(off, src) {
    var w = chatWin(); if (!w) return;
    chatOff = !!off;
    chatHiddenBy = chatOff ? (src || 'toggle') : null;
    w.classList.toggle('chat-off', chatOff);
    chatPaintTab();
    if (chatOff) {
      /* a hidden input must not keep the keyboard/focus hostage */
      var inp = el('chat-input');
      if (inp && document.activeElement === inp) { try { inp.blur(); } catch (err) {} }
    } else {
      chatUnread = 0;
    }
    chatPaintBadge();
  }
  chatBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    chatSetOff(!chatOff, 'toggle');
  });
  /* Count lines appended while the window is closed. The log node
     (#chat-log, the monolith's) is pair-page DOM, present by the
     time this module runs; retry briefly in case of load order. */
  (function chatWatch() {
    var log = el('chat-log');
    if (!log) { setTimeout(chatWatch, 600); return; }
    if (chatObs) return;
    chatObs = new MutationObserver(function (muts) {
      if (!chatOff) return;
      var n = 0;
      muts.forEach(function (m) { n += m.addedNodes.length; });
      if (n > 0) { chatUnread += n; chatPaintBadge(); }
    });
    chatObs.observe(log, { childList: true });
  })();
  window.__espilHud2ChatState = function () {
    var w = chatWin();
    var tb = el('espil-hud2-chat-tab');
    return {
      off: chatOff,
      unread: chatUnread,
      hiddenBy: chatHiddenBy,
      tabVisible: !!(tb && tb.classList.contains('chat-tab-on')
        && getComputedStyle(tb).display !== 'none'),
      windowDisplay: w ? getComputedStyle(w).display : null,
      expanded: w ? w.classList.contains('is-expanded') : null,
      logChildren: (el('chat-log') || {}).children ? el('chat-log').children.length : 0
    };
  };

  /* ---- chat swipe-to-hide + "채팅" restore tab (__espilChatSwipe
     v1, Han 2026-11-19) ---------------------------------------------
     One state machine: this block owns NO visibility state of its
     own. A committed left swipe calls the toggle's own
     chatSetOff(true, 'swipe'); the tab and the 💬 button both call
     chatSetOff(false). chatOff stays the single boolean; the tab
     shows only for the swipe-hidden state (chatHiddenBy), while a
     toggle-hidden window keeps the pre-2026-11-19 screen exactly -
     the 💬 button alone, badge and all. Session-only, like the
     toggle: nothing is persisted.
     The gesture: a horizontal-dominant drag on the window follows
     the finger leftward (the window's own touch-action:pan-y keeps
     vertical pans native, so a log scroll never arms the swipe);
     release past the threshold (72px or 30% of the window width,
     whichever is smaller) commits the hide, anything less snaps
     back. A drag past 12px swallows the click it would otherwise
     end with, so the window's tap-to-expand never fires mid-swipe.
     Starts on the input, a channel chip or any button are not
     swipe starts - those keep their own gestures. Coarse pointers
     and the in-map page only; place-space / arena child windows
     never arm this (their chat rules are untouched). */
  var chatTab = mk('button', 'espil-hud2-chat-tab', '채팅');
  chatTab.type = 'button';
  chatTab.setAttribute('aria-label', '채팅 열기');
  function chatPaintTab() {
    if (!chatTab) return;
    chatTab.classList.toggle('chat-tab-on', !!(chatOff && chatHiddenBy === 'swipe'));
  }
  chatTab.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    chatSetOff(false, 'tab');
    /* The tap's own click lands AFTER pointerdown - by then the
       tab is gone and the restored window sits under the same
       point, so the click would toggle the window's tap-to-expand.
       Swallow that one click (the drag path uses the same flag). */
    chatSwallowClick = true;
    setTimeout(function () { chatSwallowClick = false; }, 400);
  });
  var chatSwipe = null, chatSwallowClick = false;
  function chatSwipeSnapBack(w) {
    w.classList.remove('chat-drag');
    w.classList.add('chat-snap');
    w.style.transform = 'translateX(0px)';
    setTimeout(function () {
      w.classList.remove('chat-snap');
      w.style.transform = '';
    }, 220);
  }
  document.addEventListener('touchstart', function (e) {
    chatSwipe = null;
    if (chatOff || !coarse()) return;
    if (!document.body || !document.body.classList.contains('in-map')) return;
    if (!e.touches || e.touches.length !== 1) return;
    var w = chatWin();
    if (!w) return;
    var t = e.target;
    if (!t || !t.closest || !w.contains(t)) return;
    if (t.closest('#chat-input, button, a, select, textarea, .chat-channel')) return;
    chatSwipe = { w: w, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, mode: null };
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!chatSwipe || !e.touches || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - chatSwipe.x0;
    var dy = e.touches[0].clientY - chatSwipe.y0;
    if (!chatSwipe.mode) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { chatSwipe = null; return; }
      if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) {
        chatSwipe.mode = 'drag';
        chatSwipe.w.classList.add('chat-drag');
      } else return;
    }
    chatSwipe.dx = dx;
    var off = Math.max(Math.min(dx, 0), -chatSwipe.w.offsetWidth);
    chatSwipe.w.style.transform = 'translateX(' + off + 'px)';
  }, { passive: true });
  function chatSwipeEnd(commit) {
    if (!chatSwipe) return;
    var s = chatSwipe; chatSwipe = null;
    if (s.mode !== 'drag') return;
    if (Math.abs(s.dx) > 12) {
      chatSwallowClick = true;
      setTimeout(function () { chatSwallowClick = false; }, 400);
    }
    var thr = Math.min(72, Math.round(s.w.offsetWidth * 0.3));
    if (commit && s.dx <= -thr) {
      s.w.classList.remove('chat-drag');
      s.w.style.transform = '';
      chatSetOff(true, 'swipe');
    } else {
      chatSwipeSnapBack(s.w);
    }
  }
  document.addEventListener('touchend', function () { chatSwipeEnd(true); }, { passive: true });
  document.addEventListener('touchcancel', function () { chatSwipeEnd(false); }, { passive: true });
  document.addEventListener('click', function (e) {
    if (!chatSwallowClick) return;
    chatSwallowClick = false;
    if (e.target && e.target.closest && e.target.closest('.chat-window')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  window.__espilChatSwipeState = function () {
    return {
      hiddenBy: chatHiddenBy,
      tabOn: !!(chatTab && chatTab.classList.contains('chat-tab-on')),
      dragging: !!(chatSwipe && chatSwipe.mode === 'drag')
    };
  };

  /* ---- menu: ONE icon + a sheet (Han 2026-11-11) -----------------
     The fixed shortcuts (skill tree, items, bag - plus the map and
     stall the old chip row also carried) gather behind a single
     menu icon: the sheet is the one place they live now. Firing an
     entry closes the sheet first, then opens the real panel through
     its existing route, so nothing can sit trapped under the sheet
     and panel z-order never matters. */
  var menu = mk('div', 'espil-hud2-menu');
  menu.setAttribute('aria-label', 'Menu');
  var sheet = mk('div', 'espil-hud2-sheet');
  sheet.setAttribute('aria-hidden', 'true');
  var SHEET = [
    { id: 'skill', icon: '⚔️', label: 'Skill tree', key: 'K', fn: function () {
        if (window.__espilSkills && window.__espilSkills.tree) window.__espilSkills.tree();
        else sendKey('k', 'KeyK'); } },
    { id: 'items', icon: '🧰', label: 'Items', key: 'P', fn: function () {
        if (window.__espilOpenSelfProfile) window.__espilOpenSelfProfile();
        else sendKey('p', 'KeyP'); } },
    { id: 'bag', icon: '🎒', label: 'Bag', key: 'I', fn: function () {
        if (window.__espilGearWindow && window.__espilGearWindow.openBag) window.__espilGearWindow.openBag();
        else sendKey('i', 'KeyI'); } },
    { id: 'map', icon: '🗺️', label: 'Map', key: 'M', fn: function () { sendKey('m', 'KeyM'); } },
    { id: 'stall', icon: '🧺', label: 'Stall', key: 'Y', fn: function () { sendKey('y', 'KeyY'); } }
  ];
  function sheetOpen() { return sheet.classList.contains('open'); }
  function openSheet() {
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }
  (function buildSheet() {
    /* coarse pointers get the flip book instead (Han 2026-11-16);
       the sheet element itself stays, empty and safe to query. */
    if (coarse()) return;
    var card = mk('div', null);
    card.className = 'h2-sheet-card';
    var title = mk('div', null, '<span>Menu</span>');
    title.className = 'h2-sheet-title';
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'h2-sheet-close';
    x.setAttribute('aria-label', 'Close menu');
    x.textContent = '✕';
    x.addEventListener('pointerdown', function (e) { e.preventDefault(); closeSheet(); });
    title.appendChild(x);
    card.appendChild(title);
    SHEET.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'h2-sheet-row';
      b.setAttribute('data-sheet', d.id);
      b.setAttribute('aria-label', d.label);
      b.innerHTML = '<span class="si">' + d.icon + '</span><span>' + d.label + '</span>' +
        '<span class="sk">' + d.key + '</span>';
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        closeSheet();
        try { d.fn(); } catch (err) {}
      });
      card.appendChild(b);
    });
    sheet.appendChild(card);
    sheet.addEventListener('pointerdown', function (e) { if (e.target === sheet) closeSheet(); });
  })();
  var menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.setAttribute('data-menu', 'menu');
  menuBtn.setAttribute('aria-label', 'Menu');
  menuBtn.textContent = '☰';
  menuBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (coarse()) { if (bkIsOpen()) bkCloseBook(); else bkOpenBook(); }
    else if (sheetOpen()) closeSheet(); else openSheet();
  });
  menu.appendChild(menuBtn);

  /* ---- FLIP BOOK MENU (Han 2026-11-16) -------------------------
     Nine pages: Index, Skill, Items, Bag, Map, Stall, Friends /
     Party, Settings, Cash Shop (Han's scope decision 2026-11-16).
     A page that wraps an existing window MOVES that window's node
     into the page slot while the page is current and returns it
     when the page is left; opening and closing always go through
     the window's own existing routes, so its state (aria-hidden
     or class), its stores and its side effects never fork. The
     frame rail carries the book's only close button. Coarse
     pointers only - under fine pointers none of this is built. */
  var BK_PAGES = [
    { id: 'index', title: 'Menu' },
    { id: 'skill', title: 'Skill tree', panelId: 'skill-tree', closeId: 'st-close',
      open: function () {
        if (window.__espilSkills && window.__espilSkills.tree) window.__espilSkills.tree();
        else sendKey('k', 'KeyK');
      } },
    { id: 'items', title: 'Items', panelId: 'character-panel', closeId: 'char-close',
      open: function () {
        if (window.__espilOpenSelfProfile) window.__espilOpenSelfProfile();
        else sendKey('p', 'KeyP');
      } },
    { id: 'bag', title: 'Bag', panelId: 'inventory-panel', closeId: 'inv-close',
      open: function () {
        if (window.__espilGearWindow && window.__espilGearWindow.openBag) window.__espilGearWindow.openBag();
        else sendKey('i', 'KeyI');
      } },
    { id: 'map', title: 'Map' },
    { id: 'stall', title: 'Stall', panelId: 'stall-panel', closeId: 'stall-close',
      open: function () { sendKey('y', 'KeyY'); } },
    { id: 'friends', title: 'Friends / Party', panelId: 'friends-panel', closeId: 'friends-close',
      open: function () { sendKey('o', 'KeyO'); } },
    { id: 'settings', title: 'Settings', nodeId: 'settings-panel', closeId: 'set-close',
      open: function () { var g = el('city-settings'); if (g) g.click(); },
      isOpen: function () { var n = el('settings-panel'); return !!(n && n.classList.contains('open')); } },
    { id: 'cash', title: 'Cash Shop', nodeId: 'espil-cash-window',
      open: function () { if (window.__espilCash) window.__espilCash.open(); },
      close: function () { if (window.__espilCash) window.__espilCash.close(); },
      isOpen: function () { var n = el('espil-cash-window'); return !!(n && n.classList.contains('open')); } }
  ];
  BK_PAGES.forEach(function (p) {
    p.hosted = false;
    p._home = null;
    p.node = function () { return el(p.panelId || p.nodeId || ''); };
    if (p.panelId && !p.isOpen) p.isOpen = function () {
      var n = p.node(); return !!(n && n.getAttribute('aria-hidden') === 'false');
    };
    if (!p.close) p.close = function () {
      var b = p.closeId ? el(p.closeId) : null; if (b) b.click();
    };
  });
  var book = null, bkFrame, bkView, bkLeaf, bkLeafFront, bkLeafBack, bkShadeF, bkShadeB,
      bkPocket, bkRailTitle, bkRailPos, bkPrevBtn, bkNextBtn, bkCloseBtn;
  var bkCur = 0, bkOpenState = false, bkFlipping = false,
      bkLeafDir = 1, bkDrag = null, bkFlipFrom = null, bkFlipToIdx = -1;
  function bkIsOpen() { return bkOpenState; }
  function bkHost(p) {
    var n = p.node();
    if (!n || p.hosted) return;
    p._home = { parent: n.parentNode, next: n.nextSibling };
    p.slot.appendChild(n);
    n.classList.add('espil-booked');
    p.hosted = true;
  }
  function bkUnhost(p) {
    var n = p.node();
    if (!n || !p.hosted) return;
    n.classList.remove('espil-booked');
    var h = p._home;
    if (h && h.parent) {
      if (h.next && h.next.parentNode === h.parent) h.parent.insertBefore(n, h.next);
      else h.parent.appendChild(n);
    } else if (document.body) document.body.appendChild(n);
    p.hosted = false;
    p._home = null;
  }
  /* host the page's window and open it through its own route;
     a window already open (e.g. reached from the game world) is
     hosted as-is and never toggled shut by the book. */
  function bkEnterPrep(p) {
    if (!p.panelId && !p.nodeId) return;
    if (!p.node() && p.open) { try { p.open(); } catch (e) {} }
    bkHost(p);
    if (p.isOpen && !p.isOpen()) { try { p.open(); } catch (e) {} }
  }
  /* leaving a page: the window's own close route, then unhost -
     exactly the side effects of its own X button today. */
  function bkLeave(p) {
    if (!p.panelId && !p.nodeId) return;
    if (p.isOpen && p.isOpen()) { try { p.close(); } catch (e) {} }
    bkUnhost(p);
  }
  /* an aborted gesture must leave no trace: if the target window
     was already open before the gesture, only unhost it. */
  function bkRestorePre(p, wasOpen) {
    if (!p.panelId && !p.nodeId) return;
    if (wasOpen) bkUnhost(p); else bkLeave(p);
  }
  function bkPaintStatus() {
    var s = el('bk-status');
    if (!s) return;
    var leo = coin.querySelector('.h2-num');
    var lv = bars.querySelector('.h2-lv');
    s.textContent = (lv && lv.textContent ? lv.textContent + ' · ' : '') +
      'Leo ' + (leo && leo.textContent ? leo.textContent : '');
  }
  function bkPaintMapStage() {
    var s = el('bk-map-stage');
    if (!s) return;
    var w = el('minimap-wrap');
    s.textContent = (w && w.getAttribute('data-stage')) || '1';
  }
  function bkPaintRail() {
    if (!bkRailTitle) return;
    bkRailTitle.textContent = BK_PAGES[bkCur].title;
    bkRailPos.textContent = (bkCur + 1) + ' / ' + BK_PAGES.length;
    bkPrevBtn.disabled = bkCur <= 0;
    bkNextBtn.disabled = bkCur >= BK_PAGES.length - 1;
  }
  function bkFaceFill(face, slot) {
    var old = face.querySelector('.bk-clone');
    if (old) old.remove();
    var c = slot.cloneNode(true);
    c.classList.add('bk-clone');
    c.removeAttribute('id');
    var withId = c.querySelectorAll('[id]');
    for (var k = 0; k < withId.length; k++) withId[k].removeAttribute('id');
    var si = slot.querySelectorAll('input,select,textarea');
    var ci = c.querySelectorAll('input,select,textarea');
    for (var i = 0; i < si.length && i < ci.length; i++) {
      if (si[i].type === 'checkbox' || si[i].type === 'radio') ci[i].checked = si[i].checked;
      else ci[i].value = si[i].value;
    }
    var sc = slot.querySelectorAll('canvas');
    var cc = c.querySelectorAll('canvas');
    for (var j = 0; j < sc.length && j < cc.length; j++) {
      try {
        var x = cc[j].getContext('2d');
        if (x) { cc[j].width = sc[j].width; cc[j].height = sc[j].height; x.drawImage(sc[j], 0, 0); }
      } catch (e) {}
    }
    face.insertBefore(c, face.firstChild);
  }
  function bkLeafTransform(deg) {
    bkLeaf.style.transform = 'rotateY(' + (bkLeafDir > 0 ? -deg : deg) + 'deg)';
  }
  function bkSetAngle(deg) {
    /* drag-time direct control: the leaf follows the finger. */
    var s = Math.sin(deg * Math.PI / 180);
    bkLeafTransform(deg);
    bkShadeF.style.opacity = (s * 0.8).toFixed(3);
    bkShadeB.style.opacity = (s * 0.8).toFixed(3);
    bkPocket.style.opacity = (s * 0.35).toFixed(3);
  }
  function bkSetLeaf(dir, fromP, toP) {
    bkLeafDir = dir;
    bkLeaf.style.transition = 'none';
    bkLeaf.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
    bkFaceFill(bkLeafFront, fromP.slot);
    bkFaceFill(bkLeafBack, toP.slot);
    bkLeaf.style.display = 'block';
    bkSetAngle(0);
  }
  function bkHideLeaf() {
    bkLeaf.style.display = 'none';
    bkPocket.style.opacity = '0';
    /* drop the face clones: they are visual-only copies that
       inherit aria-hidden="false" from their source panels -
       left in the DOM they read as open dialogs to any
       [role="dialog"] query (the cash pill's companion check
       among them). Faces are repainted on every bkSetLeaf. */
    [bkLeafFront, bkLeafBack].forEach(function (f) {
      var c = f.querySelector('.bk-clone');
      if (c) c.remove();
    });
  }
  /* Programmatic turns run on CSS transitions, not rAF: the
     compositor keeps wall-clock time even when the game's main
     thread is saturated and frames are sparse, so a turn always
     completes in its duration. The shade peaks mid-turn via a
     half-time opacity step; completion is a timer (dur + slack),
     token-guarded so a superseded turn never finishes twice. */
  var bkAnimTimers = [], bkAnimToken = 0;
  function bkAnimateTo(a1, dur, done) {
    var token = ++bkAnimToken;
    bkAnimTimers.forEach(clearTimeout);
    bkAnimTimers = [];
    var half = Math.max(1, Math.round(dur / 2));
    bkLeaf.style.transition = 'transform ' + dur + 'ms cubic-bezier(.42,0,.58,1)';
    bkShadeF.style.transition = 'opacity ' + half + 'ms linear';
    bkShadeB.style.transition = 'opacity ' + half + 'ms linear';
    bkPocket.style.transition = 'opacity ' + half + 'ms linear';
    bkLeafTransform(a1);
    bkShadeF.style.opacity = '0.55';
    bkShadeB.style.opacity = '0.55';
    bkPocket.style.opacity = '0.3';
    bkAnimTimers.push(setTimeout(function () {
      if (token !== bkAnimToken) return;
      bkShadeF.style.opacity = '0';
      bkShadeB.style.opacity = '0';
      bkPocket.style.opacity = '0';
    }, half));
    bkAnimTimers.push(setTimeout(function () {
      if (token !== bkAnimToken) return;
      bkLeaf.style.transition = 'none';
      bkShadeF.style.transition = 'none';
      bkShadeB.style.transition = 'none';
      bkPocket.style.transition = 'none';
      bkAnimTimers = [];
      if (done) done();
    }, dur + 80));
  }
  function bkAnimateCancel() {
    bkAnimToken++;
    bkAnimTimers.forEach(clearTimeout);
    bkAnimTimers = [];
  }
  function bkFinishFlip() {
    var fromP = bkFlipFrom, toP = BK_PAGES[bkFlipToIdx];
    bkLeave(fromP);
    fromP.el.classList.remove('cur');
    fromP.el.style.zIndex = '';
    toP.el.style.zIndex = '';
    bkHideLeaf();
    bkView.classList.remove('flipping');
    bkCur = bkFlipToIdx;
    bkFlipping = false;
    bkFlipFrom = null;
    bkFlipToIdx = -1;
    bkPaintRail();
  }
  function bkFlipTo(idx, dir) {
    var fromP = BK_PAGES[bkCur], toP = BK_PAGES[idx];
    bkFlipping = true;
    bkFlipFrom = fromP;
    bkFlipToIdx = idx;
    bkEnterPrep(toP);
    toP.el.classList.add('cur');
    toP.el.style.zIndex = '2';
    fromP.el.style.zIndex = '1';
    bkView.classList.add('flipping');
    if (toP.id === 'map') bkPaintMapStage();
    bkSetLeaf(dir, fromP, toP);
    void bkLeaf.offsetWidth; /* settle the start angle before the transition */
    bkAnimateTo(180, 520, bkFinishFlip);
  }
  function bkGoTo(idx) {
    if (!bkOpenState || bkFlipping || bkDrag) return;
    if (idx === bkCur || idx < 0 || idx >= BK_PAGES.length) return;
    bkFlipTo(idx, idx > bkCur ? 1 : -1);
  }
  /* edge drag: a press in the view's outer 18vw on either side
     arms a page turn in that direction; the press itself is left
     alone, so a plain tap still reaches the control under the
     finger. Past 10px of travel the leaf takes over; release
     past 45% of the view width completes the turn. */
  function bkDragArm(e) {
    if (!bkOpenState || bkFlipping || bkDrag) return;
    var r = bkView.getBoundingClientRect();
    var x = e.clientX - r.left;
    var zone = window.innerWidth * 0.18;
    var dir = 0;
    if (x <= zone && bkCur > 0) dir = -1;
    else if (x >= r.width - zone && bkCur < BK_PAGES.length - 1) dir = 1;
    if (!dir) return;
    var toP = BK_PAGES[bkCur + dir];
    bkDrag = { dir: dir, x0: e.clientX, w: r.width, target: bkCur + dir,
               leafReady: false, moved: false, prog: 0,
               preOpen: (toP.isOpen ? !!toP.isOpen() : false) };
    bkEnterPrep(toP);
    toP.el.classList.add('cur');
    toP.el.style.zIndex = '2';
    BK_PAGES[bkCur].el.style.zIndex = '1';
    if (toP.id === 'map') bkPaintMapStage();
    document.addEventListener('pointermove', bkDragMove);
    document.addEventListener('pointerup', bkDragUp);
    document.addEventListener('pointercancel', bkDragUp);
  }
  function bkDragMove(e) {
    if (!bkDrag) return;
    var prog = -bkDrag.dir * (e.clientX - bkDrag.x0) / bkDrag.w;
    if (!bkDrag.leafReady && Math.abs(e.clientX - bkDrag.x0) > 10) {
      bkDrag.leafReady = true;
      bkView.classList.add('flipping');
      bkSetLeaf(bkDrag.dir, BK_PAGES[bkCur], BK_PAGES[bkDrag.target]);
    }
    if (bkDrag.leafReady) {
      bkDrag.moved = true;
      bkDrag.prog = Math.max(0, Math.min(1, prog));
      bkSetAngle(bkDrag.prog * 180);
    }
  }
  function bkDragUp() {
    document.removeEventListener('pointermove', bkDragMove);
    document.removeEventListener('pointerup', bkDragUp);
    document.removeEventListener('pointercancel', bkDragUp);
    if (!bkDrag) return;
    var d = bkDrag;
    bkDrag = null;
    var toP = BK_PAGES[d.target], fromP = BK_PAGES[bkCur];
    if (!d.leafReady) {
      /* a tap, not a turn: undo the arming, keep the tap's own
         click (it was never intercepted) as the only effect. */
      bkRestorePre(toP, d.preOpen);
      toP.el.classList.remove('cur');
      toP.el.style.zIndex = '';
      fromP.el.style.zIndex = '';
      return;
    }
    /* the press that started this drag may still deliver a click
       to the control under the finger - swallow exactly that one. */
    var sup = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', sup, true);
    /* the stray click is delivered with the pointerup, so a
       short window suffices - and it MUST expire before the
       settle animation finishes (+280ms), or it would swallow
       the outgoing panel's own close-route click in bkLeave. */
    setTimeout(function () { document.removeEventListener('click', sup, true); }, 120);
    bkFlipping = true;
    bkFlipFrom = fromP;
    bkFlipToIdx = d.target;
    if (d.prog > 0.45) {
      bkAnimateTo(180, 200, bkFinishFlip);
    } else {
      bkAnimateTo(0, 200, function () {
        bkRestorePre(toP, d.preOpen);
        toP.el.classList.remove('cur');
        toP.el.style.zIndex = '';
        fromP.el.style.zIndex = '';
        bkHideLeaf();
        bkView.classList.remove('flipping');
        bkFlipping = false;
        bkFlipFrom = null;
        bkFlipToIdx = -1;
      });
    }
  }
  function bkOpenBook() {
    if (!book) buildBook();
    if (bkOpenState) return;
    bkOpenState = true;
    book.classList.add('open');
    book.setAttribute('aria-hidden', 'false');
    document.body.classList.add('espil-book-open');
    bkPaintStatus();
    bkPaintRail();
  }
  function bkCloseBook() {
    if (!bkOpenState) return;
    if (bkDrag) { bkDragUp(); }
    if (bkFlipping && bkFlipFrom) {
      bkAnimateCancel();
      bkFinishFlip();
    }
    bkLeave(BK_PAGES[bkCur]);
    BK_PAGES.forEach(function (p, i) {
      p.el.classList.toggle('cur', i === 0);
      p.el.style.zIndex = '';
    });
    bkCur = 0;
    bkHideLeaf();
    bkOpenState = false;
    book.classList.remove('open');
    book.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('espil-book-open');
    bkPaintRail();
  }
  function buildBook() {
    if (book) return;
    book = mk('div', 'espil-hud2-book');
    book.setAttribute('role', 'dialog');
    book.setAttribute('aria-hidden', 'true');
    book.setAttribute('aria-label', 'Menu book');
    bkFrame = mk('div', null);
    bkFrame.className = 'bk-frame';
    var rail = mk('div', null);
    rail.className = 'bk-rail';
    bkPrevBtn = document.createElement('button');
    bkPrevBtn.type = 'button';
    bkPrevBtn.className = 'bk-nav bk-prev';
    bkPrevBtn.setAttribute('aria-label', 'Previous page');
    bkPrevBtn.textContent = '‹';
    bkRailTitle = mk('div', null);
    bkRailTitle.className = 'bk-title';
    bkRailPos = mk('div', null);
    bkRailPos.className = 'bk-pos';
    bkNextBtn = document.createElement('button');
    bkNextBtn.type = 'button';
    bkNextBtn.className = 'bk-nav bk-next';
    bkNextBtn.setAttribute('aria-label', 'Next page');
    bkNextBtn.textContent = '›';
    bkCloseBtn = document.createElement('button');
    bkCloseBtn.type = 'button';
    bkCloseBtn.className = 'bk-close';
    bkCloseBtn.setAttribute('aria-label', 'Close book');
    bkCloseBtn.textContent = '✕';
    rail.appendChild(bkPrevBtn);
    rail.appendChild(bkRailTitle);
    rail.appendChild(bkRailPos);
    rail.appendChild(bkNextBtn);
    rail.appendChild(bkCloseBtn);
    bkView = mk('div', null);
    bkView.className = 'bk-view';
    BK_PAGES.forEach(function (p, i) {
      var pg = mk('div', null);
      pg.className = 'bk-page' + (i === 0 ? ' cur' : '');
      pg.setAttribute('data-book-page', p.id);
      var slot = mk('div', null);
      slot.className = 'bk-slot';
      pg.appendChild(slot);
      p.el = pg;
      p.slot = slot;
      bkView.appendChild(pg);
    });
    bkPocket = mk('div', null);
    bkPocket.className = 'bk-pocket';
    bkLeaf = mk('div', null);
    bkLeaf.className = 'bk-leaf';
    bkLeafFront = mk('div', null);
    bkLeafFront.className = 'bk-face front';
    bkLeafBack = mk('div', null);
    bkLeafBack.className = 'bk-face back';
    bkShadeF = mk('div', null);
    bkShadeF.className = 'bk-shade';
    bkShadeB = mk('div', null);
    bkShadeB.className = 'bk-shade';
    bkLeafFront.appendChild(bkShadeF);
    bkLeafBack.appendChild(bkShadeB);
    bkLeaf.appendChild(bkLeafFront);
    bkLeaf.appendChild(bkLeafBack);
    bkView.appendChild(bkPocket);
    bkView.appendChild(bkLeaf);
    bkFrame.appendChild(rail);
    bkFrame.appendChild(bkView);
    book.appendChild(bkFrame);
    /* page 0 - the index: the sheet's five rows lead to their
       pages; the three scope-added windows get rows of their own. */
    var idxWrap = mk('div', null);
    idxWrap.className = 'bk-scroll';
    var status = mk('div', 'bk-status');
    status.className = 'bk-status';
    idxWrap.appendChild(status);
    var rowMeta = {
      skill: SHEET[0], items: SHEET[1], bag: SHEET[2], map: SHEET[3], stall: SHEET[4],
      friends: { icon: '👥', key: 'O' }, settings: { icon: '⚙️', key: '' }, cash: { icon: '💰', key: '' }
    };
    BK_PAGES.forEach(function (p, i) {
      if (i === 0) return;
      var meta = rowMeta[p.id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'h2-sheet-row';
      b.setAttribute('data-book-go', p.id);
      b.setAttribute('aria-label', p.title);
      b.innerHTML = '<span class="si">' + meta.icon + '</span><span>' + p.title + '</span>' +
        (meta.key ? '<span class="sk">' + meta.key + '</span>' : '');
      b.addEventListener('click', function () { bkGoTo(i); });
      idxWrap.appendChild(b);
    });
    BK_PAGES[0].slot.appendChild(idxWrap);
    /* page 4 - the map control page: the minimap has no window
       of its own; the page names its stage cycle and fires the
       same M-key route the sheet uses today. */
    var mapWrap = mk('div', null);
    mapWrap.className = 'bk-scroll';
    mapWrap.innerHTML =
      '<p class="bk-map-cur">Map size: <b id="bk-map-stage">1</b> / 3</p>' +
      '<button type="button" class="h2-sheet-row" id="bk-map-cycle">' +
      '<span class="si">🗺️</span><span>Change map size</span><span class="sk">M</span></button>' +
      '<p class="bk-map-note">Cycles the minimap through its three sizes, exactly as the M key does.</p>';
    BK_PAGES[4].slot.appendChild(mapWrap);
    mapWrap.querySelector('#bk-map-cycle').addEventListener('click', function () {
      sendKey('m', 'KeyM');
      setTimeout(bkPaintMapStage, 60);
    });
    bkPrevBtn.addEventListener('click', function () { bkGoTo(bkCur - 1); });
    bkNextBtn.addEventListener('click', function () { bkGoTo(bkCur + 1); });
    bkCloseBtn.addEventListener('click', function () { bkCloseBook(); });
    bkView.addEventListener('pointerdown', bkDragArm);
    if (document.body && !book.parentNode) document.body.appendChild(book);
    bkPaintRail();
  }
  if (coarse()) buildBook();

  /* action cluster (Han 2026-11-11 form): a two-row grid inside
     the box - the quick bar (4 assignable skill slots) on the top
     row, ATK / JUMP / USE / TELEPORT on the bottom row. Positions
     are (right, bottom) px inside the box; the compact set serves
     narrow screens (the layout key includes the width class). */
  var POS_L = { atk: [2, 2], jump: [66, 4], use: [122, 4], fly: [178, 8] };
  var POS_P = { atk: [2, 2], jump: [66, 4], use: [122, 4], fly: [178, 8] };
  var POS_C = { atk: [2, 2], jump: [60, 3], use: [110, 3], fly: [160, 5] };
  var actions = mk('div', 'espil-hud2-actions');
  actions.setAttribute('aria-label', 'Actions');
  var KEYMAP = { punch: ['q', 'KeyQ'], kick: ['w', 'KeyW'], throw: ['e', 'KeyE'], defense: ['r', 'KeyR'],
                 dash: ['a', 'KeyA'], spin: ['s', 'KeyS'], wave: ['d', 'KeyD'], art: ['f', 'KeyF'] };
  function fireMove(id) {
    return function (e) {
      e.preventDefault();
      if (e.currentTarget.classList.contains('h2-off')) return;
      try {
        if (window.__espilSkills && window.__espilSkills.move) window.__espilSkills.move(id);
        else if (KEYMAP[id]) sendKey(KEYMAP[id][0], KEYMAP[id][1]);
      } catch (err) {}
    };
  }
  function fireSurface(targetId) {
    return function (e) {
      e.preventDefault();
      if (e.currentTarget.classList.contains('h2-off')) return;
      var t = el(targetId);
      if (t) { try { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); return; } catch (err) {} }
      if (targetId === 'map-attack') { try { if (window.__espilSkills) window.__espilSkills.move('punch'); } catch (err) {} }
    };
  }
  var actBtns = {};
  function addAction(key, attrs, icon, label, handler, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    for (var k in attrs) b.setAttribute(k, attrs[k]);
    if (cls) b.className = cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = '<span class="ci">' + icon + '</span><span class="al">' + label + '</span>';
    b.addEventListener('pointerdown', handler);
    actions.appendChild(b);
    actBtns[key] = b;
  }
  addAction('atk', { 'data-atk': '1' }, '⚔️', 'ATK', fireSurface('map-attack'));
  addAction('use', {}, '✋', 'USE', fireSurface('map-interact'), 'h2-util');
  addAction('jump', {}, '⬆️', 'JUMP', fireSurface('map-jump'), 'h2-util');
  addAction('fly', { 'data-fly': '1' }, '✈️', '', function (e) { e.preventDefault(); sendKey('b', 'KeyB'); });
  actBtns.fly.setAttribute('aria-label', 'TELEPORT');

  /* ---- quick slots (Han 2026-11-11) ------------------------------
     Four slots, each holding one of the game's eight moves. Tap
     fires through the exact desktop path (__espilSkills.move ===
     doMove, which itself refuses unlearned tree skills with its
     own toast); a long press (>=480ms, near-stationary) opens the
     assign sheet instead, and tapping an EMPTY slot opens it too.
     Assignment persists with the skill state: the companion record
     espil_quickslots_v1, mirrored into __espilSkills.state.qs so
     it also rides the espil_skills_v1 record whenever the
     monolith saves skills after the HUD has set it (the loader
     there picks named fields only, so the HUD reads the raw
     record back as its fallback). Cooldowns paint from the game's
     own cooldown map (__espilCombatState().cd, seconds left); the
     sweep fraction divides by the MOVES base cooldown - swift-rank
     reductions make that an approximation for display only. */
  var QS_KEY = 'espil_quickslots_v1';
  var QS_MOVES = {
    punch:   { name: 'Punch',           icon: '👊', cd: 0.45, key: 'Q' },
    kick:    { name: 'Kick',            icon: '🦵', cd: 0.65, key: 'W' },
    throw:   { name: 'Quote Tool',      icon: '「」', cd: 0.9,  key: 'E' },
    defense: { name: 'Defense',         icon: '🛡️', cd: 2.5,  key: 'R' },
    dash:    { name: 'Dash Strike',     icon: '💨', cd: 0.8,  key: 'A', tree: true },
    spin:    { name: 'Spinning Strike', icon: '🌀', cd: 1.4,  key: 'S', tree: true },
    wave:    { name: 'Ranged Wave',     icon: '🌊', cd: 1.1,  key: 'D', tree: true },
    art:     { name: 'Weapon Art',      icon: '⚔️', cd: 2.2,  key: 'F', tree: true }
  };
  var QS_ORDER = ['punch', 'kick', 'throw', 'defense', 'dash', 'spin', 'wave', 'art'];
  function qsSanitize(a) {
    if (!Array.isArray(a) || a.length !== 4) return null;
    return a.map(function (v) { return QS_MOVES[v] ? v : null; });
  }
  function qsLoad() {
    try {
      var a = qsSanitize(JSON.parse(localStorage.getItem(QS_KEY) || 'null'));
      if (a) return a;
    } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('espil_skills_v1') || 'null');
      var b = s && qsSanitize(s.qs);
      if (b) return b;
    } catch (e) {}
    return ['punch', 'kick', 'throw', 'defense'];
  }
  var qsSlots = qsLoad();
  function qsSave() {
    try { localStorage.setItem(QS_KEY, JSON.stringify(qsSlots)); } catch (e) {}
    try {
      if (window.__espilSkills && window.__espilSkills.state)
        window.__espilSkills.state.qs = qsSlots.slice();
    } catch (e) {}
    qsPaint();
  }
  var quick = mk('div', 'espil-hud2-quick');
  quick.setAttribute('aria-label', 'Quick slots');
  var slotBtns = [];
  function qsPaint() {
    slotBtns.forEach(function (b, i) {
      var id = qsSlots[i];
      var m = id ? QS_MOVES[id] : null;
      b.classList.toggle('h2-empty', !m);
      b.setAttribute('data-move', id || '');
      b.setAttribute('aria-label', m ? ('Quick slot ' + (i + 1) + ': ' + m.name) : ('Quick slot ' + (i + 1) + ': empty'));
      b.querySelector('.ci').textContent = m ? m.icon : '＋';
      b.querySelector('.al').textContent = m ? m.name.split(' ')[0].toUpperCase() : 'EMPTY';
    });
  }
  var assignSheet = mk('div', 'espil-hud2-assign');
  assignSheet.setAttribute('aria-hidden', 'true');
  var assignSlot = -1;
  function assignOpen() { return assignSheet.classList.contains('open'); }
  function closeAssign() {
    assignSheet.classList.remove('open');
    assignSheet.setAttribute('aria-hidden', 'true');
    assignSlot = -1;
  }
  function openAssign(i) {
    assignSlot = i;
    var title = assignSheet.querySelector('.h2-sheet-title span');
    if (title) title.textContent = 'Quick slot ' + (i + 1);
    Array.prototype.forEach.call(assignSheet.querySelectorAll('[data-assign]'), function (r) {
      r.classList.toggle('h2-cur', r.getAttribute('data-assign') === (qsSlots[i] || ''));
    });
    var clr = assignSheet.querySelector('[data-clear]');
    if (clr) clr.style.display = qsSlots[i] ? '' : 'none';
    assignSheet.classList.add('open');
    assignSheet.setAttribute('aria-hidden', 'false');
  }
  (function buildAssign() {
    var card = mk('div', null);
    card.className = 'h2-sheet-card';
    var title = mk('div', null, '<span>Quick slot</span>');
    title.className = 'h2-sheet-title';
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'h2-sheet-close';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '✕';
    x.addEventListener('pointerdown', function (e) { e.preventDefault(); closeAssign(); });
    title.appendChild(x);
    card.appendChild(title);
    QS_ORDER.forEach(function (id) {
      var m = QS_MOVES[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'h2-sheet-row' + (m.tree ? ' h2-locked' : '');
      b.setAttribute('data-assign', id);
      b.setAttribute('aria-label', m.name);
      b.innerHTML = '<span class="si">' + m.icon + '</span><span>' + m.name +
        (m.tree ? ' · skill tree' : '') + '</span><span class="sk">' + m.key + '</span>';
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (assignSlot >= 0) { qsSlots[assignSlot] = id; qsSave(); }
        closeAssign();
      });
      card.appendChild(b);
    });
    var clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'h2-sheet-row';
    clr.setAttribute('data-clear', '1');
    clr.setAttribute('aria-label', 'Clear slot');
    clr.innerHTML = '<span class="si">🧹</span><span>Clear slot</span>';
    clr.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (assignSlot >= 0) { qsSlots[assignSlot] = null; qsSave(); }
      closeAssign();
    });
    card.appendChild(clr);
    assignSheet.appendChild(card);
    assignSheet.addEventListener('pointerdown', function (e) { if (e.target === assignSheet) closeAssign(); });
  })();
  for (var qi = 0; qi < 4; qi++) {
    (function (i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'h2-slot';
      b.setAttribute('data-slot', String(i));
      b.innerHTML = '<span class="ci">＋</span><span class="al">EMPTY</span>' +
        '<span class="h2-slotn">' + (i + 1) + '</span><span class="h2-cd"></span>';
      var lpTimer = null, lpFired = false, downAt = null;
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (b.classList.contains('h2-off')) return;
        lpFired = false;
        downAt = { x: e.clientX, y: e.clientY };
        lpTimer = setTimeout(function () { lpFired = true; openAssign(i); }, 480);
      });
      function cancelLp() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }
      b.addEventListener('pointermove', function (e) {
        if (!downAt || !lpTimer) return;
        var dx = e.clientX - downAt.x, dy = e.clientY - downAt.y;
        if (dx * dx + dy * dy > 100) cancelLp();
      });
      b.addEventListener('pointercancel', function () { cancelLp(); downAt = null; });
      b.addEventListener('pointerleave', cancelLp);
      b.addEventListener('pointerup', function (e) {
        cancelLp();
        var wasLp = lpFired;
        lpFired = false;
        downAt = null;
        if (wasLp) return;
        e.preventDefault();
        if (b.classList.contains('h2-off')) return;
        var id = qsSlots[i];
        if (!id) { openAssign(i); return; }
        try {
          if (window.__espilSkills && window.__espilSkills.move) window.__espilSkills.move(id);
          else if (KEYMAP[id]) sendKey(KEYMAP[id][0], KEYMAP[id][1]);
        } catch (err) {}
      });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      quick.appendChild(b);
      slotBtns.push(b);
    })(qi);
  }
  actions.appendChild(quick);
  qsPaint();
  /* cooldown painter: the game's own per-move seconds-left map */
  setInterval(function () {
    if (!coarse()) return;
    var cds = null;
    try {
      var cs = window.__espilCombatState ? window.__espilCombatState() : null;
      if (cs && cs.cd) cds = cs.cd;
    } catch (e) {}
    if (!cds) {
      try {
        if (window.__espilSkills && window.__espilSkills.state && window.__espilSkills.state.cd)
          cds = window.__espilSkills.state.cd;
      } catch (e) {}
    }
    if (!cds) return;
    slotBtns.forEach(function (b, i) {
      var id = qsSlots[i];
      var ov = b.querySelector('.h2-cd');
      if (!ov) return;
      var rem = id ? (cds[id] || 0) : 0;
      if (!id || !(rem > 0.03)) { ov.style.display = 'none'; return; }
      var base = QS_MOVES[id].cd || 1;
      var frac = Math.max(0, Math.min(1, rem / base));
      ov.style.display = 'flex';
      ov.style.background = 'conic-gradient(rgba(4,6,8,.62) 0 ' + (frac * 100).toFixed(1) +
        '%, transparent ' + (frac * 100).toFixed(1) + '% 100%)';
      ov.textContent = rem >= 0.1 ? rem.toFixed(1) : '';
    });
  }, 100);

  var mounted = false;
  function mount() {
    if (!document.body) return;
    [coin, score, timefps, menu, bars, chars, chatBtn, chatTab, actions, sheet, assignSheet, book].forEach(function (n) {
      if (n && !n.parentNode) document.body.appendChild(n);
    });
    var wrap = el('minimap-wrap');
    if (wrap && !el('espil-hud2-mmlayer')) {
      var layer = mk('div', 'espil-hud2-mmlayer');
      wrap.appendChild(layer);
    }
    mounted = true;
    layoutActions();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var lastKey = null;
  function layoutActions() {
    var p = portrait();
    var compact = window.innerWidth <= (p ? 430 : 700);
    var key = (p ? 'P' : 'L') + (compact ? 'c' : '');
    if (key === lastKey) return;
    lastKey = key;
    var T = compact ? POS_C : (p ? POS_P : POS_L);
    for (var k in actBtns) {
      if (!T[k]) continue;
      actBtns[k].style.right = T[k][0] + 'px';
      actBtns[k].style.bottom = T[k][1] + 'px';
    }
  }
  window.addEventListener('resize', layoutActions);
  window.addEventListener('orientationchange', function () { lastKey = null; layoutActions(); });

  /* ---- live state ---- */
  var kills = 0;
  window.addEventListener('espil-guide', function (e) {
    if (e && e.detail && e.detail.type === 'monster-kill') kills++;
  });
  var fpsMeter = { frames: 0, last: 0 };
  var fpsHist = [], fpsAvg = 0;
  (function fpsLoop() {
    requestAnimationFrame(fpsLoop);
    fpsMeter.frames++;
  })();
  setInterval(function () {
    /* the rAF counter runs on real elapsed seconds; the sampler that
       reads it ticks on a 1 s wall interval */
    var now = performance.now();
    var dt = (now - (fpsMeter.last || now)) / 1000;
    fpsMeter.last = now;
    if (dt > 0.2) {
      var f = Math.round(fpsMeter.frames / dt);
      fpsMeter.frames = 0;
      fpsHist.push(f);
      if (fpsHist.length > 3) fpsHist.shift();
      fpsAvg = Math.round(fpsHist.reduce(function (a, b) { return a + b; }, 0) / fpsHist.length);
    }
  }, 1000);

  var ZONE_NAMES = { tutorial: 'Tutorial', low: 'Low', mid: 'Mid', high: 'High' };
  var cur = { zone: '-', active: 0, mkM: 0, mkB: 0, charN: 0, off: false };
  var mkPool = { mon: [], blu: [] };
  function mkDiv(cls) {
    var d = document.createElement('div');
    d.className = 'h2-mk ' + cls;
    return d;
  }
  function paintMarkers() {
    var layer = el('espil-hud2-mmlayer');
    var wrap = el('minimap-wrap');
    cur.mkM = 0; cur.mkB = 0;
    if (!layer || !wrap) return;
    var stage = wrap.getAttribute('data-stage');
    layer.style.display = (stage === '1') ? 'block' : 'none';
    if (stage !== '1') return;
    var pose = null;
    try { pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch (e) {}
    if (!pose) return;
    var W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return;
    var i, d;
    /* player: white marker at centre, rotated to facing */
    var pm = layer.querySelector('.h2-mkp');
    if (!pm) { pm = document.createElement('div'); pm.className = 'h2-mkp'; layer.appendChild(pm); }
    var fx = -Math.sin(pose.a || 0), fz = -Math.cos(pose.a || 0);
    var ang = Math.atan2(fz, fx) * 180 / Math.PI + 90;
    pm.style.left = (W / 2) + 'px';
    pm.style.top = (H / 2) + 'px';
    pm.style.transform = 'rotate(' + ang + 'deg)';
    function plot(list, cls, pool) {
      var need = 0;
      for (i = 0; i < list.length; i++) {
        var dx = list[i].x - pose.x, dz = list[i].z - pose.z;
        if (Math.abs(dx) > 55 || Math.abs(dz) > 55) continue;
        if (!pool[need]) { pool[need] = mkDiv(cls); layer.appendChild(pool[need]); }
        d = pool[need];
        d.style.display = 'block';
        d.style.left = ((0.5 + dx / 100) * W) + 'px';
        d.style.top = ((0.5 + dz / 100) * H) + 'px';
        need++;
      }
      for (i = need; i < pool.length; i++) pool[i].style.display = 'none';
      return need;
    }
    var mons = [], blues = [];
    try {
      var ms = window.__espilMonsterState ? window.__espilMonsterState() : null;
      if (ms) ms.monsters.forEach(function (m) { if (!m.gone && m.state !== 'leaving') mons.push(m); });
    } catch (e) {}
    try {
      var ns = window.__espilNpcState ? window.__espilNpcState() : null;
      if (ns) ns.npcs.forEach(function (n) { blues.push(n); });
    } catch (e) {}
    try {
      var cs = window.__espilChatState ? window.__espilChatState() : null;
      if (cs && cs.users) cs.users.forEach(function (u) {
        if (u.id !== cs.myId && u.pos) blues.push({ x: u.pos.x, z: u.pos.z });
      });
    } catch (e) {}
    cur.mkM = plot(mons, 'mon', mkPool.mon);
    cur.mkB = plot(blues, 'blu', mkPool.blu);
  }

  var charSig = '';
  function paintChars(pose) {
    cur.charN = 0;
    if (!portrait() || !pose) { charSig = ''; if (chars) chars.innerHTML = ''; return; }
    var entries = [];
    try {
      var ns = window.__espilNpcState ? window.__espilNpcState() : null;
      if (ns) ns.npcs.forEach(function (n) {
        var d = Math.hypot(n.x - pose.x, n.z - pose.z);
        if (d <= 60) entries.push({ name: (n.look && n.look.still) || n.lookKey || 'Resident', gender: n.gender, d: d });
      });
    } catch (e) {}
    try {
      var cs = window.__espilChatState ? window.__espilChatState() : null;
      if (cs && cs.users) cs.users.forEach(function (u) {
        if (u.id === cs.myId || !u.pos) return;
        var d = Math.hypot(u.pos.x - pose.x, u.pos.z - pose.z);
        if (d <= 60) entries.push({ name: u.name || 'Guest', gender: u.gender, d: d });
      });
    } catch (e) {}
    entries.sort(function (a, b) { return a.d - b.d; });
    entries = entries.slice(0, 8);
    cur.charN = entries.length;
    var sig = entries.map(function (e2) { return e2.name; }).join('|');
    if (sig === charSig) return;
    charSig = sig;
    chars.innerHTML = '';
    entries.forEach(function (e2) {
      var row = document.createElement('div');
      row.className = 'h2-char';
      var col = (e2.gender === 'female' || e2.gender === 'f') ? '#f0a6c0' : (e2.gender === 'male' || e2.gender === 'm') ? '#7db4e8' : '#ffd97a';
      row.innerHTML = '<span class="h2-chip" style="background:' + col + '"></span><span class="h2-cname"></span>';
      row.querySelector('.h2-cname').textContent = e2.name;
      chars.appendChild(row);
    });
  }

  function refresh() {
    if (!mounted) mount();
    layoutActions();
    var inMap = document.body && document.body.classList.contains('in-map');
    if (!inMap || !coarse()) return;
    /* Leo coin */
    var leo = 1000;
    try { var lv = parseInt(localStorage.getItem('espil_leo_balance') || '1000', 10); if (!isNaN(lv)) leo = lv; } catch (e) {}
    var numEl = coin.querySelector('.h2-num');
    var lt = leo.toLocaleString('en-US');
    if (numEl && numEl.textContent !== lt) numEl.textContent = lt;
    /* pose + zone + active */
    var pose = null;
    try { pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch (e) {}
    if (pose) {
      try {
        var z = window.__espilZoneAt ? window.__espilZoneAt(pose.x, pose.z) : null;
        if (z && ZONE_NAMES[z.zone]) cur.zone = ZONE_NAMES[z.zone];
      } catch (e) {}
    }
    try {
      var ms = window.__espilMonsterState ? window.__espilMonsterState() : null;
      if (ms) cur.active = ms.active;
    } catch (e) {}
    var zn = score.querySelector('.h2-zone-t');
    if (zn && zn.textContent !== cur.zone) zn.textContent = cur.zone;
    var an = score.querySelector('.h2-act-n');
    if (an && an.textContent !== String(cur.active)) an.textContent = String(cur.active);
    var kn = score.querySelector('.h2-kills-n');
    if (kn && kn.textContent !== String(kills)) kn.textContent = String(kills);
    /* clock + fps */
    var dnow = new Date();
    var hh = ('0' + dnow.getHours()).slice(-2), mm2 = ('0' + dnow.getMinutes()).slice(-2);
    var ck = timefps.querySelector('.h2-clock');
    var ct = hh + ':' + mm2;
    if (ck && ck.textContent !== ct) ck.textContent = ct;
    var fe = timefps.querySelector('.h2-fps');
    var ft = 'FPS ' + (fpsHist.length ? fpsAvg : '-');
    if (fe && fe.textContent !== ft) fe.textContent = ft;
    /* HP / MP + level */
    try {
      var ss = window.__espilSkills ? window.__espilSkills.state : null;
      if (ss) {
        /* HEAL FX (2026-11-13): while monolith's heal animation runs,
           render its display values so this bar fills smoothly and
           its number counts up with the flasks; the hook already
           falls back to true state when no animation is active. */
        var hd = null;
        try { hd = window.__espilHealDisplay ? window.__espilHealDisplay() : null; } catch (e) {}
        var hpv = hd ? hd.hp : ss.hp;
        var mpv = hd ? hd.mp : ss.mp;
        var hpf = Math.max(0, Math.min(100, hpv / (ss.maxhp || 100) * 100));
        var mpf = Math.max(0, Math.min(100, mpv / (ss.maxmp || 50) * 100));
        bars.querySelector('.h2-track.hp i').style.width = hpf + '%';
        bars.querySelector('.h2-track.mp i').style.width = mpf + '%';
        var hn = bars.querySelector('.h2-hp-num');
        var ht = Math.ceil(hpv) + '/' + ss.maxhp;
        if (hn && hn.textContent !== ht) hn.textContent = ht;
      }
      var lvl = 1;
      var lvv = parseInt(localStorage.getItem('espil_level') || '1', 10);
      if (!isNaN(lvv) && lvv > 0) lvl = lvv;
      var lve = bars.querySelector('.h2-lv');
      var lvt = 'Lv ' + lvl;
      if (lve && lve.textContent !== lvt) lve.textContent = lvt;
    } catch (e) {}
    paintMarkers();
    paintChars(pose);
  }
  refresh();
  setInterval(refresh, 500);

  /* store-interior sync: the attack family goes disabled + inert
     indoors; DEFENSE / TELEPORT / USE / JUMP keep their own rules */
  setInterval(function () {
    var off = false;
    try { off = !!window.__espilInside || !!window.__espilStorePaused; } catch (e) {}
    cur.off = off;
    for (var k in actBtns) {
      var b = actBtns[k];
      var isAtk = b.hasAttribute('data-atk');
      if (isAtk) b.classList.toggle('h2-off', off);
    }
    /* quick slots follow the same indoor rule: every move but
       Defense goes inert inside the store */
    slotBtns.forEach(function (b, i) {
      b.classList.toggle('h2-off', off && qsSlots[i] !== 'defense');
    });
  }, 400);

  /* extend the room's state hook */
  var prevState = window.__espilMMOHudState;
  window.__espilMMOHudState = function () {
    var s = {};
    try { if (prevState) s = prevState(); } catch (e) {}
    s.hud2 = true;
    s.mode = !coarse() ? 'desktop' : (portrait() ? 'portrait' : 'landscape');
    s.kills = kills;
    s.zone = cur.zone;
    s.activeMonsters = cur.active;
    s.mmMarkers = { monsters: cur.mkM, blues: cur.mkB };
    s.charList = cur.charN;
    s.fps = fpsAvg;
    s.attacksOff = !!(actBtns.atk && actBtns.atk.classList.contains('h2-off'));
    s.leoText = (coin.querySelector('.h2-num') || {}).textContent || '';
    /* 2026-11-11 directive surface: quick slots + the menu sheet */
    s.quickslots = qsSlots.slice();
    s.quickKey = QS_KEY;
    s.menuButtons = menu.querySelectorAll('button').length;
    s.sheetOpen = sheetOpen();
    s.assignOpen = assignOpen();
    /* flip book (Han 2026-11-16): null on fine pointers, where
       the book is never built. */
    s.book = book ? { open: bkIsOpen(), page: bkCur, pages: BK_PAGES.length } : null;
    return s;
  };
})();
/* __espilMMOHud END */

