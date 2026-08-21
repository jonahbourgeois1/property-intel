/*!
 * nadir-geo.js — the ONE georeference for a parcel-fitted nadir.
 * Vyanet Property Intel · created 2026-08-21
 *
 * WHY THIS FILE EXISTS
 * Three pages convert between "percent of the nadir image" and lat/lng, and
 * as of 2026-08-21 they did NOT agree:
 *   element-review.html v6.2  makeProjector()   true Web Mercator      (correct)
 *   responder-intel.html v2.5.1 pixelToLatLng() flat metres-per-pixel  (WRONG)
 *   shared.gs                 pixelToLatLng()   same flat maths        (dead code)
 * The flat version divides by 110574 m/deg latitude, which is the meridional
 * degree at the EQUATOR. At lat 44 the true value is 111113, so it applies a
 * systematic 0.488% NORTH-SOUTH stretch, proportional to the footprint:
 *   z20 0.23 m · z19 0.46 m · z18 0.93 m · z17 1.86 m · z16 3.72 m
 * East-west was fine (111320*cos(lat) is right). So the responder viewer's pins
 * and its GroundOverlay bounds are both slightly stretched north-south today,
 * and the reviewer tool and the responder product disagree about where a pin is.
 *
 * THIS FILE IS THE SINGLE SOURCE. Include it in both pages and delete both
 * copies of pixelToLatLng. That is what makes placement identical everywhere and
 * at every zoom level.
 *
 * ZOOM INVARIANCE — the guarantee, stated plainly:
 * a pin's lat/lng is derived ONLY from the stored percentage and the nadir's own
 * centre/zoom/size (which are baked into the nadir URL). It does NOT depend on
 * the map camera. So the ground position is computed once and is the same at
 * every map zoom; the map's own projection then puts it on screen. There is no
 * per-zoom drift to correct, and no recomputation on zoom. Anything that DOES
 * drift with zoom is a symptom of positioning against a container instead of
 * against the projection — see the note on percentage positioning below.
 *
 * DELIBERATELY has no dependency on google.maps. Everything returns plain
 * {lat,lng} objects. That keeps it unit-testable in node, and makes the expected
 * move to EagleView imagery a basemap swap rather than a rewrite.
 *
 * ⚠️ PERCENTAGE POSITIONING IS ONLY VALID AGAINST THE PAINTED IMAGE.
 * element-review positions markers as left:x%/top:y% of #frame, and that works
 * only because #frame is exactly the painted nadir. On a map there is no such
 * container, so markers must be placed by projecting lat/lng — never by
 * percentage of the map div. Same failure fitFrame() documents about object-fit.
 */
