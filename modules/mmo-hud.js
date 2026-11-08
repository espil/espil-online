
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
/* __espilMMOHud END */

