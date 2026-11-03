
/* __espilFastTrack v1 - Han's order (2026-10-28): the buses are gone;
   instead the roadways of Georgia, Burrard, Robson, Denman and Davie
   carry FAST TRACK tiles - stepping on one doubles the player's land
   speed (the walk code multiplies by window.__espilSpeedBoost).
   Vancouver only. The strips are flat ribbons laid on the road
   surface along street centrelines surveyed in world coordinates
   against the game's own collision grid (perpendicular walkable-run
   centres, rig probe_fit3, 2026-10-28); the boost test is a
   point-to-segment distance check on the player's position. */
(function(){
  'use strict';
  if (window.__espilFastTrack) return;
  var STREETS = [
    { id: 'georgia', pts: [[-1156,-1074],[-1098,-1004],[-1036,-941],[-967,-884],[-895,-833],[-824,-779],[-755,-724],[-684,-671],[-617,-613],[-555,-549],[-485,-493],[-405,-452],[-330,-403],[-267,-341],[-198,-288],[-120,-247],[-38,-214],[44,-180],[128,-150],[217,-133],[298,-97],[360,-35],[401,39],[420,129],[429,223],[470,295],[543,327],[627,336],[714,347],[799,377],[887,388],[978,376],[1065,391],[1150,415],[1238,428],[1324,444],[1411,459],[1500,460]] },
    { id: 'burrard', pts: [[-69,-698],[-94,-614],[-114,-528],[-135,-442],[-173,-361],[-200,-278],[-198,-188],[-193,-99],[-201,-14],[-213,71],[-237,154],[-263,236],[-266,323],[-273,410],[-286,495],[-294,581],[-308,666],[-324,750],[-329,835],[-334,923],[-357,1014],[-361,1103],[-334,1191],[-315,1279],[-309,1368],[-303,1457],[-283,1544],[-235,1631]] },
    { id: 'robson',  pts: [[-906,-827],[-850,-750],[-781,-687],[-712,-623],[-647,-554],[-584,-484],[-516,-420],[-446,-358],[-380,-292],[-314,-226],[-248,-160],[-175,-100],[-90,-47],[-22,18],[24,93],[79,163],[146,231],[212,300],[276,371],[340,442],[403,513],[467,583]] },
    { id: 'denman',  pts: [[-1152,-1061],[-1151,-977],[-1149,-893],[-1133,-812],[-1101,-734],[-1086,-654],[-1104,-567],[-1113,-476],[-1107,-387],[-1119,-298],[-1140,-211],[-1142,-122],[-1145,-33],[-1166,54],[-1185,141],[-1200,229],[-1217,316],[-1221,406],[-1230,495],[-1252,581],[-1272,672],[-1302,769],[-1343,868]] },
    { id: 'davie',   pts: [[-1260,670],[-1173,683],[-1086,695],[-998,693],[-910,685],[-822,678],[-735,686],[-648,706],[-560,702],[-472,696],[-385,706],[-297,711],[-211,724],[-124,748],[-36,755],[50,768],[129,813],[211,847],[299,861],[382,888],[465,914],[551,927],[637,937],[723,948],[806,972],[888,998],[972,1018],[1056,1038],[1140,1058]] }
  ];
  var SEGS = [];
  STREETS.forEach(function(st){
    for (var i = 0; i + 1 < st.pts.length; i++){
      SEGS.push({ id: st.id, ax: st.pts[i][0], az: st.pts[i][1], bx: st.pts[i + 1][0], bz: st.pts[i + 1][1] });
    }
  });
  var WIDTH = 3.4, REACH = 1.9, Y = 0.07;
  var builtScene = null, mat = null, onStreet = null, hinted = false;
  var HINT = { en: 'Fast track - speed x2', ko: '패스트 트랙 - 속도 2배', fr: 'Voie rapide - vitesse x2', zh: '快速车道 - 速度 x2' };
  function lang(){ try { return (window.__espilLang && window.__espilLang()) || 'en'; } catch(e){ return 'en'; } }
  function makeTexture(){
    var c = document.createElement('canvas'); c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(7,34,38,0.80)'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(245,197,66,0.95)';
    g.fillRect(0, 0, 128, 5); g.fillRect(0, 123, 128, 5);
    g.strokeStyle = 'rgba(245,197,66,0.95)'; g.lineWidth = 11; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(38, 30); g.lineTo(82, 64); g.lineTo(38, 98); g.stroke();
    g.globalAlpha = 0.55;
    g.beginPath(); g.moveTo(66, 30); g.lineTo(110, 64); g.lineTo(66, 98); g.stroke();
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  function build(scene){
    mat = new THREE.MeshBasicMaterial({ map: makeTexture(), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: true });
    SEGS.forEach(function(s){
      var dx = s.bx - s.ax, dz = s.bz - s.az;
      var len = Math.hypot(dx, dz); if (len < 1) return;
      var ux = dx / len, uz = dz / len, px = -uz, pz = ux, hw = WIDTH / 2;
      var y = Y;
      var v = new Float32Array([
        s.ax + px * hw, y, s.az + pz * hw,   s.ax - px * hw, y, s.az - pz * hw,
        s.bx - px * hw, y, s.bz - pz * hw,   s.bx + px * hw, y, s.bz + pz * hw ]);
      var uv = new Float32Array([0, 0, 0, 1, len / 7, 1, len / 7, 0]);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 1; mesh.frustumCulled = false;
      scene.add(mesh);
    });
    builtScene = scene;
  }
  function segDist2(px, pz, s){
    var dx = s.bx - s.ax, dz = s.bz - s.az;
    var L2 = dx * dx + dz * dz || 1;
    var t = ((px - s.ax) * dx + (pz - s.az) * dz) / L2;
    t = Math.max(0, Math.min(1, t));
    var cx = s.ax + dx * t, cz = s.az + dz * t;
    var ex = px - cx, ez = pz - cz;
    return ex * ex + ez * ez;
  }
  function mapScene(){
    try { if (typeof window.__espilMapScene === 'function') return window.__espilMapScene(); } catch(e){}
    try {
      var dm = window.__espilDistrictMeshes;
      if (dm && dm.length && dm[0] && dm[0].parent) {
        var n = dm[0];
        while (n.parent) n = n.parent;
        return n;
      }
    } catch(e){}
    return null;
  }
  function inMap(){
    try { return document.body.classList.contains('in-map'); } catch(e){ return false; }
  }
  setInterval(function(){
    try {
      if (!inMap()) { window.__espilSpeedBoost = 1; onStreet = null; return; }
      var key = window.__espilCityKey;
      if (typeof key === 'function') { try { key = key(); } catch(e){ key = ''; } }
      key = String(key || '').toLowerCase();
      if (key && key.indexOf('vancouver') < 0) { window.__espilSpeedBoost = 1; onStreet = null; return; }
      var scene = mapScene();
      if (scene && scene !== builtScene && typeof THREE !== 'undefined') build(scene);
      var pose = window.__espilPlayerPose && window.__espilPlayerPose();
      if (!pose) return;
      var hit = null, best = REACH * REACH;
      for (var i = 0; i < SEGS.length; i++){
        var d2 = segDist2(pose.x, pose.z, SEGS[i]);
        if (d2 < best) { best = d2; hit = SEGS[i].id; }
      }
      onStreet = hit;
      window.__espilSpeedBoost = hit ? 2 : 1;
      if (mat) mat.opacity = hit ? 1 : 0.85;
      if (hit && !hinted) {
        hinted = true;
        if (typeof window.__espilToast === 'function') window.__espilToast(HINT[lang()] || HINT.en);
      }
    } catch(e) { /* the world may still be booting */ }
  }, 120);
  window.__espilFastTrackState = function(){
    return { on: !!onStreet, street: onStreet, boost: window.__espilSpeedBoost || 1, segments: SEGS.length, built: !!builtScene };
  };
  window.__espilFastTrack = true;
})();

