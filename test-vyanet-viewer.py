# Phase A verification for vyanet-viewer.html (hub 1.1.x) against localhost:8899.
# Static referee first (node --check, ids, handlers, braces), then behavior.
# Child pages and the live gateway are stubbed per scenario so every code path
# actually evaluates (unstubbed = silently passes on nothing). Scenario G runs
# the real child pages unstubbed as an integration smoke.
import json, re, subprocess, sys, tempfile, os
from playwright.sync_api import sync_playwright

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

MV_STUB = '<html><head><title>MV STUB</title></head><body>mv stub</body></html>'
SAT_STUB = ('<html><head><title>SAT STUB</title></head><body>sat stub<script>'
            'window.__gotStage=0;'
            "window.addEventListener('message',function(e){"
            "if(e.data&&e.data.type==='vyanet-stage')window.__gotStage++;});"
            '</script></body></html>')

def stub_children(ctx):
    ctx.route('**/model-viewer.html*', lambda r: r.fulfill(content_type='text/html', body=MV_STUB))
    ctx.route('**/viewer.html*', lambda r: r.fulfill(content_type='text/html', body=SAT_STUB))

def static_checks():
    hub_path = 'C:/dev/property-intel/vyanet-viewer.html'
    mod_path = 'C:/dev/property-intel/js/vyanet-viewer/property.js'
    html = open(hub_path, encoding='utf-8').read()
    m = re.search(r'<script type="module">([\s\S]*?)</script>', html)
    check('S1 module script present', m is not None)
    js = m.group(1) if m else ''
    tmp_js = os.path.join(tempfile.gettempdir(), 'hub-inline.mjs')
    tmp_mod = os.path.join(tempfile.gettempdir(), 'hub-property.mjs')
    open(tmp_js, 'w', encoding='utf-8').write(js)
    open(tmp_mod, 'w', encoding='utf-8').write(open(mod_path, encoding='utf-8').read())
    for label, f in [('S2 node --check inline script', tmp_js), ('S3 node --check property.js', tmp_mod)]:
        r = subprocess.run(['node', '--check', f], capture_output=True, text=True, shell=True)
        check(label, r.returncode == 0)
        if r.returncode:
            print(r.stderr)
    html_ids = set(re.findall(r'id="([^"]+)"', html))
    dynamic = {'frame-3d', 'frame-sat'}
    js_ids = re.findall(r"getElementById\('([^']+)'\)", js)
    missing = [i for i in js_ids if i not in html_ids and i not in dynamic]
    missing += ['role-' + r for r in ('customer', 'tech', 'responder') if 'role-' + r not in html_ids]
    check('S4 all getElementById literals + dynamic role ids resolve (' + str(len(js_ids)) + ')', not missing)
    if missing:
        print('  missing: ' + ', '.join(missing))
    handlers = set(re.findall(r'on(?:click|submit)="(\w+)\(', html))
    unresolved = [h for h in handlers if not re.search(r'window\.' + h + r'\s*=', js)]
    check('S5 all ' + str(len(handlers)) + ' inline handlers resolve on window', not unresolved)
    if unresolved:
        print('  unresolved: ' + ', '.join(unresolved))
    stripped = re.sub(r"'[^']*'", '', re.sub(r'"[^"]*"', '', js))
    bal = minbal = 0
    for ch in stripped:
        bal += (ch == '{') - (ch == '}')
        minbal = min(minbal, bal)
    check('S6 brace balance', bal == 0 and minbal >= 0)
    names, depth = {}, 0
    for line in js.split('\n'):
        if depth == 0:
            d = re.match(r'\s*(?:const|let|function|async function)\s+([A-Za-z_$][\w$]*)', line)
            if d:
                names[d.group(1)] = names.get(d.group(1), 0) + 1
        for ch in line:
            depth += (ch == '{') - (ch == '}')
    dups = [k for k, v in names.items() if v > 1]
    check('S7 no duplicate top-level declarations', not dups)
    if dups:
        print('  dups: ' + ', '.join(dups))

def wait_settled(page):
    # camsSettled shows as an enabled-or-not ENTER plus empty status line
    page.wait_for_function("document.getElementById('gt-status').textContent === ''")

def visible(page, sel):
    return page.evaluate("!!document.querySelector('" + sel + "')?.classList.contains('visible')")

