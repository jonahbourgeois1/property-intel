/*
  safe-portal/fixtures.js — the four SAFE records the mock portal renders.

  This is MOCK DATA for a design walkthrough. It is shaped like the record a
  future sync-owned `data/safe/{id}.json` would hold, so the shell reads it
  the way production would. Every pin carries a `placement`:

    surveyed  — a real measured position (GPS still, sheet pin, record pin)
    estimated — placed by hand for the mock; drawn with a dashed ring
    mock      — the device/feature itself is invented for the walkthrough

  Nothing here is written to data/ (that folder is Apps Script sync-owned).

  Sources of the real parts:
    Residence  data/index/6de88883….json, data/cameras/json/6de88883….json
               (14 GPS stills, 4 live), data/drone-test/83af9960….json
               (pins, Pool-incident route, nadir bounds), data/nearmap/
               d9f759d7….json (wildfire concern pins), data/gis/2dce25a3….json
    HOA        data/hoa/highlands.json → 46 member index/satellite records
    Golf       golf API ?route=golf-course&sheet=Awbrey Glen Golf Course
               (43 pins), golf-reports/awbrey-glen.html (hole table, limits)
    School     NCES 410198000270 + bendhigh.blschools.org (public facts);
               no imagery pass yet, so every pin is a desk-pass placeholder.
*/
(function () {
  'use strict';

  // ---- helpers ------------------------------------------------------------
  // Pins on the 3D nadir render are stored as % of that frame (record
  // convention). The render is an orthographic top-down of local metres, so
  // lat/lng are linear across the frame and plain interpolation is exact.
  function frameToLatLng(b) {
    return function (x, y) {
      return {
        lat: b.north - (y / 100) * (b.north - b.south),
        lng: b.west + (x / 100) * (b.east - b.west)
      };
    };
  }
  // drone-test nadir frame (data/drone-test/83af9960….json nadir.bounds)
  var dt = frameToLatLng({
    north: 44.04270592455917, south: 44.04005000315991,
    east: -121.37701615691185, west: -121.38125136494637
  });
  // Nearmap vert frame (data/nearmap/d9f759d7….json nadir.bounds)
  var nm = frameToLatLng({
    north: 44.04241696029909, south: 44.0403377738976,
    east: -121.37747850269079, west: -121.38078767806292
  });
  function pt(x, y) { return { lat: x, lng: y }; }

  var STILLS = '../data/cameras/images/6de88883bfd4a8349a901c54611ed9d7/';
  var CLD = 'https://res.cloudinary.com/dtqswjo5v/image/upload/';

  // =========================================================================
  // 1. RESIDENCE — Jones residence, 18775 Macalpine Loop (Tracy's house)
  // =========================================================================
  var residenceCams = [
    // id, label, lat, lng, heading(true), fov, live roster name, device
    ['cam-01', 'Front walkway – driveway approach', 44.0413914, -121.3786278, 241.45, 70, 'FRONT DOOR', '4350162'],
    ['cam-02', 'Front lawn – west', 44.0412611, -121.3786472, 238.24, 90, null, null],
    ['cam-03', 'Landscape bed – south', 44.0412361, -121.3785472, 149.93, 90, null, null],
    ['cam-04', 'Side gate – south', 44.0412778, -121.3783722, 147.18, 90, null, null],
    ['cam-05', 'Lawn – northeast', 44.0414, -121.37835, 50.62, 90, null, null],
    ['cam-06', 'Rear railing – east', 44.04145, -121.3784111, 56.93, 90, null, null],
    ['cam-07', 'Rear deck – east', 44.0415, -121.3784417, 65.77, 70, 'UPPER DECK MASTER DOOR', '4350175'],
    ['cam-08', 'Rear lawn toward patio', 44.0416028, -121.3785389, 40.29, 70, 'LOWER DECK SINGLE DOOR', '4350171'],
    ['cam-09', 'Rear lawn – east', 44.0415917, -121.3784861, 62.49, 90, null, null],
    ['cam-10', 'North lawn', 44.041675, -121.3786611, 5.5, 90, null, null],
    ['cam-11', 'North lawn edge', 44.0415944, -121.3788694, 20.27, 90, null, null],
    ['cam-12', 'Side path – west', 44.0415472, -121.3789972, 268.33, 90, null, null],
    ['cam-13', 'Driveway court – southwest', 44.0414556, -121.3789444, 233.51, 110, null, null],
    ['cam-14', 'Driveway – house frontage', 44.0413889, -121.3787917, 152.17, 110, 'DRIVEWAY', '4350156']
  ].map(function (r) {
    return {
      id: r[0], comp: 'S', kind: 'camera', name: r[1], lat: r[2], lng: r[3],
      heading: r[4], fov: r[5], range: 25, photo: STILLS + r[0] + '.jpg',
      vendor: 'CHEKT', placement: 'surveyed',
      status: r[6] ? 'live' : 'online',
      live: r[6] ? { name: r[6], device: r[7], site: '3525' } : null,
      // The cameras file stores fov 90 for every pin. The mock varies the cone
      // by preset (door 70° / lawn 90° / driveway 110°) to show the open build
      // item Tracy raised: field of view must vary by camera.
      desc: r[6]
        ? 'Technician GPS still, true heading ' + r[4] + '°. Associated to CHEKT roster camera "' + r[6] + '" (site 3525).'
        : 'Technician GPS still, true heading ' + r[4] + '°. Not yet associated to a CHEKT roster camera.'
    };
  });

  var residence = {
    id: '6de88883bfd4a8349a901c54611ed9d7',
    slug: 'residence',
    vertical: 'residence',
    verticalLabel: 'Residence',
    name: 'Jones residence',
    address: '18775 Macalpine Loop, Bend, OR 97702',
    center: pt(44.0414545, -121.3786406),
    zoom: 19,
    status: 'reviewed',
    tier: ['Base SAFE map', 'Device layer', 'Drone tier (3D model)'],
    monitoring: { alarm: 'Vyanet', cameras: 'CHEKT (12 on roster)', note: 'Vyanet account · CHEKT site 3525' },
    roles: [
      { id: 'owner', label: 'Owner' },
      { id: 'responder', label: 'Responder' }
    ],
    links: [
      { label: '3D model (model-viewer)', href: 'https://responder-intel.vyanet.com/model-viewer.html?model=https://d3fg47bqswi0rr.cloudfront.net/captures/plane/tracy-residence-2026-06-16/parcels/181102C000600/clipped.glb' },
      { label: 'Current hub (vyanet-viewer)', href: 'https://responder-intel.vyanet.com/vyanet-viewer.html?property=6de88883bfd4a8349a901c54611ed9d7' }
    ],
    facts: [
      ['Taxlot', '181102C000600'],
      ['Subdivision', 'Highlands at Broken Top, Phase 2'],
      ['Year built', '2006'],
      ['Class', 'Two story with basement'],
      ['Living area', '8,853 sq ft'],
      ['Garage', '2,650 sq ft'],
      ['Beds / baths', '3 / 5.5'],
      ['Roof height', 'mean 14.0 ft · max 31.8 ft'],
      ['Fire first due', 'BFD 301'],
      ['Fire district', 'Rural Fire District #2'],
      ['WUI', 'Yes (Deschutes wildfire county)'],
      ['Flood zone', 'Not in SFHA'],
      ['Slope > 25%', 'No'],
      ['Hydrants within 150 m', '0'],
      ['Vegetation', 'Inter-Mountain Basins Big Sagebrush Steppe'],
      ['Capture', 'tracy-residence-2026-06-16 (drone, parcel-clipped)']
    ],
    pins: residenceCams.concat([
      // ---- Security: alarm devices (mock, placed on the record's structure pins)
      { id: 'panel', comp: 'S', kind: 'panel', name: 'Alarm panel / keypad – entry', lat: 44.04139, lng: -121.37864, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Armed-stay / armed-away state and zone list. Monitored by Vyanet central station.' },
      { id: 'dc-front', comp: 'S', kind: 'contact', name: 'Door contact – front door', lat: 44.0414, lng: -121.37866, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Zone 1. Covered by FRONT DOOR camera.' , near: 'cam-01' },
      { id: 'dc-garage', comp: 'S', kind: 'contact', name: 'Door contact – garage man door', lat: 44.0414842, lng: -121.3787949, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Zone 2, on the detached garage (record pin 35).' },
      { id: 'dc-master', comp: 'S', kind: 'contact', name: 'Door contact – upper deck master slider', lat: 44.04152, lng: -121.37846, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Zone 3. Covered by UPPER DECK MASTER DOOR camera.', near: 'cam-07' },
      { id: 'dc-lower', comp: 'S', kind: 'contact', name: 'Door contact – lower deck single door', lat: 44.04162, lng: -121.37851, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Zone 4. Covered by LOWER DECK SINGLE DOOR camera.', near: 'cam-08' },
      { id: 'pir-great', comp: 'S', kind: 'motion', name: 'Motion – great room', lat: 44.04142, lng: -121.37855, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Zone 5, pet-immune PIR.' },
      { id: 'gb-living', comp: 'S', kind: 'glass', name: 'Glass-break – living room', lat: 44.04148, lng: -121.37852, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Zone 6, acoustic glass-break.' },
      // ---- Access
      { id: 'gate-road', comp: 'A', kind: 'gate', name: 'Driveway entry – Macalpine Loop (gate unconfirmed)', lat: dt(39, 72.8).lat, lng: dt(39, 72.8).lng, vendor: 'Vyanet', status: 'online', placement: 'estimated', actions: ['unlock', 'who'], near: 'cam-13',
        desc: 'Single private entry off Macalpine Loop. The record\'s clarification #2 asks whether a gate or barrier is present; it is not resolvable at full resolution. Shown as a proposed keypad gate so the unlock flow can be walked through.' },
      { id: 'garage-door', comp: 'A', kind: 'door', name: 'Garage door – detached garage', lat: dt(58, 46).lat, lng: dt(58, 46).lng, vendor: 'Vyanet', status: 'online', placement: 'mock', actions: ['unlock', 'who'], near: 'cam-14',
        desc: 'Remote open/close through the panel. The DRIVEWAY camera confirms who is at the door before it opens.' },
      { id: 'entry-court', comp: 'A', kind: 'feature', name: 'Primary entry – driveway court', lat: dt(60, 67).lat, lng: dt(60, 67).lng, placement: 'surveyed', desc: 'Record concern pin 209 (Primary entry). Driveway terminates in a paved court near the building cluster.' },
      { id: 'priv-road', comp: 'A', kind: 'feature', name: 'Private road – curved approach', lat: dt(55, 72).lat, lng: dt(55, 72).lng, placement: 'surveyed', desc: 'Record concern pin 210. Narrow and curved, limited forward visibility for large apparatus.' },
      { id: 'loop', comp: 'A', kind: 'feature', name: 'Circular driveway / turnaround', lat: dt(63, 55).lat, lng: dt(63, 55).lng, placement: 'surveyed', desc: 'Record concern pins 183 + 225. Looped drive gives a limited but functional turnaround near the structure.' },
      { id: 'side-gate', comp: 'A', kind: 'gate', name: 'Side gate – south', lat: 44.0412778, lng: -121.3783722, vendor: 'Owner', status: 'n/a', placement: 'surveyed', desc: 'Pedestrian gate seen in technician still cam-04. No hardware on file.', near: 'cam-04' },
      // ---- Fire
      { id: 'smoke-main', comp: 'F', kind: 'smoke', name: 'Smoke / heat – main level', lat: 44.0414, lng: -121.3786, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Life-safety zone 11.' },
      { id: 'smoke-base', comp: 'F', kind: 'smoke', name: 'Smoke / heat – basement', lat: 44.04136, lng: -121.37858, vendor: 'Vyanet', status: 'trouble', placement: 'mock', desc: 'Life-safety zone 12. Low-battery trouble reported 2 days ago.' },
      { id: 'smoke-upper', comp: 'F', kind: 'smoke', name: 'Smoke / heat – upper level', lat: 44.04145, lng: -121.37863, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Life-safety zone 13.' },
      { id: 'co-mech', comp: 'F', kind: 'smoke', name: 'CO – mechanical room', lat: 44.04134, lng: -121.37866, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Life-safety zone 14.' },
      { id: 'pool-water', comp: 'F', kind: 'water', name: 'Pool – supplemental water source', lat: dt(69, 32).lat, lng: dt(69, 32).lng, placement: 'surveyed', desc: 'Record pin 130. Potential tanker fill point at the NE corner of the improved area; access from the driveway is indirect and partly under canopy.' },
      { id: 'dsg-sw', comp: 'F', kind: 'hazard', name: 'Defensible-space gap – southwest', lat: nm(55, 42).lat, lng: nm(55, 42).lng, placement: 'surveyed', desc: 'Wildfire concern pin 230. Shrub and tree fuels press against the structure on the SW and SE sides; no cleared buffer equivalent to the north lawns.' },
      { id: 'open-perim', comp: 'F', kind: 'hazard', name: 'Open perimeter – west / north', lat: nm(50, 35).lat, lng: nm(50, 35).lng, placement: 'surveyed', desc: 'Wildfire concern pin 234. No fencing; unmanaged fuels allow surface and crown fire spread toward the structure.' },
      { id: 'drive-veg', comp: 'F', kind: 'hazard', name: 'Single access through dense vegetation', lat: nm(53.5, 48.5).lat, lng: nm(53.5, 48.5).lng, placement: 'surveyed', desc: 'Concern pin 186 (Driveway). Winding drive through high woody vegetation, no secondary egress.' },
      { id: 'no-hydrant', comp: 'F', kind: 'hydrant', name: 'No hydrant within 150 m', lat: 44.04095, lng: -121.3797, placement: 'estimated', status: 'n/a', desc: 'GIS fact: hydrants_150m = 0. Nearest hydrant to be confirmed with Bend Fire / water utility; plan for tanker shuttle or pool draft.' },
      // ---- Emergency service
      { id: 'staging', comp: 'E', kind: 'staging', name: 'Staging – paved apron south of structure', lat: dt(63, 55).lat + 0.00003, lng: dt(63, 55).lng - 0.00012, placement: 'estimated', desc: 'From the FR recommendations: EMS and command may use the open paved apron south of the structure without blocking apparatus egress. Commit one engine to the driveway entrance to hold the egress corridor.' },
      { id: 'dead-end', comp: 'E', kind: 'hazard', name: 'Dead end – single access, reverse-out', lat: dt(60, 67).lat - 0.00006, lng: dt(60, 67).lng + 0.0001, placement: 'surveyed', desc: 'Record concern pin 184. No turnaround loop rated for heavy apparatus; plan forward-in / reverse-out or multi-point turn on the court.' },
      { id: 'pendant', comp: 'E', kind: 'medical', name: 'Panic / medical pendant – master suite', lat: 44.04152, lng: -121.37849, vendor: 'Vyanet', status: 'online', placement: 'mock', desc: 'Two-way voice to Vyanet central station. Shown at the master suite; the pendant travels with the occupant.' },
      { id: 'lz-none', comp: 'E', kind: 'lz', name: 'Helicopter ground – none on parcel', lat: 44.0421, lng: -121.3799, placement: 'estimated', status: 'n/a', desc: 'Dense conifer canopy around all structures. Open terrain west of the developed core is unimproved scrub and not rated. Nearest usable ground to be designated with the agency.' },
      { id: 'tennis', comp: 'E', kind: 'feature', name: 'Tennis court – hard surface, not staging', lat: dt(57, 35.5).lat, lng: dt(57, 35.5).lng, placement: 'surveyed', desc: 'Record pin 144. Upper parcel hardcourt; does not contribute to staging and can impede movement if apparatus is positioned there.' }
    ]),
    zones: [
      { comp: 'F', kind: 'ring', name: 'Zone 1 – 30 ft ember-resistant', lat: dt(62, 50).lat, lng: dt(62, 50).lng, radius_m: 9.1 },
      { comp: 'F', kind: 'ring', name: 'Zone 2 – 100 ft defensible space', lat: dt(62, 50).lat, lng: dt(62, 50).lng, radius_m: 30.5 }
    ],
    routes: [
      { id: 'pool-route', comp: 'E', name: 'Pool incident', trigger: 'Person in distress in the pool; responders must reach it from the main entrance', start: 'Entrance (Macalpine Loop)', target: 'Pool',
        points: [[39, 72.8], [51.5, 66.5], [54.1, 53.5], [49.7, 43.8], [59.5, 37.2], [68.2, 32.3]].map(function (p) { return dt(p[0], p[1]); }) }
    ],
    report: {
      S: {
        status: '14 cameras surveyed · 4 associated to live feeds · 6 alarm zones',
        summary: 'Open perimeter, single approach. Camera coverage is strongest on the frontage and the rear decks; the north lawn and west side path are covered but not associated to live feeds yet.',
        considerations: 'Dense conifer clusters and established landscaping closely surround the main residence on all sides, limiting sightlines around the structure. The driveway is long, curved, and terminates in a looped configuration around the front of the residence. Eight CHEKT roster cameras (front courtyard, garage corner, garage exterior, HVAC enclosure, lower deck double doors, upper deck family and living room doors, side drone) do not yet have a pin.',
        recommendations: 'Associate the eight unpinned roster cameras to GPS stills on the next technician visit. Vary each cone by what the camera actually sees (door vs. driveway) rather than a fixed 90°. Treat the west side path (cam-12) and north lawn edge (cam-11) as the perimeter approach cameras for alarm-event review.'
      },
      A: {
        status: '1 vehicle entry · looped drive · 2 remote-operable openings (proposed)',
        summary: 'Everything arrives through one private entry off Macalpine Loop. The map gives the owner a button for each remote-operable opening and the camera that confirms who is standing there.',
        considerations: 'Single private road access point; narrow and curved with limited forward visibility. No secondary access exists from any other side of the property. Whether a gate or barrier is present at the road is not resolvable in the imagery (record clarification #2). The detached structure to the left is a garage or outbuilding; a separate entry point is unconfirmed (clarification #3).',
        recommendations: 'Confirm gate presence and hardware at the road entry. Put the garage door and any gate on the panel so unlock is one press from this map, with the DRIVEWAY and Driveway-court cameras as the confirmation views. Share a responder access code through the Knox / lockbox program rather than the owner code.'
      },
      F: {
        status: 'WUI parcel · 0 hydrants within 150 m · pool as supplemental water',
        summary: 'High-density ponderosa and sagebrush steppe on every side. The north lawns give some buffer; the southwest and southeast have no equivalent cleared zone.',
        considerations: 'Tree canopy approaches within a few metres of the building footprint and roofline. Lawn areas to the north and northeast provide localized fuel reduction near the pool deck and north façade, but the southwest and southeast perimeters show no equivalent buffer. Two chimneys and a solar array are ember-intrusion points on the roof. The single driveway winds through dense vegetation with no visible turnaround or secondary egress.',
        recommendations: 'Establish and maintain a 30 ft ember-resistant Zone 1 around the structure, thinning shrubs and low limbs on the SW and SE sides first. Prune limbs to 10 ft and open horizontal spacing between crowns on the west and south. Install and inspect chimney spark arrestors; harden eave soffits, roof-to-wall junctions and solar mounting gaps. Confirm driveway width and vertical clearance with Rural Fire District #2 and identify a turnaround near the structure.'
      },
      E: {
        status: 'Single access · reverse-out · staging on the south apron · no on-site LZ',
        summary: 'Responders arrive through one curved drive and must plan their own way out. The map carries the pool route, the staging apron, and the devices that reach the central station.',
        considerations: 'All apparatus must enter and exit via the same single access point. The paved court near the building cluster offers a multi-point turnaround but no rated loop. Heavy apparatus may need to reverse a significant distance. The open terrain behind and beside the developed core is unimproved scrub and is not suitable for heavy apparatus movement. Wildfire risk context is high given native vegetation immediately adjacent to all structures.',
        recommendations: 'Approach via Macalpine Loop; commit one engine to staging at the driveway entrance to hold the egress corridor while a second unit advances. Plan forward-in / reverse-out or use the court for a multi-point turn before committing fully. Note the pool at the NE corner as a potential tanker fill point. Stage EMS and command on the paved apron south of the structure. Conduct a defensive perimeter assessment on arrival, north and west flanks first.'
      }
    },
    limits: [
      'Whether the driveway loop is wide and structurally rated for engine / ladder turnaround (record clarification #1).',
      'Gate or barrier at the property entry off Macalpine Loop (clarification #2).',
      'Use and separate entry of the detached structure (clarification #3).',
      'On-site fire-suppression water beyond the pool: tank or hydrant (clarification #4).'
    ],
    events: [
      { t: 'Today 06:42', kind: 'motion', pin: 'cam-14', text: 'Motion · DRIVEWAY — vehicle on the frontage, clip saved' },
      { t: 'Yesterday 21:15', kind: 'door', pin: 'dc-front', text: 'Front door opened — disarmed by user code 2 within 30 s' },
      { t: '2 days ago 14:03', kind: 'trouble', pin: 'smoke-base', text: 'Low battery · Smoke / heat – basement' },
      { t: '2 days ago 02:51', kind: 'alarm', pin: 'gb-living', text: 'ALARM · Glass-break – living room. Cancelled by owner; no dispatch. Cameras on the rear decks showed no activity.' },
      { t: '5 days ago 17:30', kind: 'access', pin: 'garage-door', text: 'Garage door opened remotely by owner for landscaping contractor' }
    ],
    rosterUnpinned: ['FRONT COURTYARD', 'GARAGE CORNER DRIVEWAY', 'GARAGE EXTERIOR', 'HVAC ENCLOSURE', 'LOWER DECK DOUBLE DOORS', 'UPPER DECK FAMILY ROOM DOOR', 'UPPER DECK LIVING ROOM DOOR', 'SIDE DRONE']
  };

  // =========================================================================
  // 2. HOA — Highlands at Broken Top (Tracy's neighborhood, 46 mapped lots)
  // =========================================================================
  // id8 | address | lat | lng | coverage
  //   canvas  = live device canvas in production (Jones)
  //   safe    = base SAFE map complete (plane render + pins published)
  //   pending = base SAFE map in production (satellite pass only so far)
  var hoaMembers = [
    ['6de88883', '18775 Macalpine Loop', 44.0414545, -121.3786406, 'canvas'],
    ['da0c562f', '18605 Macalpine Loop', 44.0454757, -121.3686754, 'safe'],
    ['9c6ccd60', '18615 Macalpine Loop', 44.0445897, -121.3695608, 'safe'],
    ['6f58352e', '18625 Macalpine Loop', 44.0437261, -121.3709293, 'safe'],
    ['fc76a4d6', '18610 Macalpine Loop', 44.0431709, -121.3666879, 'pending'],
    ['51a47f9f', '18620 Macalpine Loop', 44.0418667, -121.3675744, 'pending'],
    ['aafb0d1f', '18640 Macalpine Loop', 44.0407355, -121.3695226, 'safe'],
    ['b83747dc', '18665 Macalpine Loop', 44.0421942, -121.373933, 'pending'],
    ['8442cdac', '61664 Belmore Loop', 44.039558, -121.3704465, 'safe'],
    ['648ec82e', '18650 Macalpine Loop', 44.0406831, -121.37229, 'pending'],
    ['ebfeb254', '61654 Belmore Loop', 44.0376863, -121.3713554, 'pending'],
    ['1e84fbc9', '61644 Belmore Loop', 44.0376599, -121.3733018, 'pending'],
    ['0ef52b62', '18700 Macalpine Loop', 44.0397164, -121.3744291, 'pending'],
    ['848be0b4', '61624 Belmore Loop', 44.0386625, -121.3768943, 'pending'],
    ['bb366698', '61656 Rowallan Ct', 44.0380761, -121.379597, 'pending'],
    ['9ecc2408', '18770 Macalpine Loop', 44.0394331, -121.3784851, 'pending'],
    ['3d3c84a2', '61646 Rowallan Ct', 44.0378181, -121.3822369, 'safe'],
    ['6b8693fa', '61665 Rowallan Ct', 44.0407554, -121.3811694, 'safe'],
    ['ace51107', '18780 Macalpine Loop', 44.0422213, -121.3827419, 'safe'],
    ['921dbe14', '18863 Sutherland Ct', 44.0435193, -121.3797949, 'safe'],
    ['f28fb2df', '18820 Macalpine Loop', 44.0442591, -121.3823549, 'safe'],
    ['4af46007', '18883 Sutherland Ct', 44.043717, -121.3769822, 'pending'],
    ['05189afd', '18882 Sutherland Ct', 44.0459538, -121.37673, 'pending'],
    ['eb37c893', '18830 Macalpine Loop', 44.0457845, -121.3823611, 'safe'],
    ['ad1e4590', '18895 Macalpine Loop', 44.0469842, -121.3794692, 'safe'],
    ['2158430c', '18870 Macalpine Loop', 44.047551, -121.3823526, 'safe'],
    ['d0ddc2a6', '18900 Macalpine Loop', 44.0484052, -121.3812532, 'safe'],
    ['69502289', '61951 Kildonan Ct', 44.0492055, -121.3792057, 'safe'],
    ['f5e0d087', '61971 Kildonan Ct', 44.0503494, -121.3793353, 'safe'],
    ['c607fbb5', '61970 Kildonan Ct', 44.0508552, -121.3768419, 'pending'],
    ['b0908263', '18950 Macalpine Loop', 44.04952, -121.376394, 'pending'],
    ['17126fba', '61850 Dunbar Ct', 44.0476255, -121.3728349, 'pending'],
    ['cf900c77', '61855 Dunbar Ct', 44.0468976, -121.3748063, 'pending'],
    ['d45b6ec8', '61825 Dunbar Ct', 44.0444686, -121.3748938, 'pending'],
    ['bd8a15dc', '61941 Ballantrae Ct', 44.0488324, -121.374174, 'pending'],
    ['aef86e1f', '61940 Ballantrae Ct', 44.0497, -121.3712267, 'pending'],
    ['9a020a6a', '61961 Ballantrae Ct', 44.050772, -121.3738656, 'pending'],
    ['460a56e1', '61960 Ballantrae Ct', 44.0516783, -121.3719781, 'pending'],
    ['12d47c27', '19045 Macalpine Loop', 44.0484884, -121.3700825, 'safe'],
    ['9eedad65', '19125 Macalpine Loop', 44.0493891, -121.3677507, 'safe'],
    ['2d3cb64d', '19100 Macalpine Loop', 44.0506705, -121.3694519, 'safe'],
    ['90c09670', '19135 Macalpine Loop', 44.0502494, -121.3662902, 'pending'],
    ['c76d279d', '19190 Macalpine Loop', 44.0519705, -121.364801, 'pending'],
    ['c87442f5', '19140 Macalpine Loop', 44.0517219, -121.3679157, 'pending'],
    ['e2f6752a', '61645 Rowallan Ct', 44.0386741, -121.3827286, 'safe'],
    ['cec7bfd5', '19065 Macalpine Loop', 44.047868, -121.369408, 'safe']
  ].map(function (r) {
    var cov = r[4];
    return {
      id: 'lot-' + r[0], comp: 'S', kind: 'lot', name: r[1], lat: r[2], lng: r[3],
      placement: 'surveyed', coverage: cov, hub: r[0],
      status: cov === 'canvas' ? 'live' : (cov === 'safe' ? 'online' : 'n/a'),
      desc: cov === 'canvas'
        ? 'Live Device Canvas in production: 14 surveyed cameras, 4 live feeds, device layer on the SAFE map. Open the residence view to see it.'
        : cov === 'safe'
          ? 'Base SAFE map complete: parcel-clipped aerial render, 4 obliques, reviewed element and concern pins. Device layer not yet requested.'
          : 'Base SAFE map in production: satellite pass complete, aerial render pending.'
    };
  });

  var hoa = {
    id: 'highlands',
    slug: 'hoa',
    vertical: 'hoa',
    verticalLabel: 'HOA',
    name: 'Highlands at Broken Top',
    address: 'Macalpine Loop · Bend, OR 97702 · 46 mapped lots',
    center: pt(44.0448, -121.3745),
    zoom: 16,
    status: 'reviewed',
    tier: ['Base SAFE map (community)', 'Per-lot SAFE maps', 'Device layer where homes have it'],
    monitoring: { alarm: 'Mixed providers', cameras: 'Per home', note: 'SAFE is vendor-agnostic: the community map sits above whatever each home has' },
    roles: [
      { id: 'owner', label: 'Board' },
      { id: 'responder', label: 'Responder' }
    ],
    links: [
      { label: 'Community map (hoa-viewer)', href: 'https://responder-intel.vyanet.com/hoa-viewer.html?hoa=highlands&property=6de88883bfd4a8349a901c54611ed9d7' }
    ],
    facts: [
      ['Lots mapped', '46'],
      ['Base SAFE maps complete', '21 (aerial render + reviewed pins)'],
      ['In production', '24 (satellite pass only)'],
      ['Live Device Canvas', '1 (18775 Macalpine Loop)'],
      ['Fire first due', 'BFD 301'],
      ['Fire district', 'Rural Fire District #2'],
      ['WUI', 'All assessed lots'],
      ['Flood zone', 'Not in SFHA (assessed lot)'],
      ['Streets', 'Macalpine Loop · Belmore Loop · Rowallan, Sutherland, Kildonan, Dunbar, Ballantrae Cts'],
      ['Vegetation', 'Ponderosa pine / big sagebrush steppe']
    ],
    members: hoaMembers,
    pins: hoaMembers.concat([
      { id: 'entry', comp: 'A', kind: 'gate', name: 'Community entry (location to confirm)', lat: 44.0527, lng: -121.3658, placement: 'estimated', status: 'n/a', actions: ['who'], near: 'entry-cam',
        desc: 'Arterial connection for the loop. Exact entry geometry, signage and any gate hardware are a bot-capture item; placed here so the access story reads end to end.' },
      { id: 'entry-cam', comp: 'S', kind: 'camera', name: 'Entry camera – proposed (license plate view)', lat: 44.0525, lng: -121.3661, heading: 160, fov: 60, range: 40, vendor: 'Proposed', status: 'offline', placement: 'mock',
        desc: 'Community cameras do not exist yet; Community Live stays a placeholder until they do. Shown as a proposed install so the board can see what the protective circle would add.' },
      { id: 'common', comp: 'E', kind: 'staging', name: 'Common open space – apparatus staging candidate', lat: 44.0445, lng: -121.3755, placement: 'estimated', desc: 'Interior open ground inside the loop. Suitability for heavy apparatus and helicopter use to be confirmed with Rural Fire District #2.' },
      { id: 'fuel-break-w', comp: 'F', kind: 'hazard', name: 'Western edge – unmanaged fuels', lat: 44.0420, lng: -121.3845, placement: 'estimated', desc: 'West flank of the subdivision meets continuous ponderosa and sagebrush. Per-lot wildfire assessments at the west edge show open perimeters with no cleared buffer.' },
      { id: 'cul-rowallan', comp: 'E', kind: 'hazard', name: 'Rowallan Ct – dead-end cul-de-sac', lat: 44.0385, lng: -121.3810, placement: 'estimated', desc: 'One of five courts off the loop. Dead ends concentrate evacuation and apparatus turnaround on one bulb.' },
      { id: 'cul-kildonan', comp: 'E', kind: 'hazard', name: 'Kildonan Ct – dead-end cul-de-sac', lat: 44.0500, lng: -121.3785, placement: 'estimated', desc: 'Dead-end court; turnaround on the bulb only.' },
      { id: 'cul-ballantrae', comp: 'E', kind: 'hazard', name: 'Ballantrae Ct – dead-end cul-de-sac', lat: 44.0503, lng: -121.3728, placement: 'estimated', desc: 'Dead-end court; turnaround on the bulb only.' },
      { id: 'evac', comp: 'E', kind: 'route', name: 'Evacuation direction – loop to arterial', lat: 44.0515, lng: -121.3675, placement: 'estimated', desc: 'The loop gives two directions of travel to the single arterial connection. Evacuation planning should assume every court empties onto the loop.' },
      { id: 'hyd-survey', comp: 'F', kind: 'hydrant', name: 'Hydrant survey – pending', lat: 44.0466, lng: -121.3770, placement: 'estimated', status: 'n/a', desc: 'The one assessed lot has 0 hydrants within 150 m. A community hydrant survey (Bend Fire / water utility) is a Fire-layer item for the board.' }
    ]),
    zones: [],
    routes: [],
    report: {
      S: {
        status: '46 lots in the protective circle · 1 live canvas · 21 base maps complete',
        summary: 'The board sees the whole circle at once: which homes have a SAFE map, which have devices on it, and where the community itself has nothing watching the entry.',
        considerations: 'Each home\'s security devices stay the home\'s own, whoever installed or monitors them. The community has no cameras today, so Community Live is an empty layer. Lots on the west and south edges back onto continuous open fuels with open perimeters.',
        recommendations: 'Offer the device layer to every home that already has cameras, regardless of monitoring provider. Treat an entry camera with a plate view as the first community device. Publish the coverage status to residents as the HOA\'s protective-circle statement.'
      },
      A: {
        status: 'One arterial connection · loop road · 5 courts',
        summary: 'Everything enters through one connection to the arterial and distributes on the loop. The courts are dead ends.',
        considerations: 'Entry geometry, signage and gate hardware are not yet captured. Several homes have long private drives through vegetation (18775 Macalpine is the worked example).',
        recommendations: 'Capture the entry with the bot (nadir + oblique) and record whether any barrier exists. Standardize reflective address markers at every drive entrance, a recommendation already issued on individual lots.'
      },
      F: {
        status: 'WUI community · Rural Fire District #2 · 1 of 46 lots assessed for defensible space',
        summary: 'The whole subdivision sits in sagebrush steppe and ponderosa. The one completed assessment shows the pattern: north lawns buffered, southwest and southeast open.',
        considerations: 'Fuel continuity across lot lines means one home\'s gap is the neighbor\'s exposure. No hydrant within 150 m of the assessed lot. The west edge meets unmanaged forest.',
        recommendations: 'Run the wildfire assessment on all 46 lots from the existing aerial renders. Publish a community hydrant survey. Coordinate a shared fuel-break along the western edge. Consider Firewise USA recognition with the SAFE maps as the documentation.'
      },
      E: {
        status: 'Loop geometry · dead-end courts · staging candidate inside the loop',
        summary: 'Responders have two ways around the loop but only one way in. The common ground inside the loop is the staging candidate.',
        considerations: 'Each court empties onto the loop; cul-de-sac bulbs are the only turnarounds. Private drives are long, curved, and canopied. No designated helicopter ground.',
        recommendations: 'Designate and confirm an apparatus staging area and a helicopter ground with Rural Fire District #2. Give responders the per-lot SAFE maps through the responder packet so turnaround and water notes travel with the dispatch.'
      }
    },
    limits: [
      'Community entry geometry and any gate hardware — not yet captured.',
      'Hydrant locations and flow across the subdivision — utility survey pending.',
      'Defensible-space status on 45 of 46 lots — assessments not yet run.'
    ],
    events: [
      { t: 'Today 07:10', kind: 'info', pin: 'lot-6de88883', text: 'Device layer refreshed — 18775 Macalpine Loop (14 cameras, 4 live)' },
      { t: 'Yesterday', kind: 'info', pin: 'lot-eb37c893', text: 'Base SAFE map published — 18830 Macalpine Loop' },
      { t: '3 days ago', kind: 'info', pin: 'hyd-survey', text: 'Fire layer item opened — community hydrant survey' }
    ]
  };

  // =========================================================================
  // 3. GOLF — Awbrey Glen Golf Club (proof-of-concept vertical)
  // =========================================================================
  var holeMeta = {
    1: { par: 5, yd: 554, hcp: 4, club: 1743, g: 'Bunker SE · water E · trees N · cart path W', lz: 'Water W ringed by reeds · conifers E · bare ground NW' },
    2: { par: 4, yd: 391, hcp: 14, club: 3095, g: 'Bunker SW · conifer shadow E half · cart path E', lz: 'Bunker N · 3 roofs (2 E, 1 W) · cart path E' },
    3: { par: 4, yd: 424, hcp: 8, club: 4321, g: 'Bunkers NW + E · conifers E · cart path E', lz: 'Pines W · 1 roof SW · bare ground W' },
    4: { par: 4, yd: 397, hcp: 2, club: 3552, g: 'Bunker NE · conifers W + SE · no cart path', lz: 'Bunker E-centre · 1 roof with driveway E · cart path W' },
    5: { par: 4, yd: 330, hcp: 16, club: 3604, g: 'Bunker N · dry grass E margin · no cart path', lz: '1 roof at E edge · pines W · cart path NW' },
    6: { par: 3, yd: 168, hcp: 12, club: 2895, g: 'Bunkers W, N, E · trees SE · cart path E', lz: '3 roofs E · sparse pines W' },
    7: { par: 4, yd: 404, hcp: 10, club: 2251, g: 'Bunker NW · water E with tall grass · broadleaf S', lz: 'Bunker N · 2 roofs E · cart path W' },
    8: { par: 3, yd: 197, hcp: 18, club: 1791, g: 'Bunkers W + NW · conifers E · cart path SW', lz: '3 bunkers around green · 3 roofs (2 W, 1 NE)' },
    9: { par: 5, yd: 538, hcp: 6, club: 255, g: 'Bunkers NW + E · shrubs E · no cart path', lz: 'Broadleaf N edge · cart path across N' },
    10: { par: 4, yd: 439, hcp: 11, club: 1459, g: 'No bunkers · broadleaf W + NE · cart path E', lz: 'Bunker N · dense trees W · cart path E' },
    11: { par: 3, yd: 204, hcp: 15, club: 2343, g: 'Bunker SW · broadleaf E + W · cart path W', lz: '2 bunkers · 4 roofs (2 W, 2 E) · 3 carts, mower at capture' },
    12: { par: 5, yd: 580, hcp: 3, club: 4394, g: 'No bunkers · water SE with tall grass · sprinkler arcs', lz: 'Checkered stripes · trees W + E · bare ground E' },
    13: { par: 3, yd: 189, hcp: 17, club: 4538, g: 'Bunker NE · rock outcrops + shrubs W · no cart path', lz: 'Bunkers N + SW · rock outcrops W · cart path S' },
    14: { par: 4, yd: 437, hcp: 7, club: 4016, g: 'Bunker W · cart paths E + W', lz: 'No bunkers · trees W · cart path SE' },
    15: { par: 5, yd: 590, hcp: 1, club: 4859, g: 'Bunker S · fairway W · cart path NE corner', lz: 'Curved bunker NE · rock, shrubs, bare ground W' },
    16: { par: 3, yd: 221, hcp: 13, club: 3853, g: 'Bunker NW · grassy hollow N · broadleaf E + W', lz: '3 bunkers around green · trees N + E' },
    17: { par: 4, yd: 389, hcp: 9, club: 2254, g: 'Bunker NW · conifers E + NW · cart path W', lz: 'Bunker N · 4 roofs (2 W, 2 E) · cart path W' },
    18: { par: 5, yd: 555, hcp: 5, club: 623, g: 'Bunkers W, NE, SE · trees W · cart path W', lz: 'Water SE corner with reeds · 1 roof W · cart path W' }
  };
  var greenImg = {
    1: 'v1790713365/Awbrey_Glen_-_Hole_01_green_hcvifx.png', 2: 'v1790713365/Awbrey_Glen_-_Hole_02_green_sglpky.png', 3: 'v1790713365/Awbrey_Glen_-_Hole_03_green_sbxf81.png',
    4: 'v1790713365/Awbrey_Glen_-_Hole_04_green_nouzbc.png', 5: 'v1790713365/Awbrey_Glen_-_Hole_05_green_lwdmzf.png', 6: 'v1790713365/Awbrey_Glen_-_Hole_06_green_radqxt.png',
    7: 'v1790713365/Awbrey_Glen_-_Hole_07_green_clgjmp.png', 8: 'v1790713366/Awbrey_Glen_-_Hole_08_green_a7lx2f.png', 9: 'v1790713366/Awbrey_Glen_-_Hole_09_green_n2qq3l.png',
    10: 'v1790713366/Awbrey_Glen_-_Hole_10_green_hsdqgm.png', 11: 'v1790713366/Awbrey_Glen_-_Hole_11_green_vd5cwr.png', 12: 'v1790713366/Awbrey_Glen_-_Hole_12_green_eqspdt.png',
    13: 'v1790713366/Awbrey_Glen_-_Hole_13_green_ad6vaj.png', 14: 'v1790713366/Awbrey_Glen_-_Hole_14_green_avhejq.png', 15: 'v1790713366/Awbrey_Glen_-_Hole_15_green_n5s9js.png',
    16: 'v1790713366/Awbrey_Glen_-_Hole_16_green_y47c5i.png', 17: 'v1790713367/Awbrey_Glen_-_Hole_17_green_ovvfib.png', 18: 'v1790713367/Awbrey_Glen_-_Hole_18_green_ver0uz.png'
  };
  var lzImg = {
    1: 'v1790797642/Awbrey_Glen_-_Hole_01_fairway_jzoald.png', 2: 'v1790797643/Awbrey_Glen_-_Hole_02_fairway_wthkwh.png', 3: 'v1790797643/Awbrey_Glen_-_Hole_03_fairway_gwum5f.png',
    4: 'v1790797644/Awbrey_Glen_-_Hole_04_fairway_riyj4c.png', 5: 'v1790797644/Awbrey_Glen_-_Hole_05_fairway_zetx0r.png', 6: 'v1790797645/Awbrey_Glen_-_Hole_06_fairway_jptho4.png',
    7: 'v1790797646/Awbrey_Glen_-_Hole_07_fairway_gyr0p4.png', 8: 'v1790797646/Awbrey_Glen_-_Hole_08_fairway_nq7gmn.png', 9: 'v1790797647/Awbrey_Glen_-_Hole_09_fairway_fdpprq.png',
    10: 'v1790797647/Awbrey_Glen_-_Hole_10_fairway_rb0jmg.png', 11: 'v1790797648/Awbrey_Glen_-_Hole_11_fairway_rzhhyl.png', 12: 'v1790797649/Awbrey_Glen_-_Hole_12_fairway_uicbwl.png',
    13: 'v1790797649/Awbrey_Glen_-_Hole_13_fairway_juv5tn.png', 14: 'v1790797650/Awbrey_Glen_-_Hole_14_fairway_zwbsga.png', 15: 'v1790797651/Awbrey_Glen_-_Hole_15_fairway_oavqc0.png',
    16: 'v1790797651/Awbrey_Glen_-_Hole_16_fairway_yg4h0a.png', 17: 'v1790797652/Awbrey_Glen_-_Hole_17_fairway_qcos3i.png', 18: 'v1790797653/Awbrey_Glen_-_Hole_18_fairway_qfesst.png'
  };
  // Sheet column K pins (golf API). Greens 1–18, landing zones 1–18.
  var greens = [
    [1, 44.083796, -121.351585], [2, 44.087521, -121.352174], [3, 44.09097, -121.351945], [4, 44.088319, -121.354479],
    [5, 44.087371, -121.35737], [6, 44.084469, -121.357859], [7, 44.080909, -121.35781], [8, 44.079284, -121.356367],
    [9, 44.078933, -121.350402], [10, 44.083183, -121.348503], [11, 44.085631, -121.348506], [12, 44.091277, -121.348593],
    [13, 44.091601, -121.351624], [14, 44.089183, -121.356147], [15, 44.09232, -121.353126], [16, 44.089029, -121.355095],
    [17, 44.084563, -121.353931], [18, 44.079459, -121.351893]
  ];
  var lzs = [
    [1, 44.081841, -121.35168], [2, 44.086527, -121.352195], [3, 44.089794, -121.352281], [4, 44.089548, -121.35374],
    [5, 44.088376, -121.357259], [6, 44.085355, -121.357431], [7, 44.082149, -121.357517], [8, 44.079383, -121.356594],
    [9, 44.078511, -121.353397], [10, 44.081718, -121.348419], [11, 44.08534, -121.348504], [12, 44.088869, -121.348247],
    [13, 44.091612, -121.351251], [14, 44.090719, -121.355028], [15, 44.091243, -121.355757], [16, 44.089255, -121.354963],
    [17, 44.085725, -121.354341], [18, 44.081533, -121.353569]
  ];
  // Restroom + water stations named in the club's local rules: after greens 4, 9, 14, 16.
  var stations = { 4: true, 9: true, 14: true, 16: true };

  var golfPins = [];
  greens.forEach(function (g) {
    var h = g[0], m = holeMeta[h];
    golfPins.push({
      id: 'green-' + h, comp: 'E', kind: 'green', hole: h, num: h, name: 'Green ' + h,
      lat: g[1], lng: g[2], placement: 'surveyed', image: CLD + greenImg[h], image2: CLD + lzImg[h],
      meta: m, report: '../golf-reports/awbrey-glen.html#hole-' + h,
      desc: 'Par ' + m.par + ' · ' + m.yd + ' yd · HCP ' + m.hcp + ' · ' + m.club.toLocaleString() + ' ft from the clubhouse. ' + m.g + '.'
    });
    if (stations[h]) {
      golfPins.push({
        id: 'station-' + h, comp: 'E', kind: 'medical', name: 'Restroom + water station – after green ' + h,
        lat: g[1] + 0.00012, lng: g[2] + 0.00018, placement: 'estimated',
        desc: 'Named in the club\'s local rules. A fixed landmark for an on-course medical call and a shelter point in a lightning hold.'
      });
    }
  });
  lzs.forEach(function (l) {
    var h = l[0], m = holeMeta[h];
    golfPins.push({
      id: 'lz-' + h, comp: 'A', kind: 'fairway', hole: h, num: h, name: 'Landing zone ' + h,
      lat: l[1], lng: l[2], placement: 'surveyed', image: CLD + lzImg[h], meta: m,
      report: '../golf-reports/awbrey-glen.html#hole-' + h,
      desc: 'Primary tee-shot landing area, hole ' + h + '. ' + m.lz + '. Where divots and wear concentrate and where a superintendent looks first.'
    });
  });

  var golf = {
    id: 'aa0dd9d365e53b1e1d59633ccdbe992b',
    slug: 'golf',
    vertical: 'golf',
    verticalLabel: 'Golf course',
    name: 'Awbrey Glen Golf Club',
    address: '2500 NW Awbrey Glen Dr, Bend, OR 97703 · 18 holes · par 72 · 7,007 yd',
    center: pt(44.0855, -121.3528),
    zoom: 15,
    status: 'reviewed',
    tier: ['Base SAFE map', 'Golf customization (per-hole report)', 'Device layer (multi-vendor)', 'Drone tier available'],
    monitoring: { alarm: 'Another provider', cameras: 'Third-party camera vendor', note: 'Irrigation contractor · gate contractor · camera vendor · alarm provider — SAFE is the one view' },
    roles: [
      { id: 'owner', label: 'GM / Superintendent' },
      { id: 'responder', label: 'Responder' }
    ],
    links: [
      { label: 'Per-hole report (golf-reports)', href: '../golf-reports/awbrey-glen.html' },
      { label: 'Course map (golf-viewer)', href: 'https://responder-intel.vyanet.com/golf-viewer.html?sheet=Awbrey%20Glen%20Golf%20Course' },
      { label: '3D model (DJI)', href: 'https://3dviewer.dji.com/s/de0f7e6d-3c61-43b8-9334-f5c2a30b42fc' }
    ],
    facts: [
      ['Architect', 'Gene "Bunny" Mason (1993); updated by David McLay Kidd'],
      ['Superintendent', 'Kyle Watt'],
      ['Capture', '2026-07-02 (Nearmap vertical + oblique, bot-captured)'],
      ['Property extent', '5,607 ft N–S × 3,086 ft E–W'],
      ['Irrigated turf', '76.6 acres in 46 patches · largest 38.2%'],
      ['Canopy cover', '28.8%'],
      ['Water surface', '3.8 acres across 5 ponds'],
      ['Bunkers', '45'],
      ['Parking stalls', '87'],
      ['Residences on routing', '6 frames · canopy at roof in 5 of 6'],
      ['Farthest green from clubhouse', 'Green 15 · 4,859 ft (0.92 mi)']
    ],
    holes: holeMeta,
    pins: golfPins.concat([
      // ---- real sheet feature pins (coords surveyed; images from the report)
      { id: 'clubhouse', comp: 'S', kind: 'building', name: 'Clubhouse and arrival', lat: 44.079252, lng: -121.349535, placement: 'surveyed', image: CLD + 'v1790806753/Awbrey_Glen_-_Clubhouse_oblique_zixlwz.png',
        desc: '3 structures: multi-wing clubhouse, covered structure SE, small structure S. Striped lot NE (87 stalls), 7 carts on the pad NW, 12 vehicles at capture.' },
      { id: 'practice', comp: 'A', kind: 'feature', name: 'Practice areas – range tees and short game', lat: 44.079437, lng: -121.35065, placement: 'surveyed', image: CLD + 'v1790806760/Awbrey_Glen_-_Practice_oblique_re1ovn.png',
        desc: 'Paths on all sides; 11 carts on the path north of the green, 7 on the paved pad east. Open mown range tee pads north.' },
      { id: 'maint', comp: 'F', kind: 'hazard', name: 'Maintenance compound', lat: 44.083691, lng: -121.349706, placement: 'surveyed', image: CLD + 'v1790806755/Awbrey_Glen_-_Maintenance_oblique_viuwqy.png',
        desc: '6 structures, 10 vehicles, 6 equipment units, 1 trailer; equipment and bins under open-sided cover. Fuel and chemical storage contents are not visible from imagery — a site-walk item.' },
      { id: 'water-1', comp: 'F', kind: 'water', name: 'Pond AG-WTR-01 – 1.18 acres (hole 1)', lat: 44.083568, lng: -121.350994, placement: 'surveyed', image: CLD + 'v1790806767/Awbrey_Glen_-_Water_oblique_rj8zev.png',
        desc: 'Elongated N–S with a tree-covered island; reed fringe on the west shore, tree-lined east shore. Drafting candidate; depth not established.' },
      { id: 'water-2', comp: 'F', kind: 'water', name: 'Pond AG-WTR-02 – 1.19 acres (holes 1, 18)', lat: 44.0812, lng: -121.3525, placement: 'estimated', desc: 'Grass to the waterline on both shores; cart path east. Drafting candidate; depth not established.' },
      { id: 'water-3', comp: 'F', kind: 'water', name: 'Pond AG-WTR-03 – 0.81 acres (holes 7, 8)', lat: 44.0801, lng: -121.3572, placement: 'estimated', desc: 'Tree island west of centre; road and structure SE.' },
      { id: 'water-4', comp: 'F', kind: 'water', name: 'Pond AG-WTR-04 – 0.49 acres (hole 12)', lat: 44.0909, lng: -121.3482, placement: 'estimated', desc: 'Rounded with a western lobe; sprinkler arcs NW at capture.' },
      { id: 'water-5', comp: 'F', kind: 'water', name: 'Pond AG-WTR-05 – 0.13 acres (hole 12)', lat: 44.0895, lng: -121.348, placement: 'estimated', desc: 'Small rounded pond; fairway west, road and structure east.' },
      { id: 'res-1', comp: 'F', kind: 'hazard', name: 'Residence AG-RES-01 – canopy at roof', lat: 44.084369, lng: -121.353397, placement: 'surveyed', image: CLD + 'v1790806762/Awbrey_Glen_-_Residence_oblique_zlvdna.png',
        desc: 'Conifer crowns touch the western roof edge; 55 ft to played turf. The club does not own the structure and in most cases cannot touch the vegetation on it. 5 of 6 residence frames show canopy contact.' },
      { id: 'tee-15', comp: 'A', kind: 'feature', name: 'Tee complex AG-TEE-01 – hole 15', lat: 44.089422, lng: -121.357394, placement: 'surveyed', image: CLD + 'v1790806764/Awbrey_Glen_-_Tee_oblique_etft0q.png',
        desc: 'Elongated mown loop with a pad at the western end; single tree west within falling distance of the pad.' },
      // ---- street crossings (AG-PTH-01 surveyed; 02–05 estimated between the holes they join)
      { id: 'pth-1', comp: 'A', kind: 'crossing', name: 'Street crossing AG-PTH-01 – holes 1→2, NW Champion Cir', lat: 44.084246, lng: -121.351766, placement: 'surveyed', image: CLD + 'v1790806759/Awbrey_Glen_-_Path_vertical_j2yce6.png', desc: 'Paved, two painted lines across the road; canopy on all sides. Carts cross a public street here.' },
      { id: 'pth-2', comp: 'A', kind: 'crossing', name: 'Street crossing AG-PTH-02 – holes 10→11, NW Champion Cir', lat: 44.0842, lng: -121.3485, placement: 'estimated', desc: 'Paved crossing; trees on both sides.' },
      { id: 'pth-3', comp: 'A', kind: 'crossing', name: 'Street crossing AG-PTH-03 – holes 11→12, NW Vardon Ct', lat: 44.0861, lng: -121.3485, placement: 'estimated', desc: 'Paved crossing; trees on both sides.' },
      { id: 'pth-4', comp: 'A', kind: 'crossing', name: 'Street crossing AG-PTH-04 – holes 16→17, NW McCready Dr', lat: 44.0881, lng: -121.3549, placement: 'estimated', desc: 'Paved crossing; trees on both sides.' },
      { id: 'pth-5', comp: 'A', kind: 'crossing', name: 'Street crossing AG-PTH-05 – holes 17→18, NW Champion Cir', lat: 44.084, lng: -121.3545, placement: 'estimated', desc: 'Paved crossing; trees on both sides.' },
      // ---- device layer (mock, multi-vendor)
      { id: 'g-cam-1', comp: 'S', kind: 'camera', name: 'Clubhouse entry camera', lat: 44.07935, lng: -121.34935, heading: 20, fov: 90, range: 35, vendor: 'Third-party camera vendor', status: 'online', placement: 'mock', desc: 'Existing camera, not installed by Vyanet. Pulled onto the SAFE map through the vendor\'s API.' },
      { id: 'g-cam-2', comp: 'S', kind: 'camera', name: 'Cart barn camera', lat: 44.07915, lng: -121.34985, heading: 300, fov: 100, range: 30, vendor: 'Third-party camera vendor', status: 'online', placement: 'mock', desc: 'Covers the cart staging pad and barn doors.' },
      { id: 'g-cam-3', comp: 'S', kind: 'camera', name: 'Parking lot camera', lat: 44.0796, lng: -121.3491, heading: 60, fov: 110, range: 50, vendor: 'Third-party camera vendor', status: 'offline', placement: 'mock', desc: 'Offline at last poll. 87-stall lot; after-hours vehicle activity.' },
      { id: 'g-cam-4', comp: 'S', kind: 'camera', name: 'Maintenance yard camera', lat: 44.0838, lng: -121.3496, heading: 200, fov: 90, range: 40, vendor: 'Third-party camera vendor', status: 'online', placement: 'mock', desc: 'Covers the yard gate and the fuel area.' },
      { id: 'g-panel', comp: 'S', kind: 'panel', name: 'Intrusion panel – pro shop (another provider)', lat: 44.0792, lng: -121.3494, vendor: 'Another alarm provider', status: 'online', placement: 'mock', desc: 'Monitored by a competitor. SAFE layers on top; Vyanet does not need the monitoring contract to map it.' },
      { id: 'g-gate-maint', comp: 'A', kind: 'gate', name: 'Maintenance yard gate', lat: 44.0836, lng: -121.3494, vendor: 'Gate contractor', status: 'online', placement: 'mock', actions: ['unlock', 'who'], near: 'g-cam-4', desc: 'Contractor-installed gate operator. Unlock from the map and confirm on the yard camera who is at the gate.' },
      { id: 'g-gate-entry', comp: 'A', kind: 'gate', name: 'Service entrance gate – Awbrey Glen Dr', lat: 44.0786, lng: -121.3489, vendor: 'Gate contractor', status: 'online', placement: 'mock', actions: ['unlock', 'who'], near: 'g-cam-3', desc: 'Delivery and vendor access after hours.' },
      { id: 'g-door-proshop', comp: 'A', kind: 'door', name: 'Pro shop door – access reader', lat: 44.07922, lng: -121.34945, vendor: 'Another alarm provider', status: 'online', placement: 'mock', actions: ['unlock', 'who'], near: 'g-cam-1', desc: 'Reader on the competitor\'s access system. Staff credentials, remote unlock from this map.' },
      { id: 'g-irr', comp: 'A', kind: 'panel', name: 'Irrigation central controller + pump station', lat: 44.0833, lng: -121.3509, vendor: 'Irrigation contractor', status: 'online', placement: 'mock', desc: 'Pump station at pond 1 and the central controller. A third vendor\'s system on the same map as the cameras and gates.' },
      { id: 'g-fuel', comp: 'F', kind: 'hazard', name: 'Fuel storage – maintenance yard (contents to confirm)', lat: 44.0839, lng: -121.3499, placement: 'mock', desc: 'Above-ground fuel and chemical storage is typical here; the imagery cannot see inside the structures. Pre-plan item for Bend Fire.' },
      { id: 'g-aed', comp: 'E', kind: 'medical', name: 'AED – clubhouse', lat: 44.0793, lng: -121.3496, placement: 'mock', desc: 'The only AED on the property in this mock. Green 15 is 4,859 ft away — nearly a mile by cart path.' },
      { id: 'g-lz', comp: 'E', kind: 'lz', name: 'Helicopter ground – range tee (confirm with AirLink)', lat: 44.0801, lng: -121.3505, placement: 'estimated', desc: 'Open mown range tee pads north of the practice green; the largest clear turf near the clubhouse and the lot.' },
      { id: 'g-staging', comp: 'E', kind: 'staging', name: 'Apparatus staging – clubhouse lot', lat: 44.0797, lng: -121.3489, placement: 'estimated', desc: '87-stall striped lot adjacent to the clubhouse. Course interior is reached by cart path only.' },
      { id: 'g-sentry', comp: 'E', kind: 'alert', name: 'Tee Sentry lightning signal – 18th tee', lat: 44.0834, lng: -121.3551, placement: 'estimated', desc: 'Named in the club\'s local rules ("Use the Tee Sentry signal on the 18th tee"). The course\'s own weather hold signal, worth a pin for the Emergency layer.' }
    ]),
    zones: [],
    routes: [
      { id: 'cart-route-12', comp: 'E', name: 'Cart-path reach – clubhouse to green 12', trigger: 'Medical call at the far north end of the routing', start: 'Clubhouse', target: 'Green 12',
        points: [pt(44.079252, -121.349535), pt(44.0812, -121.3486), pt(44.083183, -121.348503), pt(44.085631, -121.348506), pt(44.088869, -121.348247), pt(44.091277, -121.348593)] }
    ],
    report: {
      S: {
        status: '4 cameras (third-party) · 1 intrusion panel (another provider) · maintenance yard watched',
        summary: 'The club already owns cameras and an alarm from other vendors. SAFE pulls them onto one map rather than replacing them; the clubhouse, cart barn and maintenance yard are the watched structures.',
        considerations: 'Camera coverage and field of view cannot be established from imagery (report limit); the device layer here is a mock of what the vendor API would supply. The maintenance compound holds 10 vehicles and 6 equipment units in the open. Residences on the routing are private property.',
        recommendations: 'Connect the existing camera vendor and the intrusion panel to the SAFE map; vary each cone to the actual view. Add a plate-view camera at the service entrance. Review after-hours lot activity against the parking camera.'
      },
      A: {
        status: '5 public-street cart crossings · 2 gates · 1 access reader · 18 landing zones pinned',
        summary: 'Carts cross public streets five times on the routing. The service entrance and the maintenance gate are the controlled openings; the pro shop reader is on the alarm vendor\'s system.',
        considerations: 'Gate control hardware is not resolvable from imagery (report limit). Cart paths under pine canopy are hidden in verticals, so traced lengths are minimums. Street crossings at NW Champion Cir (three), NW Vardon Ct and NW McCready Dr carry carts across live traffic.',
        recommendations: 'Record gate hardware and codes with the gate contractor and put unlock on this map. Pin every street crossing with its signage state. Use the landing-zone pins as the superintendent\'s wear-inspection route.'
      },
      F: {
        status: '28.8% canopy · 5 ponds, 3.8 acres · canopy at roof on 5 of 6 residence frames · fuel storage unconfirmed',
        summary: 'The course is the fuel break for the homes around it and the water source for the whole hillside. Five ponds are drafting candidates; the maintenance yard is the hazard.',
        considerations: 'Hydrant locations and flow are not resolvable under canopy (report limit). Pond depth is not visible. Fuel and chemical storage in the maintenance compound cannot be seen from the air. Residences on the routing have conifer crowns touching roofs; the club cannot touch vegetation it does not own.',
        recommendations: 'Confirm ponds 1 and 2 as drafting sites with Bend Fire (access, depth, dry-hydrant option). Walk the maintenance yard for fuel and chemical inventory and add it to the pre-plan. Share the residence frames with the HOA as a shared-fuel conversation. Request the Bend Fire hydrant map for the Awbrey Glen Dr frontage.'
      },
      E: {
        status: 'Far greens 0.8–0.9 mi from the clubhouse AED · range tee as LZ candidate · 4 fixed stations',
        summary: 'A medical event on holes 12–15 is nearly a mile from the clubhouse by cart path. The map carries the reach route, the water stations as landmarks, the range tee as helicopter ground and the club\'s own lightning signal.',
        considerations: 'Greens 12, 13, 14 and 15 are 4,000–4,900 ft from the clubhouse pin. Course interior is cart-path access only; apparatus stage at the lot. Restroom and water stations after greens 4, 9, 14 and 16 are fixed, named landmarks. Ground slope and drainage are not visible in single frames.',
        recommendations: 'Place a second AED at the hole 13/14 station. Pre-plan the cart-path reach route and confirm which paths carry a UTV ambulance. Confirm the range tee with AirLink as helicopter ground. Give responders the per-hole report so a caller\'s "hole 12" resolves to a pin.'
      }
    },
    limits: [
      'Gate control hardware — site walk or club access-control inventory.',
      'Camera coverage and field of view — security plan or on-site survey.',
      'Hydrant locations and flow — Bend Fire / water utility hydrant map.',
      'Irrigation pipe and valve positions — as-builts from the superintendent.',
      'Water depth in the five ponds — bathymetric survey or club records.',
      'Fuel and chemical storage in the maintenance yard — inventory or site visit.',
      'Cart path length and paths under canopy — club plan or field GPS trace.'
    ],
    events: [
      { t: 'Today 05:58', kind: 'access', pin: 'g-gate-maint', text: 'Maintenance yard gate opened — crew credential (gate contractor system)' },
      { t: 'Yesterday 23:40', kind: 'motion', pin: 'g-cam-3', text: 'Parking lot camera went offline — vendor notified' },
      { t: 'Yesterday 16:05', kind: 'alert', pin: 'g-sentry', text: 'Lightning hold — Tee Sentry signal active 42 min' },
      { t: '3 days ago 03:12', kind: 'alarm', pin: 'g-panel', text: 'ALARM · Pro shop rear door (another provider). Cart barn camera showed a staff member; cancelled.' }
    ]
  };

  // =========================================================================
  // 4. SCHOOL — Bend Senior High School (standard profile, draft)
  // =========================================================================
  var school = {
    id: 'bend-senior-high',
    slug: 'school',
    vertical: 'school',
    verticalLabel: 'School',
    name: 'Bend Senior High School',
    address: '230 NE 6th St, Bend, OR 97701 · Bend-La Pine Schools · grades 9–12',
    center: pt(44.0521, -121.2961),
    zoom: 17,
    status: 'draft',
    draftNote: 'No imagery pass yet. Every pin is a desk-pass placeholder; the bot capture (Nearmap nadir + obliques), the per-building report and the reviewer pass come next. Nothing here should be read as a verified site fact.',
    tier: ['Base SAFE map', 'Device layer (district systems)', 'Occupant considerations'],
    monitoring: { alarm: 'Another provider (fire + intrusion)', cameras: 'District camera system', note: 'District-managed access control; SAFE layers on top' },
    roles: [
      { id: 'owner', label: 'Principal / District' },
      { id: 'responder', label: 'Responder / SRO' }
    ],
    links: [
      { label: 'NCES school record', href: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=410198000270' },
      { label: 'School website', href: 'https://bendhigh.blschools.org/' }
    ],
    facts: [
      ['Students', '1,204 (2024–25) · 9: 318 · 10: 289 · 11: 318 · 12: 279'],
      ['Teachers', '53.6 FTE · ratio 22.5'],
      ['District', 'Bend-La Pine Administrative SD 1'],
      ['Principal', 'Christopher Reese'],
      ['Main office', '541-355-3700'],
      ['Established', '1904 (oldest high school in Bend)'],
      ['Mascot / colors', 'Lava Bears · blue and gold'],
      ['Elevation', '3,660 ft'],
      ['Locale', 'City, midsize · Deschutes County'],
      ['Capture', 'None yet — bot pass pending']
    ],
    pins: [
      // ---- Security
      { id: 's-cam-1', comp: 'S', kind: 'camera', name: 'Main entrance camera', lat: 44.05205, lng: -121.29745, heading: 270, fov: 90, range: 30, vendor: 'District camera system', status: 'online', placement: 'mock', desc: 'Covers the secure vestibule approach from NE 6th St.' },
      { id: 's-cam-2', comp: 'S', kind: 'camera', name: 'Student lot camera', lat: 44.05215, lng: -121.2947, heading: 90, fov: 100, range: 40, vendor: 'District camera system', status: 'online', placement: 'mock', desc: 'East lot toward NE 9th St.' },
      { id: 's-cam-3', comp: 'S', kind: 'camera', name: 'Bus loop camera', lat: 44.05095, lng: -121.2965, heading: 180, fov: 100, range: 40, vendor: 'District camera system', status: 'online', placement: 'mock', desc: 'Bus bays and the south approach.' },
      { id: 's-cam-4', comp: 'S', kind: 'camera', name: 'Commons / courtyard camera', lat: 44.05195, lng: -121.296, heading: 0, fov: 90, range: 25, vendor: 'District camera system', status: 'online', placement: 'mock', desc: 'Interior courtyard between wings.' },
      { id: 's-cam-5', comp: 'S', kind: 'camera', name: 'Stadium gate camera', lat: 44.0535, lng: -121.2952, heading: 45, fov: 90, range: 30, vendor: 'District camera system', status: 'offline', placement: 'mock', desc: 'Event-night gate; offline at last poll.' },
      { id: 's-panel', comp: 'S', kind: 'panel', name: 'Intrusion panel – monitored by another provider', lat: 44.052, lng: -121.29735, vendor: 'Another alarm provider', status: 'online', placement: 'mock', desc: 'Existing contract. SAFE does not require the monitoring relationship to map the devices.' },
      { id: 's-lockdown', comp: 'S', kind: 'alert', name: 'Lockdown / panic button – front office', lat: 44.05202, lng: -121.2974, vendor: 'District', status: 'online', placement: 'mock', desc: 'Initiates lockdown announcement and notifies dispatch.' },
      { id: 's-blind', comp: 'S', kind: 'hazard', name: 'Sightline gap – loading dock recess', lat: 44.0524, lng: -121.2959, placement: 'mock', desc: 'Recessed service area not covered by the courtyard camera in this mock. Placeholder for the reviewer pass.' },
      // ---- Access
      { id: 'a-vestibule', comp: 'A', kind: 'door', name: 'Secure vestibule – visitor check-in', lat: 44.052, lng: -121.2975, vendor: 'District access control', status: 'online', placement: 'mock', actions: ['unlock', 'who'], near: 's-cam-1', desc: 'Single point of entry during the school day. ID scan at the window; remote release from the office.' },
      { id: 'a-knox', comp: 'A', kind: 'key', name: 'Knox box – main entrance', lat: 44.05198, lng: -121.29755, placement: 'mock', desc: 'Responder key access. Location to be confirmed with Bend Fire.' },
      { id: 'd1', comp: 'A', kind: 'door', name: 'Exterior door D1 – main entrance', lat: 44.052, lng: -121.29752, vendor: 'District access control', status: 'online', placement: 'mock', actions: ['unlock', 'who'], near: 's-cam-1', desc: 'Numbered for responders. Contact + reader.' },
      { id: 'd2', comp: 'A', kind: 'door', name: 'Exterior door D2 – office side', lat: 44.05215, lng: -121.29752, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Contact + reader.' },
      { id: 'd3', comp: 'A', kind: 'door', name: 'Exterior door D3 – gym north', lat: 44.0527, lng: -121.2956, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Event entry; propped-door alert.' },
      { id: 'd4', comp: 'A', kind: 'door', name: 'Exterior door D4 – gym east', lat: 44.05255, lng: -121.2953, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Contact + reader.' },
      { id: 'd5', comp: 'A', kind: 'door', name: 'Exterior door D5 – kitchen service', lat: 44.05175, lng: -121.29585, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Deliveries; contact + reader.' },
      { id: 'd6', comp: 'A', kind: 'door', name: 'Exterior door D6 – commons south', lat: 44.0516, lng: -121.2964, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Bus-loop side; contact + reader.' },
      { id: 'd7', comp: 'A', kind: 'door', name: 'Exterior door D7 – science wing east', lat: 44.0521, lng: -121.2954, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Contact + reader.' },
      { id: 'd8', comp: 'A', kind: 'door', name: 'Exterior door D8 – auditorium west', lat: 44.05175, lng: -121.29745, vendor: 'District access control', status: 'online', placement: 'mock', desc: 'Event entry; contact + reader.' },
      { id: 'a-fieldgate', comp: 'A', kind: 'gate', name: 'Field gate – perimeter fence', lat: 44.0533, lng: -121.2949, vendor: 'District', status: 'n/a', placement: 'mock', desc: 'Chained after hours. Apparatus access to the field for a helicopter landing goes through here.' },
      { id: 'a-busloop', comp: 'A', kind: 'feature', name: 'Bus loop – one-way', lat: 44.0509, lng: -121.2964, placement: 'mock', desc: 'Morning and afternoon bus staging. Blocks the south frontage at bell times.' },
      { id: 'a-dropoff', comp: 'A', kind: 'feature', name: 'Parent drop-off – NE 6th St', lat: 44.0514, lng: -121.2977, placement: 'mock', desc: 'Queues onto NE 6th St at bell times.' },
      { id: 'a-stulot', comp: 'A', kind: 'feature', name: 'Student lot – NE 9th St side', lat: 44.0521, lng: -121.2944, placement: 'mock', desc: 'Primary student parking.' },
      { id: 'a-stafflot', comp: 'A', kind: 'feature', name: 'Staff lot – north', lat: 44.053, lng: -121.2966, placement: 'mock', desc: 'EMS staging candidate; clear of the bell-time queues.' },
      // ---- Fire
      { id: 'f-facp', comp: 'F', kind: 'panel', name: 'Fire alarm control panel – main office', lat: 44.05204, lng: -121.29738, vendor: 'Another provider (fire)', status: 'online', placement: 'mock', desc: 'Annunciator at the main entrance. Monitored by the existing fire alarm company.' },
      { id: 'f-fdc', comp: 'F', kind: 'hydrant', name: 'Fire department connection (FDC)', lat: 44.05225, lng: -121.2975, placement: 'mock', desc: 'Sprinkler riser connection; location to confirm.' },
      { id: 'f-hyd-1', comp: 'F', kind: 'hydrant', name: 'Hydrant – NE 6th St', lat: 44.0523, lng: -121.2979, placement: 'mock', desc: 'Flow not established — Bend Fire hydrant map.' },
      { id: 'f-hyd-2', comp: 'F', kind: 'hydrant', name: 'Hydrant – NE 9th St', lat: 44.05205, lng: -121.29405, placement: 'mock', desc: 'Flow not established — Bend Fire hydrant map.' },
      { id: 'f-hyd-3', comp: 'F', kind: 'hydrant', name: 'Hydrant – north lot', lat: 44.0532, lng: -121.297, placement: 'mock', desc: 'Flow not established — Bend Fire hydrant map.' },
      { id: 'f-kitchen', comp: 'F', kind: 'hazard', name: 'Kitchen hood suppression – cafeteria', lat: 44.05178, lng: -121.29595, placement: 'mock', desc: 'Commercial kitchen; hood system and gas shutoff.' },
      { id: 'f-shop', comp: 'F', kind: 'hazard', name: 'CTE shop – compressed gas / flammables (confirm)', lat: 44.0524, lng: -121.2958, placement: 'mock', desc: 'Career-technical shop storage is a standard pre-plan item; contents to confirm on the site walk.' },
      { id: 'f-smoke', comp: 'F', kind: 'smoke', name: 'Smoke / heat detection – all wings', lat: 44.05215, lng: -121.2962, vendor: 'Another provider (fire)', status: 'online', placement: 'mock', desc: 'Addressable system; zone list on the FACP.' },
      // ---- Emergency service
      { id: 'e-aed-1', comp: 'E', kind: 'medical', name: 'AED – main office', lat: 44.05203, lng: -121.29742, placement: 'mock', desc: 'Nearest AED to the front entrance.' },
      { id: 'e-aed-2', comp: 'E', kind: 'medical', name: 'AED – gym lobby', lat: 44.0526, lng: -121.29555, placement: 'mock', desc: 'Athletics.' },
      { id: 'e-aed-3', comp: 'E', kind: 'medical', name: 'AED – stadium', lat: 44.05345, lng: -121.2951, placement: 'mock', desc: 'Event nights.' },
      { id: 'e-staging-ems', comp: 'E', kind: 'staging', name: 'EMS staging – staff lot (north)', lat: 44.05305, lng: -121.29675, placement: 'mock', desc: 'Clear of bus-loop and drop-off queues at bell times.' },
      { id: 'e-staging-app', comp: 'E', kind: 'staging', name: 'Apparatus staging – NE 9th St frontage', lat: 44.0524, lng: -121.2941, placement: 'mock', desc: 'Engine and truck staging with the east hydrant.' },
      { id: 'e-lz', comp: 'E', kind: 'lz', name: 'Helicopter ground – stadium field (confirm with AirLink)', lat: 44.0537, lng: -121.295, placement: 'mock', desc: 'Largest open ground on campus; accessed through the field gate.' },
      { id: 'e-command', comp: 'E', kind: 'staging', name: 'Incident command post – main entrance plaza', lat: 44.05195, lng: -121.29765, placement: 'mock', desc: 'Beside the Knox box, FACP annunciator and the vestibule camera.' },
      { id: 'e-reunify', comp: 'E', kind: 'alert', name: 'Reunification site – designation pending', lat: 44.0506, lng: -121.2956, placement: 'mock', status: 'n/a', desc: 'Off-campus reunification is set with the district and law enforcement, not from imagery. Placeholder so the packet has the field.' }
    ],
    zones: [],
    routes: [
      { id: 'app-route', comp: 'E', name: 'Apparatus approach – 6th St to north lot to gym', trigger: 'Fire alarm, gym wing', start: 'NE 6th St', target: 'Gym north (D3)',
        points: [pt(44.0515, -121.298), pt(44.0529, -121.298), pt(44.053, -121.297), pt(44.0527, -121.2958)] }
    ],
    report: {
      S: {
        status: 'DRAFT · 5 district cameras · 1 intrusion panel (another provider) · lockdown button',
        summary: 'A school mostly matches the standard customer profile: a watched perimeter, a single daytime entry, and the devices the district already owns pulled onto one map.',
        considerations: 'No imagery pass yet; sightlines, blind spots and camera placement are placeholders. The district camera system and the intrusion monitoring belong to other providers. Event nights change the perimeter (stadium gates open).',
        recommendations: 'Run the bot capture and reviewer pass before any of this is shared with the district. Connect the district camera system to the SAFE map with per-camera cones. Keep the lockdown button and the intrusion panel as the Security layer\'s two alerting devices.'
      },
      A: {
        status: 'DRAFT · 1 daytime entry (vestibule) · 8 numbered exterior doors · 1 field gate · 4 vehicle areas',
        summary: 'Door numbering is what responders need first. The vestibule is the daytime entry; everything else is a numbered door with a contact and a reader.',
        considerations: 'Bus loop and parent drop-off block the west and south frontages at bell times. The field gate is chained after hours. The Knox box location is unconfirmed.',
        recommendations: 'Confirm the door numbering scheme with the district and paint it where responders can see it from the street. Put the vestibule and D1 on remote release from this map. Record bell-time traffic patterns in the Access layer.'
      },
      F: {
        status: 'DRAFT · 3 hydrants (flow unknown) · FDC · kitchen hood · CTE shop storage',
        summary: 'Standard commercial fire profile: hydrants on two frontages, an FDC at the main entrance, and two hazard rooms (kitchen, shop).',
        considerations: 'Hydrant flows are not established. Shop and kitchen contents are a site-walk item. The fire alarm is monitored by another provider.',
        recommendations: 'Request the Bend Fire hydrant map for both frontages. Walk the CTE shop and kitchen with facilities for the hazard inventory. Confirm the FDC and FACP locations and photograph them for the packet.'
      },
      E: {
        status: 'DRAFT · 1,204 students + staff · 3 AEDs · 2 staging areas · stadium field as LZ candidate',
        summary: 'Occupant count is the number that changes everything. The map carries the AEDs, the staging areas that stay clear at bell times, the helicopter ground and the apparatus approach.',
        considerations: 'Bell-time queues on NE 6th St and the bus loop. Reunification site is set with the district, not from imagery. Stadium events add occupants and open the perimeter.',
        recommendations: 'Confirm the stadium field with AirLink as helicopter ground and the field gate as its access. Stage EMS in the north staff lot. Build the responder packet with occupancy, bell schedule, door numbers, AEDs and the reunification designation.'
      }
    },
    limits: [
      'Everything on this map — no imagery pass has been run; pins are placeholders.',
      'Door numbering and exterior door count — district facilities plan.',
      'Hydrant flows and FDC location — Bend Fire.',
      'Reunification site — district and law enforcement designation.',
      'Helicopter ground — AirLink / agency confirmation.'
    ],
    events: [
      { t: 'Today 07:31', kind: 'door', pin: 'd3', text: 'Propped-door alert · D3 gym north (cleared in 4 min)' },
      { t: 'Yesterday 19:02', kind: 'motion', pin: 's-cam-5', text: 'Stadium gate camera offline — district notified' },
      { t: '4 days ago 10:15', kind: 'alert', pin: 's-lockdown', text: 'Lockdown drill — button pressed, all doors secured in 48 s' }
    ]
  };

  window.SAFE_FIXTURES = {
    residence: residence,
    hoa: hoa,
    golf: golf,
    school: school
  };
})();
