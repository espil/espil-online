/* __espilStory v1 - downtown Vancouver regional story quests
   "다운타운 한 바퀴" (Han decisions rounds 3-4, 2026-11-09/10;
   design: espil-online-room/story/DESIGN-v1.md). Build 3 of the
   large update, after the cash shop and the arena.

   WHAT THIS MODULE OWNS
   • The 7-quest regional chain over real downtown landmarks,
     extending the tutorial chain's machinery (step state, guide
     events, a save key) exactly as the design prescribes:
       Q1 Art Gallery intro (Mira) - a loop around the plaza
       Q2 Robson errand (Mira -> Konbiniya -> Mira)
       Q3 Steam Clock defence (Sera) - stay, then fend off 3
       Q4 Waterfront message (Walter -> Canada Place -> Walter);
         completion UNLOCKS THE DEALERSHIP (vehicles hook reads
         state().dealershipUnlocked)
       Q5 Granville night hunt (Jun) - 5 kills, night only
       Q6 Library Square lost item (Noah) - glowing pickup point
       Q7 Plaza defence finale (Mira) - two instance waves
   • The five original NPCs as standing billboards on the
     resident line (THREE.Sprite stills from
     assets/plushy-residents/, name label, shadow blob, no
     mirroring). Their art is PLACEHOLDER GRADE under the
     standing sample-first rule - the sample verdict replaces
     the textures later; positions and roles are the design's.
     The Konbiniya clerk already exists as a store NPC, so Q2's
     destination is the store purchase itself, per the design.
   • Rewards through the EXISTING stores only, never a fork:
     Leo into the one espil_leo_balance key; items through the
     shared espil-guide monster-drop grant (panels.js writes
     espil_owned_items); skills recorded as learned IN THE
     TREES (Dash Strike = the character tree's m_dash alloc in
     espil_skills_v1, Weapon Art = the equipped family's
     <fam>_art alloc in espil_trees_v1, both written through
     the live state objects the monolith itself saves); the Q7
     title joins the panels title list (espil_titles).
   • Combat steps ride the arena's instance machinery
     (__espilInstanceSpawn): instance bodies are exempt from
     the field safe-zone rules, so Q7's plaza finale runs
     INSIDE the Art Gallery safe zone without weakening it,
     and kills are counted by the spawn ids this module issued
     (the shared monster-drop death event carries the id).
   • Persistence rule (standing): quest progress persists for
     LOGGED-IN users only (server-marked session, the flip's
     {id, at, server:true} record / __espilAuthState). Guests
     play the whole chain in-session, persist NOTHING (memory
     only, the stored key is never written and a stale one is
     cleared at boot judgement, the tutorial's Batch-5 pattern),
     and instead level up fast: +1 espil_level per completed
     quest (DRAFT - the design's guest trade-off; the level key
     is the HUD/profile display surface, not quest progress).
   • Conversion funnel (Han round 4): a guest's purchase
     (espil-guide 'bought') or successful craft
     (__espilCraft.upgrade/convert, wrapped pass-through)
     raises a non-blocking sign-up prompt, once per kind per
     session; the action itself is never blocked or altered.
   • Shop mode: combat steps never spawn or count in shop
     mode (the instance director itself also refuses under
     SHOP_MODE); errand and dialogue steps proceed. The chain
     never touches Lunaris (she answers logged-in users only,
     and she is not part of this regional line), and the MAIN
     story (Auckland -> Zealandia) is out of scope here - the
     design holds its structure only.

   NUMBERS: every gameplay number below is the design's DRAFT
   (Leo 50/80/120/150/200/200/400, stay 20 s, kill counts,
   material-box composition), pending Han's tuning.

   Hooks: window.__espilStoryState() mirrors
   window.__espilStory.state(); window.__espilStory carries
   the actions + probe hooks.

   FIX BATCH 7 item 4 (Han 2026-11-12): ALL guides OFF except
   the movement guide (the dive guide in entry-flow.js, not
   this module). This module's guide layer - the objective
   chip (#espil-story-obj), the step/completion banner
   (#espil-story-banner) and the Q6 glowing pickup marker -
   never presents; see the GUIDES_OFF gate below. Quest
   function (dialogue, prompts, state, rewards) is unchanged. */
