# Verification for vyanet-viewer.html (hub 1.6.7) against localhost:8899.
# Static referee first (node --check, ids, handlers, braces), then behavior.
# Child pages, the live gateway, and the dashboard's public data APIs are
# stubbed per scenario so every code path actually evaluates (unstubbed =
# silently passes on nothing). Scenario G runs the real child pages and the
# real data APIs unstubbed as an integration smoke.
#
# Run:  python -m http.server 8899   (repo root)   then   python test-vyanet-viewer.py
import base64, json, re, subprocess, sys, tempfile, os, time
from playwright.sync_api import sync_playwright

PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')

BASE = 'http://localhost:8899'
JONES = '6de88883bfd4a8349a901c54611ed9d7'
TRACY = 'd9f759d7351db3886c79dd689c41e3c0'
GW = 'https://xuzftiqa5gqy35yf26y2bca2ji0ivbnj.lambda-url.us-east-1.on.aws'
SHOT_DIR = os.path.join(tempfile.gettempdir(), 'hub-shots')
os.makedirs(SHOT_DIR, exist_ok=True)

fails = []
def check(label, cond):
    print(('PASS  ' if cond else 'FAIL  ') + label)
    if not cond:
        fails.append(label)

MV_STUB = ('<html><head><title>MV STUB</title></head><body>mv stub<script>'
           'window.__cmds=[];window.__stages=[];'
           "window.addEventListener('message',function(e){"
           "if(e.data&&e.data.type==='vyanet-cmd')window.__cmds.push(e.data.cmd);"
           "if(e.data&&e.data.type==='vyanet-stage')window.__stages.push(e.data.stage);});"
           "parent.postMessage({type:'vyanet-ready',page:'model-viewer'},location.origin);"
           '</script></body></html>')
SAT_STUB = ('<html><head><title>SAT STUB</title></head><body>sat stub<script>'
            'window.__gotStage=0;'
            "window.addEventListener('message',function(e){"
            "if(e.data&&e.data.type==='vyanet-stage')window.__gotStage++;});"
            '</script></body></html>')
LIVE_STUB = ('<html><head><title>LIVE STUB</title></head><body>live stub<script>'
             'window.__stages=[];'
             "window.addEventListener('message',function(e){"
             "if(e.data&&e.data.type==='vyanet-stage')window.__stages.push(e.data.stage);});"
             "parent.postMessage({type:'vyanet-ready',page:'live-viewer'},location.origin);"
             '</script></body></html>')

def stub_children(ctx):
    # Regex (not glob): glob **/viewer.html* would also match live-viewer.html.
    ctx.route(re.compile(r'/model-viewer\.html(?:\?|$)'),
              lambda r: r.fulfill(content_type='text/html', body=MV_STUB))
    ctx.route(re.compile(r'/live-viewer\.html(?:\?|$)'),
              lambda r: r.fulfill(content_type='text/html', body=LIVE_STUB))
    ctx.route(re.compile(r'/viewer\.html(?:\?|$)'),
              lambda r: r.fulfill(content_type='text/html', body=SAT_STUB))

def j(route, obj, status=200):
    route.fulfill(status=status, content_type='application/json', body=json.dumps(obj))

def stub_img(ctx):
    # Deterministic image loads: CloudFront nadir (hero), Esri tiles, NWS icons.
    png = lambda r: r.fulfill(content_type='image/png', body=PNG)
    ctx.route('https://d3fg47bqswi0rr.cloudfront.net/**', png)
    ctx.route('https://server.arcgisonline.com/**', png)
    ctx.route('https://api.weather.gov/icons/**', png)

