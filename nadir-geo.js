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

  // Inverse of nadirBounds: a CloudFront plane/drone crop has no Static Maps
  // query string, but the sheet stores {north,south,east,west} from crop_nadir
  // (z20 tile mosaic). Rebuild the centre/zoom/size georeference so the map
  // overlay covers that exact footprint. zoom defaults to 20 (NADIR_ZOOM).
  function geoFromBounds(b, zoom) {
    if (!b) return null;
    var north = Number(b.north), south = Number(b.south);
    var east  = Number(b.east),  west  = Number(b.west);
    if (![north, south, east, west].every(isFinite)) return null;
    if (!(north > south) || !(east > west)) return null;
    var z = parseInt(zoom, 10);
    if (!isFinite(z) || z < 1 || z > 22) z = 20;
    var S = worldSize(z);
    var xW = worldX(west, S), xE = worldX(east, S);
    var yN = worldY(north, S), yS = worldY(south, S);
    var w = xE - xW, h = yS - yN;
    if (!(w > 0) || !(h > 0)) return null;
    var cx = (xW + xE) / 2, cy = (yN + yS) / 2;
    return {
      lat:   Math.atan(Math.sinh(Math.PI * (1 - 2 * cy / S))) * 180 / Math.PI,
      lng:   cx / S * 360 - 180,
      zoom:  z,
      w:     w,
      h:     h,
      scale: 1
    };
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

  // ⚠️ ALWAYS BUILD POLYGON MATHS ON A LOCAL ORIGIN, NEVER ON ABSOLUTE METRES.
  // lng * metresPerDegLng at lat 44 is about -9.7e6 and lat * metresPerDegLat
  // about 4.9e6. Any cross product of those - a signed area, a centroid moment,
  // an orientation test - is a difference of two enormous nearly-equal doubles,
  // and the ~1e4 answer is destroyed by cancellation. The square-lot centroid
  // test caught it: the centroid came out nowhere near the centre. Subtracting
  // the first vertex first makes every coordinate a few hundred metres and the
  // maths exact. Differences alone (edge vectors, point-to-segment) are safe
  // either way, but there is no reason to have two conventions in one file.
  function localFrame(ring) {
    var r = normaliseRing(ring);
    if (r.length < 2) return null;
    var ref = r[0];
    var kx = metresPerDegLng(ref.lat), ky = metresPerDegLat(ref.lat);
    var pts = [];
    for (var i = 0; i < r.length; i++) {
      var p = { x: (r[i].lng - ref.lng) * kx, y: (r[i].lat - ref.lat) * ky };
      var last = pts[pts.length - 1];
      if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) pts.push(p);
    }
    if (pts.length > 1) {
      var f = pts[0], l = pts[pts.length - 1];
      if (Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) pts.pop();
    }
    return { pts: pts, kx: kx, ky: ky, ref: ref,
             out: function (p) { return { lat: ref.lat + p.y / ky,
                                          lng: ref.lng + p.x / kx }; } };
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

  // ── The DRAWN boundary of the allowed region ─────────────────────────────
  // makeAllowedRegion().test() accepts a point when it is inside the lot or
  // within marginM metres of it. The set of points exactly marginM metres from
  // a polygon is that polygon offset outward with ROUND joins - straight
  // sections parallel to each edge, and a quarter-ish arc of radius marginM at
  // every convex corner. So that is what gets drawn, rather than the cheap
  // "push each vertex away from the centroid" approximation this replaces:
  // radial push distorts badly on a long thin lot, which is exactly the shape a
  // rural parcel with road frontage tends to be, and a guide line that disagrees
  // with the rule it depicts is worse than no guide line.
  //
  // The two joins are different because the level set genuinely is:
  //   CONVEX corner  -> ARC of radius d (the corner is a single nearest point,
  //                     so every direction around it is d away)
  //   CONCAVE corner -> MITRE, the intersection of the two offset lines (the
  //                     exterior angle is under 180 degrees, so the boundary
  //                     turns a sharp corner rather than sweeping)
  // ⚠️ Getting the concave case wrong is not cosmetic. Emitting the per-edge
  // offset point there puts it ON the neighbouring edge - distance 0 from the
  // lot, not d - so the drawn line dives back through the property. Caught on
  // an L-shaped test lot: two of 32 vertices measured 0.000 m instead of 30.
  // A mitre at a very sharp concave corner shoots off to infinity, so it is
  // capped at 4d and falls back to a bevel beyond that.
  function ringOffsetM(ring, d) {
    var fr = localFrame(ring);
    if (!fr) return null;
    var P = fr.pts, n = P.length;
    if (n < 3) return null;
    // Orientation matters: the outward normal is the RIGHT normal only for a
    // counter-clockwise ring, so normalise the winding first.
    var area2 = 0;
    for (var i = 0; i < n; i++) {
      var a = P[i], b = P[(i + 1) % n];
      area2 += a.x * b.y - b.x * a.y;
    }
    if (area2 < 0) P.reverse();
    var N = [];
    for (i = 0; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      var dx = q.x - p.x, dy = q.y - p.y;
      var L = Math.sqrt(dx * dx + dy * dy) || 1;
      N.push({ x: dy / L, y: -dx / L });          // right normal = outward for CCW
    }
    var out = [];
    var STEP = Math.PI / 8;
    for (i = 0; i < n; i++) {
      var pi = P[i], ni = N[i], np = N[(i - 1 + n) % n];
      var cross = np.x * ni.y - np.y * ni.x;
      if (cross > 1e-9) {                          // convex: sweep an arc
        var a0 = Math.atan2(np.y, np.x), a1 = Math.atan2(ni.y, ni.x);
        var sweep = a1 - a0;
        while (sweep < 0) sweep += 2 * Math.PI;
        var steps = Math.max(1, Math.ceil(sweep / STEP));
        for (var k = 0; k <= steps; k++) {
          var a = a0 + sweep * k / steps;
          out.push({ x: pi.x + d * Math.cos(a), y: pi.y + d * Math.sin(a) });
        }
      } else {
        // Concave: mitre. Intersect the previous edge's offset line with this
        // edge's offset line, both shifted out by d.
        var pv = P[(i - 1 + n) % n];
        var ux = pi.x - pv.x, uy = pi.y - pv.y;
        var Lu = Math.sqrt(ux * ux + uy * uy) || 1; ux /= Lu; uy /= Lu;
        var qn = P[(i + 1) % n];
        var vx = qn.x - pi.x, vy = qn.y - pi.y;
        var Lv = Math.sqrt(vx * vx + vy * vy) || 1; vx /= Lv; vy /= Lv;
        var Ax = pi.x + d * np.x, Ay = pi.y + d * np.y;
        var Bx = pi.x + d * ni.x, By = pi.y + d * ni.y;
        var den = ux * vy - uy * vx;
        var done = false;
        if (Math.abs(den) > 1e-9) {
          var t = ((Bx - Ax) * vy - (By - Ay) * vx) / den;
          var mx = Ax + t * ux, my = Ay + t * uy;
          var reach = Math.sqrt((mx - pi.x) * (mx - pi.x) + (my - pi.y) * (my - pi.y));
          if (reach <= 4 * d) { out.push({ x: mx, y: my }); done = true; }
        }
        if (!done) { out.push({ x: Ax, y: Ay }); out.push({ x: Bx, y: By }); }
      }
      // ⚠️ NOTHING ELSE IS EMITTED PER EDGE, and that is not an omission.
      // Each join already supplies BOTH ends of the straight offset section:
      // vertex i's join finishes at P[i] + d*N[i] (the start of edge i's
      // offset) and vertex i+1's join begins at P[i+1] + d*N[i] (its end), so
      // the straight line between consecutive joins IS the offset of edge i.
      // Pushing P[i+1] + d*N[i] explicitly is redundant at a convex corner and
      // WRONG at a concave one, where the mitre is supposed to truncate that
      // segment short - the un-truncated point lands on the neighbouring edge,
      // 0 m from the lot instead of d. Do not add it back.
    }
    return out.map(fr.out);
  }

  // Sutherland-Hodgman against the four half-planes of the storable box. The
  // box is axis-aligned in lat/lng, so this is exact and needs no projection.
  function clipRingToBox(ring, box) {
    var planes = [
      function (v) { return box.north - v.lat; },
      function (v) { return v.lat - box.south; },
      function (v) { return box.east - v.lng; },
      function (v) { return v.lng - box.west; }
    ];
    var poly = ring.slice();
    for (var pi = 0; pi < planes.length && poly.length; pi++) {
      var f = planes[pi], next = [];
      for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length];
        var da = f(a), db = f(b);
        if (da >= 0) next.push(a);
        if ((da >= 0) !== (db >= 0)) {
          var t = da / (da - db);
          next.push({ lat: a.lat + (b.lat - a.lat) * t,
                      lng: a.lng + (b.lng - a.lng) * t });
        }
      }
      poly = next;
    }
    return poly.length >= 3 ? poly : null;
  }

  function boxRing(box) {
    return [{ lat: box.north, lng: box.west }, { lat: box.north, lng: box.east },
            { lat: box.south, lng: box.east }, { lat: box.south, lng: box.west }];
  }

  // ── Bearings and rays, for labelling the sides of a property ─────────────
  // The A/B/C/D convention in this project is model-viewer.html's:
  //   alpha = the COMPASS AZIMUTH the front elevation was captured from, so the
  //           front face of the structure looks along that bearing
  //   bravo / charlie / delta = alpha + 90 / 180 / 270  (clockwise, N->E->S->W)
  // Everything below is bearing maths in that frame: 0 = north, 90 = east.
  function bearingBetween(a, b) {
    var kx = metresPerDegLng((a.lat + b.lat) / 2), ky = metresPerDegLat((a.lat + b.lat) / 2);
    var dx = (b.lng - a.lng) * kx, dy = (b.lat - a.lat) * ky;
    var deg = Math.atan2(dx, dy) * 180 / Math.PI;   // atan2(east, north) = compass
    return (deg + 360) % 360;
  }

  // Area-weighted centroid, not the average of the vertices: a lot with many
  // closely-spaced points down one side would otherwise pull the centre toward
  // that side and skew every bearing taken from it.
  function ringCentroid(ring) {
    var fr = localFrame(ring);
    if (!fr) return null;
    var P = fr.pts, n = P.length;
    if (n < 3) return fr.out(P[0]);
    var A = 0, cx = 0, cy = 0;
    for (var i = 0; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      var f = p.x * q.y - q.x * p.y;
      A += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
    }
    if (Math.abs(A) < 1e-9) {          // degenerate sliver: fall back to the mean
      var mx = 0, my = 0;
      P.forEach(function (p) { mx += p.x; my += p.y; });
      return fr.out({ x: mx / n, y: my / n });
    }
    A *= 0.5;
    return fr.out({ x: cx / (6 * A), y: cy / (6 * A) });
  }

  // Cast a ray from `origin` along `bearingDeg` and return where it leaves the
  // ring, pushed a further `pushM` metres out. Takes the FARTHEST crossing, not
  // the first, so a concave lot or an origin sitting off-centre still yields a
  // point outside the whole boundary rather than inside a notch.
  function rayExit(ring, origin, bearingDeg, pushM) {
    var r = normaliseRing(ring);
    if (r.length < 3 || !origin) return null;
    var kx = metresPerDegLng(origin.lat), ky = metresPerDegLat(origin.lat);
    var ox = origin.lng * kx, oy = origin.lat * ky;
    var b = bearingDeg * Math.PI / 180;
    var dx = Math.sin(b), dy = Math.cos(b);            // unit, compass frame
    var best = -Infinity;
    for (var i = 0, n = r.length; i < n; i++) {
      var p = r[i], q = r[(i + 1) % n];
      var px = p.lng * kx - ox, py = p.lat * ky - oy;
      var ex = q.lng * kx - p.lng * kx, ey = q.lat * ky - p.lat * ky;
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;             // parallel
      var t = (px * ey - py * ex) / den;               // along the ray, metres
      var u = (px * dy - py * dx) / den;               // along the edge, 0..1
      if (t >= 0 && u >= 0 && u <= 1 && t > best) best = t;
    }
    if (!isFinite(best)) return null;
    var d = best + (pushM || 0);
    return { lat: origin.lat + (dy * d) / ky,
             lng: origin.lng + (dx * d) / kx, exitM: best };
  }

  // ⭐ WHERE THE FOUR SIDE LABELS BELONG — anchored to the LOT'S OWN EDGES.
  //
  // The obvious construction is to cast a ray from the building along each of
  // the four bearings and label where it leaves the lot. That is wrong in
  // practice and Jonah's markup showed exactly how: a house is rarely centred on
  // its lot, so four rays 90 degrees apart from an off-centre origin exit near
  // the CORNERS, not the middle of each side. On a rotated rectangle it produced
  // Alpha NW, Bravo N, Charlie SE, Delta SW - two bunched along the top, two
  // along the bottom, nothing on the long sides at all.
  //
  // So work from the boundary instead. Every edge has an outward normal bearing.
  // The four side bearings cut the compass into four 90-degree sectors; an edge
  // belongs to the side its normal points at. A side's anchor is then the
  // LENGTH-WEIGHTED midpoint of its edges, pushed out along the side bearing.
  //
  // Length weighting is what makes this survive a real taxlot: Deschutes rings
  // run to 34+ vertices, so a side is many short edges plus one long one, and an
  // unweighted mean would drift toward wherever the surveyor put the most
  // points. It also means the anchor is independent of where the building sits,
  // which is the whole point.
  //
  // Sectors are inclusive at +-45 degrees, so an edge facing exactly into a
  // corner contributes to BOTH neighbouring sides rather than to neither.
  // A sector with no edges at all (a triangle, say) falls back to the support
  // point - the vertex farthest along that bearing - so four anchors always come
  // back.
  function sideAnchors(ring, alphaDeg, pushM) {
    var fr = localFrame(ring);
    if (!fr) return null;
    var P = fr.pts, n = P.length;
    if (n < 3) return null;
    var i, area2 = 0;
    for (i = 0; i < n; i++) {
      var a = P[i], b = P[(i + 1) % n];
      area2 += a.x * b.y - b.x * a.y;
    }
    if (area2 < 0) { P = P.slice().reverse(); }      // outward normal needs CCW
    var edges = [];
    for (i = 0; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      var dx = q.x - p.x, dy = q.y - p.y;
      var L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1e-6) continue;
      var nx = dy / L, ny = -dx / L;                 // right normal = outward, CCW
      edges.push({ mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, L: L,
                   brg: (Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360 });
    }
    if (!edges.length) return null;
    var push = pushM || 0;
    var out = [];
    for (var k = 0; k < 4; k++) {
      var bd = ((((alphaDeg + k * 90) % 360) + 360) % 360);
      var rad = bd * Math.PI / 180;
      var ux = Math.sin(rad), uy = Math.cos(rad);    // unit vector along the bearing
      var wx = 0, wy = 0, w = 0, cnt = 0, nvx = 0, nvy = 0;
      for (i = 0; i < edges.length; i++) {
        var e = edges[i];
        var off = Math.abs(((e.brg - bd + 540) % 360) - 180);
        if (off <= 45) {
          wx += e.mx * e.L; wy += e.my * e.L; w += e.L; cnt++;
          // accumulate the outward normal too, length-weighted
          var er = e.brg * Math.PI / 180;
          nvx += Math.sin(er) * e.L; nvy += Math.cos(er) * e.L;
        }
      }
      var ax, ay;
      if (w > 0) {
        ax = wx / w; ay = wy / w;
        // Push along the side's own mean outward NORMAL, not along the side
        // bearing. Both agree on a lot squared to the frontage, but the sector
        // admits edges up to 45 degrees off, and pushing along the bearing there
        // would slide the label along the boundary instead of clear of it. The
        // normal is perpendicular to the line the label is annotating, which is
        // what "just outside the property line" has to mean.
        var nl = Math.sqrt(nvx * nvx + nvy * nvy);
        if (nl > 1e-9) { ux = nvx / nl; uy = nvy / nl; }
      } else {                                      // support point fallback
        var best = -Infinity;
        for (i = 0; i < P.length; i++) {
          var t = P[i].x * ux + P[i].y * uy;
          if (t > best) { best = t; ax = P[i].x; ay = P[i].y; }
        }
      }
      var ll = fr.out({ x: ax + ux * push, y: ay + uy * push });
      out.push({ lat: ll.lat, lng: ll.lng, bearing: bd,
                 edgeCount: cnt, edgeLenM: w });
    }
    return out;
  }

  // Longest span across the ring, in metres - used to scale how far outside the
  // boundary a label should sit so it reads the same on a 40 m lot and a 400 m one.
  function ringSpanM(ring) {
    var fr = localFrame(ring);
    if (!fr) return 0;
    var xs = fr.pts.map(function (p) { return p.x; });
    var ys = fr.pts.map(function (p) { return p.y; });
    return Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs),
                    Math.max.apply(null, ys) - Math.min.apply(null, ys));
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
    // ⭐ THE DRAWABLE BOUNDARY OF WHAT test() ACCEPTS, as [{lat,lng}].
    // Lot offset outward by marginM with round joins, then clipped to the
    // storable box - i.e. exactly the region test() returns ok for. With no lot
    // data it is the box itself. Draw this and the guide cannot disagree with
    // the rule.
    test.outline = function () {
      if (!ring) return boxRing(box);
      var off = ringOffsetM(ring, marginM);
      if (!off) return boxRing(box);
      return clipRingToBox(off, box) || boxRing(box);
    };
    return test;
  }

  // ── Lot lookup against county GeoJSON tiles ──────────────────────────────
  // Lane files unaccounted public leftovers as ACCTNO "000None" with reserved
  // TAXLOT numbers: 77 = road ROW, 88 = railroad, 99 = roads. Those polygons
  // are the leftover of a map sheet (streets, with city blocks as holes).
  // Matching on the OUTER ring only, first-hit, painted the street grid onto
  // every lot in the sheet (Cottage Grove 75 S 5th St, 2026-08-28).
  function isUnaccountedParcel(props) {
    props = props || {};
    if (String(props.ACCTNO || '') === '000None') return true;
    var raw = String(props.TAXLOT || '');
    if (!/^\d+$/.test(raw)) return false;
    var n = Number(raw);
    return n === 77 || n === 88 || n === 99;
  }

  function geojsonPolys(geom) {
    if (!geom) return [];
    if (geom.type === 'Polygon') return geom.coordinates ? [geom.coordinates] : [];
    if (geom.type === 'MultiPolygon') return geom.coordinates || [];
    return [];
  }

  function geojsonRingContains(ring, lat, lng) {
    var n = normaliseRing(ring);
    return n.length >= 4 && ringContains(n, lat, lng);
  }

  // GeoJSON polygon = [outer, hole, hole, ...]. Inside iff in outer and in no hole.
  function polyContains(poly, lat, lng) {
    if (!poly || !poly[0] || !geojsonRingContains(poly[0], lat, lng)) return false;
    for (var i = 1; i < poly.length; i++) {
      if (poly[i] && geojsonRingContains(poly[i], lat, lng)) return false;
    }
    return true;
  }

  function ringAreaAbs(ring) {
    var n = normaliseRing(ring);
    var a = 0;
    for (var i = 0, j = n.length - 1; i < n.length; j = i++) {
      a += n[j].lng * n[i].lat - n[i].lng * n[j].lat;
    }
    return Math.abs(a) / 2;
  }

  function featArea(feat) {
    var acres = Number((feat.properties || {}).MAPACRES);
    if (isFinite(acres) && acres > 0) return acres;
    var polys = geojsonPolys(feat && feat.geometry);
    var sum = 0;
    for (var i = 0; i < polys.length; i++) {
      var poly = polys[i];
      if (!poly || !poly[0]) continue;
      var a = ringAreaAbs(poly[0]);
      for (var h = 1; h < poly.length; h++) a -= ringAreaAbs(poly[h]);
      if (a > 0) sum += a;
    }
    return sum;
  }

  function parcelContains(feat, lat, lng) {
    var polys = geojsonPolys(feat && feat.geometry);
    for (var k = 0; k < polys.length; k++) {
      if (polyContains(polys[k], lat, lng)) return true;
    }
    return false;
  }

  // Accounted lot whose interior contains the point. If more than one, the
  // smallest area wins (MAPACRES when present, otherwise ring area).
  function parcelMatch(geojson, lat, lng) {
    var feats = (geojson && geojson.features) || [];
    var best = null, bestArea = Infinity;
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      if (isUnaccountedParcel(f.properties)) continue;
      if (!parcelContains(f, lat, lng)) continue;
      var area = featArea(f);
      if (area < bestArea) { best = f; bestArea = area; }
    }
    return best;
  }

  function parcelHit(geojson, lat, lng) {
    var f = parcelMatch(geojson, lat, lng);
    if (!f) return null;
    var polys = geojsonPolys(f.geometry);
    var ring = null;
    for (var k = 0; k < polys.length; k++) {
      if (polyContains(polys[k], lat, lng)) { ring = polys[k][0]; break; }
    }
    var p = f.properties || {};
    return { ring: ring, taxlot: p.MAPTAXLOT || p.TAXLOT || '', feature: f };
  }

  root.NadirGeo = {
    nadirGeo:         nadirGeo,
    makeProjector:    makeProjector,
    makeUnprojector:  makeUnprojector,
    nadirBounds:      nadirBounds,
    geoFromBounds:    geoFromBounds,
    storableBox:      storableBox,
    makeAllowedRegion: makeAllowedRegion,
    ringOffsetM:      ringOffsetM,
    bearingBetween:   bearingBetween,
    ringCentroid:     ringCentroid,
    rayExit:          rayExit,
    sideAnchors:      sideAnchors,
    ringSpanM:        ringSpanM,
    clipRingToBox:    clipRingToBox,
    ringContains:     ringContains,
    ringDistanceM:    ringDistanceM,
    normaliseRing:    normaliseRing,
    isUnaccountedParcel: isUnaccountedParcel,
    polyContains:     polyContains,
    parcelMatch:      parcelMatch,
    parcelHit:        parcelHit,
    _version:         '1.3.2'
  };
})(typeof window !== 'undefined' ? window : globalThis);
