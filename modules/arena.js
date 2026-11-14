/* __espilArena v1 - instance arena (Han decisions rounds 1-4,
   2026-11-09; design: espil-online-room/arena/DESIGN-v1.md).
   Build 2 of the large update, on top of the delivered cash shop
   (modules/cashshop.js, window.__espilCash).

   WHAT THIS MODULE OWNS
   • The arena PORTAL surface at the Art Gallery plaza: a glowing
     gold portal visual + name label + record board slab inside
     the SAFE ZONE (monsters.js SAFE_ZONE, centre 3,33 r 40), the
     proximity prompt, and the forming panel (records, party,
     invite list, auto-match queue, cash shop button).
   • Party formation: the social party (window.__espilSocialState)
     is adopted as-is; invites go out through the delivered
     presence frame (party_invite via window.__espilSocialSend);
     the auto-match queue is a local waiting state machine - the
     delivered frame surface has NO matchmaking frame family, so
     cross-client auto-match waits for the CityRoom frame noted in
     MONOLITH-SEAM.md item 6. Solo is a 1-person party.
   • The run state machine: 10-minute runs, wave rounds, party
     scaling, the 180 s soft-timer enrage, round-10 full clear
     opening endless overtime, exit preserving confirmed rewards.
   • Rewards, exactly the DESIGN-v1 section 3 draft tables:
     Leo guaranteed per round clear, grade-probability item rolls
     granted through the shared espil-guide monster-drop event
     (panels.js grants the item - no fork of the item store), Leo
     into the one espil_leo_balance store (no fork).
   • The death/revive economy inside a run: 3 stock revives from
     the SHARED espil_owned_items 'Revival Potion' count (the
     same count the monolith death UI reads), then up to 2 more
     bought through the cash shop's arena-revive-credit
     entitlement (max 5 per run), revive in place at 50%.
   • Records in espil_arena_best_v1 (personal + party bests).
     GUESTS play fully but persist NOTHING (session-local record
     object only - the quest non-persistence rule applied to the
     arena; signed-in state = window.__espilAuthState, the same
     surface panels.js uses for its guest quest rule).

   MONOLITH SEAM (arena/MONOLITH-SEAM.md): the portal's Use
   interaction, the arena interior instance routing (own anchor,
   entry/exit teleports), the revive hooks and the death-UI hold
   are monolith work. Everything seam-dependent here is a THIN
   ADAPTER over this module's logic:
   • space enter/exit: window.__espilArenaEnterSpace() /
     __espilArenaExitSpace() when the seam lands; until then the
     run plays on a FALLBACK staging ground east of the plaza
     (state().run.spaceReady === false says so, plainly).
   • revive in place: window.__espilPlayerRevivePotion() /
     __espilPlayerRevive(frac) when the seam lands; until then
     the stock-revive button clicks the standard death UI's own
     potion button (the same consumption path), the village
     button exits the run through the standard UI, and the CASH
     revive button is DISABLED with its reason shown - an
     entitlement is never sold while it cannot be spent.
   • portal interact: this module carries its own proximity
     prompt + F key + click path; the seam registers the portal
     with monolith's Use system and calls
     window.__espilArena.portalUse().

   SIMULATION NOTE (honest v1 boundary): the monster layer is
   simulated locally per client in this build (all of monsters.js
   is local). A party therefore groups socially while each client
   simulates its own instance and is paid its own full rewards -
   which is exactly the design's per-player full-reward rule.
   Shared instance simulation is a server (Durable Object) phase,
   not blocked on this module.

   NUMBERS: every gameplay number below is the design's DRAFT,
   marked DRAFT where it is coded, pending Han's tuning.

   Hook: window.__espilArenaState() mirrors
   window.__espilArena.state(); window.__espilArena carries the
   actions + test hooks the rig probes use.

   PROMPT PILL OFF (Han 2026-11-13, confirmed decision,
   superseding the fix-7 guides-inventory keep and qualifying
   the 2026-11-11 raise at HEAD 0ad1b186): the portal proximity
   prompt pill (#espil-arena-prompt) never presents - see the
   PROMPT_OFF gate below. Entry is unchanged: monolith's Use
   system (tryInteract) and this module's F key both call
   portalUse(); only the pill's presentation is gated. */
