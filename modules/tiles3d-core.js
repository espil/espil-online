/* __espilTiles3dCore v1 - Google Photorealistic 3D Tiles, HEAVY core.
   Loaded ONLY by modules/tiles3d.js after the session decision came
   back tilesEnabled:true (never on the landing path, never for a
   denied / gated / failed session). All renderer bytes live under
   ./tiles3d/vendor/ and are resolved through the page import map
   (see ../patches/importmap.snippet.html - the prototype's map,
   rebased).
   RENDERING SHAPE (the pair's facts drive this):
   - The pair page runs TWO three builds: its own global UMD three
     (the game) and this module's vendored ES three 0.186 (the tiles).
     They must never share a scene graph. So the tiles render in
     their OWN Mapbox custom layer, with their OWN renderer over the
     map's shared WebGL context - the exact pattern the pair's game
     layer already uses (espilP1GameLayer) - depth-tested against the
     map and the game layer, autoClear off, state reset after draw.
   - Frame: ReorientationPlugin at the pair anchor (Vancouver
     49.2827, -123.1207 - the same value as the pair's own anchor
     table and the boundary file's anchor metadata), lat/lon in
     RADIANS, azimuth PI: tile-local east -> +X, north -> -Z, up ->
     +Y, i.e. pair world metres. The draw then applies the pair's
     Mercator bridge (T(anchor) x S(s,-s,s) x Rx(90deg), Vancouver
     offset 0) so the tiles land in the pair's Mapbox projection -
     the pair anchor math is the single source; tiles conform to it,
     never the reverse. Rig landmark verification (Art Gallery,
     Konbiniya footprint) is Phase 2, gate item (frame alignment).
   - NO globe bend (the pair is flat; the prototype's bend is
     prototype-only, settled in scope section D). NO sight-line fade
     (production occlusion is the camera clamp on baked records;
     joint decision, scope section E). Tiles are DISPLAY ONLY: no
     IDs, no collision, no entry data ever read from them.
   GATES (per frame, cheap): downtown boundary polygon from the
   in-tree canonical tiles/downtown-boundary.json (72 vertices, x/z
   in pair world metres) with the prototype's 1.1x hysteresis band,
   plus the altitude gate (on below ~800 m camera height, off above
   ~950 m). Boundary file missing -> prototype radius fallback
   (1500 m on / 1700 m off from the anchor). Distance fade ~1.6 km
   via module-scene fog (500 -> 1600 m, prototype law); FADE_COLOR is
   a Phase-2 visual-tuning constant against the real pair scene.
   DOUBLE-BUILDING TOGGLE (Architecture's 3 refinements, binding):
   (1) suppression follows the session's ACTUAL tile state - baked
       meshes are suppressed only while tiles are really on/loaded in
       this session, and restored IMMEDIATELY when tiles drop
       (gate exit, load error, teardown);
   (2) boundary buildings are judged binary by footprint CENTRE -
       the pair's own baked centroid table (feature property i is
       index-aligned with it); centre inside the polygon -> the
       feature is filtered out of the VISUAL layer only;
   (3) the collision layer ('espil-buildings-collision'), the shared
       GeoJSON source, labels, entry and the camera clamp are never
       touched - only map.setFilter on 'espil-buildings-3d'.
   Phase-2 monolith hooks consumed (see ../patches/monolith-hooks.md):
   window.__espilMapObj() and window.__espilBakedBuildingCents().
   Until they exist the core reports suppression:'no-hook' and the
   tiles still render - the Phase-2 probe asserts the hook path.
   STREAMED-BYTES METER (map room method, metering-fix-prepared
   2026-10-15): tile responses are chunked with no content-length, so
   the header sum reads 0; instead the response body stream is
   CLONED and real bytes are counted off the clone. Installed only
   while this core runs (off/denied sessions carry no wrap). Read it
   via __espilTilesState().core.streamedBytes.
   Attribution: shown only while tiles are on (licence boundary). */

