
/* __espilTutorial v1 - the hands-on tutorial (Han's spec, 2026-10-27).
   NOT a card deck: per Han's binding principle for onboarding (first
   set 2026-10-21), a hint never waits for a click to close - it
   disappears the moment the player performs the action it teaches.
   Flow (Vancouver): move with the arrow keys -> jump -> follow the
   green navigation path to Konbiniya on Robson Street -> go inside ->
   buy the onigiri (the shop sells it as Triangle Kimbap) -> open a
   stall -> open the map. Progress persists per device; a Settings
   button replays it. The chip is pointer-events:none - it can never
   block play. Mobile (Han 2026-11-05): on coarse pointers the chip
   renders compact and DOES take taps - a tap toggles it between the
   compact chip and a minimized pill (short step label only); the
   minimized state persists across steps until tapped again. Fine
   pointers keep the original pointer-events:none behaviour. */
(function () {
  'use strict';

  var DONE_KEY = 'espil_tut_done_v1';
  var STEP_KEY = 'espil_tut_step_v1';

  /* ---- Batch 5 (Han 2026-11-07): guest quest non-persistence ----
     The quest chain in this build is the guide/tutorial progress
     (DONE_KEY / STEP_KEY). A guest's progress is never saved: the
     entry is judged at the moment the tutorial would start (in
     the boot watcher below) - if no live account session exists
     then, both keys are cleared first, so every guest entry
     restarts the chain. A logged-in entry keeps its progress -
     the predicate mirrors entry-flow's own session() (a stored
     espil_session_v1 record with an id). Judging at start time,
     not at module load, keeps the call immune to module load
     order and to the guest door dropping the session record on
     its way in. ONLY these two keys are touched: Leo, gear,
     skills and look storage are not quest progress. */
  var espilGuestResetDone = false;
  function espilSessionLive() {
    try {
      var s = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      return !!(s && s.id);
    } catch (e) { return false; }
  }

  var STR = {
    en: {
      landingNav: 'Look around the cities - use the arrow keys',
      lookShort: 'Look around',
      landingEnter: 'Press Enter to dive into the city',
      move: 'Move with the arrow keys',
      moveShort: 'Move',
      jump: 'Jump - press Shift',
      nav: 'Follow the compass to Konbiniya on Robson Street',
      enter: 'Press Space, then press Enter to go inside',
      buy: 'Buy the onigiri (Triangle Kimbap) inside',
      stall: 'Open your stall - press Y',
      map: 'Open the map - press M',
      done: 'Tutorial complete. Welcome to Espil Online.',
      replay: 'Tutorial - play it again'
    },
    ko: {
      landingNav: '방향키로 도시들을 둘러보세요',
      lookShort: '둘러보기',
      landingEnter: 'Enter를 눌러 도시로 들어가세요',
      move: '방향키로 움직여 보세요',
      moveShort: '이동하기',
      jump: 'Shift를 눌러 점프해 보세요',
      nav: '나침반을 따라 랍슨 거리의 콘비니야로 이동하세요',
      enter: 'Space를 누르고 Enter 키를 눌러 가게 안으로 들어가세요',
      buy: '가게 안에서 오니기리(삼각김밥)를 구매하세요',
      stall: 'Y를 눌러 좌판을 열어 보세요',
      map: 'M을 눌러 맵을 열어 보세요',
      done: '튜토리얼 완료. Espil Online에 오신 것을 환영합니다.',
      replay: '튜토리얼 - 다시 하기'
    },
    fr: {
      landingNav: 'Regardez les villes - touches fléchées',
      lookShort: 'Regarder autour',
      landingEnter: 'Entrée pour plonger dans la ville',
      move: 'Déplacez-vous avec les flèches',
      moveShort: 'Se déplacer',
      jump: 'Sautez - touche Maj',
      nav: 'Suivez la boussole jusqu\'à Konbiniya, rue Robson',
      enter: 'Espace, puis Entrée pour aller à l’intérieur',
      buy: 'Achetez l\'onigiri (Triangle Kimbap) à l\'intérieur',
      stall: 'Ouvrez votre étal - touche Y',
      map: 'Ouvrez la carte - touche M',
      done: 'Tutoriel terminé. Bienvenue sur Espil Online.',
      replay: 'Tutoriel - rejouer'
    },
    zh: {
      landingNav: '用方向键浏览城市',
      lookShort: '环顾四周',
      landingEnter: '按回车进入城市',
      move: '用方向键移动',
      moveShort: '移动',
      jump: '按 Shift 跳跃',
      nav: '跟着指南针前往 Robson 街的 Konbiniya',
      enter: '按空格，再按 Enter 进入店内',
      buy: '在店里买一个饭团 (Triangle Kimbap)',
      stall: '按 Y 打开你的摊位',
      map: '按 M 打开地图',
      done: '教程完成。欢迎来到 Espil Online。',
      replay: '教程 - 再玩一次'
    }
  };
  function lang() {
    var l = 'en';
    try { l = localStorage.getItem('espil_lang') || 'en'; } catch (e) {}
    return STR[l] ? l : 'en';
  }
  function t(k) { return (STR[lang()] || STR.en)[k] || STR.en[k] || k; }

  /* Short step labels for the minimized mobile pill (Han 2026-11-05).
     landingNav/move reuse the existing lookShort/moveShort strings. */
  var SHORT = {
    en: { landingEnter: 'Dive in', jump: 'Jump', nav: 'To Konbiniya', enter: 'Go inside', buy: 'Buy onigiri', stall: 'Open stall', map: 'Open map', done: 'Done' },
    ko: { landingEnter: '입장하기', jump: '점프', nav: '콘비니야로', enter: '들어가기', buy: '오니기리 사기', stall: '좌판 열기', map: '맵 열기', done: '완료' },
    fr: { landingEnter: 'Plonger', jump: 'Sauter', nav: 'Au Konbiniya', enter: 'Entrer', buy: 'Acheter l\'onigiri', stall: 'Ouvrir l\'étal', map: 'Ouvrir la carte', done: 'Terminé' },
    zh: { landingEnter: '进入城市', jump: '跳跃', nav: '去 Konbiniya', enter: '进店', buy: '买饭团', stall: '摆摊', map: '打开地图', done: '完成' }
  };
  function shortText(key) {
    if (key === 'landingNav') return t('lookShort');
    if (key === 'move') return t('moveShort');
    var l = lang();
    return (SHORT[l] && SHORT[l][key]) || SHORT.en[key] || t(key);
  }
  function coarse() {
    try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) { return false; }
  }

  /* The four arrow keys as key-cap graphics (Han 2026-10-28). */
  var KEYCAPS = '<span class="kb">&#8592;</span><span class="kb">&#8593;</span><span class="kb">&#8595;</span><span class="kb">&#8594;</span>';
  /* The globe scene takes Up/Down only (Han 2026-10-29), so the
     landing hint shows just those two caps. */
  var KEYCAPS_UD = '<span class="kb">&#8593;</span><span class="kb">&#8595;</span>';
  var STEPS = ['landingNav', 'landingEnter', 'move', 'jump', 'nav', 'enter', 'buy', 'stall', 'map'];
  var FIRST_GAME_STEP = 2; /* STEPS index of the first in-map step */
  function onLanding() { return !window.__ESPIL_GAME_PAGE; }
  var step = -1;               /* -1 = not running */
  var minimized = false;       /* mobile pill state (coarse pointers only) */
  var chip = null;
  var stepStartPose = null;
  var groundY = null;
  var started = false;

  function done() {
    try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; }
  }
  function setDone() {
    try { localStorage.setItem(DONE_KEY, '1'); localStorage.removeItem(STEP_KEY); } catch (e) {}
  }
  function inMap() { return document.body && document.body.classList.contains('in-map'); }
  function pose() {
    try { return window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch (e) { return null; }
  }
  function landed() {
    var p = pose();
    return !!(p && typeof p.y === 'number' && p.y < 1.5);
  }

  function ensureChip() {
    if (chip) return chip;
    var st = document.createElement('style');
    st.textContent =
      '#espil-tut{position:fixed;top:86px;left:50%;transform:translateX(-50%);z-index:60;' +
      'display:none;align-items:center;gap:10px;max-width:92vw;padding:10px 18px;border-radius:999px;' +
      'background-image:linear-gradient(180deg,rgba(84,56,31,.94),rgba(52,35,19,.96)),url("assets/tex/logwood.jpg");' +
      'background-size:cover,240px;border:2px solid #54381f;color:#f5e6c8;' +
      'font:700 .92rem/1.35 Manrope,sans-serif;letter-spacing:.02em;pointer-events:none;' +
      'box-shadow:inset 0 1px 0 rgba(255,224,170,.3),0 8px 18px rgba(40,25,8,.35);text-align:center}' +
      '#espil-tut .tx{display:inline-flex;align-items:center}' +
      '#espil-tut .kb{display:inline-flex;align-items:center;justify-content:center;min-width:23px;height:23px;' +
      'padding:0 4px;margin-right:4px;border-radius:6px;background:linear-gradient(180deg,#e8cf9f,#caa06a);' +
      'border:1.5px solid #54381f;border-bottom-width:3px;color:#3a2817;font-size:.8rem;font-weight:800}' +
      '#espil-tut.done{border-color:#ffd97a}' +
      /* Mobile compact + touch-minimize (Han 2026-11-05): coarse
         pointers get a chip at roughly half the footprint, and the
         chip takes taps so it can be minimized to a pill and back. */
      '@media (pointer:coarse){' +
      '#espil-tut{pointer-events:auto;gap:6px;padding:5px 11px;font-size:.70rem;border-width:1.5px;max-width:88vw;cursor:pointer}' +
      '#espil-tut .kb{min-width:16px;height:16px;padding:0 2px;margin-right:2px;border-radius:4px;font-size:.60rem;border-bottom-width:2px}' +
      '#espil-tut.tut-min{gap:5px;padding:4px 10px;font-size:.68rem}' +
      '#espil-tut .mini-ic{color:#ffd97a;font-size:.66rem;line-height:1}' +
      /* Mobile placement (Han 2026-11-06): in the map the chip
         leaves the top-centre and sits in the right column directly
         under the (shrunk) mobile minimap, right-aligned with it -
         top = the minimap's 120px top + its coarse height
         max(52px,10vh) (pair.css) + an 8px gap. Scoped to
         body.in-map so the landing-page hints keep their
         top-centre spot. The minimized pill inherits this anchor,
         and the chip's z-60 keeps it above - and tappable over -
         the tap-expanded minimap (z-30). */
      'body.in-map #espil-tut{left:auto;right:14px;transform:none;top:calc(128px + max(52px,10vh) + env(safe-area-inset-top,0px))}' +
      '}';
      /* Mobile revert (Han 2026-11-04): the Batch E2 coarse-pointer
         top:52px tutorial offset is REMOVED - top:86px everywhere. */
    document.head.appendChild(st);
    chip = document.createElement('div');
    chip.id = 'espil-tut';
    chip.innerHTML = '<span class="tx"></span>';
    /* Touch minimize toggle (coarse only; on fine pointers the chip
       keeps pointer-events:none, so this listener can never fire). */
    chip.addEventListener('click', function () {
      if (!coarse()) return;
      if (step < 0) return;
      minimized = !minimized;
      show();
    });
    document.body.appendChild(chip);
    return chip;
  }
  function show() {
    ensureChip();
    if (step < 0 || step >= STEPS.length) { hide(); return; }
    if (onLanding() && step >= FIRST_GAME_STEP) { hide(); return; } /* in-game steps wait for the game page */
    /* No step counter (Han 2026-10-28) - the hint is just the hint.
       The arrow keys are drawn as key-cap graphics, not words. */
    var tx = chip.querySelector('.tx');
    var key = STEPS[step];
    if (minimized && coarse()) {
      /* Minimized pill: only the current step's essence (Han
         2026-11-05). The minimized state persists across steps -
         a new step updates the pill label silently and does NOT
         re-expand the chip; only a tap restores it. */
      chip.classList.add('tut-min');
      tx.innerHTML = '<span class="mini-ic">&#10022;</span><span>' + shortText(key) + '</span>';
    } else {
      chip.classList.remove('tut-min');
      if (key === 'landingNav' || key === 'move') {
        tx.innerHTML = (key === 'move' ? KEYCAPS : KEYCAPS_UD) + '<span>' + t(key === 'move' ? 'moveShort' : 'lookShort') + '</span>';
      } else {
        tx.textContent = t(key);
      }
    }
    chip.classList.remove('done');
    chip.style.display = 'flex';
  }
  function hide() { if (chip) chip.style.display = 'none'; }
  function showDone() {
    ensureChip();
    /* The completion message announces itself once in full (it
       hides itself after 4.2 s anyway), even if the player had the
       chip minimized for the last step. */
    minimized = false;
    chip.classList.remove('tut-min');
    chip.querySelector('.tx').textContent = t('done');
    chip.classList.add('done');
    chip.style.display = 'flex';
    setTimeout(hide, 4200);
  }

  function saveStep() {
    try { localStorage.setItem(STEP_KEY, String(step)); } catch (e) {}
  }
  function advance() {
    step++;
    if (step >= STEPS.length) {
      step = -1;
      setDone();
      try { if (window.__espilNavHide) window.__espilNavHide(); } catch (e) {}
      showDone();
      return;
    }
    saveStep();
    stepStartPose = pose();
    if (STEPS[step] === 'nav') {
      try { if (window.__espilNavToKonbiniya) window.__espilNavToKonbiniya(); } catch (e) {}
    }
    show();
  }
  function start(fromStep) {
    if (started && step >= 0) return;
    started = true;
    step = (typeof fromStep === 'number' && fromStep >= 0 && fromStep < STEPS.length) ? fromStep : 0;
    if (!onLanding() && step < FIRST_GAME_STEP) step = FIRST_GAME_STEP; /* landing steps belong to the landing page */
    saveStep();
    stepStartPose = pose();
    if (STEPS[step] === 'nav') {
      try { if (window.__espilNavToKonbiniya) window.__espilNavToKonbiniya(); } catch (e) {}
    }
    show();
  }
  function restart() {
    try { localStorage.removeItem(DONE_KEY); localStorage.removeItem(STEP_KEY); } catch (e) {}
    step = -1;
    minimized = false; /* a replay starts expanded */
    started = false; /* the boot watcher restarts it on the next tick */
  }

  /* ---- completion detectors (polled; actions melt the hint away) -- */
  function distTo(x, z) {
    var p = pose(); if (!p) return 1e9;
    var dx = p.x - x, dz = p.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function tick() {
    if (step < 0) return;
    var key = STEPS[step];
    if (key === 'landingNav' || key === 'landingEnter') {
      /* landing steps progress through the key/dive listeners below;
         anywhere else they are definitionally behind us */
      if (!onLanding()) advance();
      return;
    }
    if (!inMap()) { if (onLanding()) hide(); return; }
    if (key === 'move') {
      var p = pose();
      if (p && stepStartPose) {
        var dx = p.x - stepStartPose.x, dz = p.z - stepStartPose.z;
        if (Math.sqrt(dx * dx + dz * dz) >= 2.5) advance();
      } else if (p) stepStartPose = p;
    } else if (key === 'jump') {
      var pj = pose();
      if (pj) {
        if (groundY === null || pj.y < groundY) groundY = pj.y;
        if (typeof pj.y === 'number' && groundY !== null && pj.y - groundY > 0.55) advance();
      }
    } else if (key === 'nav') {
      var kp = null;
      try { kp = window.__espilKonbiniyaPos; } catch (e) {}
      if (kp && distTo(kp.x, kp.z) < 6) advance();
    } else if (key === 'enter') {
      var inside = false;
      try { inside = !!window.__espilInside; } catch (e) {}
      if (inside) advance();
    } else if (key === 'stall') {
      var sp = document.getElementById('stall-panel');
      if (sp && sp.getAttribute('aria-hidden') === 'false') advance();
    } else if (key === 'map') {
      var mw = document.getElementById('minimap-wrap');
      if (mw && Number(mw.getAttribute('data-stage') || '1') >= 2) advance();
    }
    /* 'buy' completes through the espil-guide bought event below */
  }
  setInterval(tick, 300);

  window.addEventListener('espil-guide', function (e) {
    var d = e && e.detail; if (!d) return;
    if (step < 0) return;
    if (STEPS[step] === 'nav' && d.type === 'nav-arrived') advance();
    else if (STEPS[step] === 'buy' && d.type === 'bought' && /onigiri|kimbap/i.test(String(d.item || ''))) advance();
  });
  document.addEventListener('keydown', function (e) {
    if (step < 0 || !inMap()) return;
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (STEPS[step] === 'jump' && (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) {
      /* the pose check in tick confirms the actual jump; the key alone
         also counts - the player did perform the taught action */
      advance();
    }
  });

  /* ---- landing steps: arrows browse the cities, Enter dives ------ */
  document.addEventListener('keydown', function (e) {
    if (step < 0 || !onLanding()) return;
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (window.__espilNoticeOpen) return;
    if (STEPS[step] === 'landingNav' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { advance(); return; }
    if (STEPS[step] === 'landingEnter' && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
      var info = document.getElementById('city-info');
      var btn = document.getElementById('city-info-enter');
      if (info && info.getAttribute('aria-hidden') === 'false' && btn) {
        e.preventDefault();
        btn.click(); /* fires the world's own dive; espil-dive-start completes the step */
      }
    }
  });
  window.addEventListener('espil-dive-start', function () {
    if (step >= 0 && STEPS[step] === 'landingEnter') advance();
  });

  /* ---- boot: fresh players only, Vancouver (the Konbiniya city).
     The watcher stays alive so the Settings replay can restart the
     flow at any time; it starts the tutorial once the player has
     landed, and resumes a saved step after a reload. --- */
  setInterval(function () {
    if (step >= 0) return;
    if (onLanding()) return; /* Han 2026-11-02: NO tutorial inside the typewriter/entry sequence - the tutorial starts after the sequence, in the map */
    if (!inMap() || !landed()) return;
    if (!window.__espilKonbiniyaPos) return; /* not the tutorial city */
    /* Batch 5: judge the entry HERE, at start time - a guest
       entry clears the chain before done()/saved are read. */
    if (!espilGuestResetDone) {
      espilGuestResetDone = true;
      if (!espilSessionLive()) {
        try { localStorage.removeItem(DONE_KEY); localStorage.removeItem(STEP_KEY); } catch (e) {}
      }
    }
    if (done()) return;
    var saved = 0;
    try { saved = Number(localStorage.getItem(STEP_KEY) || '0') || 0; } catch (e) {}
    start(saved);
  }, 700);

  /* ---- Settings replay button (where the old Guide button sat) ---- */
  function wireReplay() {
    if (document.getElementById('set-tutorial')) return;
    var lo = document.getElementById('set-logout');
    if (!lo || !lo.parentNode) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill-btn';
    b.id = 'set-tutorial';
    b.textContent = t('replay');
    b.addEventListener('click', function () {
      try {
        var settings = document.getElementById('settings-panel');
        if (settings) { settings.classList.remove('open'); settings.setAttribute('aria-hidden', 'true'); }
      } catch (e) {}
      restart();
    });
    lo.parentNode.insertBefore(b, lo);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireReplay);
  else wireReplay();
  setInterval(wireReplay, 2500);

  window.__espilTutorialState = function () {
    return { step: step < 0 ? null : STEPS[step], stepIdx: step, done: done(), running: step >= 0, minimized: minimized };
  };
  window.__espilTutorialRestart = restart;
})();