def stub_dash(ctx):
    now = int(time.time() * 1000)
    ctx.route('https://api.weather.gov/points/**', lambda r: j(r, {'properties': {
        'forecast': 'https://api.weather.gov/gridpoints/TST/1,1/forecast',
        'forecastHourly': 'https://api.weather.gov/gridpoints/TST/1,1/forecastHourly',
        'observationStations': 'https://api.weather.gov/gridpoints/TST/1,1/stations',
        'county': 'https://api.weather.gov/zones/county/ORC017',
        'radarStation': 'KPDT', 'gridId': 'PDT',
        'elevation': {'value': 1106},
        'astronomicalData': {
            'sunrise': '2026-08-26T06:21:00-07:00', 'sunset': '2026-08-26T19:53:00-07:00',
            'civilTwilightBegin': '2026-08-26T05:51:00-07:00',
            'civilTwilightEnd': '2026-08-26T20:24:00-07:00'},
        'nwr': {'transmitter': 'WWF80'},
        'relativeLocation': {'properties': {'city': 'Bend', 'state': 'OR'}}}}))
    ctx.route('https://api.weather.gov/gridpoints/TST/1,1/forecast', lambda r: j(r, {'properties': {
        'periods': [{'name': 'Today', 'temperature': 85, 'shortForecast': 'Sunny',
                     'detailedForecast': 'Sunny, with a high near 85. West wind 10 mph.',
                     'windSpeed': '10 mph', 'windDirection': 'W',
                     'probabilityOfPrecipitation': {'value': 0},
                     'icon': 'https://api.weather.gov/icons/land/day/skc?size=medium'},
                    {'name': 'Tonight', 'temperature': 52, 'shortForecast': 'Clear',
                     'windSpeed': '5 mph', 'windDirection': 'NW',
                     'probabilityOfPrecipitation': {'value': 10},
                     'icon': 'https://api.weather.gov/icons/land/night/skc?size=medium'}]}}))
    ctx.route('https://api.weather.gov/gridpoints/TST/1,1/forecastHourly', lambda r: j(r, {'properties': {
        'periods': [
            {'startTime': '2026-08-26T12:00:00-07:00', 'temperature': 84,
             'shortForecast': 'Sunny', 'probabilityOfPrecipitation': {'value': 0}},
            {'startTime': '2026-08-26T13:00:00-07:00', 'temperature': 86,
             'shortForecast': 'Sunny', 'probabilityOfPrecipitation': {'value': 5}},
            {'startTime': '2026-08-26T14:00:00-07:00', 'temperature': 87,
             'shortForecast': 'Sunny', 'probabilityOfPrecipitation': {'value': 10}}]}}))
    ctx.route('https://api.weather.gov/gridpoints/TST/1,1/stations', lambda r: j(r, {'features': [
        {'properties': {'stationIdentifier': 'KBDN', 'name': 'Bend Municipal'}}]}))
    ctx.route('https://api.weather.gov/stations/KBDN/observations**', lambda r: j(r, {'features': [
        {'properties': {'temperature': {'value': 30}, 'textDescription': 'Clear',
                        'timestamp': '2026-08-26T18:00:00+00:00',
                        'windSpeed': {'value': 16}, 'windDirection': {'value': 270},
                        'windGust': {'value': 32}, 'relativeHumidity': {'value': 22},
                        'dewpoint': {'value': 5}, 'visibility': {'value': 16093},
                        'barometricPressure': {'value': 101592},
                        'cloudLayers': [{'amount': 'FEW', 'base': {'value': 1500}}]}}]}))
    ctx.route('https://api.weather.gov/alerts/active**', lambda r: j(r, {'features': [
        {'properties': {'event': 'Red Flag Warning', 'severity': 'Severe',
                        'headline': 'Red Flag Warning for dry and windy conditions',
                        'description': 'Critical fire weather conditions.',
                        'instruction': 'Avoid outdoor burning.',
                        'areaDesc': 'Deschutes County'}}]}))
    ctx.route('https://earthquake.usgs.gov/**', lambda r: j(r, {'features': [
        {'properties': {'mag': 3.2, 'place': '10 km N of Bend, Oregon', 'time': now - 3600000},
         'geometry': {'coordinates': [-121.4, 44.2, 5]}}]}))
    ctx.route('https://services3.arcgis.com/**', lambda r: j(r, {'features': [
        {'attributes': {'poly_IncidentName': 'Test Fire', 'poly_GISAcres': 1200,
                        'attr_FireDiscoveryDateTime': now - 7200000, 'attr_POOState': 'US-OR'},
         'centroid': {'x': -121.5, 'y': 44.5}}]}))
    ctx.route('https://www.fema.gov/api/**', lambda r: j(r, {'DisasterDeclarationsSummaries': [
        {'incidentType': 'Fire', 'declarationDate': '2020-09-15T00:00:00.000Z',
         'designatedArea': 'Deschutes (County)', 'declarationTitle': 'Oregon Wildfires'},
        {'incidentType': 'Flood', 'declarationDate': '1996-02-09T00:00:00.000Z'}]}))
    ctx.route('https://services.swpc.noaa.gov/**', lambda r: j(r, [
        {'product_id': 'K05W', 'issue_datetime': '2026-08-25 12:00:00',
         'message': 'ALERT: Geomagnetic K-index of 5\nG1 - Minor'}]))

def wait_settled(page):
    page.wait_for_function("document.getElementById('gt-status').textContent === ''")

def wait_dash(page, timeout=30000):
    page.wait_for_function(
        "document.querySelectorAll('#hm-grid .dash-body').length >= 6 && "
        "Array.from(document.querySelectorAll('#hm-grid .dash-body'))"
        ".every(function(b){return b.textContent.indexOf('Loading') === -1;})",
        timeout=timeout)

def visible(page, sel):
    return page.evaluate("!!document.querySelector('" + sel + "')?.classList.contains('visible')")