import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { ReorientationPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

var ANCHOR = { lat: 49.2827, lng: -123.1207 }; /* pair anchor (Vancouver) */
var SSE_DEFAULT = 16;      /* Han's PC reference run: 45 FPS at SSE 16 */
var SSE_FLOOR = 8;         /* streaming cap: errorTarget never below this */
var ALT_ON = 800, ALT_OFF = 950;         /* altitude gate hysteresis (m) */
var RANGE_ON = 1500, RANGE_OFF = 1700;   /* radius fallback (m) */
var FADE_NEAR = 500, FADE_FAR = 1600;    /* ~1.6 km distance fade */
var FADE_COLOR = 0xdfe9f2; /* pale haze - PHASE-2 TUNING against the real scene */
var VENDOR = './modules/tiles3d/vendor/three/addons/libs/';
var BOUNDARY_URL = 'tiles/downtown-boundary.json'; /* in-tree canonical */

var state = {
  started: false, on: false, failed: false, layerLive: false, mapHook: false,
  tilesetLoaded: false, firstTileAtMs: null, error: null,
  gate: null,              /* 'boundary' | 'radius' | null */
  inside: false, altOk: false,
  suppression: 'off',      /* off | on | no-hook | error */
  suppressedCount: 0,
  streamedBytes: 0, streamedMB: 0,
  attributions: []
};

var tiles = null, scene = null, renderer = null, map = null, ktx2Loader = null;
var lodCam = null, renderCam = null, layer = null;
var boundaryPoly = null, boundaryWide = null;
var session = null, toastFn = function () {};
var startedAt = 0, disposed = false;

window.__espilTilesCoreState = function () {
  var out = {};
  for (var k in state) out[k] = state[k];
  out.streamedMB = Math.round(state.streamedBytes / 104857.6) / 10;
  return out;
};

function pointInPoly(x, z, poly) {
  var inside = false;
  for (var i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    var xi = poly[i][0], zi = poly[i][1], xk = poly[k][0], zk = poly[k][1];
    if (((zi > z) !== (zk > z)) && (x < (xk - xi) * (z - zi) / (zk - zi) + xi)) inside = !inside;
  }
  return inside;
}

/* --- streamed-bytes meter (clone-body method; see header) --- */
var TILE_URL = /api\.cesium\.com|tile\.googleapis\.com|googleapis\.com\/v1|3dtiles/i;
function installByteMeter() {
  var origFetch = window.fetch.bind(window);
  window.fetch = async function () {
    var res = await origFetch.apply(null, arguments);
    try {
      var arg0 = arguments[0];
      var url = (typeof arg0 === 'string') ? arg0 : ((arg0 && arg0.url) || '');
      if (TILE_URL.test(url) && res.body) {
        var reader = res.clone().body.getReader();
        (async function () {
          try {
            for (;;) {
              var r = await reader.read();
              if (r.done) break;
              state.streamedBytes += r.value.byteLength;
            }
          } catch (e) { /* aborted clone: bytes counted so far stand */ }
        })();
      }
    } catch (e) {}
    return res;
  };
}

/* --- Mercator bridge: the pair's own placement law, recomputed --- */
function bridgeMatrix() {
  var mc = window.mapboxgl.MercatorCoordinate.fromLngLat({ lng: ANCHOR.lng, lat: ANCHOR.lat }, 0);
  var s = mc.meterInMercatorCoordinateUnits();
  return new THREE.Matrix4()
    .makeTranslation(mc.x, mc.y, mc.z)
    .scale(new THREE.Vector3(s, -s, s))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  /* Vancouver city offset is (0,0); offset cities are out of scope. */
}

function applySuppression() {
  var cents = null;
  try { cents = window.__espilBakedBuildingCents ? window.__espilBakedBuildingCents() : null; } catch (e) { cents = null; }
  if (!map || !cents || !boundaryPoly) { state.suppression = 'no-hook'; return; }
  var ids = [];
  for (var i = 0; i < cents.length; i++) {
    if (cents[i] && pointInPoly(cents[i][0], cents[i][1], boundaryPoly)) ids.push(i);
  }
  try {
    map.setFilter('espil-buildings-3d', ['!', ['in', ['get', 'i'], ['literal', ids]]]);
    state.suppressedCount = ids.length;
    state.suppression = 'on';
  } catch (e) { state.suppression = 'error'; }
}
function restoreSuppression() {
  if (map) { try { map.setFilter('espil-buildings-3d', null); } catch (e) {} }
  state.suppressedCount = 0;
  if (state.suppression === 'on') state.suppression = 'off';
}

var attribEl = null;
function setAttributionVisible(vis) {
  if (!attribEl) return;
  attribEl.style.display = vis ? 'block' : 'none';
}
function buildAttribution() {
  try {
    attribEl = document.createElement('div');
    attribEl.id = 'espil-tiles-attrib';
    attribEl.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:5;'
      + 'background:rgba(255,255,255,.88);color:#222;font:11px/1.5 system-ui,sans-serif;'
      + 'padding:2px 10px;display:none;pointer-events:none;';
    var items = [];
    var fromRenderer = (tiles && tiles.attributions && tiles.attributions.length)
      ? tiles.attributions : null;
    var src = fromRenderer || state.attributions || [];
    for (var i = 0; i < src.length; i++) {
      var a = src[i];
      items.push(typeof a === 'string' ? a : (a && a.html) || '');
    }
    attribEl.innerHTML = '<span>Data: </span>' + items.filter(Boolean).join(' ');
    document.body.appendChild(attribEl);
  } catch (e) {}
}

function setTilesOn(on, reason) {
  if (disposed) return;
  if (on && state.failed) on = false; /* a failed session never revives */
  if (state.on === on) return;
  state.on = on;
  if (tiles) tiles.group.visible = on;
  if (on) {
    if (state.tilesetLoaded) applySuppression();
    buildAttribution();
    setAttributionVisible(true);
  } else {
    restoreSuppression();           /* immediate restore (refinement 1) */
    setAttributionVisible(false);
    if (reason) state.error = state.error || reason;
  }
}

function stopTiles(reason) {
  /* Mid-session tile failure (scope section C): stop tiles at once,
     one small toast, base map continues. Suppression restores via
     setTilesOn(false). No retry - retry storms burn quota. */
  state.failed = true;
  setTilesOn(false, reason);
  toastFn('3D tiles unavailable - showing the regular city.', 'tiles-error');
}

function syncLodCamera(cv) {
  var src = null;
  try { src = window.__espilMapCameraObj ? window.__espilMapCameraObj() : null; } catch (e) { src = null; }
  if (src && src.position) {
    lodCam.position.set(src.position.x, src.position.y, src.position.z);
    if (src.quaternion) lodCam.quaternion.set(src.quaternion.x, src.quaternion.y, src.quaternion.z, src.quaternion.w);
    if (typeof src.fov === 'number') lodCam.fov = src.fov;
    if (typeof src.near === 'number') lodCam.near = src.near;
    if (typeof src.far === 'number') lodCam.far = src.far;
  }
  if (cv && cv.width && cv.height) lodCam.aspect = cv.width / cv.height;
  lodCam.updateProjectionMatrix();
  lodCam.updateMatrixWorld();
}

function evaluateGate() {
  var pose = null;
  try { pose = window.__espilPlayerPose ? window.__espilPlayerPose() : null; } catch (e) { pose = null; }
  if (!pose) return;
  var camH = lodCam ? lodCam.position.y : pose.y;
  if (state.on) { if (camH > ALT_OFF) state.altOk = false; }
  else if (camH < ALT_ON) state.altOk = true;
  var inside;
  if (boundaryPoly) {
    state.gate = 'boundary';
    inside = state.on
      ? (pointInPoly(pose.x, pose.z, boundaryPoly) || pointInPoly(pose.x, pose.z, boundaryWide))
      : pointInPoly(pose.x, pose.z, boundaryPoly);
  } else {
    state.gate = 'radius';
    var d = Math.sqrt(pose.x * pose.x + pose.z * pose.z);
    inside = state.on ? (d < RANGE_OFF) : (d < RANGE_ON);
  }
  state.inside = !!inside;
  setTilesOn(!!(inside && state.altOk && state.tilesetLoaded !== false), null);
}

function makeLayer() {
  return {
    id: 'espil-tiles3d-layer', type: 'custom', renderingMode: '3d',
    onAdd: function (m, gl) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: false, alpha: true });
      } catch (e) { renderer = null; return; }
      renderer.autoClear = false;
      renderer.autoClearColor = false;
      renderer.autoClearDepth = false;
      renderer.autoClearStencil = false;
      if (ktx2Loader) { try { ktx2Loader.detectSupport(renderer); } catch (e) {} }
      state.layerLive = true;
    },
    render: function (gl, matrix) {
      if (!renderer || !tiles || disposed) return;
      var cv = map.getCanvas();
      if (renderer.domElement.width !== cv.width || renderer.domElement.height !== cv.height) {
        try { renderer.setSize(cv.width, cv.height, false); } catch (e) {}
        try { tiles.setResolutionFromRenderer(lodCam, renderer); } catch (e) {}
      }
      syncLodCamera(cv);
      evaluateGate();
      if (state.on) {
        try { tiles.update(); } catch (e) {}
        renderCam.projectionMatrix.copy(new THREE.Matrix4().fromArray(matrix)).multiply(bridgeMatrix());
        renderCam.updateMatrixWorld();
        try { renderer.render(scene, renderCam); } catch (e) {}
      }
      try { renderer.state.reset(); } catch (e) {}
    },
    onRemove: function () { state.layerLive = false; }
  };
}