(function () {
  'use strict';
  if (window.__espilStoryState) return;

  /* ================= constants (DRAFT unless noted) ============ */
  var LS_KEY = 'espil_story_v1';
  var LEO_KEY = 'espil_leo_balance';
  var LEVEL_KEY = 'espil_level';
  var TITLES_KEY = 'espil_titles';
  var OWNED_KEY = 'espil_owned_items';
  var TALK_RANGE = 7;                 /* DRAFT proximity for talk */
  var PROMPT_RANGE = 7;
  var Q1_RADIUS = 9;                  /* checkpoint reach */
  var Q3_STAY_MS = 20000;             /* DRAFT dwell at the clock */
  var Q3_STAY_RADIUS = 13;
  var Q4_RADIUS = 26;                 /* Canada Place delivery reach */
  var Q5_KILLS = 5;
  var Q5_AREA_RADIUS = 130;           /* hunt counts near Granville */
  var Q5_ALIVE_MAX = 3;
  var Q6_PICKUP_RADIUS = 3.4;
  var Q7_TITLE = '다운타운의 수호자';   /* DRAFT title record (local) */
  var ERRAND_ITEM = 'Banana Milk';    /* Q2 designated store item */
  var Q3_ITEM = 'Cup Ramen';          /* Q3 recovery item reward */

  /* Guides off (Han 2026-11-12, fix batch 7 item 4): the guide
     layer's three presentation entries - renderChip(), banner()
     and the Q6 pickup marker's visible flag - check this flag
     first and never present while it is set. One flag restores
     the guides; nothing else in the module reads it. */
  var GUIDES_OFF = true;

  var GALLERY = { x: 3, z: 33 };
  var CLOCK = { x: 861, z: -189 };          /* Gastown Steam Clock */
  var CANADA_PLACE = { x: 675, z: -690 };
  var LIBRARY = { x: 363, z: 334 };         /* Library Square */

  var NPCS = [
    { id: 'mira',   name: '미라', role: '갤러리 안내인',       tex: 'wm_c02_traveller_f.png',  x: -6,  z: 44 },
    { id: 'sera',   name: '세라', role: 'Gastown 투어 가이드', tex: 'wm_c06_fisherwoman.png',  x: 855, z: -182 },
    { id: 'walter', name: '월터', role: '은퇴한 교통 안내원',   tex: 'wm_c05_chief_elder.png',  x: 646, z: -338 },
    { id: 'jun',    name: '준',   role: '거리 음악가',         tex: 'wm_c01_traveller_m.png',  x: 60,  z: 150 },
    { id: 'noah',   name: '노아', role: '중앙도서관 사서',     tex: 'wm_c11_healer.png',       x: 356, z: 327 }
  ];
  var Q1_POINTS = [ { x: 60, z: 40 }, { x: 0, z: 62 }, { x: -58, z: 28 } ];
  var Q6_POINT = { x: 325, z: 364 };        /* nudged walkable at build */

  var QUESTS = [
    { id: 'q1', name: '광장의 안내인', giver: 'mira', leo: 50,
      steps: ['accept', 'loop', 'return'] },
    { id: 'q2', name: '로브슨 심부름', giver: 'mira', leo: 80,
      steps: ['accept', 'buy', 'return'] },
    { id: 'q3', name: '스팀 시계의 오후', giver: 'sera', leo: 120,
      steps: ['accept', 'stay', 'defend'] },
    { id: 'q4', name: '항구의 전언', giver: 'walter', leo: 150,
      steps: ['accept', 'deliver', 'return'] },
    { id: 'q5', name: 'Granville의 밤', giver: 'jun', leo: 200,
      steps: ['accept', 'hunt'] },
    { id: 'q6', name: '도서관의 분실물', giver: 'noah', leo: 200,
      steps: ['accept', 'find', 'return'] },
    { id: 'q7', name: '광장을 지켜라', giver: 'mira', leo: 400,
      steps: ['accept', 'wave'] }
  ];
  function questById(id) { for (var i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i]; return null; }
  function npcById(id) { for (var i = 0; i < NPCS.length; i++) if (NPCS[i].id === id) return NPCS[i]; return null; }

  /* ================= small helpers ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inMap() { return !!(document.body && document.body.classList.contains('in-map')); }
  function playerPos() {
    try { var p = window.__espilPlayerPose && window.__espilPlayerPose(); if (p && isFinite(p.x)) return p; } catch (e) {}
    return null;
  }
  function distTo(x, z) { var p = playerPos(); if (!p) return 1e9; var dx = p.x - x, dz = p.z - z; return Math.sqrt(dx * dx + dz * dz); }
  function entryMode() { try { return window.__espilEntryMode || sessionStorage.getItem('espil_entry_mode') || 'play'; } catch (e) { return 'play'; } }
  function shopMode() { return entryMode() === 'shop'; }
  function signedIn() {
    try { var a = window.__espilAuthState && window.__espilAuthState(); if (a && typeof a.signedIn === 'boolean') return a.signedIn; } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('espil_session_v1') || 'null');
      return !!(s && s.id && s.server === true);
    } catch (e) { return false; }
  }
  function leoBalance() { var n = parseInt(localStorage.getItem(LEO_KEY), 10); return isFinite(n) ? n : 1000; }
  function leoAdd(n) { try { localStorage.setItem(LEO_KEY, String(leoBalance() + n)); } catch (e) {} }
  function toast(msg) { try { if (window.__espilToast) window.__espilToast(msg); } catch (e) {} }
  function blocked(x, z) {
    /* __espilCollisionProbe returns a result object
       ({cls, walkable, blocked, ...}), not a boolean - read its
       blocked flag; a bare truthy return also counts as blocked. */
    try {
      var r = window.__espilCollisionProbe && window.__espilCollisionProbe(x, z);
      if (!r) return false;
      if (typeof r === 'object') return !!r.blocked;
      return !!r;
    } catch (e) { return false; }
  }
  function nudge(x, z) {
    if (!blocked(x, z)) return { x: x, z: z };
    for (var r = 2; r <= 36; r += 2) {
      for (var a = 0; a < 16; a++) {
        var nx = x + Math.cos(a * Math.PI / 8) * r, nz = z + Math.sin(a * Math.PI / 8) * r;
        if (!blocked(nx, nz)) return { x: nx, z: nz };
      }
    }
    return { x: x, z: z };
  }
  /* Night = the world's own full-dark window: time-of-day's
     local-clock curve reaches its 0.5 plateau at 21:00-05:00.
     testNight (probe seam) overrides for verification only. */
  var testNight = null;
  function isNight() {
    if (testNight !== null) return testNight;
    try {
      if (typeof window.__espilDayNightOpacity === 'function') return window.__espilDayNightOpacity(new Date()) >= 0.5;
    } catch (e) {}
    var h = new Date().getHours();
    return h >= 21 || h < 5;
  }

  /* ================= progress (guest = memory only) ============ */
  function blankProgress() {
    return { done: {}, active: null, dealershipUnlocked: false, rewards: [], guestLevels: 0 };
  }
  var progress = null;
  var guestResetDone = false;
  function loadProgress() {
    if (progress) return progress;
    progress = blankProgress();
    /* judged at first use, like the tutorial's Batch-5 guest
       reset: a guest boot clears any stale stored chain before
       it is read; a logged-in boot reads it. */
    if (!signedIn()) {
      if (!guestResetDone) {
        guestResetDone = true;
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
      }
      return progress;
    }
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.done) { progress = p; progress.rewards = p.rewards || []; }
      }
    } catch (e) {}
    return progress;
  }
  function saveProgress() {
    loadProgress();
    if (!signedIn()) return;   /* guests: session memory only */
    try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function questStatus(qid) {
    var p = loadProgress();
    if (p.done[qid]) return 'done';
    if (p.active && p.active.id === qid) return 'active';
    var idx = QUESTS.findIndex(function (q) { return q.id === qid; });
    if (idx === 0) return 'available';
    return p.done[QUESTS[idx - 1].id] ? 'available' : 'locked';
  }
  function activeQuest() {
    var p = loadProgress();
    return p.active ? questById(p.active.id) : null;
  }

  /* ================= rewards (existing stores only) ============ */
  function grantItems(items, tag) {
    try {
      window.dispatchEvent(new CustomEvent('espil-guide', {
        detail: { type: 'monster-drop', id: tag, kind: 'story', grade: 'white', parts: [], items: items, story: true }
      }));
    } catch (e) {}
  }
  function grantDashStrike() {
    try {
      var ss = window.__espilSkills && window.__espilSkills.state;
      if (!ss || !ss.alloc) return false;
      if (ss.alloc.m_dash > 0) return true;
      ss.alloc.m_dash = 1;   /* recorded as learned in the character tree */
      try { localStorage.setItem('espil_skills_v1', JSON.stringify(ss)); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function dashLearned() {
    try { var ss = window.__espilSkills && window.__espilSkills.state; return !!(ss && ss.alloc && ss.alloc.m_dash > 0); } catch (e) { return false; }
  }
  function grantWeaponArt() {
    try {
      var ts = window.__espilTrees && window.__espilTrees.state();
      if (!ts || !ts.alloc) return null;
      var fam = ts.family || 'sword';
      if (!(ts.alloc[fam + '_art'] > 0)) {
        ts.alloc[fam + '_art'] = 1;   /* the weapon tree's art node, learned */
        try { localStorage.setItem('espil_trees_v1', JSON.stringify({ prof: ts.prof, spent: ts.spent, alloc: ts.alloc })); } catch (e) {}
      }
      return fam;
    } catch (e) { return null; }
  }
  function artLearned() {
    try {
      var ts = window.__espilTrees && window.__espilTrees.state();
      if (!ts || !ts.alloc) return null;
      var fams = ['sword', 'staff', 'bow', 'dagger'];
      for (var i = 0; i < fams.length; i++) if (ts.alloc[fams[i] + '_art'] > 0) return fams[i];
      return null;
    } catch (e) { return null; }
  }
  function grantTitle(title) {
    try {
      var list = JSON.parse(localStorage.getItem(TITLES_KEY) || 'null');
      if (!Array.isArray(list) || !list.length) list = ['모험가'];
      if (list.indexOf(title) < 0) { list.push(title); localStorage.setItem(TITLES_KEY, JSON.stringify(list)); }
      return true;
    } catch (e) { return false; }
  }
  function materialBox() {
    /* DRAFT composition: weapon parts x2, armour part x1,
       accessory part x1, white/yellow grades, names taken from
       the shared drop table so the bag resolves them. */
    var t = window.__espilDropTable;
    if (!t) return [];
    var items = [];
    if (t.weapon && t.weapon.white) items.push({ name: t.weapon.white, count: 2 });
    if (t.armour && t.armour.white) items.push({ name: t.armour.white, count: 1 });
    if (t.accessory && t.accessory.yellow) items.push({ name: t.accessory.yellow, count: 1 });
    return items;
  }
  function ownedCount(name) {
    try {
      var a = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]');
      return (Array.isArray(a) ? a : []).filter(function (n) { return n === name; }).length;
    } catch (e) { return 0; }
  }
  function consumeOwned(name) {
    try {
      var a = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]');
      if (!Array.isArray(a)) return false;
      var i = a.indexOf(name);
      if (i < 0) return false;
      a.splice(i, 1);
      localStorage.setItem(OWNED_KEY, JSON.stringify(a));
      return true;
    } catch (e) { return false; }
  }
  function guestLevelUp() {
    try {
      var lv = parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10);
      if (isNaN(lv) || lv < 1) lv = 1;
      localStorage.setItem(LEVEL_KEY, String(lv + 1));
      loadProgress().guestLevels++;
      return lv + 1;
    } catch (e) { return null; }
  }

  /* ================= quest flow ================= */
  var trackedSpawns = {};   /* monster id -> quest id */
  function trackSpawn(id, qid) { if (id != null) trackedSpawns[id] = qid; }
  function trackedAlive(qid) {
    var alive = {};
    try {
      (window.__espilInstanceState ? window.__espilInstanceState() : []).forEach(function (m) { alive[m.id] = true; });
    } catch (e) {}
    return Object.keys(trackedSpawns).filter(function (id) { return trackedSpawns[id] === qid && alive[id]; });
  }
  function clearTracked(qid) {
    var ids = Object.keys(trackedSpawns).filter(function (id) { return trackedSpawns[id] === qid; });
    ids.forEach(function (id) { delete trackedSpawns[id]; });
    /* leftovers die through the shared hit path (instance kills
       are Leo-exempt in the monolith; their drops are the
       system's own) */
    ids.forEach(function (id) {
      try {
        var st = (window.__espilInstanceState ? window.__espilInstanceState() : []).find(function (m) { return String(m.id) === String(id); });
        if (st && window.__espilMonsterHit) window.__espilMonsterHit(st.id, 99999, st.x + 1, st.z);
      } catch (e) {}
    });
  }
  function spawnNear(qid, kindId, cx, cz, rMin, rMax, opts) {
    if (shopMode()) return null;
    if (typeof window.__espilInstanceSpawn !== 'function') return null;
    for (var t = 0; t < 8; t++) {
      var a = Math.random() * Math.PI * 2, d = rMin + Math.random() * (rMax - rMin);
      var x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (blocked(x, z)) continue;
      var id = window.__espilInstanceSpawn(kindId, x, z, opts || {});
      if (id != null) { trackSpawn(id, qid); return id; }
    }
    var id2 = window.__espilInstanceSpawn(kindId, cx + rMin, cz, opts || {});
    if (id2 != null) trackSpawn(id2, qid);
    return id2;
  }

  function acceptQuest(qid) {
    var p = loadProgress();
    if (p.active) return { ok: false, why: 'busy' };
    if (questStatus(qid) !== 'available') return { ok: false, why: 'not-available' };
    p.active = { id: qid, step: questById(qid).steps[1], data: {} };
    if (qid === 'q3') p.active.data = { stayMs: 0, spawned: false, kills: 0 };
    if (qid === 'q5') p.active.data = { kills: 0, spawnedTotal: 0 };
    if (qid === 'q7') p.active.data = { wave: 0, waveSpawned: 0, waveKills: 0 };
    saveProgress();
    renderChip();
    return { ok: true, quest: qid, step: p.active.step };
  }
  function setStep(step) {
    var p = loadProgress();
    if (!p.active) return;
    p.active.step = step;
    saveProgress();
    renderChip();
  }
  function completeQuest(qid) {
    var p = loadProgress();
    var q = questById(qid);
    if (!q || !p.active || p.active.id !== qid) return { ok: false, why: 'not-active' };
    clearTracked(qid);
    var reward = { quest: qid, leo: q.leo };
    leoAdd(q.leo);
    if (qid === 'q3') {
      grantItems([{ name: Q3_ITEM, count: 1 }], 'story-q3');
      reward.item = Q3_ITEM;
      if (grantDashStrike()) reward.skill = 'Dash Strike';
    }
    if (qid === 'q4') {
      p.dealershipUnlocked = true;
      reward.dealership = true;
    }
    if (qid === 'q6') {
      var box = materialBox();
      if (box.length) { grantItems(box, 'story-q6'); reward.items = box.map(function (i) { return i.name + ' x' + i.count; }); }
    }
    if (qid === 'q7') {
      grantTitle(Q7_TITLE);
      reward.title = Q7_TITLE;
      var fam = grantWeaponArt();
      if (fam) reward.skill = 'Weapon Art (' + fam + ')';
    }
    p.done[qid] = true;
    p.active = null;
    p.rewards.push(reward);
    var guestLv = null;
    if (!signedIn()) guestLv = guestLevelUp();   /* the design's guest trade-off */
    saveProgress();
    banner('퀘스트 완료: ' + q.name + ' - Leo +' + q.leo +
      (reward.item ? ' · ' + reward.item : '') +
      (reward.skill ? ' · 스킬 ' + reward.skill : '') +
      (reward.title ? ' · 칭호 ' + reward.title : '') +
      (reward.dealership ? ' · 딜러십 개방' : ''));
    if (guestLv) toast('레벨 업! Lv ' + guestLv + ' (게스트는 퀘스트 진행이 저장되지 않습니다)');
    renderChip();
    return { ok: true, reward: reward };
  }

  /* One bought-item handler for every purchase channel: the
     in-world espil-guide event, the Konbiniya popup's postMessage
     bridge, and the popup's shared localStorage purchase record
     (popup restoration, Han 2026-11-11 - the standalone store page
     is a separate window and its purchases must still complete
     Q2's 'buy' step exactly as an in-world purchase does). */
  function handleBought(item) {
    var p = loadProgress();
    if (p.active && p.active.id === 'q2' && p.active.step === 'buy' && String(item) === ERRAND_ITEM) {
      setStep('return');
      banner('심부름 물품을 샀습니다. 미라에게 가져가세요');
    }
    signupPrompt('buy');
  }

  /* espil-guide: purchases (Q2 + funnel) and instance deaths */
  window.addEventListener('espil-guide', function (e) {
    var d = (e && e.detail) || {};
    if (d.type === 'bought' && d.item) handleBought(d.item);
    if (d.type === 'monster-drop' && d.id != null && trackedSpawns[d.id]) {
      var qid = trackedSpawns[d.id];
      delete trackedSpawns[d.id];
      var p2 = loadProgress();
      if (!p2.active || p2.active.id !== qid) return;
      if (qid === 'q3' && p2.active.step === 'defend') {
        p2.active.data.kills = (p2.active.data.kills || 0) + 1;
        saveProgress();
        if (p2.active.data.kills >= 3) completeQuest('q3');
      } else if (qid === 'q5' && p2.active.step === 'hunt') {
        p2.active.data.kills = (p2.active.data.kills || 0) + 1;
        saveProgress();
        if (p2.active.data.kills >= Q5_KILLS) completeQuest('q5');
        renderChip();
      } else if (qid === 'q7' && p2.active.step === 'wave') {
        p2.active.data.waveKills = (p2.active.data.waveKills || 0) + 1;
        saveProgress();
        renderChip();
      }
    }
  });

  /* ============ Konbiniya popup purchase bridge (2026-11-11) ============
     The standalone store page (a popup window) reports each
     completed purchase on two channels; both land in handleBought,
     so a popup purchase completes Q2's 'buy' step exactly as the
     in-world espil-guide 'bought' event does:
     (1) postMessage {type:'espil-store-purchase', store, item,
         qty, price} - accepted ONLY from this page's own origin
         (event.origin === location.origin); anything else,
         including a forged message from another origin, is ignored.
     (2) an append-only localStorage record under
         espil_store_purchase_v1 ({item, qty, price, store, at}).
         Drained on the storage event, on window focus, and on a
         1.5 s poll, with a seen-count under
         espil_store_purchase_seen_v1 so each record applies once.
         This channel carries the quest even if the opener never
         hears the message. All reward numbers stay provisional
         (D&D conversion review) - the bridge moves no numbers. */
  var PURCHASE_KEY = 'espil_store_purchase_v1';
  var PURCHASE_SEEN_KEY = 'espil_store_purchase_seen_v1';
  window.addEventListener('message', function (e) {
    try {
      if (!e || e.origin !== location.origin) return;
      var d = e.data || {};
      if (d.type === 'espil-store-purchase' && d.item) handleBought(String(d.item));
    } catch (err) {}
  });
  function drainPurchaseRecords() {
    try {
      var a = JSON.parse(localStorage.getItem(PURCHASE_KEY) || '[]');
      if (!Array.isArray(a) || !a.length) return;
      var seen = parseInt(localStorage.getItem(PURCHASE_SEEN_KEY), 10);
      if (!isFinite(seen) || seen < 0) seen = 0;
      if (seen > a.length) seen = a.length;
      if (seen === a.length) return;
      var fresh = a.slice(seen);
      try { localStorage.setItem(PURCHASE_SEEN_KEY, String(a.length)); } catch (e) {}
      fresh.forEach(function (r) { if (r && r.item) handleBought(String(r.item)); });
    } catch (err) {}
  }
  window.addEventListener('storage', function (e) {
    if (e && e.key === PURCHASE_KEY) drainPurchaseRecords();
  });
  window.addEventListener('focus', drainPurchaseRecords);
  setInterval(drainPurchaseRecords, 1500);
  drainPurchaseRecords();

  /* ================= conversion funnel (guests) ================ */
  var promptShown = {};
  var craftWrapped = false;
  function signupPrompt(kind) {
    if (signedIn() || promptShown[kind]) return;
    promptShown[kind] = true;
    buildDom();
    var el = $('espil-story-signup');
    if (!el) return;
    el.querySelector('.msg').textContent = kind === 'craft'
      ? '게스트로 제작했습니다. 가입하면 퀘스트 진행과 기록이 저장됩니다.'
      : '게스트로 구매했습니다. 가입하면 퀘스트 진행과 기록이 저장됩니다.';
    el.classList.add('open');
  }
  function wrapCraft() {
    if (craftWrapped) return;
    var c = window.__espilCraft;
    if (!c || typeof c.upgrade !== 'function') return;
    craftWrapped = true;
    ['upgrade', 'convert'].forEach(function (fn) {
      if (typeof c[fn] !== 'function') return;
      var orig = c[fn];
      c[fn] = function () {
        var r = orig.apply(this, arguments);
        if (r && r.ok) signupPrompt('craft');
        return r;
      };
    });
  }
  setInterval(wrapCraft, 1500);

  /* ================= NPC 3D (resident line, placeholder) ====== */
  var npcObjs = {};   /* id -> {group, sprite, label, baseY, phase, x, z} */
  var npcsBuilt = false;
  function climbToScene(obj) {
    var n = obj;
    while (n && n.parent) n = n.parent;
    return (n && n.isScene) ? n : null;
  }
  function sceneRoot() {
    try {
      var cam = (typeof window.__espilMapCameraObj === 'function') ? window.__espilMapCameraObj() : null;
      if (cam) { var s0 = climbToScene(cam); if (s0) return s0; }
      var dm = window.__espilDistrictMeshes || [];
      for (var i = 0; i < dm.length; i++) { var s1 = climbToScene(dm[i]); if (s1) return s1; }
      if (window.__espilTimeStoneGroup) { var s2 = climbToScene(window.__espilTimeStoneGroup); if (s2) return s2; }
      return null;
    } catch (e) { return null; }
  }
  function labelSprite(npc) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 160;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(12,8,4,0.72)';
    g.beginPath();
    if (g.roundRect) g.roundRect(56, 14, 400, 132, 24); else g.rect(56, 14, 400, 132);
    g.fill();
    g.strokeStyle = '#d9b45c'; g.lineWidth = 5; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffe9b0'; g.font = '700 52px sans-serif';
    g.fillText(npc.name, 256, 62);
    g.fillStyle = '#c9b48a'; g.font = '34px sans-serif';
    g.fillText(npc.role, 256, 116);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(3.4, 3.4 * 160 / 512, 1);
    sp.renderOrder = 30;
    return sp;
  }
  function buildNpcs() {
    if (npcsBuilt) return true;
    if (typeof THREE === 'undefined') return false;
    var scene = sceneRoot();
    if (!scene) return false;
    try {
      NPCS.forEach(function (npc, idx) {
        var spot = nudge(npc.x, npc.z);
        npc.x = spot.x; npc.z = spot.z;
        var group = new THREE.Group();
        group.position.set(npc.x, 0, npc.z);
        var mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
        var sp = new THREE.Sprite(mat);
        sp.position.y = 0.99;
        sp.scale.set(1.1, 1.98, 1);
        group.add(sp);
        new THREE.TextureLoader().load('assets/plushy-residents/' + npc.tex, function (tex) {
          mat.map = tex; mat.needsUpdate = true;
          if (tex.image && tex.image.width) sp.scale.set(1.98 * tex.image.width / tex.image.height, 1.98, 1);
        });
        var label = labelSprite(npc);
        label.position.y = 2.45;
        group.add(label);
        var shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.55, 20),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.03;
        group.add(shadow);
        scene.add(group);
        npcObjs[npc.id] = { group: group, sprite: sp, phase: idx * 1.37, x: npc.x, z: npc.z };
      });
      var q6 = nudge(Q6_POINT.x, Q6_POINT.z);
      Q6_POINT.x = q6.x; Q6_POINT.z = q6.z;
      /* The Q1 loop points are design targets on the plaza; the
         east point as drafted sits inside the neighbouring
         block's collision, so resolve every point to its nearest
         walkable ground at build, like the NPC stands. */
      Q1_POINTS.forEach(function (pt) {
        var s = nudge(pt.x, pt.z);
        pt.x = s.x; pt.z = s.z;
      });
      npcsBuilt = true;
      return true;
    } catch (e) { return false; }
  }

  /* Q6 glowing pickup point */
  var pickupGroup = null;
  function buildPickup() {
    if (pickupGroup && pickupGroup.parent) return true;
    if (typeof THREE === 'undefined') return false;
    var scene = sceneRoot();
    if (!scene) return false;
    try {
      pickupGroup = new THREE.Group();
      pickupGroup.position.set(Q6_POINT.x, 0, Q6_POINT.z);
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.5, 3.2, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
      );
      beam.position.y = 1.6;
      pickupGroup.add(beam);
      var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
      );
      orb.position.y = 1.1;
      orb.name = 'orb';
      pickupGroup.add(orb);
      pickupGroup.visible = false;
      scene.add(pickupGroup);
      return true;
    } catch (e) { pickupGroup = null; return false; }
  }

  /* ================= DOM (chip / prompt / panel / banner) ===== */
  var CSS = [
    '#espil-story-obj{position:fixed;top:134px;left:50%;transform:translateX(-50%);z-index:9950;background:rgba(12,8,4,.85);border:1px solid rgba(217,180,92,.55);border-radius:999px;color:#ffe9b0;font-size:13px;padding:6px 14px;display:none;font-family:inherit;pointer-events:none;max-width:92vw;text-align:center}',
    '#espil-story-obj.open{display:block}',
    '#espil-story-prompt{position:fixed;bottom:118px;left:50%;transform:translateX(-50%);z-index:9955;background:rgba(12,8,4,.88);border:1px solid rgba(217,180,92,.6);border-radius:10px;color:#ffe9b0;font-size:13.5px;padding:8px 14px;display:none;cursor:pointer;font-family:inherit}',
    '#espil-story-prompt.open{display:block}',
    '#espil-story-panel{position:fixed;left:14px;top:170px;width:320px;max-width:88vw;z-index:9970;background:linear-gradient(160deg,rgba(26,17,8,.96),rgba(12,8,4,.97));border:1px solid rgba(217,180,92,.55);border-radius:14px;color:#f5e6c4;font-family:inherit;padding:14px 14px 12px;box-shadow:0 14px 40px rgba(0,0,0,.55);display:none}',
    '#espil-story-panel.open{display:block}',
    '#espil-story-panel h3{margin:0 0 4px;font-size:15px;color:#ffd977}',
    '#espil-story-panel .role{color:#a68d54;font-size:11.5px;margin-bottom:8px}',
    '#espil-story-panel .row{font-size:13px;line-height:1.6;color:#e8d9ae}',
    '#espil-story-panel .dim{color:#a68d54;font-size:11.5px;line-height:1.5}',
    '#espil-story-panel button{background:linear-gradient(180deg,#8a6420,#6d4d15);border:1px solid #d9b45c;color:#ffeec2;border-radius:9px;padding:7px 12px;font-size:12.5px;cursor:pointer;margin:8px 4px 0 0;font-family:inherit}',
    '#espil-story-panel button.ghost{background:rgba(255,255,255,.06);border-color:rgba(217,180,92,.35)}',
    '#espil-story-panel .x{position:absolute;top:8px;right:10px;background:none;border:none;color:#a68d54;font-size:16px;margin:0;padding:2px 6px}',
    '#espil-story-banner{position:fixed;top:176px;left:50%;transform:translateX(-50%);z-index:9965;color:#ffd977;font-size:18px;font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.8);display:none;font-family:inherit;pointer-events:none;text-align:center;max-width:92vw}',
    '#espil-story-banner.open{display:block}',
    '#espil-story-signup{position:fixed;right:14px;bottom:120px;width:300px;max-width:86vw;z-index:9975;background:linear-gradient(160deg,rgba(26,17,8,.97),rgba(12,8,4,.98));border:1px solid rgba(217,180,92,.6);border-radius:14px;color:#f5e6c4;font-family:inherit;padding:12px 14px;display:none;box-shadow:0 14px 40px rgba(0,0,0,.55)}',
    '#espil-story-signup.open{display:block}',
    '#espil-story-signup .msg{font-size:13px;line-height:1.55;color:#e8d9ae}',
    '#espil-story-signup button{background:linear-gradient(180deg,#8a6420,#6d4d15);border:1px solid #d9b45c;color:#ffeec2;border-radius:9px;padding:6px 11px;font-size:12.5px;cursor:pointer;margin:8px 4px 0 0;font-family:inherit}',
    '#espil-story-signup button.ghost{background:rgba(255,255,255,.06);border-color:rgba(217,180,92,.35)}'
  ].join('\n');
  var domBuilt = false, bannerTimer = null;
  function buildDom() {
    if (domBuilt) return;
    domBuilt = true;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var obj = document.createElement('div'); obj.id = 'espil-story-obj'; document.body.appendChild(obj);
    var prompt = document.createElement('div'); prompt.id = 'espil-story-prompt';
    prompt.addEventListener('click', function () { interact(); });
    document.body.appendChild(prompt);
    var panel = document.createElement('div'); panel.id = 'espil-story-panel'; document.body.appendChild(panel);
    var bn = document.createElement('div'); bn.id = 'espil-story-banner'; document.body.appendChild(bn);
    var su = document.createElement('div'); su.id = 'espil-story-signup';
    su.innerHTML = '<div class="msg"></div><button data-a="go">가입하기</button><button class="ghost" data-a="close">닫기</button>';
    su.querySelector('[data-a="close"]').addEventListener('click', function () { su.classList.remove('open'); });
    su.querySelector('[data-a="go"]').addEventListener('click', function () {
      var b = document.getElementById('signin-open');
      if (b) b.click();
      su.classList.remove('open');
    });
    document.body.appendChild(su);
  }
  function banner(text) {
    if (GUIDES_OFF) return;   /* guides off: the banner never presents */
    buildDom();
    var bn = $('espil-story-banner'); if (!bn) return;
    bn.textContent = text; bn.classList.add('open');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bn.classList.remove('open'); }, 3400);
  }

  /* ---- objective text per quest/step ---- */
  function objectiveText() {
    var p = loadProgress();
    if (p.active) {
      var q = questById(p.active.id), step = p.active.step, d = p.active.data || {};
      if (q.id === 'q1') {
        if (step === 'loop') return '광장 한 바퀴: 동쪽 테라스, 남쪽 분수, 서쪽 벤치를 차례로 들르세요 (' + (d.point || 0) + '/3)';
        if (step === 'return') return '미라에게 돌아가세요';
      }
      if (q.id === 'q2') {
        if (step === 'buy') return 'Konbiniya에서 ' + '바나나 우유(Banana Milk)를 사세요';
        if (step === 'return') return '바나나 우유를 미라에게 가져가세요';
      }
      if (q.id === 'q3') {
        if (step === 'stay') return '스팀 시계 앞에서 머무르세요 (' + Math.min(Q3_STAY_MS, Math.round(d.stayMs || 0)) / 1000 + '/' + (Q3_STAY_MS / 1000) + '초)';
        if (step === 'defend') return '스팀 시계를 지켜라: 몬스터 ' + (d.kills || 0) + '/3 처치';
      }
      if (q.id === 'q4') {
        if (step === 'deliver') return '월터의 전언을 Canada Place까지 전하세요';
        if (step === 'return') return '월터에게 돌아가세요';
      }
      if (q.id === 'q5') {
        if (step === 'hunt') return isNight()
          ? 'Granville의 밤: 몬스터 ' + (d.kills || 0) + '/' + Q5_KILLS + ' 처치'
          : 'Granville의 밤: 밤(21시-5시)이 되면 몬스터가 나타납니다 - 지금은 조건 안내만 표시됩니다';
      }
      if (q.id === 'q6') {
        if (step === 'find') return 'Library Square 주변에서 빛나는 분실물을 찾으세요';
        if (step === 'return') return '분실물을 노아에게 가져가세요';
      }
      if (q.id === 'q7') {
        if (step === 'wave') return '광장을 지켜라: 웨이브 ' + Math.max(1, d.wave || 1) + '/2 - 남은 몬스터를 모두 처치하세요';
      }
      return q.name;
    }
    for (var i = 0; i < QUESTS.length; i++) {
      if (questStatus(QUESTS[i].id) === 'available') {
        var g = npcById(QUESTS[i].giver);
        return '새 퀘스트: ' + QUESTS[i].name + ' - ' + g.name + '(' + g.role + ')에게 말을 거세요';
      }
    }
    if (loadProgress().done.q7) return '다운타운 한 바퀴 완료 - 감사합니다';
    return '';
  }
  function renderChip() {
    if (GUIDES_OFF) {
      /* guides off: the objective chip never presents */
      var el0 = $('espil-story-obj');
      if (el0) el0.classList.remove('open');
      return;
    }
    buildDom();
    var el = $('espil-story-obj');
    if (!el) return;
    var txt = inMap() ? objectiveText() : '';
    el.textContent = txt ? '✦ ' + txt : '';
    el.classList.toggle('open', !!txt);
  }

  /* ---- dialogue ---- */
  var openNpc = null;
  function dialogueFor(npc) {
    var p = loadProgress();
    var lines = [], actions = [];
    var myAvailable = QUESTS.filter(function (q) { return q.giver === npc.id && questStatus(q.id) === 'available'; })[0];
    var myActive = p.active && questById(p.active.id).giver === npc.id ? p.active : null;
    var activeQ = p.active ? questById(p.active.id) : null;
    if (myActive) {
      var step = p.active.step;
      if (p.active.id === 'q1' && step === 'return') {
        lines = ['광장을 한 바퀴 다 돌아오셨네요. 다운타운은 이렇게 걸어서 익히는 게 제일 빠르답니다.'];
        actions = [{ a: 'turnin', label: '완료 보고 (Leo ' + activeQ.leo + ')' }];
      } else if (p.active.id === 'q2' && step === 'return') {
        if (ownedCount(ERRAND_ITEM) > 0) {
          lines = ['바나나 우유, 맞네요! 심부름 고마워요. 로브슨 거리는 이제 익숙해지셨죠?'];
          actions = [{ a: 'turnin', label: '물품 전하기 (Leo ' + activeQ.leo + ')' }];
        } else {
          lines = ['바나나 우유가 아직 없네요. Konbiniya에서 사 오시면 됩니다.'];
        }
      } else if (p.active.id === 'q4' && step === 'return') {
        lines = ['Canada Place까지 전언을 전하고 오셨군요. 긴 거리 수고하셨습니다. 이만하면 차량을 몰 자격이 충분해요 - 딜러십 이용이 열렸습니다.'];
        actions = [{ a: 'turnin', label: '완료 보고 (Leo ' + activeQ.leo + ')' }];
      } else if (p.active.id === 'q6' && step === 'return') {
        lines = ['찾아오셨군요! 제 분실물이 맞습니다. 정말 감사해요.'];
        actions = [{ a: 'turnin', label: '분실물 전하기 (Leo ' + activeQ.leo + ')' }];
      } else if (p.active.id === 'q3' && step === 'stay') {
        lines = ['스팀 시계 앞에서 조금만 머물러 주세요. 오후의 종소리가 울릴 때쯤이면... 어라, 뭔가 몰려오고 있어요!'];
      } else if (p.active.id === 'q3' && step === 'defend') {
        lines = ['시계를 지켜 주세요! 몬스터가 몰려오고 있습니다!'];
      } else if (p.active.id === 'q5' && step === 'hunt') {
        lines = [isNight() ? '밤의 Granville은 낮과 다르죠. 거리에서 몬스터 ' + Q5_KILLS + '마리만 정리해 주세요.' : '이 퀘스트는 밤(21시-5시)에만 진행할 수 있어요. 밤이 되면 거리로 나와 주세요.'];
      } else if (p.active.id === 'q7' && step === 'wave') {
        lines = ['광장을 함께 지켜요! 물러서지 마세요!'];
      } else {
        lines = ['아직 진행 중인 일이 있네요. 목표를 확인해 주세요.'];
      }
    } else if (myAvailable) {
      var q = myAvailable;
      if (q.id === 'q1') lines = ['어서 오세요, 아트 갤러리 앞 광장에 오신 걸 환영합니다. 처음 오셨으면 광장을 한 바퀴 둘러보고 오세요. 동쪽 테라스와 남쪽 분수, 서쪽 벤치를 차례로 들르면 됩니다.'];
      else if (q.id === 'q2') lines = ['로브슨 거리 Konbiniya에서 바나나 우유 하나만 사다 주시겠어요? 다녀오시면 사례를 드릴게요.'];
      else if (q.id === 'q3') lines = ['스팀 시계 투어를 도와주세요. 시계 앞에서 잠시 머물러 주시면 됩니다. 요즘 오후만 되면 몬스터가 얼씬거려서요.'];
      else if (q.id === 'q4') lines = ['은퇴해도 전언은 제가 맡죠. Canada Place 관리실에 이 전언을 전해 주시겠소? 다녀오면 차량 딜러십 이용 자격을 드리겠소.'];
      else if (q.id === 'q5') lines = ['밤의 Granville 거리에서 연주하는 게 제 일인데, 요즘 몬스터가 너무 많아졌어요. 밤에 거리에서 ' + Q5_KILLS + '마리만 정리해 주세요.'];
      else if (q.id === 'q6') lines = ['도서관 근처에서 분실물을 잃어버렸어요. Library Square 주변 어딘가에 빛나고 있을 거예요. 찾아 주시겠어요?'];
      else if (q.id === 'q7') lines = ['광장에 몬스터 무리가 몰려오고 있어요. 마지막으로 한 번만, 함께 막아 주세요!'];
      actions = [{ a: 'accept', label: '퀘스트 받기: ' + q.name, qid: q.id }];
    } else if (p.active) {
      lines = ['지금은 ' + activeQ.name + ' 퀘스트가 진행 중입니다. 그 일부터 마쳐 주세요.'];
    } else {
      lines = ['다운타운은 걸을수록 정이 드는 동네예요.'];
    }
    return { lines: lines, actions: actions };
  }
  function talk(npcId) {
    buildDom();
    var npc = npcById(npcId);
    if (!npc) return { ok: false, why: 'no-npc' };
    openNpc = npcId;
    renderPanel();
    var panel = $('espil-story-panel');
    if (panel) panel.classList.add('open');
    return { ok: true, npc: npcId };
  }
  function renderPanel() {
    var panel = $('espil-story-panel');
    if (!panel || !openNpc) return;
    var npc = npcById(openNpc);
    var dlg = dialogueFor(npc);
    var html = '<button class="x" data-a="close">✕</button><h3>' + esc(npc.name) + '</h3><div class="role">' + esc(npc.role) + '</div>'
      + dlg.lines.map(function (ln) { return '<div class="row">' + esc(ln) + '</div>'; }).join('')
      + dlg.actions.map(function (a) {
          return '<button data-a="' + a.a + '"' + (a.qid ? ' data-q="' + a.qid + '"' : '') + '>' + esc(a.label) + '</button>';
        }).join('')
      + '<button class="ghost" data-a="close">닫기</button>'
      + chainSummaryHtml();
    panel.innerHTML = html;
    Array.prototype.forEach.call(panel.querySelectorAll('button[data-a]'), function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-a');
        if (a === 'close') { panel.classList.remove('open'); openNpc = null; }
        else if (a === 'accept') { acceptQuest(b.getAttribute('data-q')); renderPanel(); }
        else if (a === 'turnin') { turnIn(); }
      });
    });
  }
  function chainSummaryHtml() {
    var rows = QUESTS.map(function (q) {
      var st = questStatus(q.id);
      var mark = st === 'done' ? '✓' : st === 'active' ? '▶' : st === 'available' ? '○' : '·';
      return '<div class="dim">' + mark + ' ' + esc(q.name) + (st === 'done' ? ' (완료)' : st === 'locked' ? ' (이전 퀘스트 필요)' : '') + '</div>';
    }).join('');
    return '<div style="margin-top:10px">' + rows + '</div>';
  }
  function turnIn() {
    var p = loadProgress();
    if (!p.active) return { ok: false, why: 'no-active' };
    var id = p.active.id, step = p.active.step;
    if (step !== 'return') return { ok: false, why: 'not-return-step' };
    if (id === 'q2' && !consumeOwned(ERRAND_ITEM)) return { ok: false, why: 'no-item' };
    var r = completeQuest(id);
    if (openNpc) renderPanel();
    return r;
  }
  function nearestNpc() {
    var best = null, bd = 1e9;
    NPCS.forEach(function (npc) {
      var d = distTo(npc.x, npc.z);
      if (d < bd) { bd = d; best = npc; }
    });
    return bd <= TALK_RANGE ? best : null;
  }
  function atPickup() {
    var p = loadProgress();
    return p.active && p.active.id === 'q6' && p.active.step === 'find' && distTo(Q6_POINT.x, Q6_POINT.z) <= Q6_PICKUP_RADIUS;
  }
  function interact() {
    if (atPickup()) { pickupLostItem(); return { ok: true, what: 'pickup' }; }
    var npc = nearestNpc();
    if (npc) return talk(npc.id);
    return { ok: false, why: 'nobody-near' };
  }
  function pickupLostItem() {
    var p = loadProgress();
    if (!p.active || p.active.id !== 'q6' || p.active.step !== 'find') return { ok: false, why: 'not-active' };
    setStep('return');
    banner('분실물을 찾았습니다. 노아에게 가져가세요');
    return { ok: true };
  }

  /* ================= step tick ================= */
  function tickSteps() {
    var p = loadProgress();
    if (!p.active) return;
    var q = questById(p.active.id), step = p.active.step, d = p.active.data;
    if (q.id === 'q1' && step === 'loop') {
      var pt = Q1_POINTS[d.point || 0];
      if (pt && distTo(pt.x, pt.z) <= Q1_RADIUS) {
        d.point = (d.point || 0) + 1;
        if (d.point >= Q1_POINTS.length) setStep('return');
        else { saveProgress(); }
        banner('광장 둘러보기 ' + Math.min(3, d.point) + '/3');
        renderChip();
      }
    } else if (q.id === 'q3' && step === 'stay') {
      if (distTo(CLOCK.x, CLOCK.z) <= Q3_STAY_RADIUS) {
        /* accumulate REAL elapsed time (capped per tick): a fixed
           increment per interval firing would stretch the dwell
           on any throttled or backgrounded tab */
        var nowS = Date.now();
        var lastS = d.stayLast || nowS;
        d.stayMs = (d.stayMs || 0) + Math.min(1000, Math.max(0, nowS - lastS));
        d.stayLast = nowS;
        if (d.stayMs >= Q3_STAY_MS) {
          setStep('defend');
          banner('몬스터가 스팀 시계로 몰려옵니다!');
          spawnNear('q3', 'rat', CLOCK.x, CLOCK.z, 8, 12, { level: 1, hpMul: 0.8, dropZone: 'tutorial' });
          /* 'wisp' has no entry in monsters.js KINDS (kindById
             returns null and the instance spawn refuses it); its
             documented placeholder class is the shambler */
          spawnNear('q3', 'shambler', CLOCK.x, CLOCK.z, 8, 12, { level: 1, hpMul: 0.8, dropZone: 'tutorial' });
          spawnNear('q3', 'rat', CLOCK.x, CLOCK.z, 8, 12, { level: 1, hpMul: 0.8, dropZone: 'tutorial' });
        }
        if ((d.stayMs % 2000) < 250) renderChip();
      } else {
        d.stayLast = null;
      }
    } else if (q.id === 'q4' && step === 'deliver') {
      if (distTo(CANADA_PLACE.x, CANADA_PLACE.z) <= Q4_RADIUS) {
        setStep('return');
        banner('전언을 전했습니다. 월터에게 돌아가세요');
      }
    } else if (q.id === 'q5' && step === 'hunt') {
      if (isNight() && !shopMode() && (d.kills || 0) < Q5_KILLS) {
        var jun = npcById('jun');
        if (distTo(jun.x, jun.z) <= Q5_AREA_RADIUS) {
          var alive = trackedAlive('q5').length;
          var want = Math.min(Q5_ALIVE_MAX, Q5_KILLS - (d.kills || 0) - alive);
          var pp = playerPos();
          for (var i = 0; i < want && pp; i++) {
            spawnNear('q5', i % 2 ? 'rat' : 'stray', pp.x, pp.z, 10, 16, { level: 2, dropZone: 'low' });
          }
        }
      }
    } else if (q.id === 'q7' && step === 'wave') {
      var waves = [
        ['rat', 'shambler', 'rat', 'shambler'],
        ['stray', 'shambler', 'stray', 'shambler', 'brute']
      ];
      if (!d.wave) { d.wave = 1; d.waveSpawned = 0; d.waveKills = 0; }
      var comp = waves[d.wave - 1];
      if (d.waveSpawned < comp.length && !shopMode()) {
        var kind = comp[d.waveSpawned];
        var id = spawnNear('q7', kind, GALLERY.x, GALLERY.z, 12, 18,
          { level: d.wave, hpMul: 0.85, dropZone: 'tutorial' });
        if (id != null) { d.waveSpawned++; saveProgress(); }
      } else if (d.waveSpawned >= comp.length && (d.waveKills || 0) >= comp.length && trackedAlive('q7').length === 0) {
        if (d.wave === 1) {
          d.wave = 2; d.waveSpawned = 0; d.waveKills = 0;
          saveProgress();
          banner('두 번째 웨이브가 몰려옵니다!');
          renderChip();
        } else {
          completeQuest('q7');
        }
      }
    }
    /* Q6 pickup marker surface - guides off: the glowing marker
       never shows; the pickup itself (atPickup/interact) still
       works when the player reaches the point. */
    if (pickupGroup) pickupGroup.visible = !GUIDES_OFF && !!(p.active && p.active.id === 'q6' && p.active.step === 'find');
  }

  /* ================= events + main tick ================= */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'f' && e.key !== 'F') return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (!inMap()) return;
    if (nearestNpc() || atPickup()) interact();
  });

  var promptFor = null;
  setInterval(function () {
    if (!inMap()) {
      var pr0 = $('espil-story-prompt');
      if (pr0) pr0.classList.remove('open');
      return;
    }
    buildDom();
    buildNpcs();
    buildPickup();
    /* idle sway (residents never mirror; a gentle bob only) */
    var now = Date.now();
    Object.keys(npcObjs).forEach(function (id) {
      var o = npcObjs[id];
      if (o && o.sprite) o.sprite.position.y = 0.99 + Math.sin(now / 900 + o.phase) * 0.02;
    });
    if (pickupGroup && pickupGroup.visible) {
      var orb = pickupGroup.children[1];
      if (orb) orb.position.y = 1.1 + Math.sin(now / 500) * 0.18;
    }
    tickSteps();
    renderChip();
    /* proximity prompt */
    var prompt = $('espil-story-prompt');
    if (prompt) {
      var npc = nearestNpc();
      var pk = atPickup();
      var label = null, key = null;
      if (pk) { label = '✦ 빛나는 분실물 - 클릭 또는 F 키로 줍기'; key = 'pickup'; }
      else if (npc) { label = '💬 ' + npc.name + ' (' + npc.role + ') - 클릭 또는 F 키로 대화'; key = npc.id; }
      if (label) {
        if (promptFor !== key) { prompt.textContent = label; promptFor = key; }
        prompt.classList.add('open');
      } else {
        prompt.classList.remove('open');
        promptFor = null;
      }
    }
  }, 250);

  /* ================= state + public hook ================= */
  function state() {
    var p = loadProgress();
    var quests = {};
    QUESTS.forEach(function (q) { quests[q.id] = questStatus(q.id); });
    return {
      version: 1,
      mode: entryMode(),
      night: isNight(),
      persisted: signedIn(),
      quests: quests,
      active: p.active ? { id: p.active.id, step: p.active.step, data: JSON.parse(JSON.stringify(p.active.data || {})) } : null,
      dealershipUnlocked: !!p.dealershipUnlocked,
      rewards: p.rewards,
      guestLevels: p.guestLevels || 0,
      skills: { dashStrike: dashLearned(), weaponArt: artLearned() },
      npcs: NPCS.map(function (n) {
        return { id: n.id, name: n.name, x: Math.round(n.x * 10) / 10, z: Math.round(n.z * 10) / 10,
                 built: !!npcObjs[n.id], near: distTo(n.x, n.z) <= TALK_RANGE };
      }),
      pickup: { x: Q6_POINT.x, z: Q6_POINT.z, visible: !!(pickupGroup && pickupGroup.visible) },
      points: Q1_POINTS.map(function (p) { return { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 }; }),
      tracked: Object.keys(trackedSpawns).length,
      funnel: { shown: Object.keys(promptShown), craftWrapped: craftWrapped }
    };
  }
  window.__espilStoryState = state;
  window.__espilStory = {
    state: state,
    talk: talk,
    accept: acceptQuest,
    turnIn: turnIn,
    interact: interact,
    pickup: pickupLostItem,
    testSetNight: function (v) { testNight = (v === null || v === undefined) ? null : !!v; return isNight(); }
  };
})();
