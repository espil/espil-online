
/* __espilBakedPlaces v1
   Baked building data (Han 2026-10-29): building names, street
   addresses and the stores inside each building, joined at build
   time from Overture Maps Places + OpenStreetMap and shipped as
   assets/osm/<city>_places.json. No Google Places and no runtime
   API cost. The file loads lazily on first use - it is never part
   of the entry loading gate - and the browser caches it per city.
   A city without a baked file resolves null, and callers fall
   back to the live OSM lookup / an empty store list.
   Record shape: [cx, cz, w, d, name, addr, [[store, type], ...]]
   where (cx, cz, w, d) is the source polygon's bounding box,
   which is the AABB the runtime building records carry. */
(function () {
  'use strict';
  var cache = {};
  var stats = { calls: 0, hits: 0 };
  function cityKey() {
    try { return window.__espilCityKey || 'vancouver'; }
    catch (e) { return 'vancouver'; }
  }
  function load(city) {
    var c = cache[city];
    if (c) return c.promise;
    c = cache[city] = { status: 'loading', records: null, grid: {}, promise: null };
    c.promise = fetch('assets/osm/' + city + '_places.json')
      .then(function (r) { if (!r.ok) throw new Error('no bake'); return r.json(); })
      .then(function (doc) {
        c.records = (doc && doc.b) || [];
        c.status = 'ready';
        for (var i = 0; i < c.records.length; i++) {
          var rec = c.records[i];
          rec._i = i;
          var k = Math.floor(rec[0] / 60) + ',' + Math.floor(rec[1] / 60);
          (c.grid[k] = c.grid[k] || []).push(rec);
        }
        return c;
      })
      .catch(function () { c.status = 'absent'; c.records = []; return c; });
    return c.promise;
  }
  function match(c, b) {
    if (!c.records || !c.records.length) return null;
    var gx = Math.floor(b.x / 60), gz = Math.floor(b.z / 60);
    var best = null, bestScore = 1e9;
    for (var ix = gx - 2; ix <= gx + 2; ix++) {
      for (var iz = gz - 2; iz <= gz + 2; iz++) {
        var cell = c.grid[ix + ',' + iz];
        if (!cell) continue;
        for (var j = 0; j < cell.length; j++) {
          var rec = cell[j];
          var dx = b.x - rec[0], dz = b.z - rec[1];
          var dist = Math.sqrt(dx * dx + dz * dz);
          var score = -1;
          if (b.w && b.d && Math.abs(dx) <= 3 && Math.abs(dz) <= 3 &&
              Math.abs(b.w - rec[2]) <= 5 && Math.abs(b.d - rec[3]) <= 5) {
            score = dist;                    /* AABB fingerprint */
          } else if (Math.abs(dx) <= rec[2] / 2 + 3 && Math.abs(dz) <= rec[3] / 2 + 3) {
            /* Point inside the footprint: adjacent strips overlap,
               so the winner is the record the point sits deepest
               in (largest margin to its edges), not the nearest
               centre - a door point hugs its own building's edge. */
            var mx = rec[2] / 2 + 3 - Math.abs(dx);
            var mz = rec[3] / 2 + 3 - Math.abs(dz);
            score = 100 - Math.min(mx, mz) + dist * 0.001;
          } else if (dist <= 15) {
            score = 200 + dist;              /* nearest centre */
          }
          if (score >= 0 && score < bestScore) { bestScore = score; best = rec; }
        }
      }
    }
    return best;
  }
  function shape(rec) {
    if (!rec) return null;
    var stores = [];
    var list = rec[6] || [];
    for (var j = 0; j < list.length; j++) {
      stores.push({ id: 'baked:' + rec._i + ':' + j, name: list[j][0],
                    type: list[j][1] || '', address: rec[5] || '',
                    rating: 0, ratingCount: 0 });
    }
    return { name: rec[4] || null, addr: rec[5] || null, stores: stores };
  }
  window.__espilBakedFor = function (b) {
    stats.calls++;
    return load(cityKey()).then(function (c) {
      var rec = (c.status === 'ready') ? match(c, b) : null;
      if (rec) stats.hits++;
      return shape(rec);
    });
  };
  window.__espilBakedDetail = function (id) {
    return load(cityKey()).then(function (c) {
      if (c.status !== 'ready' || !id) return null;
      var m = /^baked:(\d+):(\d+)$/.exec(String(id));
      if (!m) return null;
      var rec = c.records[Number(m[1])];
      if (!rec || !rec[6] || !rec[6][Number(m[2])]) return null;
      var s = rec[6][Number(m[2])];
      return { displayName: { text: s[0] }, primaryType: s[1] || '',
               formattedAddress: rec[5] || '' };
    });
  };
  window.__espilBakedPlacesState = function () {
    var city = cityKey();
    var c = cache[city];
    return { city: city, status: c ? c.status : 'idle',
             records: c && c.records ? c.records.length : 0,
             calls: stats.calls, hits: stats.hits };
  };
})();