static_checks()

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ── Scenario A: Jones as-is (no cameras detectable), full happy path ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES)
    page.wait_for_selector('#gate.visible')
    check('A1 gate visible on load', True)
    check('A2 gate shows name', page.text_content('#gt-name') == 'Jones')
    check('A3 gate shows address', 'Macalpine' in page.text_content('#gt-addr'))
    meta = page.text_content('#gt-meta')
    check('A4 meta chips (acct/hoa/coords)', 'Residential' in meta and 'HOA highlands' in meta and '44.04145' in meta)
    wait_settled(page)
    check('A5 ENTER disabled until role picked', page.is_disabled('#gt-enter'))
    check('A6 no passcode field when no cameras', not visible(page, '#gt-pass-block'))
    check('A6b no skip button when no cameras', not visible(page, '#gt-skip'))
    page.click('#role-responder')
    check('A7 role button lights', 'on' in page.get_attribute('#role-responder', 'class'))
    check('A8 ENTER enabled after role', not page.is_disabled('#gt-enter'))
    page.screenshot(path=os.path.join(SHOT_DIR, 'gate-mobile.png'))
    page.click('#gt-enter')
    page.wait_for_selector('#home.visible')
    check('A9 home after enter', True)
    check('A10 gate hidden', not visible(page, '#gate'))
    check('A11 role chip on home', page.text_content('#hm-role') == 'Viewing as Responder')
    check('A12 both plugin cards offered', 'avail' in page.get_attribute('#card-3d', 'class')
          and 'avail' in page.get_attribute('#card-sat', 'class'))
    check('A13 HOME button lit', 'on' in page.get_attribute('#btn-home', 'class'))
    f3 = page.query_selector('#frame-3d')
    fs = page.query_selector('#frame-sat')
    check('A14 both iframes mounted at home', f3 is not None and fs is not None)
    check('A15 3D iframe src view=drone-test', 'view=drone-test' in (f3.get_attribute('src') or ''))
    check('A16 sat iframe src tab=security', 'tab=security' in (fs.get_attribute('src') or ''))
    page.screenshot(path=os.path.join(SHOT_DIR, 'home-mobile.png'))
    page.click('#card-3d')
    check('A17 3D stage: home hidden', not visible(page, '#home'))
    check('A18 3D frame on top', 'on' in page.get_attribute('#frame-3d', 'class'))
    check('A19 3D button lit, HOME unlit', 'on' in page.get_attribute('#btn-3d', 'class')
          and 'on' not in (page.get_attribute('#btn-home', 'class') or ''))
    page.click('#btn-sat')
    check('A20 satellite frame on top', 'on' in page.get_attribute('#frame-sat', 'class')
          and 'on' not in (page.get_attribute('#frame-3d', 'class') or ''))
    sat_frame = next((f for f in page.frames
                      if f.url.split('?')[0].endswith('/viewer.html')), None)
    got = -1
    if sat_frame:
        sat_frame.wait_for_function('window.__gotStage > 0', timeout=5000)
        got = sat_frame.evaluate('window.__gotStage')
    check('A21 vyanet-stage postMessage received by satellite child', got and got > 0)
    page.click('#btn-home')
    check('A22 back to home, frames keep z classes', visible(page, '#home')
          and 'on' in page.get_attribute('#frame-sat', 'class'))
    page.screenshot(path=os.path.join(SHOT_DIR, 'stage-sat-mobile.png'))
    page.reload()
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('A23 refresh re-gates (no skip)', True)
    check('A24 role preselected from session', 'on' in page.get_attribute('#role-responder', 'class'))
    check('A25 one-tap ENTER ready', not page.is_disabled('#gt-enter'))
    page.click('#gt-enter')
    page.wait_for_selector('#home.visible')
    page.click('#hm-switch')
    page.wait_for_selector('#gate.visible')
    check('A26 switch role re-gates', True)
    check('A27 switch role cleared selection', 'on' not in (page.get_attribute('#role-responder', 'class') or ''))
    check('A28 ENTER disabled again', page.is_disabled('#gt-enter'))
    ctx.close()

    # ── Scenario B: cameras via data/cameras file; gateway 401 then 200 ──
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    stub_children(ctx)
    gw_accept = {'v': False}
    def gw_route(route):
        if gw_accept['v']:
            route.fulfill(content_type='application/json', body=json.dumps({'cameras': []}))
        else:
            route.fulfill(status=401, content_type='application/json', body='{}')
    ctx.route(GW + '/**', gw_route)
    ctx.route('**/data/cameras/' + JONES + '.json',
              lambda r: r.fulfill(content_type='application/json',
                                  body=json.dumps({'property': JONES, 'cameras': [{'id': 'cam-01'}]})))
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
    page.screenshot(path=os.path.join(SHOT_DIR, 'gate-pass-mobile.png'))
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
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('B7 re-gate: passcode field skipped (key saved)', not visible(page, '#gt-pass-block'))
    check('B8 re-gate: saved-key note shown', visible(page, '#gt-pass-saved'))
    check('B9 role customer preselected', 'on' in page.get_attribute('#role-customer', 'class'))
    ctx.close()

    # ── Scenario C: cameras via model record; &gw=0 stores without validating ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    stub_children(ctx)
    rec = json.loads(open('C:/dev/property-intel/data/drone-test/83af9960667d769f621a4a70ad03a970.json', encoding='utf-8').read())
    rec['cameras'] = [{'id': 'cam-01', 'label': 'Front walkway', 'live': {'device': 'X', 'channel': 0}}]
    ctx.route('**/data/drone-test/83af9960667d769f621a4a70ad03a970.json',
              lambda r: r.fulfill(content_type='application/json', body=json.dumps(rec)))
    gw_called = {'v': 0}
    def gw_count(route):
        gw_called['v'] += 1
        route.fulfill(status=401, body='{}')
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

    # ── Scenario D: Tracy hub, &role= preselect, real data files ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    stub_children(ctx)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + TRACY + '&role=tech')
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('D1 &role= preselects but gate still shows', 'on' in page.get_attribute('#role-tech', 'class'))
    check('D2 Tracy identity', 'Tracy' in page.text_content('#gt-name'))
    page.click('#gt-enter')
    page.wait_for_selector('#home.visible')
    f3 = page.query_selector('#frame-3d')
    fs = page.query_selector('#frame-sat')
    check('D3 both plugins from drone-test-only index', 'view=drone-test' in (f3.get_attribute('src') or '')
          and 'tab=drone-test' in (fs.get_attribute('src') or ''))
    page.screenshot(path=os.path.join(SHOT_DIR, 'home-desktop.png'))
    ctx.close()

    # ── Scenario E: ?stage=satellite lands in satellite after gate ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    stub_children(ctx)
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&stage=satellite&role=responder')
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    page.click('#gt-enter')
    page.wait_for_selector('#frame-sat.on')
    check('E1 stage param skips home into satellite', not visible(page, '#home')
          and 'on' in page.get_attribute('#btn-sat', 'class'))
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
    gw_calls = {'v': 0}
    def gw_tally(route):
        gw_calls['v'] += 1
        route.fulfill(status=401, body='{}')
    ctx.route(GW + '/**', gw_tally)
    ctx.route('**/data/cameras/' + JONES + '.json',
              lambda r: r.fulfill(content_type='application/json',
                                  body=json.dumps({'property': JONES, 'cameras': [{'id': 'cam-01'}]})))
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES)
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    page.click('#role-responder')
    check('H1 skip enabled once role picked', not page.is_disabled('#gt-skip'))
    page.screenshot(path=os.path.join(SHOT_DIR, 'gate-skip-mobile.png'))
    page.click('#gt-skip')
    page.wait_for_selector('#home.visible')
    check('H2 skip enters home', True)
    check('H3 no key stored, no gateway calls',
          page.evaluate("sessionStorage.getItem('vyViewerKey')") is None and gw_calls['v'] == 0)
    check('H4 role still persisted', page.evaluate("sessionStorage.getItem('vyRole')") == 'responder')
    page.reload()
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    check('H5 re-gate still offers passcode + skip', visible(page, '#gt-pass-block')
          and visible(page, '#gt-skip'))
    ctx.close()

    # ── Scenario G: real child pages (no stubs), integration smoke ──
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = ctx.new_page()
    page.goto(BASE + '/vyanet-viewer.html?property=' + JONES + '&role=responder')
    page.wait_for_selector('#gate.visible')
    wait_settled(page)
    page.click('#gt-enter')
    page.wait_for_selector('#home.visible')
    page.wait_for_function(
        "Array.from(document.querySelectorAll('iframe')).length === 2")
    titles = {}
    for f in page.frames:
        if 'model-viewer.html' in f.url or 'viewer.html' in f.url.split('?')[0]:
            try:
                f.wait_for_load_state('domcontentloaded', timeout=20000)
                titles[f.url.split('/')[-1].split('?')[0]] = f.title()
            except Exception as e:
                titles[f.url.split('/')[-1].split('?')[0]] = 'ERR ' + str(e)
    check('G1 real model-viewer child loads', titles.get('model-viewer.html') == 'Property 3D Viewer')
    check('G2 real viewer.html child loads', titles.get('viewer.html') == 'Property Intel — Vyanet')
    ctx.close()

    browser.close()

print()
print('SHOTS: ' + SHOT_DIR)
if fails:
    print('FAILED: ' + str(len(fails)))
    sys.exit(1)
print('ALL CHECKS PASSED')
