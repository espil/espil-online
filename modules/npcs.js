/* __espilNpcs v1 - walking pedestrian NPCs (Han 2026-11-05).
   Ambient local pedestrians around the Vancouver Art Gallery whose
   population follows the game's traffic level:
     traffic ORANGE -> 1-6 people, RED -> 7-15, free flow -> 0,
   with a hard pool cap of 30 alive at once (Han's order).
   TRAFFIC SOURCE: the game's own live simulation - the segment
   flow values in modules/monolith.js (updateTraffic), read through
   the read-only window.__espilTrafficSegs / __espilTrafficLevel
   hooks the monolith exposes for this module. The segments are
   built from real OSM roads (buildOsmTraffic) and their flow is an
   internal simulation (random walk + neighbour smoothing + rush
   hour bias + incidents) - there is NO live TomTom feed in the
   build today, and this module adds none: it reads exactly the
   state the game itself uses, so the two can never diverge.
   Colour mapping (the game's trafficLevel bands -> TomTom-style
   colours): clear -> green, slow -> yellow, heavy -> orange,
   stopped -> red. The prevailing colour is the most common colour
   among segments whose midpoint lies within 200 m of the Art
   Gallery anchor (the player spawn front, (3, 33)); ties break
   toward the more severe colour. Level + target re-roll every
   ~30 s.
   Bodies: the game's own avatar GLBs (male.glb / female_idle.glb),
   one parsed master per gender, cloned per NPC with the remote
   avatars' skeleton-rebind pattern; each NPC gets its own mixer
   (idle / walk), tiered by distance like the remote tick. The male
   master prefers the game's verified male_idle.glb / male_walk.glb
   clips over the body file's embedded set, exactly like the local
   walker. No nameplates, no chat, no presence/network registration
   - local ambient pedestrians only.
   Spawning: at building entrances around the gallery. Entrances
   are derived from the baked places records (assets/osm/<city>
   _places.json - the same Overture/OSM bake baked-places.js
   reads): a walkable point just outside a building's AABB edge,
   validated against the collision grid (__espilCollisionProbe);
   if the bake yields too few, entrances fall back to walkable
   cells adjacent to building cells in the collision grid itself.
   Walking: each NPC walks entrance -> entrance at ~1.3 m/s with
   probe-steered avoidance; on arrival it glides a step toward the
   door and despawns (entered the building) - a progress watchdog
   retargets any NPC that stops closing on its door to a door with
   a clear walking corridor, so pocket deadlocks cannot strand a
   pedestrian - and population control
   spawns the replacement at a DIFFERENT building's entrance.
   COLLISION ON (Han): (a) buildings - movement is resolved against
   the collision grid every step (axis slide + lookahead steering),
   and a per-frame centre guard reverts any centre that lands in a
   blocked cell back to its last walkable position, so an NPC never
   renders inside a building footprint; (b) player -
   the player is a moving obstacle: an NPC yields (idle) when the
   player is close ahead, and is nudged aside if the player walks
   into it, so the two never visibly interpenetrate; the player's
   own movement is never blocked (ambient NPCs, same contract as
   remote avatars).
   Hooks: window.__espilNpcState() -> {level, target, active, cap,
   forced, sampled, entrances, npcs:[{x,z,state}]} and the test
   override window.__espilNpcForceLevel('red'|'orange'|'green'|
   'yellow'|null) in the spirit of __espilNightForce - inert when
   null. Vancouver only: any other active city despawns the pool. */
