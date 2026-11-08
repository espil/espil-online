/* __espilMonsters v1 - survival-game monsters + zones (Han 2026-11-06).
   LOCAL, Vancouver only. No network, no GLB: monsters are 2D animated
   sprite billboards (THREE.Sprite) - the Asset line replaces the
   placeholder frames through the same KINDS table, so the art swap is
   data-only. Production recycles shared bases: a kind is a base x a
   texture tint x a scale, so kinds multiply without new geometry.
   GRADES follow the Zealandia 8-colour ladder (white/yellow/green/
   blue/purple/red/gold/pink, rarity honestly begins at blue).
   ZONES: the map is divided tutorial/low/mid/high; the boundaries ARE
   the radial distance bands from the Art Gallery anchor - the nearer
   the gallery, the weaker the monsters. Summoning is PER ZONE: only
   the player's zone and its neighbours stay active; distant zones go
   dormant. Zone entrances are glow-marked in the Konbiniya language
   (ground pool + light pillar, same gold-family pulse, colour by the
   zone beyond the gate).
   Combat contract (S1 consumes this): __espilMonsterTargets() for hit
   tests, __espilMonsterHit(id, dmg, fromX, fromZ[, opts]) for damage,
   and monster attacks call window.__espilPlayerDamage(dmg, x, z).
   opts: {crit, element}. The hit returns {applied, evaded, killed,
   ...}: MITIGATION lives on this side (Han ruling 2026-11-06) - the
   kind's evasion can defeat the hit outright, its trait multiplies
   it (same element x0.5, listed weakness x1.5), and its defense
   takes a percentage off; `applied` is what is deducted and what
   the damage number shows. opts.crit stays presentation on top
   (bigger shaking number, baritone hit sound). The two tutorial
   kinds are deliberately unmitigated (def 0, eva 0, neutral), so a
   training hit lands for exactly the raw amount.
   HIT FEEL (FEEL.md, Zealandia 9-technique set, monster side): white
   hit flash + mass-scaled knockback, attack wind-up telegraph that
   cancels when the monster takes >= 25% maxHp during it, HP bar with
   a lagging ghost chunk, pop damage numbers (size by damage, drift
   alternating, crit shakes), and a single hit sound replayed at a
   random rate (baritone on crit).
   Death dispatches espil-guide {type:'monster-drop', kind, grade,
   parts:[...]} on the weapon-materials line for S5 crafting.
   Hooks: __espilZoneAt(x,z), __espilMonsterState(),
   __espilMonsterTargets(), __espilMonsterHit(...),
   __espilMonsterForceZone(zone|null) (test override, same spirit as
   __espilNpcForceLevel). */