(function () {
  'use strict';
  if (window.__espilArenaState) return;

  /* ================= constants (DRAFT unless noted) ================= */
  var PORTAL = { x: 11, z: 33 };        /* 8 m east of ESPIL_SPAWN (3,33), inside the safe zone */
  var PORTAL_RANGE = 10;                /* DRAFT - the spawn point itself is in range */
  var STAGING = { x: 100, z: 33 };      /* pre-seam fallback ground, outside the safe zone */
  var RUN_MS = 600000;                  /* DRAFT 10 min */
  var ROUND_SOFT_MS = 180000;           /* DRAFT - past this the round's monsters enrage */
  var INTERMISSION_MS = 5000;           /* DRAFT between rounds */
  var PARTY_CAP = 4;                    /* Han round 3: cap 4, fixed */
  var QUEUE_WAIT_MS = 4000;             /* DRAFT auto-match wait, then the waiting group is confirmed */
  var SPAWN_ALIVE_MAX = 6;              /* DRAFT trickle cap: instance bodies alive at once */
  var SPAWN_EVERY_MS = 800;             /* DRAFT trickle interval */
  var SPAWN_RING_MIN = 13, SPAWN_RING_MAX = 20;   /* DRAFT spawn distance from the run centre */
  var REVIVE_STOCK_MAX = 3;             /* per run, from the shared potion stock */
  var REVIVE_CASH_MAX = 2;              /* per run, through the cash shop */
  var REVIVE_FRAC = 0.5;                /* revive in place at HP/MP 50% (design, fixed) */
  var CASH_REVIVE_ITEM = 'arena-revive-credit';   /* cashshop.js catalogue id (persistent entitlement) */
  var LS_KEY = 'espil_arena_best_v1';
  var LEO_KEY = 'espil_leo_balance';

  /* Prompt pill off (Han 2026-11-13): the portal proximity
     prompt (#espil-arena-prompt) never presents while this flag
     is set - the tick below checks it before toggling the
     pill's 'open' class. The portal, the Use/F-key entry paths
     and the forming panel never read it. One flag restores
     the pill. */
  var PROMPT_OFF = true;

  /* reward tables (DESIGN-v1 section 3, all DRAFT) */
  var LEO_PER_ROUND = 10;               /* round clear pays round x 10 Leo, guaranteed */
  var FULL_CLEAR_BONUS = 500;           /* round-10 full clear */
  var RECORD_BONUS_PER_ROUND = 20;      /* per round of personal-best improvement, once per run */
  var ROLL_BANDS = [
    { maxRound: 3,  acq: 0.40, grades: [['white', 55], ['yellow', 30], ['green', 12], ['blue', 3]] },
    { maxRound: 6,  acq: 0.55, grades: [['white', 35], ['yellow', 32], ['green', 20], ['blue', 10], ['purple', 3]] },
    { maxRound: 9,  acq: 0.70, grades: [['white', 18], ['yellow', 28], ['green', 26], ['blue', 18], ['purple', 8], ['red', 2]] },
    { maxRound: 1e9, acq: 0.85, grades: [['white', 8], ['yellow', 18], ['green', 26], ['blue', 26], ['purple', 14], ['red', 6], ['gold', 1.8], ['pink', 0.2]] }
  ];
  /* wave composition by round (DRAFT; tier unlock per design) */
  function poolForRound(r) {
    if (r <= 2) return ['rat', 'wisp'];
    if (r <= 4) return ['rat', 'wisp', 'stray', 'shambler'];
    if (r === 5) return ['stray', 'shambler', 'brute'];
    if (r <= 7) return ['shambler', 'brute', 'wraith'];
    if (r <= 9) return ['brute', 'wraith', 'hound'];
    return ['wraith', 'hound', 'titan'];
  }
  function titansForRound(r) {           /* DRAFT titan-class beats */
    if (r === 5) return 1;
    if (r === 10) return 2;
    if (r > 10 && r % 5 === 0) return 1;
    return 0;
  }
  function dropZoneForRound(r) {         /* kill drops use the open-world table of this zone */
    if (r <= 3) return 'low';
    if (r <= 6) return 'mid';
    return 'high';
  }
  function bandForRound(r) {
    for (var i = 0; i < ROLL_BANDS.length; i++) if (r <= ROLL_BANDS[i].maxRound) return ROLL_BANDS[i];
    return ROLL_BANDS[ROLL_BANDS.length - 1];
  }

  /* ================= small helpers ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inMap() { return !!(document.body && document.body.classList.contains('in-map')); }
  function playerPos() {
    try { var p = window.__espilPlayerPose && window.__espilPlayerPose(); if (p && isFinite(p.x)) return p; } catch (e) {}
    return null;
  }
  function distTo(x, z) { var p = playerPos(); if (!p) return 1e9; var dx = p.x - x, dz = p.z - z; return Math.sqrt(dx * dx + dz * dz); }
  function signedIn() {
    try { var a = window.__espilAuthState && window.__espilAuthState(); return !!(a && a.signedIn); } catch (e) { return false; }
  }
  function myName() { try { return localStorage.getItem('espil_username') || 'Guest'; } catch (e) { return 'Guest'; } }
  function dayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function leoBalance() { var n = parseInt(localStorage.getItem(LEO_KEY), 10); return isFinite(n) ? n : 1000; }
  function leoAdd(n) { try { localStorage.setItem(LEO_KEY, String(leoBalance() + n)); } catch (e) {} }
  function potionCount() {
    try { var c = window.__espilCombatState && window.__espilCombatState(); if (c && isFinite(c.potions)) return c.potions; } catch (e) {}
    return 0;
  }
  function entryMode() { try { return window.__espilEntryMode || sessionStorage.getItem('espil_entry_mode') || 'play'; } catch (e) { return 'play'; } }

  /* ================= records ================= */
  var _recs = null;
  function blankRecs() {
    return { personal: { bestRound: 0, bestKills: 0, bestFullClearMs: null },
             party: { bestRound: 0, members: [] },
             consumedEntitlements: 0, lastRunDay: null, runs: 0 };
  }
  function recs() {
    if (_recs) return _recs;
    _recs = blankRecs();
    if (signedIn()) {
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) { var p = JSON.parse(raw); if (p && p.personal && p.party) _recs = p; }
      } catch (e) {}
    }
    return _recs;
  }
  function saveRecs() {
    if (!signedIn()) return;   /* guests: session-local only, nothing persisted */
    try { localStorage.setItem(LS_KEY, JSON.stringify(recs())); } catch (e) {}
  }

  /* ================= party ================= */
  var party = { members: [{ id: 'self', name: myName(), self: true }], source: 'solo' };
  function partySize() { return party.members.length; }
  function refreshPartyFromSocial() {
    try {
      var st = window.__espilSocialState && window.__espilSocialState();
      if (st && st.party && st.party.members && st.party.members.length) {
        var me = myName(), hasSelf = false;
        var members = st.party.members.slice(0, PARTY_CAP).map(function (n) {
          var self = (n === me); if (self) hasSelf = true;
          return { id: n, name: n, self: self };
        });
        if (!hasSelf) members.unshift({ id: 'self', name: me, self: true });
        party = { members: members.slice(0, PARTY_CAP), source: 'social' };
        return party;
      }
    } catch (e) {}
    if (party.source === 'social') party = { members: [{ id: 'self', name: myName(), self: true }], source: 'solo' };
    return party;
  }
  function nearbyPlayers() {
    try {
      var st = window.__espilChatState && window.__espilChatState();
      if (!st || !st.users) return [];
      return st.users.filter(function (u) { return u.id !== st.myId; }).map(function (u) {
        return { id: u.id, name: u.name || 'Guest' };
      });
    } catch (e) { return []; }
  }
  function invite(peerId) {
    try { if (typeof window.__espilSocialSend === 'function') return !!window.__espilSocialSend({ t: 'party_invite', to: peerId }); } catch (e) {}
    return false;
  }

  /* auto-match queue (local state machine; see the header note) */
  var queue = { active: false, since: 0, matched: 0, timer: null };
  function enterQueue() {
    if (run) return { ok: false, why: 'running' };
    if (queue.active) return { ok: true, already: true };
    queue.active = true; queue.since = Date.now(); queue.matched = 0;
    queue.timer = setTimeout(function () {
      if (!queue.active) return;
      queue.active = false;
      refreshPartyFromSocial();
      queue.matched = partySize();
      renderPanel();
    }, QUEUE_WAIT_MS);
    renderPanel();
    return { ok: true };
  }
  function leaveQueue() {
    if (queue.timer) { clearTimeout(queue.timer); queue.timer = null; }
    queue.active = false; queue.matched = 0;
    renderPanel();
    return { ok: true };
  }

  /* ================= rewards ================= */
  function rollItem(round, forceAcquire) {
    var band = bandForRound(round);
    if (!forceAcquire && Math.random() >= band.acq) return null;
    var table = window.__espilDropTable;
    if (!table) return null;
    var roll = Math.random() * 100, acc = 0, grade = band.grades[band.grades.length - 1][0];
    for (var i = 0; i < band.grades.length; i++) { acc += band.grades[i][1]; if (roll < acc) { grade = band.grades[i][0]; break; } }
    var lines = ['weapon', 'armour', 'accessory'];
    var line = lines[Math.floor(Math.random() * lines.length)];
    var name = table[line] && table[line][grade];
    if (!name) return null;
    return { name: name, line: line, grade: grade, count: 1 };
  }
  function grantItem(item) {
    /* The shared drop path: panels.js grants espil-guide
       monster-drop items into espil_owned_items. Instance kills
       already flow through it; round-clear rolls ride the same
       event so the item store is never forked. */
    try {
      window.dispatchEvent(new CustomEvent('espil-guide', {
        detail: { type: 'monster-drop', id: 'arena-roll', kind: 'arena', grade: item.grade, parts: [], items: [item], instance: true, arena: true }
      }));
    } catch (e) {}
  }
  function testRolls(round, n) {
    var got = 0, grades = {}, i, it;
    for (i = 0; i < n; i++) { it = rollItem(round, false); if (it) { got++; grades[it.grade] = (grades[it.grade] || 0) + 1; } }
    return { round: round, n: n, acquired: got, acqRate: n ? got / n : 0, grades: grades };
  }

  /* ================= cash revive entitlement ================= */
  function cashEntitlements() {
    try { var s = window.__espilCash && window.__espilCash.state(); if (s && s.entitlements) return s.entitlements.arenaRevives || 0; } catch (e) {}
    return 0;
  }
  function cashSpare() { return Math.max(0, cashEntitlements() - (recs().consumedEntitlements || 0)); }
  function reviveSeamReady() { return typeof window.__espilPlayerRevive === 'function' || typeof window.__espilPlayerRevivePotion === 'function'; }

  /* ================= space adapters (monolith seam) ================= */
  function enterSpace() {
    try {
      if (typeof window.__espilArenaEnterSpace === 'function') {
        var c = window.__espilArenaEnterSpace();
        if (c && isFinite(c.x) && isFinite(c.z)) return { centre: { x: c.x, z: c.z }, ready: true };
      }
    } catch (e) {}
    return { centre: { x: STAGING.x, z: STAGING.z }, ready: false };
  }
  function exitSpace() {
    try { if (typeof window.__espilArenaExitSpace === 'function') window.__espilArenaExitSpace(); } catch (e) {}
  }

  /* ================= the run ================= */
  var run = null;
  var lastSummary = null;

  function startRun() {
    if (run) return { ok: false, why: 'already-running' };
    if (entryMode() === 'shop') return { ok: false, why: 'shop-mode' };
    if (queue.active) leaveQueue();
    refreshPartyFromSocial();
    var space = enterSpace();
    var r = recs();
    run = {
      startedAt: Date.now(), endsAt: Date.now() + RUN_MS,
      round: 0, phase: 'starting', clearedRounds: 0,
      members: party.members.slice(0, PARTY_CAP), partySize: Math.max(1, Math.min(PARTY_CAP, partySize())),
      centre: space.centre, spaceReady: space.ready,
      kills: 0, leoEarned: 0, itemsWon: [],
      stockUsed: 0, cashUsed: 0, dead: false, cashArmed: false,
      oldBest: r.personal.bestRound, firstToday: r.lastRunDay !== dayKey(),
      fullClearMs: null, fullClearPaid: false, overtime: false,
      roundStartedAt: 0, roundSpawned: 0, roundBudget: 0, roundTitans: 0,
      enraged: false, lastSpawnAt: 0, outSince: 0
    };
    /* the day/run counters live in the record object either way
       (guests: session memory only - saveRecs persists solely for
       signed-in users), so the daily-first rule behaves the same
       inside one guest session. */
    r.lastRunDay = dayKey(); r.runs = (r.runs || 0) + 1; saveRecs();
    /* seam item 2: while held, monolith still marks death and
       dispatches player-died but does not present its own death UI
       (the arena death panel is the surface). Harmless pre-seam:
       the current monolith ignores the flag and its UI shows. */
    try { window.__espilDeathUiHold = true; } catch (e) {}
    startRound(1);
    showHud(); renderPanel();
    return { ok: true, spaceReady: space.ready };
  }

  function startRound(rn) {
    run.round = rn; run.phase = 'combat';
    run.roundStartedAt = Date.now(); run.enraged = false;
    if (window.__espilInstanceSetEnrage) window.__espilInstanceSetEnrage(false);
    var base = 6 + 4 * rn;   /* DRAFT round spawn count */
    run.roundBudget = Math.round(base * (1 + 0.7 * (run.partySize - 1)));   /* DRAFT party spawn scaling */
    run.roundSpawned = 0;
    run.roundTitans = titansForRound(rn);
    run.lastSpawnAt = 0;
    banner('라운드 ' + rn + (rn > 10 ? ' - 오버타임' : ''));
  }

  function spawnStep(now) {
    if (run.roundSpawned >= run.roundBudget) return;
    if (now - run.lastSpawnAt < SPAWN_EVERY_MS) return;
    var alive = window.__espilInstanceState ? window.__espilInstanceState().length : 0;
    if (alive >= SPAWN_ALIVE_MAX) return;
    var isTitan = run.roundTitans > 0 && run.roundSpawned >= run.roundBudget - run.roundTitans;
    var pool = poolForRound(run.round);
    var kindId = isTitan ? 'titan' : pool[Math.floor(Math.random() * pool.length)];
    var spot = null;
    for (var t = 0; t < 8 && !spot; t++) {
      var a = Math.random() * Math.PI * 2, d = SPAWN_RING_MIN + Math.random() * (SPAWN_RING_MAX - SPAWN_RING_MIN);
      var x = run.centre.x + Math.cos(a) * d, z = run.centre.z + Math.sin(a) * d;
      var blocked = false;
      try { blocked = !!(window.__espilCollisionProbe && window.__espilCollisionProbe(x, z)); } catch (e) {}
      if (!blocked) spot = { x: x, z: z };
    }
    if (!spot) spot = { x: run.centre.x + SPAWN_RING_MIN, z: run.centre.z };
    var id = window.__espilInstanceSpawn && window.__espilInstanceSpawn(kindId, spot.x, spot.z, {
      level: run.round,
      hpMul: 1 + 0.5 * (run.partySize - 1),   /* DRAFT party HP scaling */
      dropZone: dropZoneForRound(run.round)
    });
    if (id != null) {
      run.roundSpawned++; if (isTitan) run.roundTitans--; run.lastSpawnAt = now;
      if (run.enraged && window.__espilInstanceSetEnrage) window.__espilInstanceSetEnrage(true);   /* late spawns join the enrage */
    }
  }

  function roundClear() {
    var rn = run.round;
    run.clearedRounds = rn;
    var leo = rn * LEO_PER_ROUND * (run.firstToday ? 2 : 1);   /* DRAFT: daily first run x2 */
    leoAdd(leo); run.leoEarned += leo;
    var item = rollItem(rn, false);
    if (item) { grantItem(item); run.itemsWon.push(item); }
    if (rn === 10 && !run.fullClearPaid) {
      run.fullClearPaid = true;
      run.fullClearMs = Date.now() - run.startedAt;
      leoAdd(FULL_CLEAR_BONUS); run.leoEarned += FULL_CLEAR_BONUS;
      var bonus = rollItem(10, true);   /* full clear: one extra roll at 100% acquisition */
      if (bonus) { grantItem(bonus); run.itemsWon.push(bonus); }
      run.overtime = true;
      banner('풀 클리어! 남은 시간 동안 오버타임이 이어집니다');
    } else {
      banner('라운드 ' + rn + ' 클리어 - Leo +' + leo);
    }
    run.phase = 'intermission';
    run.phaseEndsAt = Date.now() + INTERMISSION_MS;
  }

  function finishRun(reason) {
    if (!run) return null;
    var r = recs();
    var recordBonus = 0;
    if (run.clearedRounds > run.oldBest) {
      recordBonus = (run.clearedRounds - run.oldBest) * RECORD_BONUS_PER_ROUND;   /* DRAFT, once per run */
      leoAdd(recordBonus); run.leoEarned += recordBonus;
    }
    if (run.clearedRounds > r.personal.bestRound) r.personal.bestRound = run.clearedRounds;
    if (run.kills > r.personal.bestKills) r.personal.bestKills = run.kills;
    if (run.fullClearMs && (!r.personal.bestFullClearMs || run.fullClearMs < r.personal.bestFullClearMs)) r.personal.bestFullClearMs = run.fullClearMs;
    if (run.clearedRounds > r.party.bestRound) {
      r.party.bestRound = run.clearedRounds;
      r.party.members = run.members.map(function (m) { return m.name; });
    }
    saveRecs();
    try { window.__espilDeathUiHold = false; } catch (e) {}
    if (window.__espilInstanceClear) window.__espilInstanceClear();
    if (window.__espilInstanceSetEnrage) window.__espilInstanceSetEnrage(false);
    exitSpace();
    lastSummary = {
      reason: reason, rounds: run.clearedRounds, kills: run.kills,
      leoEarned: run.leoEarned, recordBonus: recordBonus,
      items: run.itemsWon.map(function (i) { return i.name; }),
      stockUsed: run.stockUsed, cashUsed: run.cashUsed,
      fullClearMs: run.fullClearMs, partySize: run.partySize,
      spaceReady: run.spaceReady
    };
    run = null;
    hideDeathPanel(); showResults(lastSummary); renderPanel(); renderHud();
    return lastSummary;
  }

  function exitRun() { return finishRun('portal'); }

  /* death inside a run: 'player-died' arrives on espil-guide;
     the outcome is classified by watching the combat state -
     ~50% revive in place = a consumed revive (stock or cash),
     ~10% at the spawn point = village = the player leaves the run. */
  function onPlayerDied() {
    if (!run || run.dead) return;
    run.dead = true;
    showDeathPanel();
  }
  function watchRevive() {
    if (!run || !run.dead) return;
    var c = null;
    try { c = window.__espilCombatState && window.__espilCombatState(); } catch (e) {}
    if (!c || c.dead) return;
    run.dead = false;
    hideDeathPanel();
    var frac = c.maxhp ? c.hp / c.maxhp : 0;
    if (run.cashArmed) { run.cashArmed = false; run.cashUsed++; return; }
    if (frac >= 0.4) { run.stockUsed++; return; }
    finishRun('village');   /* revived at the village: out of the run, confirmed rewards kept */
  }
  function stockLeft() { return run ? Math.max(0, REVIVE_STOCK_MAX - run.stockUsed) : 0; }
  function cashLeft() { return run ? Math.max(0, REVIVE_CASH_MAX - run.cashUsed) : 0; }

  function useStockRevive() {
    if (!run || !run.dead) return { ok: false, why: 'not-dead' };
    if (stockLeft() <= 0) return { ok: false, why: 'stock-cap' };
    if (potionCount() <= 0) return { ok: false, why: 'no-potions' };
    if (typeof window.__espilPlayerRevivePotion === 'function') {
      if (window.__espilPlayerRevivePotion()) return { ok: true, via: 'seam' };
      return { ok: false, why: 'revive-failed' };
    }
    /* pre-seam adapter: the standard death UI's own potion button
       is the delivered consumption path (espilConsumePotion +
       revive at 50%); watchRevive counts the revive when the
       player is observed alive again. */
    var btn = $('espil-death-potion');
    if (btn) { btn.click(); return { ok: true, via: 'death-ui' }; }
    return { ok: false, why: 'no-death-ui' };
  }
  function useCashRevive() {
    if (!run || !run.dead) return { ok: false, why: 'not-dead' };
    if (cashLeft() <= 0) return { ok: false, why: 'cash-cap' };
    if (!reviveSeamReady()) return { ok: false, why: 'seam-pending' };   /* never sell an unspendable revive */
    var r = recs();
    if (cashSpare() <= 0) {
      if (!window.__espilCash) return { ok: false, why: 'no-cashshop' };
      var bought = window.__espilCash.buy(CASH_REVIVE_ITEM);
      if (!bought || !bought.ok) return { ok: false, why: (bought && bought.why) || 'buy-failed' };
    }
    r.consumedEntitlements = (r.consumedEntitlements || 0) + 1;
    saveRecs();
    run.cashArmed = true;
    var ok = false;
    if (typeof window.__espilPlayerRevive === 'function') ok = !!window.__espilPlayerRevive(REVIVE_FRAC);
    else if (typeof window.__espilPlayerRevivePotion === 'function') ok = !!window.__espilPlayerRevivePotion();
    if (!ok) { run.cashArmed = false; return { ok: false, why: 'revive-failed' }; }
    return { ok: true, via: 'seam' };
  }
  function exitFromDeath() {
    if (!run) return { ok: false, why: 'no-run' };
    if (run.dead) {
      var btn = $('espil-death-village');
      if (btn) { btn.click(); return { ok: true, via: 'death-ui' }; }   /* watchRevive classifies the village revive as the exit */
      if (typeof window.__espilPlayerReviveVillage === 'function' && window.__espilPlayerReviveVillage()) return { ok: true, via: 'seam' };
      return { ok: false, why: 'seam-pending' };   /* never finish a run under a dead player with no revive path */
    }
    return finishRun('exit') ? { ok: true, via: 'direct' } : { ok: false, why: 'no-run' };
  }

  /* ================= portal 3D (visual + label + board) ================= */
  var portalGroup = null, portalRing = null, boardMesh = null, boardCanvas = null;
  /* the scene climb, copied from monsters.js: __espilMapCameraObj
     is a FUNCTION returning the camera object in the delivered
     build, and the climb must end at the THREE.Scene itself */
  function climbToScene(obj) {
    var n = obj;
    while (n && n.parent) n = n.parent;
    return (n && n.isScene) ? n : null;
  }
  function sceneRoot() {
    try {
      var cam = (typeof window.__espilMapCameraObj === 'function')
        ? window.__espilMapCameraObj() : null;
      if (cam) { var s0 = climbToScene(cam); if (s0) return s0; }
      var dm = window.__espilDistrictMeshes || [];
      for (var i = 0; i < dm.length; i++) {
        var s1 = climbToScene(dm[i]);
        if (s1) return s1;
      }
      if (window.__espilTimeStoneGroup) {
        var s2 = climbToScene(window.__espilTimeStoneGroup);
        if (s2) return s2;
      }
      return null;
    } catch (e) { return null; }
  }
  function textSprite(lines, opts) {
    opts = opts || {};
    var c = document.createElement('canvas'); c.width = 512; c.height = 192;
    var g = c.getContext('2d');
    g.fillStyle = opts.bg || 'rgba(12,8,4,0.78)';
    g.beginPath();
    if (g.roundRect) g.roundRect(6, 6, 500, 180, 26); else g.rect(6, 6, 500, 180);
    g.fill();
    g.strokeStyle = opts.rim || '#f2b63c'; g.lineWidth = 6; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(function (ln, i) {
      g.fillStyle = ln.color || '#ffe9b0';
      g.font = (ln.bold ? '700 ' : '') + (ln.size || 44) + 'px sans-serif';
      g.fillText(ln.text, 256, 50 + i * 52);
    });
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(opts.w || 5.4, (opts.w || 5.4) * 192 / 512, 1);
    sp.renderOrder = 30;
    return sp;
  }
  function drawBoard() {
    if (!boardCanvas) return;
    var r = recs(), g = boardCanvas.getContext('2d');
    g.fillStyle = '#171008'; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = '#f2b63c'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 312);
    g.textAlign = 'center'; g.fillStyle = '#f2b63c';
    g.font = '700 40px sans-serif'; g.fillText('아레나 기록', 256, 58);
    g.fillStyle = '#ffe9b0'; g.font = '30px sans-serif';
    g.fillText('개인 최고 라운드  ' + (r.personal.bestRound || '-'), 256, 120);
    g.fillText('한 런 최다 처치  ' + (r.personal.bestKills || '-'), 256, 168);
    g.fillText('파티 최고 라운드  ' + (r.party.bestRound || '-'), 256, 216);
    g.fillStyle = '#c9b48a'; g.font = '24px sans-serif';
    g.fillText(signedIn() ? '내 기록만 표시됩니다' : '게스트 기록은 이 세션에만 남습니다', 256, 276);
    if (boardMesh) boardMesh.material.map.needsUpdate = true;
  }
  function buildPortal() {
    if (portalGroup && portalGroup.parent) return true;
    if (typeof THREE === 'undefined') return false;
    var scene = sceneRoot();
    if (!scene) return false;
    try {
      portalGroup = new THREE.Group();
      portalGroup.position.set(PORTAL.x, 0, PORTAL.z);
      var base = new THREE.Mesh(
        new THREE.CircleGeometry(3.4, 40),
        new THREE.MeshBasicMaterial({ color: 0xf2b63c, transparent: true, opacity: 0.30, depthWrite: false })
      );
      base.rotation.x = -Math.PI / 2; base.position.y = 0.06;
      portalGroup.add(base);
      portalRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.3, 0.13, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0xffcf5e, transparent: true, opacity: 0.85 })
      );
      portalRing.position.y = 2.4;
      portalGroup.add(portalRing);
      var label = textSprite([{ text: '⚔ 아레나 포탈', size: 52, bold: true }, { text: 'ARENA PORTAL · 입장 무료', size: 32, color: '#c9b48a' }], { w: 6.2 });
      label.position.y = 5.6;
      portalGroup.add(label);
      /* record board slab beside the portal */
      boardCanvas = document.createElement('canvas'); boardCanvas.width = 512; boardCanvas.height = 320;
      var btex = new THREE.CanvasTexture(boardCanvas);
      boardMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.7, 0.14),
        new THREE.MeshBasicMaterial({ map: btex })
      );
      boardMesh.position.set(-4.4, 1.5, 1.4);
      boardMesh.rotation.y = 0.5;
      portalGroup.add(boardMesh);
      drawBoard();
      scene.add(portalGroup);
      return true;
    } catch (e) { portalGroup = null; return false; }
  }

  /* ================= DOM (panel / HUD / death / results) ================= */
  var CSS = [
    '#espil-arena-panel{position:fixed;right:14px;top:64px;width:300px;z-index:9970;background:linear-gradient(160deg,rgba(26,17,8,.96),rgba(12,8,4,.97));border:1px solid rgba(242,182,60,.55);border-radius:14px;color:#f5e6c4;font-family:inherit;padding:14px 14px 12px;box-shadow:0 14px 40px rgba(0,0,0,.55);display:none}',
    '#espil-arena-panel.open{display:block}',
    '#espil-arena-panel h3{margin:0 0 8px;font-size:15px;color:#ffd977;letter-spacing:.04em}',
    '#espil-arena-panel .row{font-size:12.5px;line-height:1.55;color:#e8d9ae}',
    '#espil-arena-panel .dim{color:#a68d54;font-size:11.5px}',
    '#espil-arena-panel button{background:linear-gradient(180deg,#8a6420,#6d4d15);border:1px solid #f2b63c;color:#ffeec2;border-radius:9px;padding:7px 10px;font-size:12.5px;cursor:pointer;margin:4px 4px 0 0;font-family:inherit}',
    '#espil-arena-panel button:disabled{opacity:.45;cursor:default}',
    '#espil-arena-panel button.ghost{background:rgba(255,255,255,.06);border-color:rgba(242,182,60,.35)}',
    '#espil-arena-panel .x{position:absolute;top:8px;right:10px;background:none;border:none;color:#a68d54;font-size:16px;margin:0;padding:2px 6px}',
    '#espil-arena-hud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9960;background:rgba(12,8,4,.82);border:1px solid rgba(242,182,60,.5);border-radius:999px;color:#ffe9b0;font-size:13px;padding:6px 14px;display:none;font-family:inherit}',
    '#espil-arena-hud.open{display:block}',
    '#espil-arena-hud button{background:none;border:1px solid rgba(242,182,60,.5);color:#ffe9b0;border-radius:999px;padding:2px 9px;margin-left:8px;cursor:pointer;font-size:12px;font-family:inherit}',
    '#espil-arena-prompt{position:fixed;bottom:188px;left:50%;transform:translateX(-50%);z-index:9960;background:rgba(12,8,4,.85);border:1px solid rgba(242,182,60,.55);border-radius:10px;color:#ffe9b0;font-size:13.5px;padding:8px 14px;display:none;cursor:pointer;font-family:inherit}',
    '#espil-arena-prompt.open{display:block}',
    '#espil-arena-banner{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9965;color:#ffd977;font-size:20px;font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.8);display:none;font-family:inherit;pointer-events:none}',
    '#espil-arena-banner.open{display:block}',
    '#espil-arena-death{position:fixed;inset:0;z-index:9996;background:rgba(10,2,2,.45);display:none;align-items:center;justify-content:center;font-family:inherit}',
    '#espil-arena-death.open{display:flex}',
    '#espil-arena-death .card{background:linear-gradient(160deg,rgba(30,14,8,.97),rgba(14,6,4,.98));border:1px solid rgba(255,120,90,.5);border-radius:16px;padding:22px 26px;width:330px;color:#f7e3c2;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.6)}',
    '#espil-arena-death h3{margin:0 0 6px;color:#ff9a7a;font-size:17px}',
    '#espil-arena-death .row{font-size:12.5px;line-height:1.6;color:#e8cdb2}',
    '#espil-arena-death button{display:block;width:100%;margin:8px 0 0;background:linear-gradient(180deg,#8a6420,#6d4d15);border:1px solid #f2b63c;color:#ffeec2;border-radius:10px;padding:9px;font-size:13.5px;cursor:pointer;font-family:inherit}',
    '#espil-arena-death button:disabled{opacity:.45;cursor:default}',
    '#espil-arena-death button.ghost{background:rgba(255,255,255,.06);border-color:rgba(242,182,60,.35)}',
    '#espil-arena-results{position:fixed;inset:0;z-index:9968;background:rgba(6,4,2,.45);display:none;align-items:center;justify-content:center;font-family:inherit}',
    '#espil-arena-results.open{display:flex}',
    '#espil-arena-results .card{background:linear-gradient(160deg,rgba(26,17,8,.97),rgba(12,8,4,.98));border:1px solid rgba(242,182,60,.55);border-radius:16px;padding:22px 26px;width:320px;color:#f5e6c4;text-align:center}',
    '#espil-arena-results h3{margin:0 0 8px;color:#ffd977;font-size:17px}',
    '#espil-arena-results .row{font-size:13px;line-height:1.65;color:#e8d9ae;text-align:left}',
    '#espil-arena-results button{margin-top:12px;background:linear-gradient(180deg,#8a6420,#6d4d15);border:1px solid #f2b63c;color:#ffeec2;border-radius:10px;padding:8px 18px;cursor:pointer;font-family:inherit}'
  ].join('\n');
  var domBuilt = false, bannerTimer = null;
  function buildDom() {
    if (domBuilt) return;
    domBuilt = true;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var panel = document.createElement('div'); panel.id = 'espil-arena-panel'; document.body.appendChild(panel);
    var hud = document.createElement('div'); hud.id = 'espil-arena-hud'; document.body.appendChild(hud);
    var prompt = document.createElement('div'); prompt.id = 'espil-arena-prompt';
    prompt.textContent = '⚔ 아레나 포탈 - 클릭 또는 F 키로 열기';
    prompt.addEventListener('click', function () { portalUse(); });
    document.body.appendChild(prompt);
    var bn = document.createElement('div'); bn.id = 'espil-arena-banner'; document.body.appendChild(bn);
    var death = document.createElement('div'); death.id = 'espil-arena-death'; document.body.appendChild(death);
    var res = document.createElement('div'); res.id = 'espil-arena-results'; document.body.appendChild(res);
  }
  function banner(text) {
    buildDom();
    var bn = $('espil-arena-banner'); if (!bn) return;
    bn.textContent = text; bn.classList.add('open');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bn.classList.remove('open'); }, 2600);
  }
  function portalUse() {
    buildDom();
    if (entryMode() === 'shop') { banner('쇼핑 모드에서는 아레나에 입장할 수 없습니다'); return state(); }
    var p = $('espil-arena-panel');
    if (p) { p.classList.add('open'); renderPanel(); }
    return state();
  }
  function renderPanel() {
    var p = $('espil-arena-panel');
    if (!p || !p.classList.contains('open')) return;
    refreshPartyFromSocial();
    var r = recs();
    var near = distTo(PORTAL.x, PORTAL.z) <= PORTAL_RANGE;
    var html = '<button class="x" data-a="close">✕</button><h3>⚔ 아레나 포탈</h3>';
    if (run) {
      html += '<div class="row">런 진행 중 - 라운드 ' + run.round + ' · 처치 ' + run.kills + ' · Leo +' + run.leoEarned + '</div>'
        + '<div class="row dim">런 상태에서는 이 패널에서 나갈 수 있습니다.</div>'
        + '<button data-a="exit">런 종료 (보상 유지)</button>';
    } else {
      html += '<div class="row">입장 무료 · 10분 웨이브 런 · 파티 최대 ' + PARTY_CAP + '인</div>'
        + '<div class="row dim">개인 최고 라운드 ' + (r.personal.bestRound || '-') + ' · 한 런 최다 처치 ' + (r.personal.bestKills || '-') + '<br>파티 최고 라운드 ' + (r.party.bestRound || '-') + (signedIn() ? '' : '<br>게스트 기록은 이 세션에만 남습니다') + '</div>'
        + '<div class="row" style="margin-top:6px">파티 (' + partySize() + '/' + PARTY_CAP + '): ' + party.members.map(function (m) { return esc(m.name); }).join(', ') + '</div>';
      var nearPlayers = nearbyPlayers();
      if (nearPlayers.length) {
        html += '<div class="row dim" style="margin-top:4px">초대할 수 있는 플레이어</div>' + nearPlayers.slice(0, 6).map(function (u) {
          return '<button class="ghost" data-a="invite" data-id="' + esc(u.id) + '">' + esc(u.name) + ' 초대</button>';
        }).join('');
      }
      if (queue.active) html += '<div class="row" style="margin-top:6px">자동 매칭 대기 중... (' + Math.max(0, Math.round((QUEUE_WAIT_MS - (Date.now() - queue.since)) / 1000)) + '초)</div><button class="ghost" data-a="dequeue">대기 취소</button>';
      else html += '<div style="margin-top:4px"><button class="ghost" data-a="queue">자동 매칭 대기</button></div>';
      html += '<button data-a="enter" ' + (near ? '' : 'disabled') + '>아레나 입장</button>'
        + (near ? '' : '<span class="dim">포탈 근처에서 입장할 수 있습니다</span>')
        + '<button class="ghost" data-a="cash">캐시상점</button>'
        + '<div class="row dim" style="margin-top:6px">캐시상점은 포탈과 라운드 사이 휴식 시간에 열 수 있습니다.</div>';
    }
    p.innerHTML = html;
    Array.prototype.forEach.call(p.querySelectorAll('button[data-a]'), function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-a');
        if (a === 'close') p.classList.remove('open');
        else if (a === 'enter') { var res = startRun(); if (!res.ok) banner('입장할 수 없습니다: ' + res.why); }
        else if (a === 'exit') exitRun();
        else if (a === 'queue') enterQueue();
        else if (a === 'dequeue') leaveQueue();
        else if (a === 'invite') { invite(b.getAttribute('data-id')); banner('파티 초대를 보냈습니다'); }
        else if (a === 'cash') { if (window.__espilCash) window.__espilCash.open(); }
        renderPanel();
      });
    });
  }
  function showHud() { buildDom(); renderHud(); }
  function renderHud() {
    var h = $('espil-arena-hud');
    if (!h) return;
    if (!run) { h.classList.remove('open'); return; }
    var left = Math.max(0, run.endsAt - Date.now());
    var mm = Math.floor(left / 60000), ss = Math.floor(left % 60000 / 1000);
    h.innerHTML = '⚔ 라운드 ' + run.round + (run.overtime ? ' (오버타임)' : '') + ' · ' + mm + ':' + (ss < 10 ? '0' : '') + ss + ' · 처치 ' + run.kills + ' · Leo +' + run.leoEarned
      + '<button id="espil-arena-hud-exit">나가기</button>';
    h.classList.add('open');
    var b = $('espil-arena-hud-exit');
    if (b) b.addEventListener('click', function () { exitRun(); });
  }
  function showDeathPanel() {
    buildDom();
    var d = $('espil-arena-death');
    if (!d || !run) return;
    var seam = reviveSeamReady();
    var sl = stockLeft(), cl = cashLeft(), pots = potionCount();
    d.innerHTML = '<div class="card"><h3>쓰러졌습니다</h3>'
      + '<div class="row">아레나 부활은 이 런에서 최대 5회까지 가능합니다.<br>물약 부활 남은 횟수 ' + sl + '회 · 캐시 부활 남은 횟수 ' + cl + '회<br>보유 부활 물약 ' + pots + '개</div>'
      + '<button data-a="stock" ' + (sl > 0 && pots > 0 ? '' : 'disabled') + '>부활 물약으로 부활 (그 자리, 50%)</button>'
      + '<button data-a="cash" ' + (cl > 0 && seam ? '' : 'disabled') + '>캐시로 부활 구매 (그 자리, 50%) - ' + CASH_REVIVE_ITEM + '</button>'
      + (seam ? '' : '<div class="row" style="color:#a68d54">캐시 부활은 인게임 부활 연동(모노리스 심)이 준비되면 열립니다. 지금은 물약 부활을 사용하세요.</div>')
      + '<button class="ghost" data-a="exit">마을로 나가기 (확정 보상 유지)</button></div>';
    d.classList.add('open');
    Array.prototype.forEach.call(d.querySelectorAll('button[data-a]'), function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-a');
        if (a === 'stock') { var r1 = useStockRevive(); if (!r1.ok) banner('부활할 수 없습니다: ' + r1.why); }
        else if (a === 'cash') { var r2 = useCashRevive(); if (!r2.ok) banner('캐시 부활 실패: ' + r2.why); else hideDeathPanel(); }
        else if (a === 'exit') exitFromDeath();
      });
    });
  }
  function hideDeathPanel() { var d = $('espil-arena-death'); if (d) d.classList.remove('open'); }
  function showResults(s) {
    buildDom();
    var d = $('espil-arena-results');
    if (!d) return;
    d.innerHTML = '<div class="card"><h3>아레나 결과</h3><div class="row">'
      + '클리어 라운드 ' + s.rounds + '<br>처치 ' + s.kills + '<br>획득 Leo +' + s.leoEarned
      + (s.recordBonus ? ' (기록 보너스 +' + s.recordBonus + ')' : '')
      + (s.fullClearMs ? '<br>풀 클리어 기록 ' + Math.round(s.fullClearMs / 1000) + '초' : '')
      + (s.items && s.items.length ? '<br>획득 아이템: ' + s.items.map(esc).join(', ') : '')
      + '<br>부활 사용: 물약 ' + s.stockUsed + '회 · 캐시 ' + s.cashUsed + '회'
      + (s.spaceReady ? '' : '<br><span style="color:#a68d54">인스턴스 공간 연동(모노리스 심) 전이라 임시 구역에서 진행된 런입니다.</span>')
      + '</div><button id="espil-arena-results-close">닫기</button></div>';
    d.classList.add('open');
    $('espil-arena-results-close').addEventListener('click', function () { d.classList.remove('open'); });
    drawBoard();
  }

  /* ================= events + tick ================= */
  window.addEventListener('espil-guide', function (e) {
    var d = (e && e.detail) || {};
    if (d.type === 'monster-drop' && d.instance && run && !d.arena) run.kills++;
    if (d.type === 'player-died') onPlayerDied();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'f' && e.key !== 'F') return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (!inMap() || run) return;
    if (distTo(PORTAL.x, PORTAL.z) <= PORTAL_RANGE) portalUse();
  });

  var lastHudAt = 0;
  setInterval(function () {
    if (!inMap()) {
      if (run) {
        run.outSince = run.outSince || Date.now();
        if (Date.now() - run.outSince > 3000) finishRun('left-map');
      }
      return;
    }
    if (run) run.outSince = 0;
    buildDom();
    buildPortal();
    if (portalRing) { var s = 1 + Math.sin(Date.now() / 500) * 0.05; portalRing.scale.set(s, s, s); }
    var prompt = $('espil-arena-prompt');
    if (prompt) {
      if (PROMPT_OFF) { prompt.classList.remove('open'); }   /* prompt pill off (Han 2026-11-13): never presents */
      else {
        var show = !run && distTo(PORTAL.x, PORTAL.z) <= PORTAL_RANGE;
        prompt.classList.toggle('open', !!show);
      }
    }
    if (!run) return;
    var now = Date.now();
    watchRevive();
    if (!run) return;   /* watchRevive may have finished the run (village exit) */
    if (now >= run.endsAt) { finishRun('time'); return; }
    if (run.phase === 'combat') {
      spawnStep(now);
      if (!run.enraged && now - run.roundStartedAt > ROUND_SOFT_MS) {
        run.enraged = true;
        if (window.__espilInstanceSetEnrage) window.__espilInstanceSetEnrage(true);
        banner('몬스터들이 분노합니다!');
      }
      var alive = window.__espilInstanceState ? window.__espilInstanceState().length : 0;
      if (run.roundSpawned >= run.roundBudget && alive === 0) roundClear();
    } else if (run.phase === 'intermission') {
      if (now >= run.phaseEndsAt) startRound(run.round + 1);
    }
    if (now - lastHudAt > 500) { lastHudAt = now; renderHud(); var p = $('espil-arena-panel'); if (p && p.classList.contains('open')) renderPanel(); }
  }, 200);

  /* ================= state + public hook ================= */
  function state() {
    refreshPartyFromSocial();
    var sz = null;
    try { sz = window.__espilSafeZone && window.__espilSafeZone(); } catch (e) {}
    var r = recs();
    return {
      version: 1,
      mode: entryMode(),
      portal: { x: PORTAL.x, z: PORTAL.z, range: PORTAL_RANGE, built: !!portalGroup, near: distTo(PORTAL.x, PORTAL.z) <= PORTAL_RANGE },
      safeZone: sz,
      party: { size: partySize(), members: party.members.map(function (m) { return m.name; }), source: party.source, cap: PARTY_CAP },
      queue: { active: queue.active, matched: queue.matched, waitMs: QUEUE_WAIT_MS },
      records: { personal: r.personal, party: r.party, persisted: signedIn(), runs: r.runs || 0 },
      cash: { entitlements: cashEntitlements(), consumed: r.consumedEntitlements || 0, spare: cashSpare(), reviveSeamReady: reviveSeamReady() },
      run: run ? {
        round: run.round, phase: run.phase, clearedRounds: run.clearedRounds, kills: run.kills,
        leoEarned: run.leoEarned, itemsWon: run.itemsWon.map(function (i) { return i.name; }),
        partySize: run.partySize, spaceReady: run.spaceReady, enraged: run.enraged,
        roundSpawned: run.roundSpawned, roundBudget: run.roundBudget,
        msLeft: Math.max(0, run.endsAt - Date.now()), firstToday: run.firstToday,
        dead: run.dead, stockUsed: run.stockUsed, cashUsed: run.cashUsed,
        stockLeft: stockLeft(), cashLeft: cashLeft(), overtime: run.overtime
      } : null,
      lastSummary: lastSummary
    };
  }
  window.__espilArenaState = state;
  window.__espilArena = {
    state: state,
    portalUse: portalUse,
    queue: enterQueue,
    leaveQueue: leaveQueue,
    invite: invite,
    startRun: startRun,
    exitRun: exitRun,
    useStockRevive: useStockRevive,
    useCashRevive: useCashRevive,
    testRolls: testRolls,
    testSetParty: function (n) {
      n = Math.max(1, Math.min(PARTY_CAP, n | 0));
      var members = [{ id: 'self', name: myName(), self: true }];
      for (var i = 1; i < n; i++) members.push({ id: 'sim' + i, name: 'Sim' + i, self: false });
      party = { members: members, source: 'test' };
      return partySize();
    },
    testSetRoundElapsed: function (ms) { if (run) run.roundStartedAt = Date.now() - ms; },
    testSetRunLeft: function (ms) { if (run) run.endsAt = Date.now() + ms; }
  };
})();