export function start(sess, opts) {
  if (state.started) return;
  state.started = true;
  session = sess || {};
  if (opts && typeof opts.toast === 'function') toastFn = opts.toast;
  startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
  state.attributions = session.attributions || [];
  installByteMeter();

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FADE_COLOR, FADE_NEAR, FADE_FAR);
  lodCam = new THREE.PerspectiveCamera(60, 1, 0.5, 6000);
  renderCam = new THREE.Camera();

  tiles = new TilesRenderer();
  (function configure(t) {
    t.rootURL = session.tilesetUrl;
    var key = null;
    try { key = new URL(session.tilesetUrl).searchParams.get('key'); } catch (e) { key = null; }
    if (key) t.registerPlugin(new GoogleCloudAuthPlugin({
      apiToken: key, autoRefreshToken: true, useRecommendedSettings: true
    }));
  })(tiles);
  tiles.registerPlugin(new ReorientationPlugin({
    /* RADIANS (prototype bug of record: degrees put the frame 11,509 km
       off). azimuth PI -> tile axes match the pair convention. */
    lat: ANCHOR.lat * Math.PI / 180,
    lon: ANCHOR.lng * Math.PI / 180,
    height: 0,
    azimuth: Math.PI
  }));
  var draco = new DRACOLoader();
  draco.setDecoderPath(VENDOR + 'draco/gltf/');
  var ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(VENDOR + 'basis/');
  ktx2Loader = ktx2; /* detectSupport runs in the layer's onAdd, once
                        the module renderer exists over the map GL */
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco, ktxLoader: ktx2 }));
  tiles.errorTarget = Math.max(SSE_DEFAULT, SSE_FLOOR);
  tiles.setCamera(lodCam);
  tiles.addEventListener('load-tile-set', function () {
    state.tilesetLoaded = true;
    if (state.on) { applySuppression(); buildAttribution(); }
  });
  tiles.addEventListener('load-model', function () {
    if (state.firstTileAtMs === null) {
      state.firstTileAtMs = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - startedAt);
    }
  });
  tiles.addEventListener('load-error', function () { stopTiles('load_error'); });
  scene.add(tiles.group);
  tiles.group.visible = false;

  fetch(BOUNDARY_URL).then(function (r) { return r.json(); }).then(function (j) {
    boundaryPoly = (j.vertices || []).map(function (v) { return [v.x, v.z]; });
    boundaryWide = boundaryPoly.map(function (p) { return [Math.round(p[0] * 1.1), Math.round(p[1] * 1.1)]; });
    state.gate = 'boundary';
  }).catch(function () { state.gate = 'radius'; });

  /* Map + layer attach: the map object arrives via the Phase-2
     monolith hook; poll for it (the map may still be initialising
     when the arrival seam fires). KTX2 support needs the renderer -
     detectSupport runs at first onAdd against the layer renderer. */
  var poll = setInterval(function () {
    if (disposed) { clearInterval(poll); return; }
    var city = null;
    try { city = window.__espilLoadedCityKey || null; } catch (e) { city = null; }
    if (city && city !== 'vancouver') { teardown(); clearInterval(poll); return; }
    if (map) return;
    var m = null;
    try { m = window.__espilMapObj ? window.__espilMapObj() : null; } catch (e) { m = null; }
    if (!m || !window.mapboxgl) return;
    map = m;
    state.mapHook = true;
    layer = makeLayer();
    var add = function () {
      try {
        if (!map.getLayer('espil-tiles3d-layer')) map.addLayer(layer);
      } catch (e) { state.error = 'layer_add_failed'; }
    };
    if (map.loaded && map.loaded()) add();
    else map.once('load', add);
  }, 500);
}

function teardown() {
  disposed = true;
  restoreSuppression();
  setAttributionVisible(false);
  if (attribEl) { try { attribEl.remove(); } catch (e) {} attribEl = null; }
  if (map && layer) { try { map.removeLayer('espil-tiles3d-layer'); } catch (e) {} }
  if (tiles) { try { tiles.dispose && tiles.dispose(); } catch (e) {} }
  state.on = false;
  state.layerLive = false;
}