(function () {
  'use strict';
  if (window.__espilMonsterState) return; /* single instance */

  /* ---- Art Gallery anchor ----
     Source: modules/monolith.js city config (vancouver): the gallery
     record bbox x[-46.9..52.9], z[-57.6..16.8] -> centre (3.0, -20.4);
     the spawn plaza (3, 31) sits 14.2 m south of its south face. */
  var GALLERY = { x: 3, z: -20.4 };

  /* ---- Zone radii (measured) ----
     3,095 baked buildings (vancouver_district_sample.json), centroid
     distance from the gallery anchor: p10 497 m, p25 767 m, p50
     1,161 m, p75 1,638 m, p90 1,865 m, max 2,022 m. The Konbiniya
     anchor (-518.2, -414.8) sits 654 m out. Radii are round numbers
     cut against that distribution: tutorial covers the gallery block
     and Robson Square (67 buildings inside 250 m, polygon-centroid
     count re-measured 2026-11-07); low covers the
     downtown core to 600 m; mid reaches 1,200 m (just past the p50
     building); high is everything beyond, out to the district edge.
     The Konbiniya lands in MID by these radii (654 > 600). */
  var R_TUTORIAL = 250, R_LOW = 600, R_MID = 1200;
  var ZONES = ['tutorial', 'low', 'mid', 'high'];
  var ZONE_LEVEL = { tutorial: 1, low: 4, mid: 9, high: 16 };
  var ZONE_TARGET = { tutorial: 2, low: 4, mid: 6, high: 8 };
  var CAP = 40;                        /* hard cap, all zones together */
  var ZONE_EVAL_MS = 1000;             /* player-zone re-check cadence */
  var SPAWN_RATE = 0.5;                /* spawns per second per zone;
                                          the same fill refills a zone
                                          after a death (zone respawn) */

  /* ---- Hit feel tuning (FEEL.md) ---- */
  var WINDUP_BASE = 0.45;              /* s of telegraph before a
                                          strike, plus a slice of the
                                          kind's own attack cooldown */
  var CANCEL_FRAC = 0.25;              /* damage taken during a wind-up
                                          at or above this fraction of
                                          maxHp cancels the attack */
  var GHOST_HOLD = 0.35;               /* s the ghost chunk lingers at
                                          the old HP before draining */
  var GHOST_RATE = 0.55;               /* ghost drain, maxHp fraction/s */
  var BAR_RATE = 1.6;                  /* real bar drain, maxHp frac/s */

  /* ---- Grades: Zealandia 8-colour ladder ---- */
  var GRADE_COLOUR = {
    white: 0xe8e8e8, yellow: 0xf2d54b, green: 0x58c96b, blue: 0x4f9cf2,
    purple: 0xa86fe0, red: 0xe04b4b, gold: 0xf2b63c, pink: 0xf28ad0
  };
  var GRADE_CSS = {
    white: '#e8e8e8', yellow: '#f2d54b', green: '#58c96b', blue: '#4f9cf2',
    purple: '#a86fe0', red: '#e04b4b', gold: '#f2b63c', pink: '#f28ad0'
  };

  /* ---- Kinds: base x tint x scale x grade ----
     base: shared body shape (the recycle axis); tint: the texture
     swap; scale: the size change. hp/dmg scale with the zone's
     level; purple+ kinds are elite and spawn at reduced weight.
     Mitigation (Han ruling): def = percent reduction (0-60),
     eva = evade probability (0-0.35), element = the kind's own
     trait element, weak = the element it takes x1.5 from (an
     attack of its own element is resisted at x0.5). */
  var BASES = {
    crawler: { w: 1.7, h: 1.1 },   /* low quadruped blob */
    shambler: { w: 1.5, h: 2.1 },  /* upright figure */
    brute: { w: 2.3, h: 2.7 }      /* heavy mass */
  };
  var KINDS = [
    { id: 'rat', name: 'Robson Rat', base: 'crawler', tint: '#8a7a66', scale: 1.55,
      grade: 'white', level: 1, hp: 20, dmg: 3, aggro: 8, speed: 1.3, reach: 1.6, atkCd: 1.4, zone: 'tutorial', elite: false,
      sprite: { base: 'assets/monsters/rat-plushy/', fps: 8, w: 1.2, h: 1.1, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 0, eva: 0, element: 'neutral', weak: null },
    { id: 'wisp', name: 'Square Wisp', base: 'shambler', tint: '#9fc4e8', scale: 1.1,
      grade: 'white', level: 2, hp: 25, dmg: 4, aggro: 9, speed: 1.0, reach: 1.8, atkCd: 1.6, zone: 'tutorial', elite: false,
      def: 0, eva: 0, element: 'neutral', weak: null },
    { id: 'stray', name: 'Alley Stray', base: 'crawler', tint: '#5d4632', scale: 1.55,
      grade: 'yellow', level: 4, hp: 45, dmg: 6, aggro: 11, speed: 1.6, reach: 1.6, atkCd: 1.3, zone: 'low', elite: false,
      sprite: { base: 'assets/monsters/stray-plushy/', fps: 8, w: 1.05, h: 1.1, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 5, eva: 0.10, element: 'neutral', weak: null },
    { id: 'shambler', name: 'Sewer Shambler', base: 'shambler', tint: '#6fae5f', scale: 1.3,
      grade: 'green', level: 6, hp: 70, dmg: 8, aggro: 12, speed: 1.1, reach: 1.9, atkCd: 1.5, zone: 'low', elite: false,
      sprite: { base: 'assets/monsters/shambler-plushy/', fps: 8, w: 1.96, h: 2.1, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp','idle_5.webp','idle_6.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp','walk_front_5.webp','walk_front_6.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp','aggro_5.webp','aggro_6.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp','attack_5.webp','attack_6.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp','hit_5.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 20, eva: 0, element: 'earth', weak: 'fire' },
    { id: 'brute', name: 'Gastown Brute', base: 'brute', tint: '#a85f3c', scale: 1.8,
      grade: 'blue', level: 9, hp: 130, dmg: 12, aggro: 13, speed: 1.0, reach: 2.3, atkCd: 1.8, zone: 'mid', elite: false,
      sprite: { base: 'assets/monsters/brute-plushy/', fps: 6, w: 3.25, h: 2.7, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp','idle_5.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp','walk_front_5.webp','walk_front_6.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 35, eva: 0, element: 'neutral', weak: null },
    { id: 'wraith', name: 'Harbour Wraith', base: 'shambler', tint: '#8f6fc9', scale: 1.4,
      grade: 'purple', level: 12, hp: 180, dmg: 15, aggro: 14, speed: 1.4, reach: 2.0, atkCd: 1.4, zone: 'mid', elite: true,
      sprite: { base: 'assets/monsters/wraith-plushy/', fps: 8, w: 1.96, h: 2.1, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp','idle_5.webp','idle_6.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp','walk_front_5.webp','walk_front_6.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp','aggro_5.webp','aggro_6.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp','attack_5.webp','attack_6.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp','hit_5.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 25, eva: 0.35, element: 'dark', weak: 'light' },
    { id: 'hound', name: 'Ember Hound', base: 'crawler', tint: '#d97b2e', scale: 1.6,
      grade: 'red', level: 16, hp: 260, dmg: 20, aggro: 16, speed: 2.1, reach: 1.8, atkCd: 1.2, zone: 'high', elite: true,
      sprite: { base: 'assets/monsters/hound-plushy/', fps: 8, w: 1.2, h: 1.1, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 15, eva: 0.15, element: 'fire', weak: 'water' },
    { id: 'titan', name: 'Deep Titan', base: 'brute', tint: '#d9a441', scale: 2.6,
      grade: 'gold', level: 20, hp: 450, dmg: 28, aggro: 18, speed: 0.9, reach: 2.8, atkCd: 2.2, zone: 'high', elite: true,
      sprite: { base: 'assets/monsters/titan-plushy/', fps: 6, w: 3.25, h: 2.7, frames: {
        idle: ['idle_1.webp','idle_2.webp','idle_3.webp','idle_4.webp','idle_5.webp'],
        walk: ['walk_front_1.webp','walk_front_2.webp','walk_front_3.webp','walk_front_4.webp','walk_front_5.webp','walk_front_6.webp'],
        aggro: ['aggro_1.webp','aggro_2.webp','aggro_3.webp','aggro_4.webp'],
        attack: ['attack_1.webp','attack_2.webp','attack_3.webp','attack_4.webp'],
        hit: ['hit_1.webp','hit_2.webp','hit_3.webp','hit_4.webp'],
        stun: ['stun_1.webp','stun_2.webp','stun_3.webp','stun_4.webp'],
        death: ['death_1.webp','death_2.webp','death_3.webp','death_4.webp'] } },
      def: 50, eva: 0, element: 'earth', weak: 'wind' }
  ];
  /* trait multiplier for an incoming element against a kind */
  function traitFactor(kind, element) {
    if (!element || element === 'neutral' || !kind.element || kind.element === 'neutral') return 1;
    if (element === kind.element) return 0.5;           /* same element: resisted */
    if (kind.weak && element === kind.weak) return 1.5; /* listed weakness */
    return 1;
  }
  var ZONE_KINDS = {};
  KINDS.forEach(function (k) { (ZONE_KINDS[k.zone] = ZONE_KINDS[k.zone] || []).push(k); });
  /* weapon-materials drop line (S5 crafting), one part per grade */
  var PARTS = {
    white: 'Worn Iron Shard', yellow: 'Brass Shard', green: 'Copper Ingot',
    blue: 'Steel Ingot', purple: 'Mithril Shard', red: 'Dragonsteel Shard',
    gold: 'Sunsteel Shard', pink: 'Lunaris Shard'
  };

  /* ---- Real sprite frames (Batch 5, Han: monsters in 2D) ----
     A kind may carry sprite: { base: 'assets/monsters/<kind>/',
     fps: 8, frames: { idle: [...], walk: [...], aggro: [...],
     attack: [...], hit: [...], stun: [...], death: [...] } }
     (file names relative to base), or be mapped at runtime via
     window.__espilMonsterSpriteMap[kindId] (same shape) - the map
     wins. Wired today (Asset room delivery, MONSTER-ART-SPEC-v1,
     2026-11-07): the crawler kind walk sets for rat / stray /
     hound - 6 frames each, already tinted per kind (the material
     colour stays white; only the hit flash and the wind-up
     telegraph ever tint the body). Static slots use the first
     frame. Kinds without a delivered set (wisp, shambler, brute,
     wraith, titan) keep the canvas placeholder at the new scales
     until their sets land.
     PLUSHY SUPERSESSION (Han 2026-11-07, Asset room handover):
     the sprite source is now the Plushy AI set, and ALL SEVEN
     covered kinds are wired from their Plushy deliveries under
     assets/monsters/<kind>-plushy/ (idle/walk-front/aggro/
     attack/hit/stun/death groups, tints pre-applied, plane
     aspect matched to each canvas via sprite.w/h): rat = boar,
     stray = strayer, hound = boar elite, shambler = spitter,
     wraith = spitter elite, brute = brute, titan = brute elite.
     The walk left/right/back frames are delivered and copied
     but not in the billboard cycle (the sprite faces the camera;
     the front set is the readable cycle). WISP HAS NO PLUSHY
     COUNTERPART ANYWHERE - it is a documented GAP and keeps the
     shambler-class canvas placeholder, which does not properly
     cover it. Plushy canvases run 312-437 px, so at the final
     sizes the density is ~211 px/m on the rat and ~52 px/m on
     the titan - a source limit, disclosed, not fixable here.
     SCALES carry the player-size floor (player ~1.7 m, Asset
     room): rendered height = base height x scale must reach
     1.7 m, which raised rat and stray to 1.55 (1.71 m). */
  var TEXCACHE = {};
  function frameTexture(url) {
    if (TEXCACHE[url]) return TEXCACHE[url];
    var tex = null;
    try {
      tex = new THREE.TextureLoader().load(url);
    } catch (e) { tex = null; }
    TEXCACHE[url] = tex;
    return tex;
  }
  function spriteCfgFor(kind) {
    try {
      var map = window.__espilMonsterSpriteMap;
      if (map && map[kind.id]) return map[kind.id];
    } catch (e) {}
    return kind.sprite || null;
  }
  function spriteFrames(cfg, key) {
    if (!cfg || !cfg.frames) return null;
    var f = cfg.frames[key];
    if (f && f.length) return f;
    if (key === 'aggro') return cfg.frames.walk || cfg.frames.idle || null;
    if (key === 'attack') return cfg.frames.aggro || cfg.frames.idle || null;
    if (key === 'hit' || key === 'stun' || key === 'death') return cfg.frames.idle || null;
    return cfg.frames.idle || null;
  }
  /* advance the billboard's frame for the monster's current state.
     Falls back silently to whatever texture is already on the body
     (the canvas placeholder) until a frame image has loaded. */
  function stepSprite(m, dt, key) {
    if (!m.sprite) return;
    var frames = spriteFrames(m.sprite, key);
    if (!frames) return;
    var fps = m.sprite.fps || 6;
    if (m.frameKey !== key) { m.frameKey = key; m.frameT = 0; }
    m.frameT += dt;
    var idx = Math.floor(m.frameT * fps) % frames.length;
    if (idx === m.frameIdx && m.frameKey === m.frameApplied) return;
    var tex = frameTexture((m.sprite.base || '') + frames[idx]);
    if (tex && tex.image && tex.image.width) {
      if (m.body.material.map !== tex) m.body.material.map = tex;
      m.frameIdx = idx; m.frameApplied = m.frameKey;
    }
  }

  /* ---- Zone entrance gates: 3 rings x 4 compass directions ----
     Colour is the zone BEYOND the gate (grade-ladder-adjacent hues):
     ring 250 -> low = green, ring 600 -> mid = blue, ring 1200 ->
     high = purple. Same visual language as the Konbiniya glow:
     additive radial ground pool + light pillar, slow pulse. */
  var GATE_DEFS = [
    { ring: R_TUTORIAL, colour: 0x58c96b, css: 'rgba(88,201,107,', beyond: 'low' },
    { ring: R_LOW, colour: 0x4f9cf2, css: 'rgba(79,156,242,', beyond: 'mid' },
    { ring: R_MID, colour: 0xa86fe0, css: 'rgba(168,111,224,', beyond: 'high' }
  ];
  var GATE_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  var S = {
    monsters: [], seq: 0, playerZone: null, forcedZone: null,
    activeZones: {}, zoneEvalAt: 0, spawnAcc: {}, gates: [], gatesBuilt: false,
    gateTryAt: 0, sepAt: 0, tickN: 0, outMapSince: 0, booted: false,
    feel: { hits: 0, crits: 0, cancels: 0, numbers: 0, flashes: 0, evades: 0 }, dmgSeq: 0
  };

  function cityKey() {
    try { return window.__espilCityKey || 'vancouver'; } catch (e) { return 'vancouver'; }
  }
  function inMap() {
    return !!(document.body && document.body.classList.contains('in-map'));
  }
  function probe(x, z) {
    try {
      return (typeof window.__espilCollisionProbe === 'function')
        ? window.__espilCollisionProbe(x, z) : null;
    } catch (e) { return null; }
  }
  function walkable(x, z) {
    var p = probe(x, z);
    return !!(p && p.walkable && !p.blocked && !p.swimmable);
  }
  function playerPose() {
    try {
      return (typeof window.__espilPlayerPose === 'function')
        ? window.__espilPlayerPose() : null;
    } catch (e) { return null; }
  }
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
  function irand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[irand(arr.length)]; }

  /* ---------------- zones ---------------- */
  function zoneAt(x, z) {
    var dx = x - GALLERY.x, dz = z - GALLERY.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    var zone = d < R_TUTORIAL ? 'tutorial' : (d < R_LOW ? 'low' : (d < R_MID ? 'mid' : 'high'));
    return { zone: zone, level: ZONE_LEVEL[zone], dist: Math.round(d * 10) / 10 };
  }
  function activeZoneSet(playerZone) {
    /* player's zone + its chain neighbours; the far zones stay dormant */
    var out = {};
    var i = ZONES.indexOf(playerZone);
    if (i < 0) return out;
    out[playerZone] = true;
    if (i > 0) out[ZONES[i - 1]] = true;
    if (i < ZONES.length - 1) out[ZONES[i + 1]] = true;
    return out;
  }
  function countByZone() {
    var c = { tutorial: 0, low: 0, mid: 0, high: 0 };
    S.monsters.forEach(function (m) { if (!m.gone && m.state !== 'leaving') c[m.zone]++; });
    return c;
  }

  /* ---------------- placeholder sprite art ----------------
     Canvas-drawn per base+tint (the 'texture swap' axis); the Asset
     line replaces these canvases with real animated frames through
     the same KINDS table. Two-tone silhouette + eyes + ground feet,
     drawn once per kind and cached. */
  var spriteCache = {};
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function kindTexture(kind) {
    var key = kind.base + '|' + kind.tint;
    if (spriteCache[key]) return spriteCache[key];
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var c = cv.getContext('2d');
    var body = kind.tint, dark = shade(kind.tint, 0.55), light = shade(kind.tint, 1.25);
    c.fillStyle = body; c.strokeStyle = dark; c.lineWidth = 4;
    if (kind.base === 'crawler') {
      /* low quadruped blob: body ellipse, tail, 4 leg stubs, eyes */
      c.beginPath(); c.ellipse(64, 78, 46, 30, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(22, 70); c.quadraticCurveTo(2, 60, 6, 44); c.lineTo(16, 58); c.stroke();
      c.fillStyle = dark;
      [[34, 104], [52, 108], [78, 108], [96, 104]].forEach(function (p) {
        c.fillRect(p[0] - 4, p[1] - 6, 8, 12);
      });
      c.fillStyle = light;
      c.beginPath(); c.arc(96, 62, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(100, 58, 4.5, 0, Math.PI * 2); c.arc(110, 60, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111';
      c.beginPath(); c.arc(101, 58, 2, 0, Math.PI * 2); c.arc(111, 60, 1.8, 0, Math.PI * 2); c.fill();
    } else if (kind.base === 'shambler') {
      /* upright figure: torso, head, arms, eyes */
      c.beginPath(); c.ellipse(64, 84, 26, 34, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(64, 34, 18, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = dark; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(42, 66); c.lineTo(26, 92); c.moveTo(86, 66); c.lineTo(102, 92); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(57, 32, 4, 0, Math.PI * 2); c.arc(71, 32, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111';
      c.beginPath(); c.arc(57, 32, 2, 0, Math.PI * 2); c.arc(71, 32, 2, 0, Math.PI * 2); c.fill();
    } else {
      /* brute: heavy mass, shoulders, small head, arms */
      c.beginPath(); c.ellipse(64, 82, 42, 38, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = light;
      c.beginPath(); c.ellipse(38, 52, 16, 12, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(90, 52, 16, 12, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = body;
      c.beginPath(); c.arc(64, 30, 14, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = dark; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(30, 70); c.lineTo(18, 100); c.moveTo(98, 70); c.lineTo(110, 100); c.stroke();
      c.fillStyle = '#ffe9a8';
      c.beginPath(); c.arc(58, 28, 3.5, 0, Math.PI * 2); c.arc(70, 28, 3.5, 0, Math.PI * 2); c.fill();
    }
    var tex = new THREE.CanvasTexture(cv);
    spriteCache[key] = tex;
    return tex;
  }
  function nameplateTexture(kind) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 56;
    var c = cv.getContext('2d');
    c.strokeStyle = GRADE_CSS[kind.grade]; c.lineWidth = 4;
    c.fillStyle = 'rgba(8,10,14,0.72)';
    c.beginPath();
    if (c.roundRect) c.roundRect(4, 4, 248, 48, 10); else c.rect(4, 4, 248, 48);
    c.fill(); c.stroke();
    c.fillStyle = '#fff';
    c.font = 'bold 24px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Lv ' + kind.level + '  ' + kind.name, 128, 30);
    return new THREE.CanvasTexture(cv);
  }
  function hpBarTexture() {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 16;
    return { canvas: cv, tex: new THREE.CanvasTexture(cv) };
  }
  /* Sprite tint priority: the hit flash (overbright white) beats the
     wind-up telegraph (warm swell colour) beats the plain texture. */
  function applyTint(m) {
    if (!m.body || !m.body.material) return;
    if (m.flashT > 0) m.body.material.color.setScalar(2.6);
    else if (m.windupT > 0) m.body.material.color.setHex(0xffb066);
    else m.body.material.color.setHex(0xffffff);
  }
  function drawHpBar(m) {
    var c = m.hpCanvas.getContext('2d');
    c.clearRect(0, 0, 128, 16);
    c.fillStyle = 'rgba(8,10,14,0.72)';
    c.fillRect(0, 0, 128, 16);
    var max = m.maxHp || 1;
    var bf = Math.max(0, Math.min(1, m.barHp / max));
    var gf = Math.max(0, Math.min(1, m.ghostHp / max));
    /* the ghost chunk (the "HP bar lie"): the just-lost HP lingers as
       a pale segment behind the real bar and follows it down late */
    if (gf > bf) {
      c.fillStyle = '#efe6cf';
      c.fillRect(2, 2, Math.round(124 * gf), 12);
    }
    /* real bar colour by remaining-HP segment */
    c.fillStyle = bf > 0.5 ? '#58c96b' : (bf > 0.25 ? '#f2d54b' : '#e04b4b');
    c.fillRect(2, 2, Math.round(124 * bf), 12);
    m.hpTex.needsUpdate = true;
  }

  /* ---------------- monster lifecycle ---------------- */
  function pickKind(zone) {
    var list = ZONE_KINDS[zone] || ZONE_KINDS.tutorial;
    /* elite (purple+) kinds spawn at reduced weight */
    for (var t = 0; t < 3; t++) {
      var k = pick(list);
      if (!k.elite || Math.random() < 0.34) return k;
    }
    return list[0];
  }
  function spawnPoint(zone, px, pz) {
    /* a walkable point inside the target zone, 18-45 m from the
       player, so summons appear at a distance (never on top of the
       player and never a mid-screen pop-in) */
    for (var t = 0; t < 14; t++) {
      var a = Math.random() * Math.PI * 2;
      var d = 18 + Math.random() * 27;
      var x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      if (!walkable(x, z)) continue;
      if (zoneAt(x, z).zone !== zone) continue;
      return { x: x, z: z };
    }
    for (var u = 0; u < 14; u++) {
      var a2 = Math.random() * Math.PI * 2;
      var d2 = 12 + Math.random() * 48;
      var x2 = px + Math.cos(a2) * d2, z2 = pz + Math.sin(a2) * d2;
      if (walkable(x2, z2) && zoneAt(x2, z2).zone === zone) return { x: x2, z: z2 };
    }
    return null;
  }
  function addMonster(kind, x, z, scene) {
    var base = BASES[kind.base];
    var w = base.w * kind.scale, h = base.h * kind.scale;
    /* a wired set may carry its own plane aspect (sprite.w/h in
       base units) so its canvas is never stretched - the Plushy
       rat set (393x361) uses w 1.2 against the crawler h 1.1 */
    var cfg0 = spriteCfgFor(kind);
    if (cfg0 && cfg0.w && cfg0.h) { w = cfg0.w * kind.scale; h = cfg0.h * kind.scale; }
    var body = new THREE.Sprite(new THREE.SpriteMaterial({
      map: kindTexture(kind), transparent: true, depthWrite: false
    }));
    body.scale.set(w, h, 1);
    var plate = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nameplateTexture(kind), transparent: true, depthWrite: false
    }));
    plate.scale.set(2.4, 0.53, 1);
    var hp = hpBarTexture();
    var hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: hp.tex, transparent: true, depthWrite: false
    }));
    hpSprite.scale.set(1.5, 0.19, 1);
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.5 * kind.scale, w * 0.3), 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    var m = {
      id: ++S.seq, kind: kind, x: x, z: z, safeX: x, safeZ: z,
      spawnX: x, spawnZ: z, zone: kind.zone, level: kind.level,
      hp: kind.hp, maxHp: kind.hp, state: 'walk', gone: false,
      windupT: 0, windupDur: 0, windupDmg: 0,
      barHp: kind.hp, ghostHp: kind.hp, ghostHoldT: 0,
      body: body, plate: plate, hpSprite: hpSprite, hpCanvas: hp.canvas, hpTex: hp.tex,
      shadow: shadow, w: w, h: h, faceY: Math.random() * Math.PI * 2,
      speed: kind.speed, atkT: 0, flashT: 0, dieT: 0, fadeT: 0,
      wanderT: 0, tx: x, tz: z, stuckT: 0, anchorX: x, anchorZ: z,
      stuckClock: 0, phase: S.seq % 5, bob: Math.random() * Math.PI * 2,
      sprite: spriteCfgFor(kind), frameT: 0, frameKey: '', frameApplied: '', frameIdx: -1
    };
    if (m.sprite && m.sprite.frames) {
      /* warm the texture cache so the first frames do not pop in */
      Object.keys(m.sprite.frames).forEach(function (k) {
        (m.sprite.frames[k] || []).forEach(function (f) {
          frameTexture((m.sprite.base || '') + f);
        });
      });
    }
    drawHpBar(m);
    body.position.set(x, h / 2, z);
    plate.position.set(x, h + 0.75, z);
    hpSprite.position.set(x, h + 0.42, z);
    shadow.position.set(x, 0.03, z);
    scene.add(body); scene.add(plate); scene.add(hpSprite); scene.add(shadow);
    S.monsters.push(m);
    return m;
  }
  function removeMonster(m) {
    var i = S.monsters.indexOf(m);
    if (i >= 0) S.monsters.splice(i, 1);
    m.gone = true;
    try {
      [m.body, m.plate, m.hpSprite].forEach(function (s) {
        if (s.parent) s.parent.remove(s);
        if (s.material) s.material.dispose();
      });
      if (m.shadow) {
        if (m.shadow.parent) m.shadow.parent.remove(m.shadow);
        m.shadow.geometry.dispose(); m.shadow.material.dispose();
      }
    } catch (e) {}
  }
  function spawnMonster(zone, px, pz) {
    if (S.monsters.length >= CAP) return;
    var scene = sceneRoot();
    if (!scene) return;
    var pt = spawnPoint(zone, px, pz);
    if (!pt) return;
    var kind = pickKind(zone);
    try {
      var m = addMonster(kind, pt.x, pt.z, scene);
      /* fade in from transparent so the summon reads as an arrival */
      m.state = 'arriving'; m.fadeT = 0.9;
      m.body.material.opacity = 0; m.plate.material.opacity = 0; m.hpSprite.material.opacity = 0;
    } catch (e) { /* a failed spawn never breaks the page */ }
  }

  /* ---------------- per-monster step ---------------- */
  function stepMonster(m, dt, pp) {
    if (m.state === 'dying') {
      m.dieT -= dt;
      stepSprite(m, dt, 'death');
      var f = Math.max(0, m.dieT / 0.9);
      m.body.material.opacity = f;
      m.plate.material.opacity = f; m.hpSprite.material.opacity = f;
      m.body.position.y = m.h / 2 - (1 - f) * 0.6;
      if (m.dieT <= 0) removeMonster(m);
      return;
    }
    if (m.state === 'leaving') {
      m.fadeT -= dt;
      var g = Math.max(0, m.fadeT / 0.9);
      m.body.material.opacity = g;
      m.plate.material.opacity = g; m.hpSprite.material.opacity = g;
      if (m.fadeT <= 0) removeMonster(m);
      return;
    }
    if (m.state === 'arriving') {
      m.fadeT -= dt;
      var a = Math.max(0, 1 - m.fadeT / 0.9);
      m.body.material.opacity = a;
      m.plate.material.opacity = a; m.hpSprite.material.opacity = a;
      if (m.fadeT <= 0) { m.state = 'walk'; }
    }
    if (m.flashT > 0) m.flashT -= dt;
    applyTint(m);
    /* HP bar feel: the real bar drains fast but smoothly toward the
       true HP; the ghost chunk holds for GHOST_HOLD, then follows
       down late at the slower GHOST_RATE */
    var barDirty = false;
    if (m.barHp > m.hp) {
      m.barHp = Math.max(m.hp, m.barHp - m.maxHp * BAR_RATE * dt);
      barDirty = true;
    } else if (m.barHp < m.hp) { m.barHp = m.hp; barDirty = true; }
    if (m.ghostHoldT > 0) m.ghostHoldT -= dt;
    else if (m.ghostHp > m.hp) {
      m.ghostHp = Math.max(m.hp, m.ghostHp - m.maxHp * GHOST_RATE * dt);
      barDirty = true;
    } else if (m.ghostHp < m.hp) { m.ghostHp = m.hp; barDirty = true; }
    if (barDirty) drawHpBar(m);
    m.atkT -= dt;
    var dx = 0, dz = 0, dist = 1e12, chasing = false;
    if (pp) {
      dx = pp.x - m.x; dz = pp.z - m.z;
      dist = Math.sqrt(dx * dx + dz * dz);
      chasing = dist < m.kind.aggro;
    }
    var tx, tz, spd;
    if (chasing) {
      tx = pp.x; tz = pp.z; spd = m.speed;
      if (m.windupT > 0) {
        /* wind-up telegraph: planted feet, body swelling toward the
           strike (scale + warm tint via applyTint). The strike only
           lands if the player is still in reach when it completes;
           damage taken during the wind-up can cancel it outright
           (see __espilMonsterHit). */
        m.windupT -= dt;
        var wf = 1 - Math.max(0, m.windupT) / (m.windupDur || 1);
        m.body.scale.set(m.w * (1 + 0.16 * wf), m.h * (1 + 0.16 * wf), 1);
        spd = 0;
        if (m.windupT <= 0) {
          m.windupT = 0; m.windupDmg = 0;
          m.body.scale.set(m.w, m.h, 1);
          m.atkT = m.kind.atkCd;
          if (dist < m.kind.reach * 1.2) {
            try {
              if (typeof window.__espilPlayerDamage === 'function')
                window.__espilPlayerDamage(m.kind.dmg, m.x, m.z);
            } catch (e) {}
          }
        }
      } else if (dist < m.kind.reach && m.atkT <= 0) {
        /* begin the wind-up instead of striking instantly */
        m.windupDur = WINDUP_BASE + m.kind.atkCd * 0.15;
        m.windupT = m.windupDur;
        m.windupDmg = 0;
      }
    } else {
      if (m.windupT > 0) {
        /* the player broke away mid-telegraph: the attack fizzles */
        m.windupT = 0; m.windupDmg = 0;
        m.body.scale.set(m.w, m.h, 1);
        m.atkT = Math.max(m.atkT, 0.4);
      }
      m.wanderT -= dt;
      if (m.wanderT <= 0 || (Math.abs(m.x - m.tx) < 1 && Math.abs(m.z - m.tz) < 1)) {
        m.wanderT = 2 + Math.random() * 4;
        for (var t = 0; t < 8; t++) {
          var a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 11;
          var nx = m.spawnX + Math.cos(a) * d, nz = m.spawnZ + Math.sin(a) * d;
          if (walkable(nx, nz)) { m.tx = nx; m.tz = nz; break; }
        }
      }
      tx = m.tx; tz = m.tz; spd = m.speed * 0.6;
    }
    var mx = tx - m.x, mz = tz - m.z;
    var md = Math.sqrt(mx * mx + mz * mz);
    if (md > 0.6) {
      var ux = mx / md, uz = mz / md;
      var stepLen = spd * dt;
      var offs = [0, 0.6, -0.6, 1.2, -1.2, 2.2, -2.2, Math.PI];
      var moved = false;
      for (var oi = 0; oi < offs.length && !moved; oi++) {
        var cs = Math.cos(offs[oi]), sn = Math.sin(offs[oi]);
        var hx = ux * cs - uz * sn, hz = ux * sn + uz * cs;
        var sx = m.x + hx * stepLen, sz = m.z + hz * stepLen;
        if (!walkable(sx, sz)) continue;
        if (!walkable(m.x + hx * 1.0, m.z + hz * 1.0)) continue;
        m.x = sx; m.z = sz; moved = true;
        var tf = Math.atan2(-hx, -hz);
        var df = tf - m.faceY;
        while (df > Math.PI) df -= Math.PI * 2;
        while (df < -Math.PI) df += Math.PI * 2;
        m.faceY += df * Math.min(1, dt * 8);
      }
      if (!moved) {
        if (walkable(m.x + ux * stepLen, m.z)) { m.x += ux * stepLen; moved = true; }
        else if (walkable(m.x, m.z + uz * stepLen)) { m.z += uz * stepLen; moved = true; }
      }
      if (moved) m.stuckT = 0; else m.stuckT += dt;
    }
    /* anchor watchdog: a monster that cannot displace 2 m in 60 s of
       game time is removed where it stands (same valve as the NPC
       pocket rule - a wedged monster quietly vanishing beats one
       frozen in a wall forever) */
    var ax = m.x - m.anchorX, az = m.z - m.anchorZ;
    if (ax * ax + az * az >= 4) { m.anchorX = m.x; m.anchorZ = m.z; m.stuckClock = 0; }
    else {
      m.stuckClock += dt;
      if (m.stuckClock > 60) removeMonster(m);
    }
    /* idle bob: the placeholder's only animation (the Asset line
       replaces frames; the bob keeps the billboard alive meanwhile) */
    m.bob += dt * 3;
    var bobY = Math.sin(m.bob) * 0.07;
    /* real frames, when a set is wired: the state key follows the
       monster's actual state - hit beat while the flash runs, the
       attack group through the wind-up, walk while it moves, the
       aggro group while it chases on the spot, idle otherwise.
       Sets without a group fall back (attack -> aggro -> idle,
       aggro -> walk -> idle), and single-frame groups simply hold. */
    if (m.sprite) {
      var sKey = 'idle';
      if (m.flashT > 0) sKey = 'hit';
      else if (m.windupT > 0) sKey = 'attack';
      else if (md > 0.6) sKey = 'walk';
      else if (chasing) sKey = 'aggro';
      stepSprite(m, dt, sKey);
    }
    m.body.position.set(m.x, m.h / 2 + bobY, m.z);
    m.plate.position.set(m.x, m.h + 0.75 + bobY, m.z);
    m.hpSprite.position.set(m.x, m.h + 0.42 + bobY, m.z);
    m.shadow.position.set(m.x, 0.03, m.z);
  }
  function separateMonsters() {
    for (var i = 0; i < S.monsters.length; i++) {
      for (var j = i + 1; j < S.monsters.length; j++) {
        var a = S.monsters[i], b = S.monsters[j];
        if (a.gone || b.gone || a.state === 'dying' || b.state === 'dying') continue;
        var dx = b.x - a.x, dz = b.z - a.z;
        var d2 = dx * dx + dz * dz;
        /* separation distance follows the (Batch 5) body sizes */
        var minD = 0.55 * (a.kind.scale + b.kind.scale);
        if (d2 > minD * minD || d2 < 0.0001) continue;
        var d = Math.sqrt(d2), push = (minD - d) / 2;
        var ux = dx / d, uz = dz / d;
        if (walkable(a.x - ux * push, a.z - uz * push)) { a.x -= ux * push; a.z -= uz * push; }
        if (walkable(b.x + ux * push, b.z + uz * push)) { b.x += ux * push; b.z += uz * push; }
      }
    }
  }

  /* ---------------- zone entrance gates ---------------- */
  var gatePoolTex = {};
  function gatePoolTexture(css) {
    if (gatePoolTex[css]) return gatePoolTex[css];
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    var gr = c.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, css + '0.9)');
    gr.addColorStop(0.4, css + '0.35)');
    gr.addColorStop(1, css + '0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(cv);
    gatePoolTex[css] = tex;
    return tex;
  }
  function snapWalkable(x, z) {
    if (walkable(x, z)) return { x: x, z: z };
    for (var r = 4; r <= 44; r += 4) {
      for (var a = 0; a < 8; a++) {
        var nx = x + Math.cos(a * Math.PI / 4) * r;
        var nz = z + Math.sin(a * Math.PI / 4) * r;
        if (walkable(nx, nz)) return { x: nx, z: nz };
      }
    }
    return null;
  }
  function buildGates() {
    var scene = sceneRoot();
    if (!scene || typeof THREE === 'undefined') return;
    var poolGeo = new THREE.PlaneGeometry(24, 24);
    var pillarGeo = new THREE.CylinderGeometry(2.2, 3.4, 60, 16, 1, true);
    GATE_DEFS.forEach(function (def) {
      /* one shared material pair per ring (all four gates of a ring
         pulse together, so per-gate materials would be pure waste) */
      var poolMat = new THREE.MeshBasicMaterial({
        map: gatePoolTexture(def.css), transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      });
      var pillarMat = new THREE.MeshBasicMaterial({
        color: def.colour, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false
      });
      GATE_DIRS.forEach(function (dir) {
        var ideal = { x: GALLERY.x + dir[0] * def.ring, z: GALLERY.z + dir[1] * def.ring };
        var pt = snapWalkable(ideal.x, ideal.z);
        if (!pt) return;
        var pool = new THREE.Mesh(poolGeo, poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(pt.x, 0.25, pt.z);
        pool.renderOrder = 3;
        var pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(pt.x, 30, pt.z);
        pillar.renderOrder = 3;
        var g = new THREE.Group();
        g.add(pool); g.add(pillar);
        scene.add(g);
        S.gates.push({ group: g, pool: pool, pillar: pillar, x: pt.x, z: pt.z, ring: def.ring, beyond: def.beyond });
      });
    });
    S.gatesBuilt = true;
    /* one shared pulse interval for all gates (Konbiniya cadence) */
    setInterval(function () {
      var s = 0.5 + 0.5 * Math.sin(Date.now() / 1400);
      S.gates.forEach(function (gt) {
        gt.pool.material.opacity = 0.42 + 0.16 * s;
        gt.pillar.material.opacity = 0.10 + 0.06 * s;
      });
    }, 150);
  }

  /* ---------------- damage numbers (FEEL 7) ----------------
     DOM overlay pooled per hit: the number pops (scale overshoot),
     rises and fades, drifts left or right alternating per hit, and
     scales with the damage. A crit renders bigger, bolder, gold and
     shaking. The text is the MITIGATED applied damage (rounded) -
     never the raw figure S1 passed in; an evaded hit shows an
     EVADED tag instead of a number. */
  var dmgLayer = null, dmgPool = [];
  function ensureDmgLayer() {
    if (dmgLayer) return dmgLayer;
    if (!document.body || !document.head) return null;
    var st = document.createElement('style');
    st.textContent = '@keyframes espilDmgShake{0%{margin-left:0}25%{margin-left:-2px}50%{margin-left:2px}75%{margin-left:-1px}100%{margin-left:0}}';
    document.head.appendChild(st);
    dmgLayer = document.createElement('div');
    dmgLayer.id = 'espil-dmg-numbers';
    dmgLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9990;';
    document.body.appendChild(dmgLayer);
    return dmgLayer;
  }
  function spawnDmgNumber(m, dmg, crit, evaded) {
    try {
      var layer = ensureDmgLayer();
      if (!layer) return;
      var size = evaded ? 14 : Math.round((15 + Math.min(16, dmg * 0.4)) * (crit ? 1.45 : 1));
      var el = document.createElement('div');
      el.className = 'espil-dmgnum' + (crit ? ' crit' : '') + (evaded ? ' evaded' : '');
      el.style.cssText = 'position:absolute;left:0;top:0;display:none;white-space:nowrap;' +
        'font-family:sans-serif;font-weight:' + (crit ? '900' : '700') + ';' +
        'font-size:' + size + 'px;color:' + (evaded ? '#9fc4e8' : (crit ? '#ffd23c' : '#ffffff')) + ';' +
        'text-shadow:0 1px 2px rgba(0,0,0,0.85),0 0 6px rgba(0,0,0,0.45);';
      var span = document.createElement('span');
      span.textContent = evaded ? 'EVADED' : String(Math.round(dmg));
      if (crit) span.style.cssText = 'display:inline-block;animation:espilDmgShake 0.28s linear infinite;';
      el.appendChild(span);
      layer.appendChild(el);
      S.dmgSeq++;
      dmgPool.push({
        el: el, m: m, t: 0, life: 0.9, crit: crit,
        dir: (S.dmgSeq % 2 === 0) ? 1 : -1, y: m.h + 0.9
      });
      S.feel.numbers++;
    } catch (e) { /* a number can never break a hit */ }
  }
  function stepDmgNumbers(dt) {
    if (!dmgPool.length) return;
    var cam = null;
    try {
      cam = (typeof window.__espilMapCameraObj === 'function')
        ? window.__espilMapCameraObj() : null;
    } catch (e) {}
    var W = window.innerWidth || 1, H = window.innerHeight || 1;
    for (var i = dmgPool.length - 1; i >= 0; i--) {
      var n = dmgPool[i];
      n.t += dt;
      if (n.t >= n.life || n.m.gone) {
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
        dmgPool.splice(i, 1);
        continue;
      }
      var f = n.t / n.life;
      var pop = n.t < 0.14
        ? (0.6 + (n.t / 0.14) * 0.55)
        : (1.15 - 0.15 * ((n.t - 0.14) / Math.max(0.01, n.life - 0.14)));
      var op = f > 0.65 ? 1 - (f - 0.65) / 0.35 : 1;
      var shown = false;
      if (cam && typeof THREE !== 'undefined') {
        try {
          var v = new THREE.Vector3(n.m.x, n.y + f * 1.1, n.m.z).project(cam);
          if (v.z < 1) {
            var sx = (v.x * 0.5 + 0.5) * W + n.dir * f * 34;
            var sy = (-v.y * 0.5 + 0.5) * H;
            n.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) +
              'px) translate(-50%,-100%) scale(' + pop.toFixed(2) + ')';
            n.el.style.opacity = op.toFixed(2);
            shown = true;
          }
        } catch (e) {}
      }
      n.el.style.display = shown ? 'block' : 'none';
    }
  }
  function clearDmgNumbers() {
    for (var i = 0; i < dmgPool.length; i++) {
      if (dmgPool[i].el.parentNode) dmgPool[i].el.parentNode.removeChild(dmgPool[i].el);
    }
    dmgPool = [];
  }

  /* ---------------- hit sound (FEEL 3/4) ----------------
     PLACEHOLDER AUDIO: no audio asset exists in the tree yet, so the
     hit sound is a synthesized WebAudio blip. The DESIGN is the
     Zealandia one and does not change when the asset lands: a single
     sample replayed at a random rate per hit, dropped to a low
     baritone rate on a crit. When the Asset line delivers the real
     sample, decode it into hitSample and the buffer branch below
     takes over - the rate logic stays as is. Everything is guarded:
     audio failure can never break a hit. */
  var hitCtx = null, hitSample = null;
  function playHitSound(crit) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!hitCtx) hitCtx = new AC();
      if (hitCtx.state === 'suspended') {
        var rp = hitCtx.resume();
        if (rp && rp.catch) rp.catch(function () {});
      }
      var t = hitCtx.currentTime;
      var rate = crit ? 0.5 + Math.random() * 0.06 : 0.88 + Math.random() * 0.3;
      var g = hitCtx.createGain();
      g.gain.setValueAtTime(crit ? 0.22 : 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (crit ? 0.16 : 0.09));
      g.connect(hitCtx.destination);
      if (hitSample) {
        var src = hitCtx.createBufferSource();
        src.buffer = hitSample;
        src.playbackRate.value = rate;
        src.connect(g);
        src.start(t);
      } else {
        var o = hitCtx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(540 * rate, t);
        o.frequency.exponentialRampToValueAtTime(180 * rate, t + 0.08);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.18);
      }
    } catch (e) { /* audio can never break a hit */ }
  }

  /* ---------------- hooks ---------------- */
  window.__espilZoneAt = function (x, z) { return zoneAt(x, z); };
  window.__espilMonsterState = function () {
    var byZone = countByZone();
    return {
      active: S.monsters.filter(function (m) { return !m.gone && m.state !== 'leaving'; }).length,
      total: S.monsters.length,
      byZone: byZone,
      playerZone: S.playerZone,
      forced: S.forcedZone,
      cap: CAP,
      gates: S.gates.length,
      gateList: S.gates.map(function (g) {
        return { x: Math.round(g.x * 10) / 10, z: Math.round(g.z * 10) / 10, ring: g.ring, beyond: g.beyond };
      }),
      kinds: KINDS.map(function (k) {
        return { id: k.id, name: k.name, zone: k.zone, grade: k.grade, level: k.level, hp: k.hp, dmg: k.dmg,
                 scale: k.scale, sprite: !!spriteCfgFor(k),
                 def: k.def, eva: k.eva, element: k.element, weak: k.weak };
      }),
      feel: {
        hits: S.feel.hits, crits: S.feel.crits, cancels: S.feel.cancels,
        numbers: S.feel.numbers, flashes: S.feel.flashes, evades: S.feel.evades,
        activeNumbers: dmgPool.length
      },
      monsters: S.monsters.map(function (m) {
        return {
          id: m.id, kind: m.kind.id, x: Math.round(m.x * 100) / 100,
          z: Math.round(m.z * 100) / 100, hp: m.hp, maxHp: m.maxHp,
          level: m.level, zone: m.zone, state: m.state,
          flash: m.flashT > 0, winding: m.windupT > 0,
          sprite: m.sprite ? (m.sprite.base || 'kind') : null,
          frame: m.sprite ? (m.frameKey + ':' + m.frameIdx) : null,
          windupDmg: Math.round(m.windupDmg * 10) / 10,
          barFrac: Math.round((m.barHp / (m.maxHp || 1)) * 1000) / 1000,
          ghostFrac: Math.round((m.ghostHp / (m.maxHp || 1)) * 1000) / 1000
        };
      })
    };
  };
  window.__espilMonsterTargets = function () {
    var out = [];
    S.monsters.forEach(function (m) {
      if (m.gone || m.state === 'dying' || m.state === 'leaving' || m.state === 'arriving') return;
      out.push({ id: m.id, x: m.x, z: m.z, r: 0.9 * m.kind.scale + 0.6 });
    });
    return out;
  };
  window.__espilMonsterHit = function (id, dmg, fromX, fromZ, opts) {
    for (var i = 0; i < S.monsters.length; i++) {
      var m = S.monsters[i];
      if (m.id !== id || m.gone || m.state === 'dying' || m.state === 'leaving') continue;
      var crit = !!(opts && opts.crit);
      var element = (opts && opts.element) ? String(opts.element) : 'neutral';
      /* ---- mitigation (Han ruling 2026-11-06): this side reduces
         the raw hit S1 computed. Evasion defeats the hit outright;
         the trait factor multiplies (same element x0.5, listed
         weakness x1.5); defense takes its percentage off last.
         `applied` is the only figure deducted or displayed. ---- */
      var evaded = false, applied = 0;
      if (m.kind.eva > 0 && Math.random() < m.kind.eva) {
        evaded = true;
      } else {
        applied = Math.round(dmg * traitFactor(m.kind, element) * (1 - (m.kind.def || 0) / 100) * 100) / 100;
        if (applied < 0) applied = 0;
      }
      if (evaded) {
        /* the blow slipped past: a beat of flash, an EVADED tag
           instead of a number, no shove, no wind-up pain */
        m.flashT = 0.08;
        applyTint(m);
        S.feel.evades++;
        spawnDmgNumber(m, 0, crit, true);
        return { id: m.id, hp: m.hp, dead: false, killed: false, applied: 0, evaded: true,
                 crit: crit, cancelled: false, kind: m.kind.id, zone: m.zone, grade: m.kind.grade };
      }
      m.hp -= applied;
      /* ---- feel: flash, number, sound (on the applied figure) ---- */
      m.flashT = 0.2;
      S.feel.flashes++;
      applyTint(m);
      S.feel.hits++;
      if (crit) S.feel.crits++;
      spawnDmgNumber(m, applied, crit);
      playHitSound(crit);
      /* ---- wind-up cancel: applied pain at/above CANCEL_FRAC of
         maxHp taken during the telegraph cancels the attack ---- */
      var cancelled = false;
      if (m.windupT > 0 && m.hp > 0) {
        m.windupDmg += applied;
        if (m.windupDmg >= m.maxHp * CANCEL_FRAC) {
          m.windupT = 0; m.windupDmg = 0;
          m.body.scale.set(m.w, m.h, 1);
          m.atkT = Math.max(m.atkT, m.kind.atkCd * 0.6);
          S.feel.cancels++;
          cancelled = true;
        }
      }
      /* the ghost chunk restarts its linger on every hit */
      m.ghostHoldT = GHOST_HOLD;
      drawHpBar(m);
      /* knockback away from the attacker; the distance shrinks with
         the kind's mass (scale squared), so small kinds get shoved
         and brutes barely move */
      var dx = m.x - fromX, dz = m.z - fromZ;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      var mass = m.kind.scale * m.kind.scale;
      var kb = Math.max(0.25, Math.min(1.8, 1.6 / mass));
      var kx = dx / d * kb, kz = dz / d * kb;
      if (walkable(m.x + kx, m.z + kz)) { m.x += kx; m.z += kz; }
      else if (walkable(m.x + kx * 0.5, m.z + kz * 0.5)) { m.x += kx * 0.5; m.z += kz * 0.5; }
      if (m.hp > 0) return { id: m.id, hp: m.hp, dead: false, killed: false, applied: applied, evaded: false, crit: crit, cancelled: cancelled, kind: m.kind.id, zone: m.zone, grade: m.kind.grade };
      /* death: drop on the weapon-materials line, then fade/sink */
      var n = m.kind.elite ? 2 : 1;
      var parts = [];
      for (var p = 0; p < n; p++) parts.push(PARTS[m.kind.grade]);
      try {
        window.dispatchEvent(new CustomEvent('espil-guide', {
          detail: { type: 'monster-drop', id: m.id, kind: m.kind.id, grade: m.kind.grade, parts: parts }
        }));
      } catch (e) {}
      m.state = 'dying'; m.dieT = 0.9;
      return { id: m.id, hp: 0, dead: true, killed: true, applied: applied, evaded: false, crit: crit, parts: parts, kind: m.kind.id, zone: m.zone, grade: m.kind.grade };
    }
    return null;
  };
  window.__espilMonsterForceZone = function (v) {
    if (v === null || v === undefined) { S.forcedZone = null; }
    else if (ZONES.indexOf(v) >= 0) { S.forcedZone = v; }
    else return;
    S.zoneEvalAt = 0; /* re-evaluate on the next tick */
  };

  /* ---------------- main loop ---------------- */
  function tick() {
    requestAnimationFrame(tick);
    var now = performance.now();
    var dt = Math.min(0.05, (now - (tick.last || now)) / 1000);
    tick.last = now;
    if (dt <= 0) return;
    S.tickN++;
    try {
      if (!inMap() || cityKey() !== 'vancouver') {
        if (S.monsters.length) {
          S.outMapSince = S.outMapSince || now;
          if (now - S.outMapSince > 3000) {
            while (S.monsters.length) removeMonster(S.monsters[0]);
            clearDmgNumbers();
            S.gates.forEach(function (gt) { try { if (gt.group.parent) gt.group.parent.remove(gt.group); } catch (e) {} });
            S.gates = []; S.gatesBuilt = false;
          }
        }
        return;
      }
      S.outMapSince = 0;
      if (window.__espilStorePaused) return; /* store page holds the world */
      if (!S.gatesBuilt && now > S.gateTryAt) {
        S.gateTryAt = now + 2000;
        if (probe(GALLERY.x, GALLERY.z)) buildGates();
      }
      var pp = playerPose();
      if (now >= S.zoneEvalAt) {
        S.zoneEvalAt = now + ZONE_EVAL_MS;
        if (pp) {
          var pz = S.forcedZone || zoneAt(pp.x, pp.z).zone;
          if (pz !== S.playerZone) {
            S.playerZone = pz;
            S.activeZones = activeZoneSet(pz);
            /* zones that fell out of the active set fade out */
            S.monsters.forEach(function (m) {
              if (!m.gone && m.state !== 'dying' && !S.activeZones[m.zone]) {
                m.state = 'leaving'; m.fadeT = 0.9;
              }
            });
          }
        }
      }
      /* per-zone population: fill active zones at ~0.5/s each */
      if (S.playerZone && pp) {
        var counts = countByZone();
        ZONES.forEach(function (z) {
          if (!S.activeZones[z]) return;
          if (counts[z] >= ZONE_TARGET[z]) return;
          S.spawnAcc[z] = (S.spawnAcc[z] || 0) + dt * SPAWN_RATE;
          while (S.spawnAcc[z] >= 1 && counts[z] < ZONE_TARGET[z] && S.monsters.length < CAP) {
            S.spawnAcc[z] -= 1;
            spawnMonster(z, pp.x, pp.z);
            counts[z]++;
          }
        });
      }
      if (now - S.sepAt > 150) { S.sepAt = now; separateMonsters(); }
      for (var k = S.monsters.length - 1; k >= 0; k--) {
        var m = S.monsters[k];
        if (!m || m.gone) continue;
        stepMonster(m, dt, pp);
        if (m.gone) continue;
        /* centre guard: never render inside a blocked cell */
        if (walkable(m.x, m.z)) { m.safeX = m.x; m.safeZ = m.z; }
        else { m.x = m.safeX; m.z = m.safeZ; }
      }
      stepDmgNumbers(dt);
    } catch (e) { /* the monster layer never breaks the page */ }
  }
  S.booted = true;
  requestAnimationFrame(tick);
})();
