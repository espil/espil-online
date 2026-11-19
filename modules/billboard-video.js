/* __espilBillboardVideo v1 - building-wall video ads (Han 2026-11-18:
   "빌딩이 어느정도의 높이에 있으면, 광고영상이 빌딩에 띄워지게").
   A script measures building heights from the baked district data;
   buildings at or above ESPIL_BILLBOARD_MIN_H are ELIGIBLE, and the
   ones the server config ASSIGNS carry a muted, looping video on
   their widest road-facing wall. The building itself is the ad
   surface - there are no dedicated billboard objects.

   Access pattern: the monolith's world state (mapScene, walkPlayer,
   ESPIL_CITIES) is closure-scoped, NOT global - modules reach the
   world through the window hooks, exactly like monsters.js/npcs.js:
   the scene by climbing from __espilMapCameraObj(), the player
   from __espilPlayerPose(), the city from window.__espilCityKey,
   and the district URL from the resource the game itself fetched.
   The world offset is config data, cross-checked opportunistically
   against __espilBakedBuildingCents() when that cache appears.

   House rules this module obeys:
   - Textures ride CANVAS only. espilP1Hide() fades + hides any
     in-world plane whose material.map image is not a <canvas>
     (that is how the monster/NPC bodies survive it), so the video
     is drawn into a 640x360 canvas and the plane carries a
     CanvasTexture. Poster and fallback states draw into the same
     canvas.
   - The panel is anchored to the building's RECORD height h, not
     to the paint height hv: the monolith's globe vertex shader
     drops every vertex by min(k*d^2, cap) from the player pole, so
     a top edge built at h lands at h - drop(nearest wall point)
     = hv exactly at the wall point nearest the player and below
     hv everywhere else along the wall - it can never poke above
     the extrusion's roofline. hv itself follows from the same law
     (see state hook: hvNow).
   - Occlusion: Mapbox extrusions live in a separate GL context
     under the THREE canvas, so a THREE plane cannot depth-test
     against them. Mitigations: the panel is single-sided (culled
     from behind), and while the monolith's dither system has this
     building in its occluder set (__espilDitherState), the panel
     hides - the wall is stippled then, and a solid ad floating
     over the stipple would break the see-through law.
   - Nothing is stored: no localStorage, no identity. Counters are
     one-way beacons carrying {event} only, exactly the store-video
     counter pattern (aggregate per building per month, server-side).
   - Fail dark: no config, a district-hash mismatch, an ineligible
     or signature-mismatched assignment, or a failed video all end
     at poster / frame / nothing - never a black hole, never an
     error that reaches the game. */