def static_checks():
    hub_path = 'C:/dev/property-intel/vyanet-viewer.html'
    mv_path = 'C:/dev/property-intel/model-viewer.html'
    live_path = 'C:/dev/property-intel/live-viewer.html'
    mod_paths = [('property.js', 'C:/dev/property-intel/js/vyanet-viewer/property.js'),
                 ('dashboard.js', 'C:/dev/property-intel/js/vyanet-viewer/dashboard.js')]
    html = open(hub_path, encoding='utf-8').read()
    m = re.search(r'<script type="module">([\s\S]*?)</script>', html)
    check('S1 hub module script present', m is not None)
    js_src = m.group(1) if m else ''
    to_check = [('hub inline script', js_src)]
    for name, p in mod_paths:
        to_check.append((name, open(p, encoding='utf-8').read()))
    mv_html = open(mv_path, encoding='utf-8').read()
    mv_m = re.search(r'<script type="module">([\s\S]*?)</script>', mv_html)
    check('S2 model-viewer module script present', mv_m is not None)
    to_check.append(('model-viewer inline script', mv_m.group(1) if mv_m else ''))
    live_html = open(live_path, encoding='utf-8').read()
    live_m = re.search(r'<script type="module">([\s\S]*?)</script>', live_html)
    check('S2b live-viewer module script present', live_m is not None)
    to_check.append(('live-viewer inline script', live_m.group(1) if live_m else ''))
    for i, (label, src) in enumerate(to_check):
        tmp = os.path.join(tempfile.gettempdir(), 'hub-check-' + str(i) + '.mjs')
        open(tmp, 'w', encoding='utf-8').write(src)
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True, shell=True)
        check('S3.' + str(i) + ' node --check ' + label, r.returncode == 0)
        if r.returncode:
            print(r.stderr)
    html_ids = set(re.findall(r'id="([^"]+)"', html))
    dynamic = {'frame-3d', 'frame-sat', 'frame-live'}
    js_ids = re.findall(r"getElementById\('([^']+)'\)", js_src)
    missing = [i for i in js_ids if i not in html_ids and i not in dynamic
               and not i.startswith('dash-body-')]
    missing += ['role-' + r for r in ('customer', 'tech', 'responder') if 'role-' + r not in html_ids]
    check('S4 all hub getElementById literals + dynamic ids resolve (' + str(len(js_ids)) + ')', not missing)
    if missing:
        print('  missing: ' + ', '.join(missing))
    handlers = set(re.findall(r'on(?:click|submit)="(\w+)\(', html))
    unresolved = [h for h in handlers if not re.search(r'window\.' + h + r'\s*=', js_src)]
    check('S5 all ' + str(len(handlers)) + ' hub inline handlers resolve on window', not unresolved)
    if unresolved:
        print('  unresolved: ' + ', '.join(unresolved))
    # Brace scan with a real string/comment-aware pass (a regex stripper
    # mispairs quotes across lines once strings contain the other quote char).
    def code_chars(line):
        out, q, i = [], '', 0
        while i < len(line):
            c = line[i]
            if q:
                if c == '\\':
                    i += 2
                    continue
                if c == q:
                    q = ''
            elif c in ('"', "'", '`'):
                q = c
            elif c == '/' and i + 1 < len(line) and line[i + 1] == '/':
                break
            else:
                out.append(c)
            i += 1
        return out
    bal = minbal = 0
    names, depth = {}, 0
    for line in js_src.split('\n'):
        if depth == 0:
            d = re.match(r'\s*(?:const|let|function|async function)\s+([A-Za-z_$][\w$]*)', line)
            if d:
                names[d.group(1)] = names.get(d.group(1), 0) + 1
        for ch in code_chars(line):
            step = (ch == '{') - (ch == '}')
            bal += step
            depth += step
            minbal = min(minbal, bal)
    check('S6 hub brace balance', bal == 0 and minbal >= 0)
    dups = [k for k, v in names.items() if v > 1]
    check('S7 no duplicate top-level declarations in hub', not dups)
    if dups:
        print('  dups: ' + ', '.join(dups))
    live_ids = set(re.findall(r'id="([^"]+)"', live_html))
    live_js = live_m.group(1) if live_m else ''
    live_dyn = {'lm-img-0', 'lm-state-0', 'lm-clip-0'}
    live_missing = [i for i in re.findall(r"getElementById\('([^']+)'\)", live_js)
                    if i not in live_ids and i not in live_dyn and not i.startswith('lm-')]
    check('S8 live-viewer getElementById literals resolve', not live_missing)
    if live_missing:
        print('  missing: ' + ', '.join(live_missing))
    live_handlers = set(re.findall(r'on(?:click|submit)="(\w+)\(', live_html))
    live_unres = [h for h in live_handlers if not re.search(r'window\.' + h + r'\s*=', live_js)]
    check('S9 all ' + str(len(live_handlers)) + ' live-viewer handlers resolve on window', not live_unres)
    if live_unres:
        print('  unresolved: ' + ', '.join(live_unres))

static_checks()

