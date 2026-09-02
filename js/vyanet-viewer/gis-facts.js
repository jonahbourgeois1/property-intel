// Known-property GIS facts for Private (assessor, DOGAMI, fire, flood, WUI).
// Path: data/gis/{propertyId}.json. Writer: Apps Script gisFileForSync_.
// The overlay color legend is not this file — only the facts panel.

export const GIS_FACT_LABELS = {
  address: 'Address',
  taxlot: 'Taxlot',
  subdivision: 'Subdivision',
  year_built: 'Year built',
  stat_class: 'Structure',
  living_sqft: 'Living sqft',
  garage_sqft: 'Garage sqft',
  accessory: 'Accessory',
  beds_baths: 'Beds / baths',
  roof_mean_ft: 'Roof mean (ft)',
  roof_max_ft: 'Roof max (ft)',
  dogami_sqft: 'Building sqft (DOGAMI)',
  e911_placement: 'E911 placement',
  situs_street: 'Situs',
  frontage: 'Frontage',
  fire_first_due: 'Fire first due',
  fire_district: 'Fire district',
  wildfire_county: 'County wildfire',
  wui: 'Wildland-urban interface',
  flood_zone: 'Flood zone',
  slope_over_25: 'Slope >25%',
  vegetation: 'Vegetation',
  hydrants_150m: 'Hydrants (150 m)',
  osm_hits_on_lot: 'OSM hits on lot'
};

export const GIS_FACT_GROUPS = [
  { title: 'Identity', keys: ['address', 'taxlot', 'subdivision', 'situs_street', 'frontage'] },
  { title: 'Structure', keys: ['year_built', 'stat_class', 'living_sqft', 'garage_sqft', 'accessory', 'beds_baths', 'roof_mean_ft', 'roof_max_ft', 'dogami_sqft'] },
  { title: 'Response', keys: ['e911_placement', 'fire_first_due', 'fire_district', 'hydrants_150m'] },
  { title: 'Hazard', keys: ['wildfire_county', 'wui', 'flood_zone', 'slope_over_25', 'vegetation'] }
];

export async function fetchPropertyGis(root, propertyId) {
  const id = String(propertyId || '').trim();
  if (!id) return null;
  try {
    const res = await fetch(String(root || '') + 'gis/' + id + '.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const rec = await res.json();
    if (!rec || typeof rec !== 'object') return null;
    const facts = rec.facts && typeof rec.facts === 'object' ? rec.facts : rec;
    if (!facts || typeof facts !== 'object') return null;
    const keys = Object.keys(facts).filter(function (k) { return factHasValue_(facts[k]); });
    if (!keys.length) return null;
    return rec.facts ? rec : { property: id, facts: facts };
  } catch (e) {
    return null;
  }
}

export function formatGisFact(key, value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (key === 'e911_placement') {
    const s = String(value).trim().toUpperCase();
    if (s === 'H') return 'H (house / rooftop)';
    if (s === 'R') return 'R (rooftop)';
    if (s === 'D') return 'D (door / driveway)';
    return String(value);
  }
  if (typeof value === 'number' && isFinite(value)) {
    if (key === 'living_sqft' || key === 'garage_sqft' || key === 'dogami_sqft') {
      return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    if (key === 'roof_mean_ft' || key === 'roof_max_ft') {
      return (Math.round(value * 10) / 10).toFixed(1);
    }
    return String(value);
  }
  return String(value);
}

export function gisFactsHtml(rec, esc) {
  const escape = typeof esc === 'function' ? esc : function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  const facts = rec && rec.facts && typeof rec.facts === 'object' ? rec.facts : null;
  if (!facts) return '';
  const used = {};
  let rows = '';
  GIS_FACT_GROUPS.forEach(function (g) {
    const body = g.keys.map(function (k) { return factRow_(k, facts[k], escape, used); }).join('');
    if (body) {
      rows += '<div class="gis-group">' + escape(g.title) + '</div>' + body;
    }
  });
  Object.keys(facts).forEach(function (k) {
    if (used[k] || k === 'osm_hits_on_lot') return;
    rows += factRow_(k, facts[k], escape, used);
  });
  if (factHasValue_(facts.osm_hits_on_lot)) {
    rows += factRow_('osm_hits_on_lot', facts.osm_hits_on_lot, escape, used);
  }
  if (!rows) return '';
  let html = '<div class="rd-card"><div class="rd-head"><div class="rd-num" style="background:#a3e635;color:#0b0e12">G</div>' +
    '<div class="rd-titles"><div class="rd-name">Known property facts</div>' +
    '<div class="rd-meta">Assessor, building footprint, fire, flood, vegetation</div></div></div>' +
    '<div class="rd-body">' + rows + '</div></div>';
  const hydrants = Array.isArray(rec.hydrants) ? rec.hydrants : [];
  if (hydrants.length) {
    html += '<div class="rd-card"><div class="rd-head"><div class="rd-num" style="background:#ef4444;color:#fff">H</div>' +
      '<div class="rd-titles"><div class="rd-name">Hydrants within 150 m</div>' +
      '<div class="rd-meta">' + hydrants.length + ' hydrant' + (hydrants.length === 1 ? '' : 's') +
      '</div></div></div><div class="rd-body">';
    hydrants.forEach(function (h) {
      const id = h && (h.id || h.hydrant_id) ? String(h.id || h.hydrant_id) : '';
      const loc = h && h.location ? String(h.location) : '';
      const bits = [];
      if (h && h.meters != null && h.meters !== '') bits.push(Number(h.meters).toFixed(0) + ' m');
      if (h && Number(h.flow_rate) > 0) bits.push(Number(h.flow_rate).toLocaleString() + ' gpm');
      html += '<div class="gis-row"><div class="gis-k">' + escape(id || 'hydrant') +
        '</div><div class="gis-v">' + escape(loc || '—') +
        (bits.length ? '<div class="gis-sub">' + escape(bits.join(' · ')) + '</div>' : '') +
        '</div></div>';
    });
    html += '</div></div>';
  }
  return html;
}

function factHasValue_(v) {
  if (v == null) return false;
  if (v === '') return false;
  if (Array.isArray(v) && !v.length) return false;
  return true;
}

function factRow_(key, value, escape, used) {
  if (!factHasValue_(value)) return '';
  used[key] = true;
  const label = GIS_FACT_LABELS[key] || key.replace(/_/g, ' ');
  return '<div class="gis-row"><div class="gis-k">' + escape(label) +
    '</div><div class="gis-v">' + escape(formatGisFact(key, value)) + '</div></div>';
}