(function () {
  'use strict';

  /* ---- tunables (draft values, Han's screen verdict may move them) ---- */
  var ESPIL_BILLBOARD_MIN_H = 20;      /* eligibility: building record height (m) at or above this may carry a video */
  var ESPIL_BILLBOARD_GATE_M = 120;    /* play radius: only faces within this distance of the player may play */
  var ESPIL_BILLBOARD_PRELOAD_M = 220; /* video elements are created/loaded within this distance */
  var ESPIL_BILLBOARD_MAX_PLAYING = 4; /* hard cap on simultaneous playing faces */
  var ESPIL_BILLBOARD_TICK_MS = 300;   /* gate / visibility / rank cadence */
  var ESPIL_BILLBOARD_MIN_EDGE_M = 8;  /* chosen wall must be at least this wide */
  var ESPIL_BILLBOARD_ROAD_M = 25;     /* a wall "faces a road" if a road passes within this of its outward test point */
  var CANVAS_W = 640, CANVAS_H = 360;  /* video texture canvas (16:9) */

  var S = {
    armed: false, city: null, configOk: false, configVersion: null,
    districtHash: null, faces: [], beaconsSent: 0, startedAt: 0, scene: null,
    debug: {}
  };

  function apiBase() {
    if (typeof window.__espilBillboardApiBase === 'string' && window.__espilBillboardApiBase) return window.__espilBillboardApiBase;
    if (typeof window.__espilAuthApiBase === 'string' && window.__espilAuthApiBase) return window.__espilAuthApiBase;
    return 'https://api.espil.online';
  }

  function fnv1a(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function beacon(face, ev) {
    try {
      var url = apiBase() + '/billboards/' + S.city + '/faces/' + face.i + '/events';
      var body = JSON.stringify({ event: ev });
      S.beaconsSent++;
      if (navigator.sendBeacon) {
        var ok = false;
        /* text/plain keeps the beacon a CORS-simple request: an
           application/json blob triggers a credentialed preflight
           whose failure silently swallows the POST (measured on
           the local Worker: 18 preflights, 0 posts). The Worker
           parses the body as JSON regardless of content type. */
        try { ok = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' })); } catch (e) { ok = false; }
        if (ok) return;
      }
      fetch(url, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () {});
    } catch (e) { /* counters never disturb the game */ }
  }

  /* ---------- world access through the window hooks ---------- */
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
    } catch (e) {}
    return null;
  }
  function playerPose() {
    try { return (typeof window.__espilPlayerPose === 'function') ? window.__espilPlayerPose() : null; }
    catch (e) { return null; }
  }
  function districtUrl(city) {
    try {
      var entries = performance.getEntriesByType('resource') || [];
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name.indexOf('_district') >= 0 && entries[i].name.indexOf('.json') >= 0) return entries[i].name;
      }
    } catch (e) {}
    return 'assets/osm/' + city + (city === 'vancouver' ? '_district_sample.json' : '_district.json');
  }

  /* ---------- district geometry (same skip rules as the monolith's
     espilP1BuildingsGeoJSON, so feature index i means the same
     building in the espil-buildings source, the dither set and here) ---------- */
  function dedupeRing(p) {
    var n = p.length;
    if (n > 1 && p[0][0] === p[n - 1][0] && p[0][1] === p[n - 1][1]) n--;
    return p.slice(0, n);
  }
  function ringSig(ring) {
    var n = ring.length;
    return Math.round(ring[0][0] * 100) + ',' + Math.round(ring[0][1] * 100) + '|' + n + '|' +
           Math.round(ring[n - 1][0] * 100) + ',' + Math.round(ring[n - 1][1] * 100);
  }
  function segDist(px, pz, ax, az, bx, bz) {
    var ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
    var t = L2 > 0 ? ((px - ax) * ex + (pz - az) * ez) / L2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = ax + ex * t, qz = az + ez * t;
    return Math.hypot(px - qx, pz - qz);
  }

  function chooseFace(b, roadSegs) {
    var ring = dedupeRing(b.p);
    var n = ring.length;
    var cx = 0, cz = 0;
    for (var j = 0; j < n; j++) { cx += ring[j][0]; cz += ring[j][1]; }
    cx /= n; cz /= n;
    var edges = [];
    for (var k = 0; k < n; k++) {
      var a = ring[k], c = ring[(k + 1) % n];
      var len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < ESPIL_BILLBOARD_MIN_EDGE_M) continue;
      var mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      var dx = mx - cx, dz = mz - cz, dl = Math.hypot(dx, dz) || 1;
      var tx = mx + dx / dl * 8, tz = mz + dz / dl * 8; /* 8 m outside the wall */
      var road = false;
      for (var s = 0; s < roadSegs.length; s++) {
        if (segDist(tx, tz, roadSegs[s][0], roadSegs[s][1], roadSegs[s][2], roadSegs[s][3]) <= ESPIL_BILLBOARD_ROAD_M) { road = true; break; }
      }
      edges.push({ a: a, c: c, len: len, road: road, mx: mx, mz: mz });
    }
    if (!edges.length) return null;
    var roadEdges = edges.filter(function (e) { return e.road; });
    var pool = roadEdges.length ? roadEdges : edges;
    pool.sort(function (x, y) { return y.len - x.len; });
    var chosen = pool[0];
    chosen.roadFallback = !roadEdges.length;
    chosen.cx = cx; chosen.cz = cz;
    var area = 0;
    for (var m = 0; m < n; m++) { var p1 = ring[m], p2 = ring[(m + 1) % n]; area += p1[0] * p2[1] - p2[0] * p1[1]; }
    chosen.area = Math.abs(area) / 2;
    chosen.ring = ring;
    return chosen;
  }

  /* ---------- panel meshes ---------- */
  function makeQuad(cx, cy, cz, ux, uz, w, hgt, nx, nz, off, mat) {
    /* u = reading direction along the wall (viewer-left to viewer-right),
       corners in world coords; front face looks along +n. */
    var ox = nx * off, oz = nz * off;
    var hw = w / 2, hh = hgt / 2;
    var v = new Float32Array([
      cx - ux * hw + ox, cy - hh, cz - uz * hw + oz,
      cx + ux * hw + ox, cy - hh, cz + uz * hw + oz,
      cx + ux * hw + ox, cy + hh, cz + uz * hw + oz,
      cx - ux * hw + ox, cy + hh, cz - uz * hw + oz
    ]);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    var mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  function drawSlate(face) {
    var ctx = face.ctx;
    ctx.fillStyle = '#171c22'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#3a4552'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, CANVAS_W - 20, CANVAS_H - 20);
    ctx.fillStyle = '#d7dee6'; ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(face.advertiser || 'ESPIL', CANVAS_W / 2, CANVAS_H / 2 - 8);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#8fa1b3';
    ctx.fillText('광고 · ADVERTISEMENT', CANVAS_W / 2, CANVAS_H / 2 + 42);
    face.tex.needsUpdate = true;
  }
  function drawPoster(face) {
    if (face.posterImg && face.posterOk) {
      var ctx = face.ctx, img = face.posterImg;
      var s = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
      var w = img.width * s, h = img.height * s;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
      face.tex.needsUpdate = true;
    } else {
      drawSlate(face);
    }
  }

  function buildFace(face, cfg, ox, oz) {
    var b = face.building, ch = face.chosen;
    var h = b.h;
    /* wall direction in world coords; the reading direction
       u = cross((0,1,0), n) = (nz, 0, -nx) with n outward, so the
       texture is never mirrored for a viewer on the normal side. */
    var ax = ch.a[0] + ox, az = ch.a[1] + oz, bx = ch.c[0] + ox, bz = ch.c[1] + oz;
    var mx = (ax + bx) / 2, mz = (az + bz) / 2;
    var nx = mx - (ch.cx + ox), nz = mz - (ch.cz + oz);
    var nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    var ux = nz, uz = -nx;
    var ex = bx - ax, ez = bz - az;
    if (ex * ux + ez * uz < 0) { var tx2 = ax; ax = bx; bx = tx2; var tz2 = az; az = bz; bz = tz2; }

    var videoW = Math.min(Math.max(ch.len * 0.84, 6), 30);
    var videoH = videoW * 9 / 16;
    if (videoH > h * 0.5) { videoH = h * 0.5; videoW = videoH * 16 / 9; }
    var labelH = Math.min(Math.max(videoH * 0.18, 0.7), 1.5);
    var pad = 0.3;
    var panelW = videoW + pad * 2, panelH = videoH + labelH + pad * 2;
    var topY = h - Math.max(1.0, h * 0.05); /* anchored to record h; the globe shader drops it to hv at the nearest wall point */
    var panelCy = topY - panelH / 2;

    var group = new THREE.Group();
    var frame = makeQuad(mx, panelCy, mz, ux, uz, panelW, panelH, nx, nz, 0.14,
      new THREE.MeshBasicMaterial({ color: 0x11151b, side: THREE.FrontSide }));
    group.add(frame);

    /* label strip: its own canvas texture (canvas => survives espilP1Hide) */
    var lc = document.createElement('canvas'); lc.width = 1024; lc.height = 96;
    var lctx = lc.getContext('2d');
    lctx.fillStyle = '#0d0f12'; lctx.fillRect(0, 0, 1024, 96);
    lctx.fillStyle = '#ffd94d'; lctx.font = 'bold 52px sans-serif'; lctx.textAlign = 'left';
    lctx.fillText('광고', 28, 66);
    lctx.fillStyle = '#e8edf2'; lctx.font = '40px sans-serif';
    lctx.fillText('AD' + (cfg.advertiser ? ' · ' + cfg.advertiser : ''), 170, 64);
    var labelTex = new THREE.CanvasTexture(lc);
    var label = makeQuad(mx, topY - labelH / 2, mz, ux, uz, panelW, labelH, nx, nz, 0.2,
      new THREE.MeshBasicMaterial({ map: labelTex, side: THREE.FrontSide }));
    group.add(label);

    /* video/poster plane: canvas machine */
    face.canvas = document.createElement('canvas');
    face.canvas.width = CANVAS_W; face.canvas.height = CANVAS_H;
    face.ctx = face.canvas.getContext('2d');
    face.tex = new THREE.CanvasTexture(face.canvas);
    var videoMesh = makeQuad(mx, topY - labelH - videoH / 2, mz, ux, uz, videoW, videoH, nx, nz, 0.2,
      new THREE.MeshBasicMaterial({ map: face.tex, side: THREE.FrontSide }));
    group.add(videoMesh);

    face.group = group;
    face.mx = mx; face.mz = mz; face.topY = topY;
    face.advertiser = cfg.advertiser || '';
    drawSlate(face);
    if (cfg.posterUrl) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { face.posterOk = true; face.posterImg = img; if (face.mode !== 'playing') { face.mode = 'poster'; drawPoster(face); } };
      img.onerror = function () { face.posterOk = false; if (face.mode !== 'playing') drawSlate(face); };
      img.src = cfg.posterUrl;
    }
    S.scene.add(group);
  }

  /* ---------- video control ---------- */
  function ensureVideo(face, cfg) {
    if (face.video || face.videoError) return;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.src = cfg.videoUrl;
    v.addEventListener('canplay', function () { face.videoReady = true; });
    v.addEventListener('error', function () {
      face.videoError = true; face.mode = 'poster';
      if (face.posterOk) drawPoster(face); else drawSlate(face);
    }, true);
    face.video = v;
  }

  function nearestRingDist(face, px, pz) {
    var ring = face.chosen.ring, ox = face.ox, oz = face.oz;
    var best = Infinity;
    for (var j = 0; j < ring.length; j++) {
      var a = ring[j], c = ring[(j + 1) % ring.length];
      var d = segDist(px, pz, a[0] + ox, a[1] + oz, c[0] + ox, c[1] + oz);
      if (d < best) best = d;
    }
    return best;
  }

  function tick() {
    if (!S.armed) return;
    var pose = playerPose();
    if (!pose) return;
    var px = pose.x, pz = pose.z;
    var ditherIds = [];
    try {
      var ds = window.__espilDitherState && window.__espilDitherState();
      if (ds && ds.extrusion && ds.extrusion.occluders) ditherIds = ds.extrusion.occluders;
    } catch (e) {}
    var zoom = 20;
    try { var m = window.__espilMapObj && window.__espilMapObj(); if (m && m.getZoom) zoom = m.getZoom(); } catch (e) {}

    var k = 0.0006, cap = 260;
    try { var gv = window.__espilGlobeView && window.__espilGlobeView.state(); if (gv) { k = gv.k; cap = gv.cap; } } catch (e) {}
    for (var pi = 0; pi < S.faces.length; pi++) {
      var pf = S.faces[pi];
      pf.dist = Math.hypot(pf.mx - px, pf.mz - pz);
      pf.ringDist = nearestRingDist(pf, px, pz);
      /* rendered height at this face right now, by the shared law */
      pf.hvNow = Math.max(0, pf.building.h - Math.min(k * pf.ringDist * pf.ringDist, cap));
    }
    var ranked = S.faces.slice().sort(function (a, b) { return a.dist - b.dist; });
    var playSlots = ESPIL_BILLBOARD_MAX_PLAYING;
    for (var ri = 0; ri < ranked.length; ri++) {
      var f = ranked[ri];
      var occluded = ditherIds.indexOf(f.i) >= 0;
      var lodFlat = zoom < 17.5 && f.dist > 550 && f.building.h < 22 && f.chosen.area < 1200;
      f.group.visible = !occluded && !lodFlat && !f.offsetBad;
      f.ditherHidden = occluded;

      if (f.dist <= ESPIL_BILLBOARD_PRELOAD_M) ensureVideo(f, f.cfg);
      var wantPlay = f.group.visible && !document.hidden && f.dist <= ESPIL_BILLBOARD_GATE_M &&
                     f.video && f.videoReady && !f.videoError && playSlots > 0;
      if (wantPlay) playSlots--;
      if (wantPlay) {
        if (f.video.paused) {
          var p = f.video.play();
          if (p && p.catch) p.catch(function () { f.videoError = true; });
          if (!f.counted) { f.counted = true; f.starts++; beacon(f, 'start'); }
        }
        f.mode = 'playing';
      } else {
        if (f.video && !f.video.paused) f.video.pause();
        if (f.dist > ESPIL_BILLBOARD_GATE_M) f.counted = false; /* re-arm the start count outside the gate */
        var sm = f.posterOk ? 'poster' : 'slate';
        if (f.mode !== sm) {
          f.mode = sm;
          if (f.posterOk) drawPoster(f); else drawSlate(f);
        }
      }
    }
  }

  function drawLoop() {
    requestAnimationFrame(drawLoop);
    for (var i = 0; i < S.faces.length; i++) {
      var f = S.faces[i];
      if (f.mode === 'playing' && f.video && !f.video.paused && f.video.readyState >= 2) {
        f.ctx.drawImage(f.video, 0, 0, CANVAS_W, CANVAS_H);
        f.tex.needsUpdate = true;
        var ct = f.video.currentTime;
        if (f.lastT !== undefined && ct < f.lastT - 0.5 && f.counted) beacon(f, 'loop');
        f.lastT = ct;
      }
    }
  }

  /* ---------- init ---------- */
  function init() {
    var city = 'vancouver';
    try {
      if (typeof window.__espilCityKey === 'string' && window.__espilCityKey) city = window.__espilCityKey;
      else if (window.__espilLastArrival && window.__espilLastArrival.city) city = window.__espilLastArrival.city;
    } catch (e) {}
    S.city = city;
    S.scene = sceneRoot();
    if (!S.scene) return;

    S.debug.districtUrl = districtUrl(city);
    fetch(S.debug.districtUrl).then(function (r) { S.debug.districtStatus = r.status; return r.text(); }).then(function (text) {
      S.districtHash = fnv1a(text);
      S.debug.districtLen = text.length;
      var district = JSON.parse(text);
      return fetch(apiBase() + '/billboards/' + city).then(function (r) {
        S.debug.configStatus = r.status;
        if (!r.ok) throw new Error('config ' + r.status);
        return r.json();
      }).then(function (config) {
        S.debug.configHash = config ? config.districtHash : null;
        if (!config || config.districtHash !== S.districtHash) {
          S.configOk = false; S.configVersion = config ? config.version : null;
          return; /* hash mismatch: fail dark rather than point ads at wrong buildings */
        }
        /* The world offset (ox, oz) is config data (the city's entry
           in the monolith's ESPIL_CITIES table), guarded like every
           other field by the district hash + per-face signatures.
           The monolith's baked-centroid cache would be an in-client
           source, but it builds only when the Mapbox buildings
           source is added, which can trail the dive by minutes -
           so it is used as an OPPORTUNISTIC cross-check instead:
           if it ever appears and disagrees with the config offset
           for an assigned face, that face hides (see verifyOffset). */
        if (!config.offset || typeof config.offset[0] !== 'number') { S.configOk = false; S.debug.fail = 'no-offset'; return; }
        proceed(district, config);
      });
    }).catch(function (err) { S.configOk = false; S.debug.error = String(err && err.message || err); /* dark is a valid state */ });
  }

  function proceed(district, config) {
        var roadSegs = [];
        var roads = district.roads || [];
        for (var ri = 0; ri < roads.length; ri++) {
          var rp = roads[ri].p || [];
          for (var rj = 0; rj < rp.length - 1; rj++) roadSegs.push([rp[rj][0], rp[rj][1], rp[rj + 1][0], rp[rj + 1][1]]);
        }
        /* feature index by the monolith's own skip rules */
        var byIndex = {}, localCents = {}, fi = -1;
        var blds = district.buildings || [];
        for (var bi = 0; bi < blds.length; bi++) {
          var b = blds[bi];
          if (!b || b.w || !b.p || b.p.length < 3) continue;
          var dring = dedupeRing(b.p);
          if (dring.length < 3) continue;
          fi++;
          byIndex[fi] = b;
          var ccx = 0, ccz = 0;
          for (var cj = 0; cj < dring.length; cj++) { ccx += dring[cj][0]; ccz += dring[cj][1]; }
          localCents[fi] = [ccx / dring.length, ccz / dring.length];
        }
        var ox = config.offset[0], oz = config.offset[1];
        S.localCents = localCents;
        S.configOk = true; S.configVersion = config.version;
        var facesCfg = config.faces || {};
        Object.keys(facesCfg).forEach(function (key) {
          var i = parseInt(key, 10);
          var b = byIndex[i];
          var fc = facesCfg[key];
          if (!b || !fc || !fc.videoUrl) return;
          if (!((b.h || 0) >= ESPIL_BILLBOARD_MIN_H)) return;      /* config cannot force an ineligible building */
          var ring = dedupeRing(b.p);
          if (fc.sig && fc.sig !== ringSig(ring)) return;          /* assignment drifted: fail safe */
          var chosen = chooseFace(b, roadSegs);
          if (!chosen) return;
          var face = {
            i: i, building: b, chosen: chosen, cfg: fc, ox: ox, oz: oz,
            dist: Infinity, ringDist: Infinity, hvNow: b.h, mode: 'slate',
            video: null, videoReady: false, videoError: false,
            posterOk: false, counted: false, starts: 0, ditherHidden: false
          };
          buildFace(face, fc, ox, oz);
          S.faces.push(face);
        });
        S.armed = S.faces.length > 0;
        S.startedAt = Date.now();
        if (S.armed) {
          setInterval(tick, ESPIL_BILLBOARD_TICK_MS);
          requestAnimationFrame(drawLoop);
          document.addEventListener('visibilitychange', function () { tick(); });
          verifyOffset();
        }
  }

  /* Opportunistic cross-check: when the monolith's baked-centroid
     cache appears, every assigned face's world centroid must match
     local centroid + config offset; a mismatch hides that face. */
  function verifyOffset() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var cents = null;
      try { cents = window.__espilBakedBuildingCents && window.__espilBakedBuildingCents(); } catch (e) {}
      if (cents && cents.length) {
        clearInterval(iv);
        S.debug.cents = cents.length;
        S.debug.offsetVerified = true;
        for (var fi2 = 0; fi2 < S.faces.length; fi2++) {
          var f = S.faces[fi2], lc = S.localCents[f.i];
          if (!lc || !cents[f.i] ||
              Math.abs(cents[f.i][0] - (lc[0] + f.ox)) > 1 ||
              Math.abs(cents[f.i][1] - (lc[1] + f.oz)) > 1) {
            f.offsetBad = true;
            if (f.group) f.group.visible = false;
            S.debug['offsetBad_' + f.i] = true;
          }
        }
      } else if (tries >= 30) {
        clearInterval(iv);
        S.debug.offsetVerified = false; /* cache never appeared this session; hash+sig guards stand */
      }
    }, 10000);
  }

  var bootTimer = setInterval(function () {
    try {
      if (document.body && document.body.classList.contains('in-map') &&
          playerPose() && sceneRoot()) {
        clearInterval(bootTimer);
        init();
      }
    } catch (e) { /* keep waiting for the world */ }
  }, 500);

  /* Debug accessor (verification only): per-face video element
     vitals + a pixel sample of the face canvas, so a probe can
     tell poster pixels from video pixels without a screenshot. */
  window.__espilBillboardDebug = function () {
    return S.faces.map(function (f) {
      var px = null;
      try {
        var d = f.ctx.getImageData(320, 180, 1, 1).data;
        var d2 = f.ctx.getImageData(60, 60, 1, 1).data;
        px = [d[0], d[1], d[2], d2[0], d2[1], d2[2]];
      } catch (e) { px = 'tainted'; }
      return {
        i: f.i, mode: f.mode,
        video: f.video ? {
          t: Math.round(f.video.currentTime * 100) / 100,
          rs: f.video.readyState, paused: f.video.paused,
          w: f.video.videoWidth, h: f.video.videoHeight,
          err: f.video.error ? f.video.error.code : null
        } : null,
        px: px
      };
    });
  };

  window.__espilBillboardState = function () {
    return {
      armed: S.armed, city: S.city, configOk: S.configOk, configVersion: S.configVersion,
      districtHash: S.districtHash, beaconsSent: S.beaconsSent, debug: S.debug,
      constants: {
        ESPIL_BILLBOARD_MIN_H: ESPIL_BILLBOARD_MIN_H,
        ESPIL_BILLBOARD_GATE_M: ESPIL_BILLBOARD_GATE_M,
        ESPIL_BILLBOARD_PRELOAD_M: ESPIL_BILLBOARD_PRELOAD_M,
        ESPIL_BILLBOARD_MAX_PLAYING: ESPIL_BILLBOARD_MAX_PLAYING
      },
      faces: S.faces.map(function (f) {
        return {
          i: f.i, h: f.building.h, hvNow: Math.round(f.hvNow * 100) / 100,
          mx: Math.round(f.mx * 10) / 10, mz: Math.round(f.mz * 10) / 10,
          topY: Math.round((f.topY || f.building.h) * 10) / 10,
          edgeLen: Math.round(f.chosen.len * 10) / 10, road: !f.chosen.roadFallback,
          dist: Math.round(f.dist * 10) / 10, mode: f.mode,
          playing: !!(f.video && !f.video.paused), videoReady: f.videoReady,
          videoError: f.videoError, posterOk: f.posterOk, starts: f.starts,
          visible: !!(f.group && f.group.visible), ditherHidden: f.ditherHidden
        };
      })
    };
  };
})();
