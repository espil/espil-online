
/* __espilMapSearch v1 - address search on the fullscreen map
   (Han's order, 2026-10-27). When the 3-stage map is opened to its
   largest stage, a search bar sits at the top: type an address or a
   place name, and navigation starts to it - downtown Vancouver only.
   Geocoding is OpenStreetMap Nominatim, bounded to the downtown box;
   the result is validated against the same box in code before the
   game's own navigation (__espilNavShow - target only since the 2026-10-31 compass change; the compass HUD shows the way) takes over.
   On a successful start the map folds back to the small stage so the
   player can walk the route. */
(function () {
  'use strict';

  /* Downtown Vancouver bounds (Han's rule: downtown only). */
  var DT = { latMin: 49.2635, latMax: 49.2975, lngMin: -123.1450, lngMax: -123.0980 };
  var LAT0 = 49.2827, LNG0 = -123.1207;

  var STR = {
    en: {
      ph: 'Search a downtown address or place',
      go: 'Go',
      searching: 'Searching...',
      notFound: 'No matching place downtown. Try another address.',
      outside: 'That place is outside downtown - navigation only works downtown.',
      noRoute: 'No walking route found to that spot.',
      navTo: 'Navigating to '
    },
    ko: {
      ph: '다운타운 주소나 장소를 검색하세요',
      go: '이동',
      searching: '검색 중...',
      notFound: '다운타운에서 일치하는 장소를 찾지 못했습니다. 다른 주소를 입력해 보세요.',
      outside: '다운타운 밖의 장소입니다. 내비게이션은 다운타운 안에서만 됩니다.',
      noRoute: '그 위치까지의 도보 경로를 찾지 못했습니다.',
      navTo: '안내 시작: '
    },
    fr: {
      ph: 'Rechercher une adresse du centre-ville',
      go: 'Aller',
      searching: 'Recherche...',
      notFound: 'Aucun lieu trouvé au centre-ville. Essayez une autre adresse.',
      outside: 'Ce lieu est hors du centre-ville - la navigation y est limitée.',
      noRoute: 'Aucun itinéraire à pied vers ce point.',
      navTo: 'Navigation vers '
    },
    zh: {
      ph: '搜索市中心的地址或地点',
      go: '前往',
      searching: '搜索中...',
      notFound: '在市中心找不到匹配地点。请换一个地址。',
      outside: '该地点在市中心之外 - 导航仅限市中心。',
      noRoute: '找不到到那里的步行路线。',
      navTo: '正在导航到 '
    }
  };
  function lang() {
    var l = 'en';
    try { l = localStorage.getItem('espil_lang') || 'en'; } catch (e) {}
    return STR[l] ? l : 'en';
  }
  function t(k) { return (STR[lang()] || STR.en)[k] || STR.en[k] || k; }
  function toast(msg) {
    try { if (window.__espilToast) window.__espilToast(msg); } catch (e) {}
  }

  var form = null, input = null, msg = null, busy = false;

  function build() {
    var wrap = document.getElementById('minimap-wrap');
    if (!wrap || document.getElementById('espil-map-search')) return !!document.getElementById('espil-map-search');
    var st = document.createElement('style');
    st.textContent =
      '#espil-map-search{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:1200;' +
      'display:none;width:min(560px,92vw);flex-direction:column;gap:6px;pointer-events:auto}' +
      '#minimap-wrap[data-stage="3"] #espil-map-search{display:flex}' +
      '#espil-map-search .row{display:flex;gap:8px}' +
      '#espil-map-search input{flex:1;padding:11px 16px;border-radius:999px;border:1px solid rgba(142,247,232,.55);' +
      'background:rgba(8,20,24,.92);color:#eafffd;font:600 .95rem Manrope,sans-serif;outline:none;min-width:0}' +
      '#espil-map-search input:focus{border-color:#8ef7e8}' +
      '#espil-map-search button{flex:none;padding:11px 20px;border-radius:999px;border:1px solid rgba(142,247,232,.55);' +
      'background:#123c3a;color:#8ef7e8;font:800 .95rem Manrope,sans-serif;cursor:pointer}' +
      '#espil-map-search button:disabled{opacity:.55;cursor:default}' +
      '#espil-map-search .msg{display:none;padding:8px 14px;border-radius:12px;background:rgba(8,20,24,.92);' +
      'border:1px solid rgba(142,247,232,.35);color:#eafffd;font:600 .85rem Manrope,sans-serif;text-align:center}';
    document.head.appendChild(st);
    form = document.createElement('form');
    form.id = 'espil-map-search';
    form.innerHTML = '<div class="row"><input type="text" autocomplete="off" spellcheck="false">' +
      '<button type="submit"></button></div><div class="msg"></div>';
    input = form.querySelector('input');
    msg = form.querySelector('.msg');
    form.querySelector('button').textContent = t('go');
    input.placeholder = t('ph');
    /* keys typed here belong to the search, never to the game */
    form.addEventListener('keydown', function (e) { e.stopPropagation(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      search(input.value.trim());
    });
    wrap.appendChild(form);
    return true;
  }

  function say(text) {
    if (msg) { msg.textContent = text; msg.style.display = text ? 'block' : 'none'; }
    if (text) toast(text);
  }
  function insideDowntown(lat, lng) {
    return lat >= DT.latMin && lat <= DT.latMax && lng >= DT.lngMin && lng <= DT.lngMax;
  }
  function toWorld(lat, lng) {
    return {
      x: (lng - LNG0) * 111320 * Math.cos(LAT0 * Math.PI / 180),
      z: -(lat - LAT0) * 111320
    };
  }
  function closeMapToSmall() {
    try { if (input) input.blur(); } catch (e) {}
    /* one M cycle takes stage 3 back to stage 1 through the game's
       own handler (focus is off the input now, so the key counts) */
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }));
    } catch (e) {}
  }

  function search(q) {
    if (busy || !q) return;
    busy = true;
    var btn = form ? form.querySelector('button') : null;
    if (btn) btn.disabled = true;
    say(t('searching'));
    var viewbox = DT.lngMin + ',' + DT.latMax + ',' + DT.lngMax + ',' + DT.latMin;
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca' +
      '&bounded=1&viewbox=' + viewbox + '&q=' + encodeURIComponent(q);
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        busy = false;
        if (btn) btn.disabled = false;
        if (!j || !j.length) { say(t('notFound')); return; }
        var lat = parseFloat(j[0].lat), lng = parseFloat(j[0].lon);
        if (!isFinite(lat) || !isFinite(lng) || !insideDowntown(lat, lng)) { say(t('outside')); return; }
        var name = String(j[0].display_name || q).split(',')[0] || q;
        var w = toWorld(lat, lng);
        var ok = false;
        try { ok = !!(window.__espilNavShow && window.__espilNavShow({ x: w.x, z: w.z, name: name })); } catch (e) {}
        if (!ok) { say(t('noRoute')); return; }
        /* compass replacement (Han 2026-10-31): the floor line is gone, so a
           search-started navigation also raises the compass HUD (UI room). */
        try { if (window.__espilCompassNav) window.__espilCompassNav.show(w.x, w.z, name); } catch (e) {}
        say(t('navTo') + name);
        if (input) input.value = '';
        closeMapToSmall();
      })
      .catch(function () {
        busy = false;
        if (btn) btn.disabled = false;
        say(t('notFound'));
      });
  }

  if (!build()) {
    var iv = setInterval(function () { if (build()) clearInterval(iv); }, 800);
  }
  window.__espilMapSearchState = function () {
    var wrap = document.getElementById('minimap-wrap');
    return {
      built: !!document.getElementById('espil-map-search'),
      stage: wrap ? wrap.getAttribute('data-stage') : null,
      visible: !!(form && wrap && wrap.getAttribute('data-stage') === '3'),
      busy: busy
    };
  };
})();