with sync_playwright() as p:
    try:
        browser = p.chromium.launch()
    except Exception as e:
        print('bundled Chromium missing; using system Chrome (' + str(e).splitlines()[0] + ')')
        browser = p.chromium.launch(channel='chrome')

    # ── Scenario A: first visit (no session) — gate, home dashboard, stages ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    stub_dash(ctx)
    stub_img(ctx)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES)
    page.wait_for_selector('#gate.visible')
    check('A1 gate visible on first visit', True)
    check('A2 gate shows name', page.text_content('#gt-name') == 'Jones')
    check('A3 gate shows address', 'Macalpine' in page.text_content('#gt-addr'))
    meta = page.text_content('#gt-meta')
    check('A4 meta chips (acct/hoa/coords)', 'Residential' in meta and 'HOA highlands' in meta and '44.04145' in meta)
    wait_settled(page)
    check('A5 ENTER disabled until role picked', page.is_disabled('#gt-enter'))
    check('A6 passcode field shown on gate when property has 3D', visible(page, '#gt-pass-block'))
    check('A6b skip offered next to passcode', visible(page, '#gt-skip'))
    check('A6c skip disabled until role picked', page.is_disabled('#gt-skip'))
    page.click('#role-responder')
    check('A7 role button lights', 'on' in page.get_attribute('#role-responder', 'class'))
    check('A8 ENTER enabled after role', not page.is_disabled('#gt-enter'))
    page.screenshot(path=os.path.join(SHOT_DIR, 'gate-mobile.png'))
    page.click('#gt-skip')
    page.wait_for_selector('#home.visible')
    check('A9 home after skip (no passcode stored)', page.evaluate("sessionStorage.getItem('vyViewerKey')") is None)
    check('A10 gate hidden', not visible(page, '#gate'))
    check('A11 role chip on home', page.text_content('#hm-role') == 'Viewing as Responder')
    check('A11b switch-role + viewing-as sit in the top row',
          page.evaluate("document.querySelector('.hm-top #hm-switch') !== null")
          and page.evaluate("document.querySelector('.hm-top #hm-role') !== null"))
    check('A12 launch buttons enabled (3d/sat/live)',
          not page.is_disabled('#go-3d') and not page.is_disabled('#go-sat')
          and not page.is_disabled('#go-live'))
    check('A12b LIVE FEED top-bar tab enabled', not page.is_disabled('#btn-live'))
    check('A13 HOME button lit', 'on' in page.get_attribute('#btn-home', 'class'))
    f3 = page.query_selector('#frame-3d')
    fs = page.query_selector('#frame-sat')
    fl = page.query_selector('#frame-live')
    check('A14 3d, sat, and live iframes mounted at home',
          f3 is not None and fs is not None and fl is not None)
    check('A15 3D iframe src has view + embed', 'view=drone-test' in (f3.get_attribute('src') or '')
          and 'embed=1' in (f3.get_attribute('src') or ''))
    check('A16 sat iframe src has tab + embed', 'tab=security' in (fs.get_attribute('src') or '')
          and 'embed=1' in (fs.get_attribute('src') or ''))
    check('A16b live iframe is live-viewer.html + embed',
          'live-viewer.html' in (fl.get_attribute('src') or '')
          and 'embed=1' in (fl.get_attribute('src') or ''))
    # dashboard cards (stubbed data)
    wait_dash(page)
    check('A17 six dashboard cards render', page.evaluate(
        "document.querySelectorAll('#hm-grid .dash-card').length") == 6)
    wx = page.text_content('#dash-body-wx')
    check('A18 weather card: obs temp + alert', '86' in wx and 'Red Flag Warning' in wx)
    check('A18e weather card: humidity + dewpoint + gusts',
          '22%' in wx and 'Dewpoint' in wx and 'gusting' in wx)
    check('A18i weather card: sunrise + weather radio',
          'Sun' in wx and 'WWF80' in wx)
    check('A18f weather card: hourly strip', page.evaluate(
        "document.querySelectorAll('#dash-body-wx .dash-hr-p').length") >= 3)
    check('A18g weather card: today narrative', 'high near 85' in wx)
    check('A18h weather alert expands', page.evaluate("""() => {
      const a = document.querySelector('#dash-body-wx .dash-wx-alert.can-open');
      if (!a) return false;
      a.click();
      return !!document.querySelector('#dash-body-wx .dash-wx-detail.open');
    }"""))
    check('A18b weather card: forecast icon strip', page.evaluate(
        "document.querySelectorAll('#dash-body-wx .dash-fc-p img').length") == 2)
    check('A18c weather forecast sits under the icon', page.evaluate(
        "document.querySelector('#dash-body-wx .dash-fc-f') && "
        "document.querySelector('#dash-body-wx .dash-fc-f').textContent.indexOf('Sunny') !== -1"))
    check('A18d weather icon fills its cell', page.evaluate(
        "document.querySelector('#dash-body-wx .dash-fc-p img').getBoundingClientRect().width") > 80)
    fire = page.text_content('#dash-body-fire')
    check('A19 wildfire card: nearest fire', 'Test Fire' in fire and 'km' in fire)
    page.wait_for_selector('#dash-body-fire .dash-tile')
    check('A19b wildfire card: mini map with marker', page.evaluate(
        "document.querySelectorAll('#dash-body-fire .dash-map .dash-tile').length") > 0
        and page.evaluate("document.querySelectorAll('#dash-body-fire .dash-ov circle').length") >= 3)
    check('A19c wildfire map fills the card width', page.evaluate("""() => {
      const tiles = document.querySelector('#dash-body-fire .dash-tiles');
      const card = document.getElementById('dash-fire');
      return tiles.getBoundingClientRect().width >= card.getBoundingClientRect().width - 8;
    }"""))
    check('A19d wildfire zoom controls present',
          page.query_selector('#dash-zoom-in-fire') is not None
          and page.query_selector('#dash-zoom-out-fire') is not None)
    z0 = page.evaluate("document.querySelector('#dash-body-fire .dash-tile').src")
    page.click('#dash-zoom-in-fire')
    page.wait_for_function(
        "src => document.querySelector('#dash-body-fire .dash-tile').src !== src",
        arg=z0)
    check('A19e wildfire zoom in changes tiles', True)
    check('A19f wildfire map is draggable', page.evaluate(
        "!!document.querySelector('#dash-tiles-fire .dash-tiles-inner')"))
    t0 = page.evaluate("document.querySelector('#dash-tiles-fire .dash-tile').style.left")
    box = page.query_selector('#dash-tiles-fire').bounding_box()
    page.mouse.move(box['x'] + 80, box['y'] + 90)
    page.mouse.down()
    page.mouse.move(box['x'] + 160, box['y'] + 130, steps=8)
    page.mouse.up()
    page.wait_for_function(
        "old => document.querySelector('#dash-tiles-fire .dash-tile').style.left !== old",
        arg=t0)
    check('A19g wildfire drag pans the map', True)
    qk = page.text_content('#dash-body-quake')
    check('A20 quake card: magnitude', 'M3.2' in qk)
    page.wait_for_selector('#dash-body-quake .dash-tile')
    check('A20b quake card: mini map with marker', page.evaluate(
        "document.querySelectorAll('#dash-body-quake .dash-map .dash-tile').length") > 0)
    check('A20e quake zoom controls present',
          page.query_selector('#dash-zoom-in-quake') is not None)
    check('A20f quake map is draggable', page.evaluate(
        "!!document.querySelector('#dash-tiles-quake .dash-tiles-inner')"))
    # hero nadir (stubbed CloudFront image loads instantly)
    page.wait_for_selector('#hm-hero.has-img', timeout=8000)
    check('A20c hero nadir shows with hint', page.text_content('#hm-hero-hint') == 'Open 3D model')
    check('A20d no passcode field on home', page.query_selector('#hm-pass') is None)
    fm = page.text_content('#dash-body-fema')
    check('A21 fema card: count since first year', '2' in fm and '1996' in fm and 'Deschutes County' in fm)
    check('A21b fema lists each declaration', page.evaluate(
        "document.querySelectorAll('#dash-body-fema .dash-list-row').length") == 2
        and 'Oregon Wildfires' in fm and 'Flood' in fm)
    sp = page.text_content('#dash-body-space')
    check('A22 space card: scale + meter', 'G1' in sp and page.evaluate(
        "document.querySelectorAll('#dash-body-space .dash-seg').length") == 5)
    check('A22b space lists bulletins', page.evaluate(
        "document.querySelectorAll('#dash-body-space .dash-list-row').length") >= 1)
    info = page.text_content('#dash-body-info')
    check('A23 more-sources card lists planned', 'Air quality' in info)
    page.screenshot(path=os.path.join(SHOT_DIR, 'home-dashboard-mobile.png'))
    # stages
    page.click('#go-3d')
    check('A24 3D stage: home hidden', not visible(page, '#home'))
    check('A25 3D frame on top', 'on' in page.get_attribute('#frame-3d', 'class'))
    mv_stub = next((f for f in page.frames
                    if f.url.split('?')[0].endswith('/model-viewer.html')), None)
    stages = []
    if mv_stub:
        mv_stub.wait_for_function(
            "window.__stages && window.__stages.indexOf('3d') !== -1", timeout=5000)
        stages = mv_stub.evaluate('window.__stages')
    check('A25b 3D child received vyanet-stage 3d', '3d' in stages)
    page.click('#btn-sat')
    check('A26 satellite frame on top', 'on' in page.get_attribute('#frame-sat', 'class')
          and 'on' not in (page.get_attribute('#frame-3d', 'class') or '')
          and 'on' not in (page.get_attribute('#frame-live', 'class') or ''))
    if mv_stub:
        mv_stub.wait_for_function(
            "window.__stages && window.__stages.indexOf('off') !== -1", timeout=5000)
        stages = mv_stub.evaluate('window.__stages')
    check('A26b 3D child paused (stage off) when leaving 3D', 'off' in stages)
    sat_frame = next((f for f in page.frames
                      if f.url.split('?')[0].endswith('/viewer.html')), None)
    got = -1
    if sat_frame:
        sat_frame.wait_for_function('window.__gotStage > 0', timeout=5000)
        got = sat_frame.evaluate('window.__gotStage')
    check('A27 vyanet-stage postMessage received by satellite child', got and got > 0)
    page.click('#btn-home')
    check('A28 back to home, frames keep z classes', visible(page, '#home')
          and 'on' in page.get_attribute('#frame-sat', 'class'))
    page.click('#hm-hero')
    check('A28b hero click opens the 3D stage', not visible(page, '#home')
          and 'on' in page.get_attribute('#frame-3d', 'class'))
    page.click('#btn-home')
    # live feed without a key: hub popup, not a home-page field
    page.click('#go-live')
    check('A29 live without key opens passcode popup', visible(page, '#live-pass'))
    check('A29b stays on home until unlocked', visible(page, '#home'))
    page.click('#live-pass-cancel')
    check('A30 cancel closes popup without storing a key',
          not visible(page, '#live-pass')
          and page.evaluate("sessionStorage.getItem('vyViewerKey')") is None)
    # session restore: reload skips the gate entirely now
    page.reload()
    page.wait_for_selector('#home.visible')
    check('A31 reload skips gate straight to home', not visible(page, '#gate'))
    check('A32 role survived reload', page.text_content('#hm-role') == 'Viewing as Responder')
    page.click('#hm-switch')
    page.wait_for_selector('#gate.visible')
    check('A33 switch role re-gates', True)
    check('A34 switch role cleared selection', 'on' not in (page.get_attribute('#role-responder', 'class') or ''))
    wait_settled(page)
    check('A35 ENTER disabled again', page.is_disabled('#gt-enter'))
    ctx.close()

    # ── Scenario B: cameras via data/cameras file; gateway 401 then 200 ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    stub_dash(ctx)
    gw_accept = {'v': False}
    def gw_route(route):
        if gw_accept['v']:
            j(route, {'cameras': []})
        else:
            j(route, {}, status=401)
    ctx.route(GW + '/**', gw_route)
    ctx.route('**/data/cameras/json/' + JONES + '.json',
              lambda r: j(r, {'property': JONES, 'cameras': [{'id': 'cam-01'}]}))
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES)
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('B1 passcode field shown when cameras file exists', visible(page, '#gt-pass-block'))
    check('B1b skip button offered alongside passcode', visible(page, '#gt-skip'))
    check('B1c skip disabled until role picked', page.is_disabled('#gt-skip'))
    page.click('#role-customer')
    page.click('#gt-enter')
    check('B2 empty passcode refused inline', 'Enter the viewer passcode' in page.text_content('#gt-err'))
    page.fill('#gt-pass-input', 'wrong-key')
    page.click('#gt-enter')
    page.wait_for_function("document.getElementById('gt-err').textContent !== ''")
    check('B3 gateway 401 -> passcode rejected', 'not accepted' in page.text_content('#gt-err'))
    check('B4 still gated after reject', visible(page, '#gate'))
    gw_accept['v'] = True
    page.fill('#gt-pass-input', 'right-key')
    page.click('#gt-enter')
    page.wait_for_selector('#home.visible')
    check('B5 accepted key enters home', True)
    check('B6 vyViewerKey stored for tab', page.evaluate("sessionStorage.getItem('vyViewerKey')") == 'right-key')
    page.reload()
    page.wait_for_selector('#home.visible')
    check('B7 reload skips gate (role + key in session)', not visible(page, '#gate'))
    ctx.close()

    # ── Scenario C: cameras via model record; &gw=0 stores without validating ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    stub_children(ctx)
    stub_dash(ctx)
    rec = json.loads(open('C:/dev/property-intel/data/drone-test/83af9960667d769f621a4a70ad03a970.json', encoding='utf-8').read())
    rec['cameras'] = [{'id': 'cam-01', 'label': 'Front walkway', 'live': {'device': 'X', 'channel': 0}}]
    ctx.route('**/data/drone-test/83af9960667d769f621a4a70ad03a970.json',
              lambda r: j(r, rec))
    gw_called = {'v': 0}
    def gw_count(route):
        gw_called['v'] += 1
        j(route, {}, status=401)
    ctx.route(GW + '/**', gw_count)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&gw=0')
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('C1 passcode field shown via record cameras', visible(page, '#gt-pass-block'))
    page.click('#role-tech')
    page.fill('#gt-pass-input', 'any-key')
    page.click('#gt-enter')
    page.wait_for_selector('#home.visible')
    check('C2 gw=0 stores key without gateway call', page.evaluate("sessionStorage.getItem('vyViewerKey')") == 'any-key'
          and gw_called['v'] == 0)
    check('C3 role chip technician', page.text_content('#hm-role') == 'Viewing as Technician')
    ctx.close()

    # ── Scenario D: &role= deep link skips the gate on first visit ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    stub_children(ctx)
    stub_dash(ctx)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + TRACY + '&role=tech')
    page.wait_for_selector('#home.visible')
    check('D1 &role= skips gate straight to home', not visible(page, '#gate'))
    check('D2 Tracy identity on home', 'Tracy' in page.text_content('#hm-name'))
    check('D3 role stored from URL', page.evaluate("sessionStorage.getItem('vyRole')") == 'tech')
    f3 = page.query_selector('#frame-3d')
    fs = page.query_selector('#frame-sat')
    check('D4 both plugins from drone-test-only index', 'view=drone-test' in (f3.get_attribute('src') or '')
          and 'tab=drone-test' in (fs.get_attribute('src') or ''))
    wait_dash(page)
    geo = page.evaluate("""() => {
      const box = id => document.getElementById(id).getBoundingClientRect();
      const go = box('go-3d'), grid = box('hm-grid'), live = box('btn-live');
      const wrap = document.querySelector('.hm-wrap').getBoundingClientRect();
      const inner = document.querySelector('.bar-inner').getBoundingClientRect();
      return { goBottom: go.bottom, gridTop: grid.top,
               barW: inner.width, wrapW: wrap.width,
               barLeft: inner.left, wrapLeft: wrap.left,
               btnRight: live.right, wrapRight: wrap.right };
    }""")
    check('D5 launch stays above cards (not a side column)',
          geo['goBottom'] <= geo['gridTop'] + 2)
    check('D6 top bar and home share the same frame',
          abs(geo['barW'] - geo['wrapW']) < 8
          and abs(geo['barLeft'] - geo['wrapLeft']) < 8
          and geo['btnRight'] <= geo['wrapRight'] + 2)
    lay = page.evaluate("""() => {
      const box = id => document.getElementById(id).getBoundingClientRect();
      const wx = box('dash-wx'), fire = box('dash-fire'), quake = box('dash-quake');
      const fema = box('dash-fema'), space = box('dash-space'), info = box('dash-info');
      const grid = box('hm-grid');
      return {
        wxW: wx.width, gridW: grid.width, wxBottom: wx.bottom,
        fireTop: fire.top, quakeTop: quake.top,
        fireLeft: fire.left, quakeLeft: quake.left,
        femaTop: fema.top, spaceTop: space.top,
        femaLeft: fema.left, spaceLeft: space.left,
        infoTop: info.top, infoW: info.width,
        pairBottom: Math.max(fema.bottom, space.bottom)
      };
    }""")
    check('D7 weather card spans the grid', abs(lay['wxW'] - lay['gridW']) < 4)
    check('D7b wildfire and earthquake share a row',
          abs(lay['fireTop'] - lay['quakeTop']) < 4 and lay['fireLeft'] < lay['quakeLeft'])
    check('D7c FEMA and space weather share a row',
          abs(lay['femaTop'] - lay['spaceTop']) < 4 and lay['femaLeft'] < lay['spaceLeft'])
    check('D7d more-sources sits under that row and spans the grid',
          lay['infoTop'] >= lay['pairBottom'] - 2 and abs(lay['infoW'] - lay['gridW']) < 4)
    check('D7e map row sits under weather', lay['fireTop'] >= lay['wxBottom'] - 2)
    mapsz = page.evaluate("""() => {
      const box = id => document.getElementById(id).getBoundingClientRect();
      const f = box('dash-tiles-fire'), q = box('dash-tiles-quake');
      const fc = box('dash-fire'), qc = box('dash-quake');
      return { fw: f.width, fh: f.height, qw: q.width, qh: q.height,
               fcw: fc.width, qcw: qc.width };
    }""")
    check('D7f wildfire and earthquake maps are the same size',
          abs(mapsz['fw'] - mapsz['qw']) < 3 and abs(mapsz['fh'] - mapsz['qh']) < 3
          and abs(mapsz['fw'] - mapsz['fcw']) < 4)
    page.screenshot(path=os.path.join(SHOT_DIR, 'home-dashboard-desktop.png'))
    ctx.close()

    # ── Scenario E: ?stage=satellite + known role lands in satellite ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    stub_children(ctx)
    stub_dash(ctx)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&stage=satellite&role=responder')
    page.wait_for_selector('#frame-sat.on')
    check('E1 stage param + role lands in satellite, no gate, no home',
          not visible(page, '#home') and not visible(page, '#gate')
          and 'on' in page.get_attribute('#btn-sat', 'class'))
    page.click('#btn-home')
    wait_dash(page)
    check('E2 dashboard loads on first HOME visit', page.evaluate(
        "document.querySelectorAll('#hm-grid .dash-card').length") == 6)
    ctx.close()

    # ── Scenario F: error paths ──
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html')
    page.wait_for_selector('#err.visible')
    check('F1 missing ?property= errors', 'property' in page.text_content('#err-msg'))
    page.goto(BASE + '/vyanet-viewer.html?property=0000000000000000000000000000dead')
    page.wait_for_selector('#err.visible')
    check('F2 unknown property errors', 'No index at' in page.text_content('#err-msg'))
    check('F3 gate never shown on error', not visible(page, '#gate'))
    ctx.close()

    # ── Scenario H: "Continue without live" skips the passcode entirely ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    stub_dash(ctx)
    gw_calls = {'v': 0}
    def gw_tally(route):
        gw_calls['v'] += 1
        j(route, {}, status=401)
    ctx.route(GW + '/**', gw_tally)
    ctx.route('**/data/cameras/json/' + JONES + '.json',
              lambda r: j(r, {'property': JONES, 'cameras': [{'id': 'cam-01'}]}))
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES)
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    page.click('#role-responder')
    check('H1 skip enabled once role picked', not page.is_disabled('#gt-skip'))
    page.click('#gt-skip')
    page.wait_for_selector('#home.visible')
    check('H2 skip enters home', True)
    check('H3 no key stored, no gateway calls',
          page.evaluate("sessionStorage.getItem('vyViewerKey')") is None and gw_calls['v'] == 0)
    check('H4 role still persisted', page.evaluate("sessionStorage.getItem('vyRole')") == 'responder')
    page.reload()
    page.wait_for_selector('#home.visible')
    check('H5 reload after skip goes straight home', not visible(page, '#gate'))
    page.click('#hm-switch')
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('H6 switch-role re-gate offers passcode + skip again',
          visible(page, '#gt-pass-block') and visible(page, '#gt-skip'))
    page.click('#role-customer')
    page.click('#gt-skip')
    page.wait_for_selector('#home.visible')
    page.click('#go-live')
    check('H7 live after skip opens the passcode popup', visible(page, '#live-pass'))
    ctx.close()

    # ── Scenario I: passcode popup on Live Feed after skipping the gate ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    stub_dash(ctx)
    stub_img(ctx)
    gw_ok = {'v': False}
    def gw_flip(route):
        if gw_ok['v']:
            j(route, {'cameras': []})
        else:
            j(route, {}, status=401)
    ctx.route(GW + '/**', gw_flip)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&role=customer')
    page.wait_for_selector('#home.visible')
    check('I1 no home passcode field', page.query_selector('#hm-pass') is None)
    page.click('#go-live')
    check('I2 live without key opens popup', visible(page, '#live-pass'))
    page.click('#live-pass-go')
    check('I3 empty passcode refused', 'Enter the viewer passcode' in page.text_content('#live-pass-err'))
    page.fill('#live-pass-input', 'wrong-key')
    page.click('#live-pass-go')
    page.wait_for_function(
        "document.getElementById('live-pass-err').textContent.indexOf('not accepted') !== -1")
    check('I4 gateway 401 -> rejected in popup', True)
    gw_ok['v'] = True
    page.fill('#live-pass-input', 'right-key')
    page.click('#live-pass-go')
    page.wait_for_selector('#frame-live.on')
    check('I5 accepted key stored and live starts', page.evaluate(
        "sessionStorage.getItem('vyViewerKey')") == 'right-key')
    check('I6 popup closed after unlock', not visible(page, '#live-pass'))
    check('I6b 3D frame is not the live stage',
          'on' not in (page.get_attribute('#frame-3d', 'class') or ''))
    live_frame = next((f for f in page.frames
                       if f.url.split('?')[0].endswith('/live-viewer.html')), None)
    stage_ok = False
    if live_frame:
        live_frame.wait_for_function(
            "window.__stages && window.__stages.indexOf('live') !== -1", timeout=5000)
        stage_ok = True
    check('I7 live stage delivered to live-viewer child', stage_ok)
    page.screenshot(path=os.path.join(SHOT_DIR, 'live-pass-popup.png'))
    ctx.close()

    # ── Scenario J: live without a 3D model (cameras file + satellite only) ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    stub_dash(ctx)
    ctx.route('**/data/index/' + JONES + '.json', lambda r: j(r, {
        'id': JONES, 'name': 'Jones',
        'address': '18775 Macalpine Loop, Bend OR 97702',
        'lat': 44.0414545, 'lng': -121.3786406, 'hoa': 'highlands',
        'account_type': 'residential',
        'views': {'security': 'sat-only-stub'}
    }))
    ctx.route('**/data/cameras/json/' + JONES + '.json',
              lambda r: j(r, {'property': JONES, 'cameras': [{'id': 'cam-01'}]}))
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&role=customer')
    page.wait_for_selector('#home.visible')
    check('J1 3D disabled when index has no model view',
          page.is_disabled('#btn-3d') and page.is_disabled('#go-3d'))
    check('J2 LIVE enabled from cameras file without a GLB',
          not page.is_disabled('#btn-live') and not page.is_disabled('#go-live'))
    check('J3 no 3D iframe mounted', page.query_selector('#frame-3d') is None)
    check('J4 live iframe mounted', page.query_selector('#frame-live') is not None)
    check('J5 satellite iframe still mounted', page.query_selector('#frame-sat') is not None)
    page.click('#btn-live')
    check('J6 live tab without key opens popup (not 3D)',
          visible(page, '#live-pass') and visible(page, '#home'))
    ctx.close()

    # ── Scenario G: real children + real data APIs (no stubs), smoke ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&role=responder')
    page.wait_for_selector('#home.visible')
    page.wait_for_function(
        "Array.from(document.querySelectorAll('iframe')).length === 3")
    titles = {}
    for f in page.frames:
        name = f.url.split('/')[-1].split('?')[0]
        if name in ('model-viewer.html', 'viewer.html', 'live-viewer.html'):
            try:
                f.wait_for_load_state('domcontentloaded', timeout=20000)
                titles[name] = f.title()
            except Exception as e:
                titles[name] = 'ERR ' + str(e)
    check('G1 real model-viewer child loads', titles.get('model-viewer.html') == 'Property 3D Viewer')
    check('G2 real viewer.html child loads', titles.get('viewer.html') == 'Property Intel — Vyanet')
    check('G2b real live-viewer child loads (paused until LIVE tab)',
          titles.get('live-viewer.html') == 'Live Feed')
    try:
        wait_dash(page, timeout=45000)
        settled = True
    except Exception:
        settled = False
    check('G3 dashboard settles against the real APIs', settled)
    try:
        page.wait_for_selector('#hm-hero.has-img', timeout=15000)
        hero_ok = True
    except Exception:
        hero_ok = False
    check('G4 hero nadir loads from real CloudFront', hero_ok)
    bodies = page.evaluate(
        "Array.from(document.querySelectorAll('#hm-grid .dash-body'))"
        ".map(function(b){return b.textContent.indexOf('Could not load') !== -1 ? 'err' : 'ok';})")
    print('      G3 sources: ' + ', '.join(
        s['id'] + '=' + bodies[i] for i, s in enumerate([
            {'id': 'wx'}, {'id': 'fire'}, {'id': 'quake'},
            {'id': 'fema'}, {'id': 'space'}, {'id': 'info'}]))
          if bodies and len(bodies) == 6 else '      G3 sources: (unavailable)')
    page.screenshot(path=os.path.join(SHOT_DIR, 'home-dashboard-real.png'), full_page=False)
    mv = None
    for f in page.frames:
        if 'model-viewer.html' in (f.url or ''):
            mv = f
            break
    loop_off = False
    if mv:
        try:
            mv.wait_for_function('window.__loopOn === false', timeout=60000)
            loop_off = True
        except Exception:
            loop_off = False
    check('G4b 3D render loop paused while home is showing', loop_off)
    dpr_ok = False
    if mv:
        dpr_ok = mv.evaluate(
            'typeof window.__pixelRatio === "number" && window.__pixelRatio <= 1.5')
    check('G4c 3D pixel ratio capped at 1.5', dpr_ok)
    page.click('#go-3d')
    check('G5 3D stage opened', mv is not None)
    loop_on = False
    if mv:
        try:
            mv.wait_for_function('window.__loopOn === true', timeout=10000)
            loop_on = True
        except Exception:
            loop_on = False
    check('G5c 3D render loop running on the 3D stage', loop_on)
    pins_ok = False
    cams_ok = False
    if mv:
        try:
            mv.wait_for_function(
                "!!window.__pinLayers && "
                "!!(window.__pinLayers.element || window.__pinLayers.concern)",
                timeout=60000)
            pins_ok = True
        except Exception:
            pins_ok = False
        try:
            mv.wait_for_function(
                "!!window.__camLayer && window.__camLayer.children.length > 0",
                timeout=30000)
            cams_ok = True
        except Exception:
            cams_ok = False
    check('G5b element/concern pins placed on the mesh', pins_ok)
    check('G6 camera pins placed on the mesh', cams_ok)
    cam_tab = mv.evaluate(
        "!!(document.getElementById('pp-btn-cams') && "
        "document.getElementById('pp-btn-cams').style.display === 'block')") if mv else False
    live_hidden = mv.evaluate(
        "(() => { const b = document.getElementById('live-tab'); "
        "return !b || getComputedStyle(b).display === 'none'; })()") if mv else False
    check('G6b Cameras tab visible in 3D', cam_tab)
    check('G6c embedded 3D hides its own LIVE FEED tab', live_hidden)
    popped = False
    if mv and cams_ok:
        popped = mv.evaluate("""() => {
          if (typeof showCameraPopup !== 'function') return false;
          showCameraPopup(0);
          const el = document.getElementById('cam-popup');
          return !!(el && el.style.display === 'block');
        }""")
    check('G6d camera pin opens the in-model popup', popped)
    live_btn = False
    flash_on = False
    if mv and cams_ok:
        got = mv.evaluate("""() => {
          if (!window.__camLayer) return { btn: false, flash: false };
          window.__camLayer.traverse(function (o) {
            if (o.isSprite && o.userData && o.userData.camera) {
              o.userData.camera.live = { device: 'AABBCCDDEEFF', channel: 0 };
            }
          });
          if (typeof window.__refreshCamIndicators === 'function') {
            window.__refreshCamIndicators();
          }
          const flash = (window.__camFlashCount || 0) > 0;
          if (typeof showCameraPopup === 'function') showCameraPopup(0);
          const btn = document.getElementById('cam-pop-live-btn');
          return {
            btn: !!(btn && btn.style.display === 'block'),
            flash: flash
          };
        }""")
        live_btn = bool(got and got.get('btn'))
        flash_on = bool(got and got.get('flash'))
    check('G6e associated pin shows Go live', live_btn)
    check('G6f live-associated pin has the flashing-feed indicator', flash_on)
    page.screenshot(path=os.path.join(SHOT_DIR, 'stage-3d-pins.png'))
    if mv:
        page.click('#btn-home')
        try:
            mv.wait_for_function('window.__loopOn === false', timeout=8000)
            loop_off_home = True
        except Exception:
            loop_off_home = False
        check('G6g 3D render loop pauses again on home', loop_off_home)
    ctx.close()

    browser.close()

print()
print('SHOTS: ' + SHOT_DIR)
if fails:
    print('FAILED: ' + str(len(fails)))
    sys.exit(1)
print('ALL CHECKS PASSED')