(function () {
  'use strict';
  if (window.__espilNpcState) return; /* single instance */

  var ANCHOR = { x: 3, z: 33 };        /* Art Gallery front (spawn) */
  var SAMPLE_R = 200;                  /* traffic sampling radius */
  var AREA_R = 230;                    /* entrance collection radius */
  var CAP = 30;                        /* Han: max summoned at once */
  var EVAL_MS = 30000;                 /* level re-eval cadence */
  var WALK_SPEED = 1.3;                /* m/s, per-NPC jittered */

  var S = {
    level: 'green', target: 0, forced: null, sampled: 0,
    entrances: [], entrancesBuilt: false, entranceTryAt: 0,
    npcs: [], pending: 0, spawnAcc: 0, everFilled: false,
    fillStartAt: 0, lastArrivedRec: null, nextEval: 0,
    tickN: 0, sepAt: 0, outMapSince: 0, booted: false
  };

  function cityKey() {
    try { return window.__espilCityKey || 'vancouver'; }
    catch (e) { return 'vancouver'; }
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
    /* The map camera is NOT parented into the scene graph (verified
       in the rig: __espilMapCameraObj() has no parent), so the scene
       is reached by climbing from objects the monolith adds to it:
       the district meshes or the Time Stone group. */
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

  /* ---------------- traffic -> population ---------------- */
  var SEVERITY = { green: 0, yellow: 1, orange: 2, red: 3 };
  function colourOf(gameLevel) {
    if (gameLevel === 'clear') return 'green';
    if (gameLevel === 'slow') return 'yellow';
    if (gameLevel === 'heavy') return 'orange';
    if (gameLevel === 'stopped') return 'red';
    return 'green';
  }
  function rollTarget(level) {
    if (level === 'red') return 7 + irand(9);        /* 7..15 */
    if (level === 'orange') return 1 + irand(6);     /* 1..6 */
    return 0;
  }
  function evaluateLevel() {
    if (S.forced) {
      S.level = S.forced;
      S.target = Math.min(CAP, rollTarget(S.forced));
      return;
    }
    var segs = null;
    try {
      segs = (typeof window.__espilTrafficSegs === 'function')
        ? window.__espilTrafficSegs() : null;
    } catch (e) { segs = null; }
    if (!segs || !segs.length || typeof window.__espilTrafficLevel !== 'function') {
      S.level = 'green'; S.target = 0; S.sampled = 0;
      return;
    }
    var counts = { green: 0, yellow: 0, orange: 0, red: 0 }, total = 0;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      var mx = (s.x1 + s.x2) / 2 - ANCHOR.x, mz = (s.z1 + s.z2) / 2 - ANCHOR.z;
      if (mx * mx + mz * mz > SAMPLE_R * SAMPLE_R) continue;
      counts[colourOf(window.__espilTrafficLevel(s.flow))]++;
      total++;
    }
    S.sampled = total;
    if (!total) { S.level = 'green'; S.target = 0; return; }
    var best = 'green';
    var order = ['yellow', 'orange', 'red'];
    for (var j = 0; j < order.length; j++) {
      if (counts[order[j]] >= counts[best]) best = order[j]; /* ties -> severe */
    }
    S.level = best;
    S.target = Math.min(CAP, rollTarget(best));
  }

  /* ---------------- entrances ---------------- */
  function entranceOk(x, z, dirIn) {
    if (!walkable(x, z)) return null;
    return { x: x, z: z, rec: -1, dirIn: dirIn || null };
  }
  function bakedEntrances(records) {
    var out = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var cx = r[0], cz = r[1], w = r[2] || 10, d = r[3] || 10;
      var dx = cx - ANCHOR.x, dz = cz - ANCHOR.z;
      if (dx * dx + dz * dz > AREA_R * AREA_R) continue;
      /* candidate doors: edge midpoints pushed 1.4 m outward,
         tried in random order; then a ring search as fallback */
      var edges = [
        { x: cx, z: cz + d / 2 + 1.4, ix: 0, iz: -1 },
        { x: cx, z: cz - d / 2 - 1.4, ix: 0, iz: 1 },
        { x: cx + w / 2 + 1.4, z: cz, ix: -1, iz: 0 },
        { x: cx - w / 2 - 1.4, z: cz, ix: 1, iz: 0 }
      ];
      var ent = null;
      for (var k = 0; k < 4 && !ent; k++) {
        var e = edges[irand(edges.length)];
        ent = entranceOk(e.x, e.z, { x: e.ix, z: e.iz });
        if (ent) ent.rec = i;
        edges.splice(edges.indexOf(e), 1);
      }
      if (!ent) {
        var rr = Math.max(w, d) / 2 + 2;
        for (var a = 0; a < 12 && !ent; a++) {
          var th = (a / 12) * Math.PI * 2;
          ent = entranceOk(cx + Math.sin(th) * rr, cz + Math.cos(th) * rr,
            { x: -Math.sin(th), z: -Math.cos(th) });
          if (ent) ent.rec = i;
        }
      }
      if (ent) out.push(ent);
    }
    return out;
  }
  function gridEntrances() {
    /* fallback: walkable cells with a building cell next door */
    var out = [], cellSeen = {};
    for (var x = ANCHOR.x - AREA_R; x <= ANCHOR.x + AREA_R; x += 5) {
      for (var z = ANCHOR.z - AREA_R; z <= ANCHOR.z + AREA_R; z += 5) {
        var dx = x - ANCHOR.x, dz = z - ANCHOR.z;
        if (dx * dx + dz * dz > AREA_R * AREA_R) continue;
        if (!walkable(x, z)) continue;
        var dirs = [[3, 0], [-3, 0], [0, 3], [0, -3]], ent = null;
        for (var k = 0; k < 4; k++) {
          var p = probe(x + dirs[k][0], z + dirs[k][1]);
          if (p && p.blocked && p.cls === 'building') {
            ent = { x: x, z: z, rec: -1, dirIn: { x: dirs[k][0] / 3, z: dirs[k][1] / 3 } };
            break;
          }
        }
        if (!ent) continue;
        var ck = Math.floor(x / 14) + ',' + Math.floor(z / 14);
        if (cellSeen[ck]) continue;
        cellSeen[ck] = 1;
        out.push(ent);
      }
    }
    return out;
  }
  function buildEntrances() {
    var finish = function (list) {
      /* dedupe: no two entrances closer than 7 m */
      var kept = [];
      for (var i = 0; i < list.length; i++) {
        var ok = true;
        for (var j = 0; j < kept.length; j++) {
          var ddx = list[i].x - kept[j].x, ddz = list[i].z - kept[j].z;
          if (ddx * ddx + ddz * ddz < 49) { ok = false; break; }
        }
        if (ok) kept.push(list[i]);
      }
      /* shuffle + cap so the pool spreads over the whole area */
      for (var m = kept.length - 1; m > 0; m--) {
        var n = irand(m + 1), t = kept[m]; kept[m] = kept[n]; kept[n] = t;
      }
      S.entrances = kept.slice(0, 140);
      S.entrancesBuilt = S.entrances.length > 0;
    };
    var city = cityKey();
    fetch('assets/osm/' + city + '_places.json')
      .then(function (r) { if (!r.ok) throw new Error('no bake'); return r.json(); })
      .then(function (doc) {
        var list = bakedEntrances((doc && doc.b) || []);
        if (list.length < 8) list = list.concat(gridEntrances());
        finish(list);
      })
      .catch(function () { finish(gridEntrances()); });
  }

  /* ---------------- avatar masters (remote-avatar pattern) ------ */
  var masters = {
    m: { state: 0, scene: null, clips: null, extra: {}, groundY: 0, waiters: [] },
    f: { state: 0, scene: null, clips: null, extra: {}, groundY: 0, waiters: [] }
  };
  function stripRootMotion(clip) {
    clip.tracks = clip.tracks.filter(function (t) {
      var n = (t.name || '').toLowerCase();
      var isPos = n.indexOf('.position') >= 0;
      var isRoot = /^(mixamorig[_:]?hips|hips|armature|root)/.test(n);
      return !(isPos && isRoot);
    });
    return clip;
  }
  function ensureMaster(key, cb) {
    var M = masters[key];
    if (M.state === 2) { cb(M); return; }
    M.waiters.push(cb);
    if (M.state === 1) return;
    M.state = 1;
    var done = function (ok) {
      M.state = ok ? 2 : 0;
      var ws = M.waiters; M.waiters = [];
      for (var i = 0; i < ws.length; i++) { try { ws[i](ok ? M : null); } catch (e) {} }
    };
    try {
      if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') throw new Error('no GLTFLoader');
      new THREE.GLTFLoader().load(
        key === 'f' ? 'assets/character/female_idle.glb' : 'assets/character/male.glb',
        function (gltf) {
          M.scene = gltf.scene;
          M.clips = gltf.animations || [];
          M.scene.rotation.y = Math.PI;
          M.scene.scale.setScalar(1.5);
          M.scene.updateMatrixWorld(true);
          var bbox = new THREE.Box3().setFromObject(M.scene);
          M.groundY = -bbox.min.y;
          M.scene.rotation.y = 0;
          M.scene.scale.setScalar(1);
          if (key === 'm') {
            /* the game's verified male idle/walk (the body file's
               embedded idle is a static bind pose - the local
               walker replaces both the same way) */
            var pending = 2;
            var fin = function () { if (--pending <= 0) done(true); };
            var loadExtra = function (file, name) {
              try {
                new THREE.GLTFLoader().load('assets/character/' + file, function (g2) {
                  var cs = g2.animations || [];
                  if (cs.length) M.extra[name] = stripRootMotion(cs[0]);
                  fin();
                }, undefined, function () { fin(); });
              } catch (e) { fin(); }
            };
            loadExtra('male_idle.glb', 'idle');
            loadExtra('male_walk.glb', 'walk');
          } else {
            done(true);
          }
        }, undefined, function () { done(false); });
    } catch (e) { done(false); }
  }
  function cloneModel(M) {
    var src = M.scene;
    var clone = src.clone(true);
    var srcNodes = [], cloneNodes = [];
    src.traverse(function (o) { srcNodes.push(o); });
    clone.traverse(function (o) { cloneNodes.push(o); });
    for (var i = 0; i < cloneNodes.length; i++) {
      var cn = cloneNodes[i], sn = srcNodes[i];
      if (sn && cn && sn.isSkinnedMesh && cn.isSkinnedMesh && cn.skeleton) {
        var bones = cn.skeleton.bones.map(function (b) { return cloneNodes[srcNodes.indexOf(b)]; });
        cn.skeleton = new THREE.Skeleton(bones, cn.skeleton.boneInverses);
      }
    }
    return clone;
  }
  function findClip(M, name) {
    if (M.extra[name]) return M.extra[name];
    var clips = M.clips || [];
    var rx = name === 'idle' ? /baselayer|idle/i : (name === 'walk' ? /walking/i : /running/i);
    for (var i = 0; i < clips.length; i++) { if (rx.test(clips[i].name)) return clips[i]; }
    return name === 'idle' ? (clips[0] || null) : null;
  }

  /* ---------------- NPC lifecycle ---------------- */
  var npcSeq = 0;
  function pickEntrance(excludeRec) {
    if (!S.entrances.length) return null;
    for (var t = 0; t < 8; t++) {
      var e = pick(S.entrances);
      if (excludeRec == null || e.rec !== excludeRec) return e;
    }
    return pick(S.entrances);
  }
  function pickTarget(fromEnt, fromX, fromZ) {
    var best = null;
    for (var t = 0; t < 8; t++) {
      var e = pick(S.entrances);
      if (!e || e === fromEnt) continue;
      if (fromEnt && e.rec >= 0 && e.rec === fromEnt.rec) continue;
      var dx = e.x - fromX, dz = e.z - fromZ, d2 = dx * dx + dz * dz;
      if (d2 > 900) return e;                    /* prefer > 30 m away */
      if (!best) best = e;
    }
    return best || pickEntrance(null);
  }
  function removeNpc(n) {
    var i = S.npcs.indexOf(n);
    if (i >= 0) S.npcs.splice(i, 1);
    n.gone = true;
    try { if (n.mixer) n.mixer.stopAllAction(); } catch (e) {}
    try { if (n.group && n.group.parent) n.group.parent.remove(n.group); } catch (e) {}
    try { if (n.shadow && n.shadow.parent) n.shadow.parent.remove(n.shadow); } catch (e) {}
    /* geometry/materials/textures are SHARED with the gender master
       - never disposed per NPC (the remote-avatar rule); only the
       per-NPC contact shadow is */
    try { if (n.shadow) { n.shadow.geometry.dispose(); n.shadow.material.dispose(); } } catch (e) {}
  }
  function despawnAll() {
    while (S.npcs.length) removeNpc(S.npcs[0]);
  }
  function spawnNpc(enRoute) {
    if (S.npcs.length + S.pending >= CAP) return;
    var scene = sceneRoot();
    if (!scene) return;
    var ent = pickEntrance(S.lastArrivedRec);
    S.lastArrivedRec = null;
    if (!ent) return;
    var key = Math.random() < 0.5 ? 'm' : 'f';
    S.pending++;
    ensureMaster(key, function (M) {
      S.pending--;
      if (!M || !M.scene) return;
      if (!inMap() || cityKey() !== 'vancouver') return;
      if (S.npcs.length >= CAP) return;
      var sc = sceneRoot();
      if (!sc) return;
      try {
        var n = {
          id: ++npcSeq, gender: key, gone: false, ready: false,
          group: new THREE.Group(), shadow: null, visual: null,
          mixer: null, actions: {}, curAnim: null,
          x: ent.x, z: ent.z, safeX: ent.x, safeZ: ent.z,
          faceY: Math.random() * Math.PI * 2,
          speed: WALK_SPEED * (0.82 + Math.random() * 0.36),
          state: 'walk', targetE: null, homeRec: ent.rec,
          waitT: 0.3 + Math.random() * 1.1, stuckT: 0, repicks: 0,
          progT: 0, bestDist: 1e12, fails: 0,
          anchorX: ent.x, anchorZ: ent.z, stuckClock: 0,
          yieldUntil: 0, enterT: 0, phase: npcSeq % 7, acc: 0
        };
        var model = cloneModel(M);
        model.rotation.y = Math.PI;
        model.scale.setScalar(1.5);
        model.position.y = M.groundY;
        model.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        n.visual = model;
        n.group.add(model);
        n.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
        n.shadow.rotation.x = -Math.PI / 2;
        var mixer = new THREE.AnimationMixer(model);
        n.mixer = mixer;
        var idle = findClip(M, 'idle'), walk = findClip(M, 'walk');
        if (idle) n.actions.idle = mixer.clipAction(idle);
        if (walk) n.actions.walk = mixer.clipAction(walk);
        n.playAnim = function (name) {
          if (!n.mixer || !n.actions[name] || n.curAnim === name) return;
          var prev = n.actions[n.curAnim], next = n.actions[name];
          n.curAnim = name;
          next.reset().fadeIn(0.18).play();
          next.__espilGen = (next.__espilGen || 0) + 1;
          if (prev && prev !== next) {
            prev.fadeOut(0.18);
            (function (pp, gg) { setTimeout(function () { if (pp.__espilGen === gg) pp.stop(); }, 220); })(prev, prev.__espilGen || 0);
          }
        };
        n.targetE = pickTarget(ent, ent.x, ent.z);
        if (enRoute && n.targetE) {
          /* initial fill: some pedestrians are already mid-walk */
          var ts = [0.3, 0.5, 0.7, 0.15, 0.85];
          for (var ti = 0; ti < ts.length; ti++) {
            var px = ent.x + (n.targetE.x - ent.x) * ts[ti];
            var pz = ent.z + (n.targetE.z - ent.z) * ts[ti];
            if (walkable(px, pz)) { n.x = px; n.z = pz; n.safeX = px; n.safeZ = pz; n.waitT = 0; break; }
          }
        }
        n.anchorX = n.x; n.anchorZ = n.z;
        n.group.position.set(n.x, 0, n.z);
        n.group.rotation.y = n.faceY;
        n.shadow.position.set(n.x, 0.03, n.z);
        sc.add(n.group); sc.add(n.shadow);
        n.ready = true;
        n.playAnim('idle');
        S.npcs.push(n);
      } catch (e) { /* a failed spawn never breaks the page */ }
    });
  }

  /* ---------------- per-NPC movement ---------------- */
  function stepNpc(n, dt, pp) {
    var now = performance.now();
    var moving = false;
    if (n.state === 'enter') {
      /* glide the last step toward the door, then despawn */
      n.enterT -= dt;
      if (n.targetE && n.targetE.dirIn) {
        n.x += n.targetE.dirIn.x * n.speed * 0.7 * dt;
        n.z += n.targetE.dirIn.z * n.speed * 0.7 * dt;
      }
      moving = true;
      if (n.enterT <= 0) { removeNpc(n); return 'gone'; }
      return moving ? 'walk' : 'idle';
    }
    if (n.waitT > 0) { n.waitT -= dt; return 'idle'; }
    if (!n.targetE) n.targetE = pickTarget(null, n.x, n.z);
    if (!n.targetE) return 'idle';
    var dx = n.targetE.x - n.x, dz = n.targetE.z - n.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.5) {
      if (n.state === 'leave') { removeNpc(n); return 'gone'; }
      S.lastArrivedRec = n.targetE.rec;
      n.state = 'enter';
      n.enterT = 0.8;
      return 'walk';
    }
    /* player as a moving obstacle: yield close, nudge out of overlap */
    var yielding = now < n.yieldUntil;
    if (pp) {
      var pdx = n.x - pp.x, pdz = n.z - pp.z;
      var pd = Math.sqrt(pdx * pdx + pdz * pdz);
      if (pd < 0.85) {
        var ax = pd > 0.02 ? pdx / pd : Math.cos(n.faceY), az = pd > 0.02 ? pdz / pd : Math.sin(n.faceY);
        var nx = pp.x + ax * 0.95, nz = pp.z + az * 0.95;
        if (walkable(nx, nz)) { n.x = nx; n.z = nz; }
        yielding = true;
      } else if (pd < 1.6) {
        yielding = true;
      }
      if (yielding) n.yieldUntil = now + 350;
    }
    if (yielding) return 'idle';
    /* progress watchdog: frame-level movement is not progress. An
       NPC can slide inside a pocket forever without ever closing on
       its door - measured in the rig (2026-11-05): a 'leave' NPC
       oscillated within a 0.5 m box for 400+ s of wall time at a
       constant ~38 m from its door, so neither the pool drain nor
       its trip ever completed, and the frame-level stuck detector
       never fired because it was "moving" every frame. Track the
       best distance reached instead: ~5 s of game time without
       closing at least 0.5 m retargets the NPC to a door with a
       clear walking corridor (corridorClear below). Last resort:
       sustained zero progress removes the NPC where it stands -
       45 s of game time for a 'leave' NPC (heading home is a short
       trip by construction; the rig measured leavers still looping
       at 1,500 s of wall time on the 120 s valve because downtown
       corridors are rarely fully clear, so the reachable-door
       retarget kept re-picking an unreachable door), 120 s for a
       walker (long building detours stay legal). A stuck
       pedestrian quietly vanishing beats one frozen in a pocket
       forever; healthy trips always close distance, so normal
       flow never reaches the valve. */
    /* the removal valve runs on an anchor-displacement clock that
       retargeting CANNOT reset: the NPC must displace at least 2 m
       from its anchor point to earn a fresh clock. (The first
       watchdog version reset its no-progress clock inside the
       retarget path - bestDist was re-anchored to infinity, so the
       next frame always registered "progress" and the valve never
       fired; the rig measured a wedged NPC cycling retargets in
       place for a full 590 s drain window, 2026-11-05.) */
    var adx = n.x - n.anchorX, adz = n.z - n.anchorZ;
    if (adx * adx + adz * adz >= 4) {
      n.anchorX = n.x; n.anchorZ = n.z; n.stuckClock = 0;
    } else {
      n.stuckClock += dt;
      if (n.stuckClock > (n.state === 'leave' ? 45 : 120)) { removeNpc(n); return 'gone'; }
    }
    if (dist < n.bestDist - 0.5) {
      n.bestDist = dist; n.fails = 0; n.progT = 0;
    } else {
      n.progT += dt;
      if (n.progT > 2.5) {
        n.progT = 0; n.fails++;
        if (n.fails >= 2) { n.fails = 0; retargetForProgress(n); return 'idle'; }
      }
    }
    /* steering: desired heading, deflected by lookahead probes.
       The lookahead is TIERED (1.15 -> 0.6 -> 0.35 m): a fixed long
       lookahead can never step up to a door, because the probe point
       overshoots the entrance into the building behind it and every
       final-approach heading is rejected (found by the rig's
       trajectory diagnosis, 2026-11-05: pools churned for 1,600 s
       with zero door arrivals). Short tiers let an NPC close the
       last metre to its entrance and thread tight gaps. */
    var ux = dx / dist, uz = dz / dist;
    var stepLen = n.speed * dt;
    var offs = [0, 0.55, -0.55, 1.1, -1.1, 1.8, -1.8, 2.6, -2.6, Math.PI];
    var looks = [1.15, 0.6, 0.35];
    var moved = false;
    for (var li = 0; li < looks.length && !moved; li++) {
      for (var oi = 0; oi < offs.length; oi++) {
        var cs = Math.cos(offs[oi]), sn = Math.sin(offs[oi]);
        var hx = ux * cs - uz * sn, hz = ux * sn + uz * cs;
        var sx = n.x + hx * stepLen, sz = n.z + hz * stepLen;
        if (!walkable(sx, sz)) continue;
        if (!walkable(n.x + hx * looks[li], n.z + hz * looks[li])) continue;
        n.x = sx; n.z = sz; moved = true;
        var tf = Math.atan2(-hx, -hz);
        var df = tf - n.faceY;
        while (df > Math.PI) df -= Math.PI * 2;
        while (df < -Math.PI) df += Math.PI * 2;
        n.faceY += df * Math.min(1, dt * 8);
        break;
      }
    }
    if (!moved) {
      /* axis slide along the desired heading as a last resort */
      if (walkable(n.x + ux * stepLen, n.z)) { n.x += ux * stepLen; moved = true; }
      else if (walkable(n.x, n.z + uz * stepLen)) { n.z += uz * stepLen; moved = true; }
    }
    if (moved) { n.stuckT = 0; moving = true; }
    else {
      n.stuckT += dt;
      if (n.stuckT > 2.5) {
        n.stuckT = 0;
        n.repicks++;
        if (n.repicks >= 3) { /* give up: leave via a reachable door */
          n.state = 'leave'; n.repicks = 0;
          retargetForProgress(n);
        } else {
          retargetForProgress(n);
        }
      }
    }
    return moving ? 'walk' : 'idle';
  }
  function nearestEntrance(x, z) {
    var best = null, bd = 1e12;
    for (var i = 0; i < S.entrances.length; i++) {
      var dx = S.entrances[i].x - x, dz = S.entrances[i].z - z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = S.entrances[i]; }
    }
    return best;
  }
  /* a walking corridor is clear when every sample along the straight
     line probes walkable - an NPC sent to such a door can always
     reach it with plain steering, pockets notwithstanding */
  function corridorClear(x1, z1, x2, z2) {
    var d = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
    var steps = Math.max(1, Math.ceil(d / 0.9));
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (!walkable(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  }
  /* nearest door (optionally at least minD away) whose corridor is
     clear; null when no door qualifies */
  function losDoor(x, z, maxD, minD) {
    var best = null, bd = maxD;
    for (var i = 0; i < S.entrances.length; i++) {
      var e = S.entrances[i];
      var dx = e.x - x, dz = e.z - z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < (minD || 0) || d >= bd) continue;
      if (corridorClear(x, z, e.x, e.z)) { best = e; bd = d; }
    }
    return best;
  }
  /* fraction of corridor samples that probe blocked - used when no
     corridor in range is fully clear (the downtown norm): the
     least-blocked line is usually walkable with minor deflections */
  function corridorBlockage(x1, z1, x2, z2) {
    var d = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
    var steps = Math.max(1, Math.ceil(d / 0.9));
    var bad = 0;
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (!walkable(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) bad++;
    }
    return bad / steps;
  }
  function leastBlockedDoor(x, z, maxD) {
    var best = null, bs = 2;
    for (var i = 0; i < S.entrances.length; i++) {
      var e = S.entrances[i];
      var dx = e.x - x, dz = e.z - z, d = Math.sqrt(dx * dx + dz * dz);
      if (d >= maxD) continue;
      var s = corridorBlockage(x, z, e.x, e.z) + d / (maxD * 4);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  /* retarget after a no-progress verdict: a door the NPC can
     provably walk to. 'leave' NPCs take the nearest clear door,
     else the least-blocked line, else the plain nearest door;
     walkers take a clear door at a useful distance, else a fresh
     random target. */
  function retargetForProgress(n) {
    var e = null;
    if (n.state === 'leave') e = losDoor(n.x, n.z, 160, 0) || leastBlockedDoor(n.x, n.z, 200) || nearestEntrance(n.x, n.z);
    else e = losDoor(n.x, n.z, 160, 10) || pickTarget(null, n.x, n.z);
    if (e) n.targetE = e;
    n.bestDist = 1e12; n.progT = 0;
  }
  function separateNpcs() {
    for (var i = 0; i < S.npcs.length; i++) {
      for (var j = i + 1; j < S.npcs.length; j++) {
        var a = S.npcs[i], b = S.npcs[j];
        var dx = b.x - a.x, dz = b.z - a.z;
        var d2 = dx * dx + dz * dz;
        if (d2 > 0.49 || d2 < 0.0001) continue;
        var d = Math.sqrt(d2), push = (0.7 - d) / 2;
        var ux = dx / d, uz = dz / d;
        if (walkable(a.x - ux * push, a.z - uz * push)) { a.x -= ux * push; a.z -= uz * push; }
        if (walkable(b.x + ux * push, b.z + uz * push)) { b.x += ux * push; b.z += uz * push; }
      }
    }
  }

  /* ---------------- hooks ---------------- */
  window.__espilNpcState = function () {
    return {
      level: S.level, target: S.target, active: S.npcs.length, cap: CAP,
      forced: S.forced, sampled: S.sampled, entrances: S.entrances.length,
      pending: S.pending,
      doors: S.entrances.map(function (e) {
        return { x: Math.round(e.x * 100) / 100, z: Math.round(e.z * 100) / 100 };
      }),
      npcs: S.npcs.map(function (n) {
        return { x: Math.round(n.x * 100) / 100, z: Math.round(n.z * 100) / 100, state: n.state };
      })
    };
  };
  window.__espilNpcForceLevel = function (v) {
    if (v === null || v === undefined) { S.forced = null; }
    else if (v === 'red' || v === 'orange' || v === 'green' || v === 'yellow') { S.forced = v; }
    else return;
    S.nextEval = 0; /* re-evaluate on the next tick */
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
        if (S.npcs.length) {
          S.outMapSince = S.outMapSince || now;
          if (now - S.outMapSince > 3000) despawnAll();
        }
        return;
      }
      S.outMapSince = 0;
      if (window.__espilStorePaused) return; /* store page holds the world */
      if (!S.entrancesBuilt && now > S.entranceTryAt) {
        S.entranceTryAt = now + 2000;
        if (probe(ANCHOR.x, ANCHOR.z)) buildEntrances();
      }
      if (now >= S.nextEval) {
        S.nextEval = now + EVAL_MS;
        evaluateLevel();
      }
      /* population easing: grow at ~2/s at entrances, shrink by
         sending the excess home (never a mid-street pop-out) */
      var active = S.npcs.length + S.pending;
      if (S.entrancesBuilt && active < S.target) {
        if (!S.fillStartAt) S.fillStartAt = now;
        S.spawnAcc += dt * 2.2;
        while (S.spawnAcc >= 1 && S.npcs.length + S.pending < S.target) {
          S.spawnAcc -= 1;
          spawnNpc(!S.everFilled && Math.random() < 0.5);
        }
        if (S.npcs.length >= S.target) S.everFilled = true;
        if (now - S.fillStartAt > 20000) S.everFilled = true;
      } else if (active > S.target) {
        /* only NPCs not already heading home count toward the excess,
           or a second tick would send the whole pool away */
        var staying = 0;
        for (var s2 = 0; s2 < S.npcs.length; s2++) if (S.npcs[s2].state === 'walk') staying++;
        var excess = staying - S.target;
        for (var i = 0; i < S.npcs.length && excess > 0; i++) {
          var cand = S.npcs[i];
          if (cand.state === 'walk') {
            cand.state = 'leave';
            cand.targetE = nearestEntrance(cand.x, cand.z);
            excess--;
          }
        }
      }
      if (now - S.sepAt > 120) { S.sepAt = now; separateNpcs(); }
      var pp = playerPose();
      for (var k = S.npcs.length - 1; k >= 0; k--) {
        var n = S.npcs[k];
        if (!n || n.gone || !n.ready) continue;
        var want = stepNpc(n, dt, pp);
        if (want === 'gone' || n.gone) continue;
        /* centre guard: whatever a writer or a boundary case did,
           the reported/rendered centre never sits in a blocked cell -
           revert to the last walkable position (the 'enter' glide
           simply pauses at the door threshold and despawn proceeds
           on its timer inside stepNpc) */
        if (walkable(n.x, n.z)) { n.safeX = n.x; n.safeZ = n.z; }
        else { n.x = n.safeX; n.z = n.safeZ; n.stuckT += dt; }
        n.group.position.set(n.x, 0, n.z);
        n.group.rotation.y = n.faceY;
        if (n.shadow) n.shadow.position.set(n.x, 0.03, n.z);
        if (n.mixer) {
          var pd2 = 1e12;
          if (pp) { var qx = n.x - pp.x, qz = n.z - pp.z; pd2 = qx * qx + qz * qz; }
          var stride = pd2 < 3600 ? 1 : (pd2 < 19600 ? 2 : 4);
          if (S.npcs.length > 20 && stride === 1 && pd2 >= 900) stride = 2;
          n.acc += dt;
          if (((S.tickN + n.phase) % stride) === 0) {
            if (n.actions[want]) n.playAnim(want);
            n.mixer.update(n.acc);
            n.acc = 0;
          }
        }
      }
    } catch (e) { /* the NPC layer never breaks the page */ }
  }
  S.booted = true;
  requestAnimationFrame(tick);
})();