(function (root) {
  'use strict';

  var EARTH_A = 6378137.0;              // WGS84 semi-major axis, metres
  var TILE    = 256;                    // Web Mercator tile size, px

  // ── The georeference, parsed from the nadir URL itself ────────────────────
  // A parcel-fitted Static Maps URL is self-describing: centre, zoom and size
  // are in its own query string, so nothing has to be stored in the sheet.
  //
  // ⭐ THE FLAGGED `scale=2` TRAP IS NOT A TRAP — AND ITS SUGGESTED FIX IS A BUG.
  // element-review v6.2 carries this comment above its own nadirGeo():
  //     "assumes scale=1 ... If buildParcelFittedNadirUrl ever adds scale=2,
  //      read it and divide"
  // Do NOT do that. In the Static Maps API `size=` IS the logical size, and
  // `scale` only multiplies the returned BITMAP dimensions — ground coverage is
  // identical. So `size=640x640&scale=2` covers exactly the same ground as
  // `size=640x640`, and the correct logical width is 640 in both cases.
  // Dividing by scale would shrink the assumed footprint by half and throw
  // every pin toward the centre. v6.2's existing maths was already right; the
  // warning was over-cautious and its remedy would have introduced the very
  // error it feared. `scale` is recorded here for information only and is
  // deliberately absent from every transform below.
  // (Caught by test-nadir-geo.mjs check 3 — the first cut of THIS file divided.)
  function nadirGeo(url) {
    url = String(url || '');
    var c  = /[?&]center=(-?[\d.]+),(-?[\d.]+)/.exec(url);
    var z  = /[?&]zoom=(\d+)/.exec(url);
    var sz = /[?&]size=(\d+)x(\d+)/.exec(url);
    var sc = /[?&]scale=(\d+)/.exec(url);
    if (!c || !z) return null;
    var scale = sc ? parseInt(sc[1], 10) : 1;
    if (!(scale >= 1)) scale = 1;
    return {
      lat:   parseFloat(c[1]),
      lng:   parseFloat(c[2]),
      zoom:  parseInt(z[1], 10),
      // LOGICAL size = the `size=` param, verbatim. Never divided by scale.
      w:     sz ? parseInt(sz[1], 10) : 640,
      h:     sz ? parseInt(sz[2], 10) : 640,
      scale: scale,          // informational; no transform reads this
      bitmapW: (sz ? parseInt(sz[1], 10) : 640) * scale,
      bitmapH: (sz ? parseInt(sz[2], 10) : 640) * scale
    };
  }

  function worldSize(zoom) { return TILE * Math.pow(2, zoom); }

  function worldX(lng, S) { return (lng + 180) / 360 * S; }
  function worldY(lat, S) {
    var s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * S;
  }

  // ── lat/lng -> percent. Behaviourally IDENTICAL to element-review v6.2's
  // makeProjector(), which is verified two ways in that file: the image centre
  // maps to exactly 50,50, and one metre-per-pixel step east lands exactly one
  // pixel right. Kept byte-compatible on purpose so this is a drop-in.
  function makeProjector(geo) {
    var S = worldSize(geo.zoom);
    var cx = worldX(geo.lng, S), cy = worldY(geo.lat, S);
    return function (lat, lng) {
      return {
        x: (geo.w / 2 + (worldX(lng, S) - cx)) / geo.w * 100,
        y: (geo.h / 2 + (worldY(lat, S) - cy)) / geo.h * 100
      };
    };
  }

  // ── percent -> lat/lng. The exact algebraic inverse of makeProjector.
  // Round-trips to 2.3e-9 % (about 2 nanometres) over zooms 16-20.
  function makeUnprojector(geo) {
    var S = worldSize(geo.zoom);
    var cx = worldX(geo.lng, S), cy = worldY(geo.lat, S);
    return function (xPct, yPct) {
      var X = cx + (Number(xPct) / 100 * geo.w - geo.w / 2);
      var Y = cy + (Number(yPct) / 100 * geo.h - geo.h / 2);
      return {
        lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / S))) * 180 / Math.PI,
        lng: X / S * 360 - 180
      };
    };
  }

  // ── The nadir's exact footprint, for a GroundOverlay ──────────────────────
  // Returns plain numbers; the caller wraps them in google.maps.LatLngBounds.
  // Replaces computeOverlayBounds() in responder-intel.html, which inherited
  // the 0.488% stretch from pixelToLatLng and so hung the overlay slightly
  // off the basemap.
  function nadirBounds(geo) {
    var inv = makeUnprojector(geo);
    var nw = inv(0, 0), se = inv(100, 100);
    return { north: nw.lat, south: se.lat, west: nw.lng, east: se.lng };
  }

  // ── The STORABLE box, which is not the image edge ─────────────────────────
  // clampCoords() in shared.gs clamps every stored coordinate to 5..95, so a
  // pin placed outside that band is silently moved. Anything enforcing where a
  // reviewer may place a pin has to know this box, not the picture's edge.
  function storableBox(geo, coordMin, coordMax) {
    var lo = (coordMin === undefined) ? 5  : coordMin;
    var hi = (coordMax === undefined) ? 95 : coordMax;
    var inv = makeUnprojector(geo);
    var nw = inv(lo, lo), se = inv(hi, hi);
    return { north: nw.lat, south: se.lat, west: nw.lng, east: se.lng,
             pctMin: lo, pctMax: hi };
  }

  // ── Local metric helpers (equirectangular about a reference latitude) ─────
  // Good to millimetres at parcel scale, and it keeps the geometry below in
  // plain planar maths instead of spherical trigonometry.
  function metresPerDegLat(lat) {
    var p = lat * Math.PI / 180;
    return 111132.954 - 559.822 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
  }
  function metresPerDegLng(lat) {
    return EARTH_A * Math.PI / 180 * Math.cos(lat * Math.PI / 180);
  }

  function distPointSegM(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var L2 = dx * dx + dy * dy;
    var t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var qx = ax + t * dx, qy = ay + t * dy;
    return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
  }

  // Ray casting. Accepts either [{lat,lng}] or GeoJSON [lng,lat] pairs.
  function normaliseRing(ring) {
    return (ring || []).map(function (v) {
      return Array.isArray(v) ? { lat: Number(v[1]), lng: Number(v[0]) }
                              : { lat: Number(v.lat), lng: Number(v.lng) };
    }).filter(function (v) { return isFinite(v.lat) && isFinite(v.lng); });
  }

  function ringContains(ring, lat, lng) {
    var inside = false, n = ring.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var yi = ring[i].lat, xi = ring[i].lng;
      var yj = ring[j].lat, xj = ring[j].lng;
      if ((yi > lat) !== (yj > lat) &&
          lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function ringDistanceM(ring, lat, lng) {
    var ref = ring[0].lat;
    var kx = metresPerDegLng(ref), ky = metresPerDegLat(ref);
    var px = lng * kx, py = lat * ky;
    var best = Infinity;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var d = distPointSegM(px, py,
                            ring[j].lng * kx, ring[j].lat * ky,
                            ring[i].lng * kx, ring[i].lat * ky);
      if (d < best) best = d;
    }
    return best;
  }

  // ── WHERE A REVIEWER MAY PLACE A PIN ─────────────────────────────────────
  // Decided 2026-08-21 (Jonah): "limit the range outside of the property lines.
  // It should be allowed to extend slightly to help account for roads or
  // important points in the extremities, but not full access to placing pins
  // wherever you want."
  //
  // So: the parcel polygon, grown by marginM metres, INTERSECTED with the
  // storable 5..95 box. The intersection is not optional — a point outside
  // 5..95 gets silently clamped by shared.gs, so allowing it would let a
  // reviewer place a gate and have the pipeline move it.
  //
  // Growing by distance-to-edge rather than offsetting the polygon is
  // deliberate: a true polygon offset needs mitre/round joins and self-
  // intersection handling, and gets it wrong on the concave lots that are
  // exactly where a driveway runs. "Within m metres of the lot" is the thing
  // actually meant, and it is exact for any polygon.
  //
  // No ring (outside Deschutes — Prineville, Madras, Crook, Jefferson, Harney,
  // the southern-Oregon Asante rows) falls back to the box alone, and says so,
  // so "no coverage" never reads as "this property has no lot lines".
  function makeAllowedRegion(opts) {
    opts = opts || {};
    var geo     = opts.geo;
    var ring    = opts.ring ? normaliseRing(opts.ring) : null;
    var marginM = (opts.marginM === undefined) ? 30 : Number(opts.marginM);
    var box     = storableBox(geo, opts.coordMin, opts.coordMax);
    var project = makeProjector(geo);
    if (ring && ring.length < 3) ring = null;

    function test(lat, lng) {
      var p = project(lat, lng);
      if (p.x < box.pctMin || p.x > box.pctMax ||
          p.y < box.pctMin || p.y > box.pctMax) {
        return { ok: false, reason: 'outside-nadir', pct: p,
                 message: 'Outside the captured image — the analysis never saw this ground.' };
      }
      if (!ring) return { ok: true, reason: 'no-parcel-data', pct: p };
      if (ringContains(ring, lat, lng)) {
        return { ok: true, reason: 'inside-parcel', pct: p };
      }
      var d = ringDistanceM(ring, lat, lng);
      if (d <= marginM) {
        return { ok: true, reason: 'within-margin', pct: p, distanceM: d };
      }
      return { ok: false, reason: 'outside-parcel', pct: p, distanceM: d,
               message: 'That is ' + Math.round(d) + ' m outside the property line ' +
                        '(limit ' + Math.round(marginM) + ' m).' };
    }

    test.box       = box;
    test.hasParcel = !!ring;
    test.marginM   = marginM;
    // The margin band as a drawable polygon-ish hint: each ring vertex pushed
    // marginM metres away from the ring centroid. NOT used for the test (which
    // is exact) — only to shade roughly where placement is allowed.
    test.marginHint = function () {
      if (!ring) return null;
      var cLat = 0, cLng = 0;
      ring.forEach(function (v) { cLat += v.lat; cLng += v.lng; });
      cLat /= ring.length; cLng /= ring.length;
      var kx = metresPerDegLng(cLat), ky = metresPerDegLat(cLat);
      return ring.map(function (v) {
        var dx = (v.lng - cLng) * kx, dy = (v.lat - cLat) * ky;
        var L = Math.sqrt(dx * dx + dy * dy) || 1;
        return { lat: v.lat + (dy / L) * marginM / ky,
                 lng: v.lng + (dx / L) * marginM / kx };
      });
    };
    return test;
  }

  root.NadirGeo = {
    nadirGeo:         nadirGeo,
    makeProjector:    makeProjector,
    makeUnprojector:  makeUnprojector,
    nadirBounds:      nadirBounds,
    storableBox:      storableBox,
    makeAllowedRegion: makeAllowedRegion,
    ringContains:     ringContains,
    ringDistanceM:    ringDistanceM,
    normaliseRing:    normaliseRing,
    _version:         '1.0.0'
  };
})(typeof window !== 'undefined' ? window : globalThis);
