"""Build docs/audit/DATA_MAP.html from docs/audit/DATA_MAP.md.

Reads every ```mermaid block (nodes, layer membership, labelled edges) and the step
table that precedes it, emits one JSON payload, and renders:
  * FLOW view per process  - sequence layout: resource rows grouped by layer,
                             step columns S01..Snn left to right, arrows per step.
  * FULL MAP               - every resource once in fixed layer columns, all
                             process edges; click a process chip to trace its
                             path, click a node to isolate its connections.
Mermaid source stays the truth (also kept as collapsible fallback render).
Run: python build_html.py   (prints the table<->edge reconciliation per diagram)"""
import re, io, os, json, html, datetime

_HERE = os.path.dirname(os.path.abspath(__file__))
_DOCS = _HERE if os.path.exists(os.path.join(_HERE, "DATA_MAP.md")) else r"C:\dev\property-intel\docs\audit"
MD = os.path.join(_DOCS, "DATA_MAP.md")
OUT = os.path.join(_DOCS, "DATA_MAP.html")

LAYERS = [
  ["L01","Local machine","#6d4c41"], ["L02","Google Sheets","#2e7d32"], ["L03","Apps Script","#43a047"],
  ["L04","Google APIs","#1e88e5"], ["L05","API Gateway","#8e24aa"], ["L06","Lambda","#ef6c00"],
  ["L07","Bedrock","#00897b"], ["L08","OpenSearch","#00acc1"], ["L09","S3","#c62828"],
  ["L10","CloudFront","#ad1457"], ["L11","CloudWatch","#d81b60"], ["L12","GitHub","#37474f"],
  ["L13","Zoho","#f9a825"], ["L14","BotPress","#5d4037"], ["L15","Vendor / external","#546e7a"]
]

md = io.open(MD, encoding="utf-8").read()

def parse_block(src):
    nodes, edges, lane = {}, [], None
    phase = None  # '%% Phase name' comments in the edge section define the phases (linear route stops)
    for raw in src.split("\n"):
        line = raw.strip()
        if line.startswith("%%"):
            txt = line[2:].strip()
            if txt and not txt.lower().startswith("invisible anchor"): phase = txt
            continue
        if not line or line.startswith(("classDef", "direction", "flowchart")): continue
        m = re.match(r'^subgraph\s+([A-Za-z0-9_]+)\["(.*)"\]$', line)
        if m: lane = m.group(1); continue
        if line == "end": lane = None; continue
        m = re.match(r'^([A-Za-z0-9_]+)\["(.*)"\](?::::([A-Za-z0-9_]+))?$', line)
        if m:
            if m.group(3) == "anchor": continue
            nodes[m.group(1)] = {"id": m.group(1), "label": m.group(2), "cls": m.group(3) or "live", "lane": lane}
            continue
        parts = re.split(r"\s+(-->|-\.->|==>|---|~~~)\s*", line)
        if len(parts) >= 3:
            i = 0
            while i + 2 < len(parts):
                a, op, rest = parts[i].strip(), parts[i+1], parts[i+2].strip()
                label = ""
                lm = re.match(r'^\|([^|]*)\|\s*(.*)$', rest)
                if lm: label = lm.group(1).strip().strip('"'); rest = lm.group(2).strip()
                b = rest.split()[0] if rest else ""
                parts[i+2] = b
                i += 2
                if op == "~~~" or re.match(r"^A\d\d$", a) or re.match(r"^A\d\d$", b): continue
                status = "cited"
                if op == "-.->" or "[UNVERIFIED]" in label.upper(): status = "unverified"
                if re.search(r"\[(SUPERSEDED|DEAD)\]", label, re.I): status = "dead"
                sm = re.match(r"(S\d\d)", label)
                edges.append({"s": a, "t": b, "label": label, "status": status, "step": sm.group(1) if sm else None, "phase": phase})
    return nodes, edges

processes, all_nodes, checks = [], {}, []
prev_end = 0
for m in re.finditer(r"```mermaid\n(.*?)```", md, re.S):
    before = md[:m.start()]
    h2s = list(re.finditer(r"^## .+$", before, re.M))
    cap = h2s[-1].group(0)[3:].strip() if h2s else "diagram"
    pid_m = re.search(r"\b(P\d\d)\b", cap)
    pid = pid_m.group(1) if pid_m else "P00"
    sect = md[h2s[-1].start():m.start()] if h2s else ""
    steps = []
    for row in re.findall(r"^\| (S\d\d) \|(.*)$", sect, re.M):
        cells = [c.strip() for c in row[1].strip().rstrip("|").split(" | ")]
        while len(cells) < 6: cells.append("")
        steps.append({"id": row[0], "layer": cells[0], "script": cells[1], "trigger": cells[2],
                      "io": cells[3], "source": cells[4], "status": cells[5]})
    nodes, edges = parse_block(m.group(1))
    for nid, n in nodes.items():
        all_nodes.setdefault(nid, n)
    title_m = re.search(r"^## (P\d\d) — (.+?) \(", md[h2s[-1].start():] if h2s else "", re.M)
    # phases in first-appearance order; each step belongs to the phase of its first edge
    phases, seen_ph = [], set()
    for e in edges:
        ph = e["phase"] or "All steps"
        if ph not in seen_ph: seen_ph.add(ph); phases.append({"name": ph, "steps": []})
    for s in steps:
        ph = next((e["phase"] or "All steps" for e in edges if e["step"] == s["id"]), None)
        if ph is None: continue
        next(p for p in phases if p["name"] == ph)["steps"].append(s["id"])
    processes.append({"id": pid, "title": (title_m.group(2) if (title_m and pid != "P00") else cap),
                      "caption": cap, "nodes": list(nodes.keys()), "edges": edges, "steps": steps,
                      "phases": phases, "mermaid": m.group(1)})
    # reconciliation
    table_ids = {s["id"] for s in steps}
    edge_ids = {e["step"] for e in edges if e["step"]}
    undefined = sorted({x for e in edges for x in (e["s"], e["t"]) if x not in nodes})
    checks.append((cap, len(nodes), len(edges), len(steps), sorted(table_ids - edge_ids), sorted(edge_ids - table_ids), undefined))

for c in checks:
    print(f"[check] {c[0][:60]!r}: nodes={c[1]} edges={c[2]} table_steps={c[3]} table_only={c[4]} edge_only={c[5]} undefined_nodes={c[6]}")

# process inventory (section 1 table): id, name, status -> topic bubbles for processes not yet mapped
inventory = []
for row in re.findall(r"^\| (P\d\d) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$", md, re.M):
    pid, name, where, status, notes = row
    name = re.sub(r"\*\*", "", name)
    name = re.sub(r"\s*\(.*$", "", name).strip()
    inventory.append({"id": pid, "name": name, "status": re.sub(r"\*\*", "", status).strip(), "where": where, "notes": notes})

# section 1b: stages (home columns) and process hand-offs (home arrows)
stages, handoffs = [], []
sect1b = re.search(r"^## 1b\..*?(?=^## 2\.)", md, re.M | re.S)
if sect1b:
    s = sect1b.group(0)
    for row in re.findall(r"^\| (\d) ([^|]+?) \| ([^|]*?) \| ([^|]*?) \|$", s, re.M):
        stages.append({"n": int(row[0]), "name": row[1].strip(), "meaning": row[2].strip(),
                       "procs": re.findall(r"P\d\d", row[3])})
    for row in re.findall(r"^\| (P\d\d) \| (P\d\d) \| (.*?) \| (.*?) \| (cited|unverified|dead|no reader) \|$", s, re.M):
        handoffs.append({"s": row[0], "t": row[1], "what": row[2].strip(), "cite": row[3].strip(),
                         "status": {"no reader": "noreader"}.get(row[4], row[4])})
placed = {p for st in stages for p in st["procs"]}
missing_stage = [i["id"] for i in inventory if i["id"] not in placed]
bad_ho = [(h["s"], h["t"]) for h in handoffs if h["s"] not in placed or h["t"] not in placed]
print(f"[check] home map: stages={len(stages)} handoffs={len(handoffs)} processes_without_stage={missing_stage} handoffs_to_unknown={bad_ho}")

DATA = {"generated": datetime.date.today().isoformat(), "layers": LAYERS, "nodes": all_nodes, "processes": processes,
        "inventory": inventory, "stages": stages, "handoffs": handoffs}

fallbacks = "".join(f"""
<details class="fallback" data-pid="{p['id']}"><summary>Mermaid source — {html.escape(p['caption'])}</summary>
<pre class="src">{html.escape(p['mermaid'])}</pre></details>""" for p in processes)

JS = r"""
const L = Object.fromEntries(DATA.layers.map(([id,name,color],i)=>[id,{id,name,color,idx:i}]));
const PCOLORS = ["#1565c0","#c62828","#2e7d32","#6a1b9a","#ef6c00","#00838f","#ad1457","#5d4037","#37474f","#f9a825"];
const procs = DATA.processes.filter(p=>p.id!=="P00");
const skeleton = DATA.processes.find(p=>p.id==="P00");
const nodeOf = id => DATA.nodes[id] || {id, label:id, lane:null, cls:"live"};
const statusStroke = s => s==="dead"?"#c62828":s==="unverified"?"#f9a825":"#333";
const $ = s => document.querySelector(s);
const panel = $("#panel"), panelTitle = $("#panel h3"), panelBody = $("#panel .body");
function setPanel(title, htmlBody){ panelTitle.textContent = title; panelBody.innerHTML = htmlBody; }
const esc = s => String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const md = s => esc(s).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
function wrap(text, width, maxLines){ const words=String(text).split(/\s+/), lines=[]; let cur=""; for (const w of words){ if ((cur+" "+w).trim().length>width && cur){ lines.push(cur); cur=w; } else cur=(cur+" "+w).trim(); } if (cur) lines.push(cur); if (lines.length>maxLines){ lines.length=maxLines; lines[maxLines-1]=lines[maxLines-1].slice(0,width-1)+"…"; } return lines; }
function laneOrder(a,b){ const la=nodeOf(a).lane, lb=nodeOf(b).lane; return (L[la]?.idx??99)-(L[lb]?.idx??99) || a.localeCompare(b); }
function zoomable(svg, g){ const z = d3.zoom().scaleExtent([0.15,3]).on("zoom", ev=>g.attr("transform", ev.transform)); svg.call(z).on("dblclick.zoom", null); return z; }
function fitTo(svg, g, z, W, H){ const b=g.node().getBBox(); const k=Math.min(W/(b.width+60), H/(b.height+60), 1.4); svg.call(z.transform, d3.zoomIdentity.translate(30 - b.x*k + (W-(b.width+60)*k)/2, 30 - b.y*k).scale(k)); }



// ------------------------------------------------------------------ BUBBLE MAP — applications per role, drill-down on click
// Application groups: layers rolled up to the platform a person would name.
const APPS = [
  {id:"operator", name:"Operator", lanes:["L01"], color:"#6d4c41"},
  {id:"google",   name:"Google (Sheets · Apps Script · Maps)", lanes:["L02","L03","L04"], color:"#2e7d32"},
  {id:"lambda",   name:"AWS Lambda (+ API Gateway)", lanes:["L05","L06"], color:"#ef6c00"},
  {id:"bedrock",  name:"AWS Bedrock (+ OpenSearch)", lanes:["L07","L08"], color:"#00897b"},
  {id:"s3",       name:"AWS S3 (+ CloudFront)", lanes:["L09","L10"], color:"#c62828"},
  {id:"cw",       name:"CloudWatch", lanes:["L11"], color:"#d81b60"},
  {id:"github",   name:"GitHub (repo · Pages viewers)", lanes:["L12"], color:"#37474f"},
  {id:"zoho",     name:"Zoho", lanes:["L13"], color:"#f9a825"},
  {id:"botpress", name:"BotPress", lanes:["L14"], color:"#5d4037"},
  {id:"vendor",   name:"Vendors / external", lanes:["L15"], color:"#546e7a"}
];
const APP_OF_LANE = {}; APPS.forEach(a=>a.lanes.forEach(l=>APP_OF_LANE[l]=a.id));
const APP = Object.fromEntries(APPS.map(a=>[a.id,a]));
const appOfNode = id => APP_OF_LANE[nodeOf(id).lane] || "vendor";

// map a "Layer" cell fragment (e.g. "Apps Script", "API GW", "S3 records") onto an application group
function appOfLayerText(t){ const s=t.toLowerCase();
  if (/human|operator|reviewer|local/.test(s)) return "operator";
  if (/sheet|apps script|web app|google|maps|geocod|direction/.test(s)) return "google";
  if (/api gw|gateway|lambda|secrets/.test(s)) return "lambda";
  if (/bedrock|kb|opensearch/.test(s)) return "bedrock";
  if (/s3|cloudfront|records|tiles/.test(s)) return "s3";
  if (/cloudwatch/.test(s)) return "cw";
  if (/github|pages|viewer|browser/.test(s)) return "github";
  if (/zoho/.test(s)) return "zoho"; if (/botpress/.test(s)) return "botpress";
  if (/cdn|vendor|chekt|external/.test(s)) return "vendor";
  return null; }

function buildBubble(){
  const view = document.createElement("div"); view.className="view"; view.id="bubble";
  view.innerHTML = `<h2>Process map — click a bubble for its route, a stop for its steps</h2>
    <div class="toolbar"><button data-act="back">← Back</button><button data-act="home">Home</button><button data-act="fit">Fit</button>
      <span class="crumbs"></span>
      <span style="float:right">Receipt for a resource: <select data-act="find"><option value="">choose…</option></select></span></div>
    <div class="canvas"><svg></svg></div>`;
  $("#views").appendChild(view);
  const svg = d3.select(view.querySelector("svg"));
  const W = view.querySelector(".canvas").clientWidth, H = Math.max(620, window.innerHeight-200);
  svg.attr("width",W).attr("height",H);
  const defs = svg.append("defs");
  const grad = (id,c1,c2)=>{ const g=defs.append("radialGradient").attr("id",id).attr("cx","35%").attr("cy","30%"); g.append("stop").attr("offset","0%").attr("stop-color",c1); g.append("stop").attr("offset","100%").attr("stop-color",c2); };
  grad("g-main","#d0d0d0","#7a7a7a"); grad("g-topic","#dbe9fb","#4f83c8"); grad("g-topic-off","#f0f0f0","#b8b8b8"); grad("g-phase","#e3ecf7","#5b7fae");
  APPS.forEach(a=>grad("g-app-"+a.id, d3.color(a.color).brighter(1.8).formatHex(), a.color));
  DATA.layers.forEach(([id,,c])=>grad("g-"+id, d3.color(c).brighter(1.7).formatHex(), c));
  for (const [k,c] of [["cited","#2a4d7f"],["unverified","#f9a825"],["dead","#c62828"]])
    defs.append("marker").attr("id","ra-"+k).attr("viewBox","0 -5 10 10").attr("refX",9).attr("markerWidth",8).attr("markerHeight",8).attr("orient","auto").append("path").attr("d","M0,-4L10,0L0,4Z").attr("fill",c);
  const g = svg.append("g"); const z = zoomable(svg, g);
  const crumbs = view.querySelector(".crumbs");
  const inv = id => DATA.inventory.find(i=>i.id===id);
  const proc = id => procs.find(p=>p.id===id);
  const appShort = a => APP[a].name.replace(/ \(.*$/,"");
  const shortRes = s => s.replace(/^property-intel-(tiles|records|ingest) \/ /,"$1/ ").replace(/^…\//,"").replace(/ \(.*$/,"").replace(/^tab /,"");
  const stepOf = (pid, sid) => (proc(pid).steps.find(s=>s.id===sid) || {id:sid});
  const stepRow = s => `<table class="kv"><tr><th>Layer</th><td>${md(s.layer||"")}</td></tr><tr><th>Script / function</th><td>${md(s.script||"")}</td></tr><tr><th>Trigger</th><td>${md(s.trigger||"")}</td></tr><tr><th>Input → Output</th><td>${md(s.io||"")}</td></tr><tr><th>Source</th><td>${md(s.source||"")}</td></tr><tr><th>Status</th><td>${md(s.status||"")}</td></tr></table>`;
  const firstCode = s => { const m=String(s||"").match(/`([^`]+)`/); return m? m[1].replace(/\(.*$/,"") : String(s||"").slice(0,26); };
  const edgeItem = (e, pid, n) => `<li><b>${esc(e.step||"")}</b> <span class="muted">${esc(pid)}</span> ${n ? (e.s===n?`→ <span class="n">${esc(nodeOf(e.t).label)}</span>`:`← <span class="n">${esc(nodeOf(e.s).label)}</span>`) : `<span class="n">${esc(nodeOf(e.s).label)}</span> → <span class="n">${esc(nodeOf(e.t).label)}</span>`}<div class="lbl">${esc(e.label)}</div></li>`;

  // resource finder → receipt
  const sel = view.querySelector("[data-act=find]");
  [...new Set(procs.flatMap(p=>p.nodes))].sort(laneOrder).forEach(n=>{ const o=document.createElement("option"); o.value=n; o.textContent=`${nodeOf(n).lane} · ${shortRes(nodeOf(n).label)}`; sel.appendChild(o); });
  sel.onchange = ()=>{ if(sel.value) receiptPanel(sel.value); sel.value=""; };

  // ---------- navigation
  let state = {level:0}; const history = [];
  function go(next){ history.push(state); state = next; render(); }
  function back(){ if (history.length){ state = history.pop(); render(); } }

  // ---------- drawing helpers (linear)
  function bubble(sel){
    sel.attr("transform",d=>`translate(${d.x},${d.y})`).style("cursor",d=>d.onClick?"pointer":"default");
    sel.filter(d=>d.shape==="pill").append("rect").attr("x",d=>-d.w/2).attr("y",-16).attr("width",d=>d.w).attr("height",32).attr("rx",16).attr("fill",d=>d.fill).attr("stroke","#fff").attr("stroke-width",2);
    sel.filter(d=>d.shape!=="pill").append("circle").attr("r",d=>d.r).attr("fill",d=>d.fill).attr("stroke",d=>d.stroke||"#fff").attr("stroke-width",d=>d.strokeWidth||2.5).attr("stroke-dasharray",d=>d.dash||null);
    sel.append("text").attr("text-anchor","middle").attr("font-size",d=>d.fontSize||11).attr("font-weight",d=>d.bold?700:500).attr("fill",d=>d.color||"#111")
      .attr("paint-order",d=>d.inside?null:"stroke").attr("stroke",d=>d.inside?null:"#fff").attr("stroke-width",d=>d.inside?null:3.5)
      .selectAll("tspan").data(d=>d.lines.map((l,i)=>({l,i,n:d.lines.length,d}))).join("tspan").attr("x",0)
      .attr("y",t=>t.d.inside ? (t.i-(t.n-1)/2)*(t.d.fontSize||11)*1.15+4 : (t.d.r||16)+14+t.i*12).text(t=>t.l);
    // sub-chips under the bubble (application tags)
    sel.filter(d=>d.chips&&d.chips.length).each(function(d){ const gg=d3.select(this).append("g"); const y0=(d.r||16)+14+(d.lines.length)*12+2;
      d.chips.forEach((c,i)=>{ const y=y0+i*16; const w=c.text.length*5.6+12; gg.append("rect").attr("x",-w/2).attr("y",y-8).attr("width",w).attr("height",14).attr("rx",7).attr("fill",APP[c.app].color).attr("opacity",0.9); gg.append("text").attr("x",0).attr("y",y+3).attr("text-anchor","middle").attr("font-size",8.5).attr("font-weight",700).attr("fill","#fff").text(c.text); }); });
    sel.append("title").text(d=>d.title||"");
    sel.on("click",(ev,d)=>{ ev.stopPropagation(); if (d.onClick) d.onClick(d); });
  }
  function link(a, b, label, status="cited", onClick){ // straight arrow a → b (left to right or top to bottom), optional label box mid-way
    const ax = a.x + (a.shape==="pill"? a.w/2 : a.r), bx = b.x - (b.shape==="pill"? b.w/2 : b.r) - 4;
    const vertical = Math.abs(b.y-a.y) > 1 && Math.abs(b.x-a.x) < 1;
    const p = g.append("g").style("cursor",onClick?"pointer":"default");
    if (vertical){ const ay=a.y+(a.r||16), by=b.y-(b.r||16)-4; p.append("line").attr("x1",a.x).attr("y1",ay).attr("x2",b.x).attr("y2",by).attr("stroke",statusStroke(status)==="#333"?"#2a4d7f":statusStroke(status)).attr("stroke-width",2.2).attr("stroke-dasharray",status==="unverified"?"6 4":null).attr("marker-end",`url(#ra-${status})`); }
    else p.append("line").attr("x1",ax).attr("y1",a.y).attr("x2",bx).attr("y2",b.y).attr("stroke",status==="cited"?"#2a4d7f":statusStroke(status)).attr("stroke-width",2.2).attr("stroke-dasharray",status==="unverified"?"6 4":null).attr("marker-end",`url(#ra-${status})`);
    if (label){ const mx=(ax+bx)/2, my=(a.y+b.y)/2; const w=String(label).length*6.6+14; p.append("rect").attr("x",mx-w/2).attr("y",my-24).attr("width",w).attr("height",18).attr("rx",8).attr("fill","#fff").attr("stroke","#2a4d7f").attr("stroke-width",1); p.append("text").attr("x",mx).attr("y",my-11).attr("text-anchor","middle").attr("font-size",10).attr("font-weight",700).attr("fill","#1b2f4a").text(label); }
    if (onClick) p.on("click",(ev)=>{ ev.stopPropagation(); onClick(); });
    return p;
  }
  const pill = (x, text, fill) => ({x, y:0, shape:"pill", w:text.length*8+30, fill, lines:[text], inside:true, bold:true, color:"#fff", fontSize:12});
  function chainLayout(items, x0, gap){ items.forEach((it,i)=>{ it.x = x0 + i*gap; it.y = 0; }); }
  function caption(text, y=-120){ g.append("text").attr("x",0).attr("y",y).attr("font-size",13).attr("fill","#555").text(text); }

  // ---------- levels
  function render(){
    g.selectAll("*").remove();
    const crumb = [{t:"Property Intel", s:{level:0}}];
    if (state.level>=1 && state.level<=3) crumb.push({t:state.pid+" "+(inv(state.pid)||{}).name, s:{level:1,pid:state.pid}});
    if (state.level>=2 && state.level<=3) crumb.push({t:state.phase, s:{level:2,pid:state.pid,phase:state.phase}});
    if (state.level===3) crumb.push({t:state.step, s:state});
    if (state.level===4) crumb.push({t:"Receipt: "+shortRes(nodeOf(state.node).label), s:state});
    crumbs.innerHTML = crumb.map((c,i)=>`<a href="#" data-i="${i}">${esc(c.t)}</a>`).join(" › ");
    crumbs.querySelectorAll("a").forEach((a,i)=>a.onclick=ev=>{ ev.preventDefault(); if (i<crumb.length-1){ history.push(state); state=crumb[i].s; render(); } });
    if (state.level===0) return home();
    if (state.level===1) return processRoute(state.pid);
    if (state.level===2) return phaseRoute(state.pid, state.phase);
    if (state.level===3) return stepDetail(state.pid, state.step);
    if (state.level===4) return receipt(state.node);
  }

  // ---------- HOME: processes as bubbles in stage columns, arrows = hand-offs (section 1b of the .md)
  const HO_COLOR = {cited:"#2a4d7f", unverified:"#f9a825", dead:"#c62828", noreader:"#9e9e9e"};
  const HO_LABEL = {cited:"cited", unverified:"[UNVERIFIED]", dead:"superseded / dead", noreader:"no reader"};
  for (const [k,c] of Object.entries(HO_COLOR)) defs.append("marker").attr("id","ho-"+k).attr("viewBox","0 -5 10 10").attr("refX",9).attr("markerWidth",7).attr("markerHeight",7).attr("orient","auto").append("path").attr("d","M0,-4L10,0L0,4Z").attr("fill",c);
  function home(){
    const gapX = 330, gapY = 128, R = 54;
    const pos = {};
    const bubbles = [];
    let pinned = null, clickT = null;   // pinned = process id whose hand-offs are frozen on screen (single click), or "edge"
    DATA.stages.forEach((st,ci)=>{
      const n = st.procs.length, y0 = -((n-1)*gapY)/2;
      g.append("text").attr("x",ci*gapX).attr("y",y0-R-58).attr("text-anchor","middle").attr("font-size",13).attr("font-weight",700).attr("fill","#1b2f4a").text(`${st.n}. ${st.name}`);
      g.append("text").attr("x",ci*gapX).attr("y",y0-R-42).attr("text-anchor","middle").attr("font-size",10.5).attr("fill","#777").text(st.meaning);
      st.procs.forEach((pid,ri)=>{
        const i = inv(pid) || {id:pid,name:pid,status:"",where:"",notes:""}; const mapped = !!proc(pid);
        const dead = /dead|superseded|not runnable|not found/i.test(i.status) && !/live/i.test(i.status);
        const unver = /UNVERIFIED|blocked|not built/i.test(i.status) && !dead;
        const b = {pid, x:ci*gapX, y:y0+ri*gapY, r:R, fill: dead?"url(#g-topic-off)":"url(#g-topic)", stroke: dead?"#c62828":unver?"#f9a825":"#fff", strokeWidth: dead||unver?3.5:2.5, dash: unver?"6 4":null,
          lines:[pid,...wrap(i.name,15,3)], fontSize:11, inside:true, bold:true, color: dead?"#444":"#14304f",
          title:`${pid} ${i.name}\n${i.status}\nhover: show its hand-offs · click: pin them · double-click: open the route`,
          mapped, inv:i,
          onClick: d=>{ clearTimeout(clickT); clickT = setTimeout(()=>{ if (pinned===d.pid){ pinned=null; highlight(null); homePanel(); } else { pinned=d.pid; highlight(d.pid); showProcHandoffs(d.pid); } }, 230); }};
        pos[pid] = b; bubbles.push(b);
      });
    });
    // arrows: cubic left→right (or a loop-back when the target column is left of / same as the source)
    const eg = g.append("g").attr("class","ho");
    const arrows = DATA.handoffs.filter(h=>pos[h.s]&&pos[h.t]).map((h,k)=>{
      const a=pos[h.s], b=pos[h.t]; const fwd = b.x > a.x; const same = Math.abs(b.x-a.x)<1;
      let d;
      if (same){ const dir = b.y>a.y?1:-1; const x1=a.x+R, y1=a.y+dir*R*0.6, x2=b.x+R, y2=b.y-dir*R*0.6-dir*4; d=`M${x1},${y1} C${x1+90},${y1} ${x2+90},${y2} ${x2},${y2}`; }
      else if (fwd){ const x1=a.x+R, x2=b.x-R-4, mx=(x1+x2)/2; d=`M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`; }
      else { const x1=a.x-R, x2=b.x+R+4, mx=(x1+x2)/2; d=`M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`; }
      const c = HO_COLOR[h.status];
      const p = eg.append("path").attr("d",d).attr("fill","none").attr("stroke",c).attr("stroke-width",h.status==="cited"?1.6:1.8).attr("stroke-opacity",0.45)
        .attr("stroke-dasharray", h.status==="unverified"||h.status==="noreader" ? "6 4" : null).attr("marker-end",`url(#ho-${h.status})`).style("cursor","pointer");
      p.append("title").text(`${h.s} → ${h.t}\n${h.what}\n${h.cite} · ${HO_LABEL[h.status]}`);
      p.on("click",(ev)=>{ ev.stopPropagation(); pinned="edge"; showHandoff(h); highlight(null, h); });
      return Object.assign({path:p, k}, h);
    });
    const hoRow = (h, dir) => { const other = dir==="out" ? h.t : h.s; const oi = inv(other)||{}; return `<li><a href="#" data-ho="${h.k}"><span style="color:${HO_COLOR[h.status]};font-weight:700">${dir==="out"?"→":"←"}</span> <b>${esc(other)}</b> ${esc(oi.name||"")}</a><div class="lbl">${md(h.what)}</div><div class="lbl muted">${esc(h.cite)} · ${esc(HO_LABEL[h.status])}</div></li>`; };
    function showProcHandoffs(pid){
      const i = inv(pid)||{}; const outs = arrows.filter(a=>a.s===pid), ins = arrows.filter(a=>a.t===pid);
      setPanel(`${pid} — ${i.name||""}`, `<p class="muted">${md(i.status||"")}</p>
        <p><b>Pinned.</b> Click the bubble again or the empty canvas to release. <a href="#" data-open="${esc(pid)}"><b>Double-click the bubble (or click here) to open the route →</b></a></p>
        <h4>Feeds into (${outs.length})</h4><ol class="edges">${outs.map(h=>hoRow(h,"out")).join("")||"<li class='muted'>nothing — its outputs are not consumed by another process</li>"}</ol>
        <h4>Fed by (${ins.length})</h4><ol class="edges">${ins.map(h=>hoRow(h,"in")).join("")||"<li class='muted'>nothing — it starts from a human or a vendor</li>"}</ol>
        <p class="muted">Click a hand-off for its citation.</p>`);
      panelBody.querySelectorAll("a[data-ho]").forEach(a=>a.onclick=ev=>{ ev.preventDefault(); const h=arrows[+a.dataset.ho]; pinned="edge"; showHandoff(h); highlight(null,h); });
      const op = panelBody.querySelector("a[data-open]"); if (op) op.onclick=ev=>{ ev.preventDefault(); go({level:1,pid}); };
    }
    function showHandoff(h){
      const si=inv(h.s)||{}, ti=inv(h.t)||{};
      setPanel(`${h.s} → ${h.t}`, `<p><b>${esc(si.name||h.s)}</b> → <b>${esc(ti.name||h.t)}</b></p><table class="kv"><tr><th>What moves</th><td>${md(h.what)}</td></tr><tr><th>Cited step</th><td>${md(h.cite)}</td></tr><tr><th>Status</th><td><span style="color:${HO_COLOR[h.status]};font-weight:700">${esc(HO_LABEL[h.status])}</span></td></tr></table><p class="muted">Open either process (click its bubble) and find the cited step in its route for the full receipt.</p>`);
    }
    // hover / focus a bubble: dim everything not connected, show labels on its arrows
    const lblG = g.append("g").attr("class","ho-labels");
    function highlight(pid, one){
      lblG.selectAll("*").remove();
      const keep = one ? new Set([one.s,one.t]) : pid ? new Set([pid, ...arrows.filter(a=>a.s===pid||a.t===pid).flatMap(a=>[a.s,a.t])]) : null;
      arrows.forEach(a=>{ const on = one ? a===one : pid ? (a.s===pid||a.t===pid) : true;
        a.path.attr("stroke-opacity", on ? (keep?0.95:0.45) : 0.06).attr("stroke-width", on&&keep ? 2.6 : (a.status==="cited"?1.6:1.8));
        if (on && keep){ const L = a.path.node().getTotalLength(), m = a.path.node().getPointAtLength(L*0.5); const txt = a.what.length>46 ? a.what.slice(0,45)+"…" : a.what; const w = txt.length*5.9+12;
          const t = lblG.append("g"); t.append("rect").attr("x",m.x-w/2).attr("y",m.y-9).attr("width",w).attr("height",17).attr("rx",8).attr("fill","#fff").attr("stroke",HO_COLOR[a.status]).attr("stroke-width",1);
          t.append("text").attr("x",m.x).attr("y",m.y+3.5).attr("text-anchor","middle").attr("font-size",9.5).attr("fill","#1b2f4a").text(txt); } });
      bsel.attr("opacity", d => keep ? (keep.has(d.pid)?1:0.18) : 1);
      bsel.select("circle").attr("stroke", d => d.pid===pinned ? "#111" : d.stroke).attr("stroke-width", d => d.pid===pinned ? 5 : d.strokeWidth);
    }
    const bsel = g.append("g").selectAll("g").data(bubbles).join("g").attr("class","proc");
    bubble(bsel);
    bsel.on("mouseenter",(ev,d)=>{ if (!pinned) highlight(d.pid); }).on("mouseleave",()=>{ if (!pinned) highlight(null); });
    bsel.on("dblclick",(ev,d)=>{ ev.stopPropagation(); clearTimeout(clickT); if (d.mapped) go({level:1,pid:d.pid}); else setPanel(`${d.pid} ${d.inv.name}`, `<table class="kv"><tr><th>Status</th><td>${md(d.inv.status)}</td></tr><tr><th>Where found</th><td>${md(d.inv.where)}</td></tr><tr><th>Notes</th><td>${md(d.inv.notes)}</td></tr></table>`); });
    svg.on("click", ()=>{ pinned=null; highlight(null); homePanel(); });
    const counts = {cited:0,unverified:0,dead:0,noreader:0}; DATA.handoffs.forEach(h=>counts[h.status]++);
    function homePanel(){ setPanel("Home — how the processes feed each other", `<p>Columns are stages, left to right: where data enters → the AWS services → the sheet pipelines → review → publish → what responders load → ops. Each arrow is one hand-off read from a step in the tables (§1b of the .md).</p>
      <p><b>Hover</b> a bubble to see only its hand-offs with what moves. <b>Click</b> a bubble to pin that view and list its hand-offs here. <b>Double-click</b> a bubble to open that process's route. <b>Click an arrow</b> for its citation.</p>
      <table class="kv"><tr><th style="color:${HO_COLOR.cited}">solid</th><td>${counts.cited} cited hand-offs</td></tr><tr><th style="color:${HO_COLOR.unverified}">dashed</th><td>${counts.unverified} [UNVERIFIED]</td></tr><tr><th style="color:${HO_COLOR.dead}">red</th><td>${counts.dead} superseded / dead</td></tr><tr><th style="color:${HO_COLOR.noreader}">grey dashed</th><td>${counts.noreader} output with no reader</td></tr></table>
      <p class="muted">Bubble border: red = dead / one-shot, dashed amber = [UNVERIFIED] or not built.</p>
      <h4>Stages</h4><ol>${DATA.stages.map(s=>`<li><b>${esc(s.name)}</b> <span class="muted">${esc(s.meaning)}</span><div class="lbl">${s.procs.map(p=>esc(p)).join(", ")}</div></li>`).join("")}</ol>`); }
    homePanel();
    fitTo(svg,g,z,W,H);
  }

  function processRoute(pid){
    const p = proc(pid), i = inv(pid);
    const stops = p.phases.filter(ph=>ph.steps.length).map(ph=>{ const es=p.edges.filter(e=>(e.phase||"All steps")===ph.name); const apps=[]; es.forEach(e=>[e.s,e.t].forEach(n=>{ const a=appOfNode(n); if(!apps.includes(a)) apps.push(a); }));
      const rng = ph.steps.length>1 ? `${ph.steps[0]}–${ph.steps[ph.steps.length-1]}` : ph.steps[0];
      return {name:ph.name, r:56, fill:"url(#g-phase)", lines:wrap(ph.name,16,3), inside:true, bold:true, color:"#fff", fontSize:11, chips:apps.map(a=>({app:a,text:appShort(a)})), sub:rng, title:`${ph.name}\nsteps ${rng}\nclick to list the steps on the right`, onClick:d=>showPhase(d), steps:ph.steps, edges:es}; });
    function showPhase(d){
      g.selectAll("g.stop").select("circle").attr("stroke","#fff").attr("stroke-width",2.5);
      g.selectAll("g.stop").filter(x=>x===d).select("circle").attr("stroke","#111").attr("stroke-width",4);
      const items = d.steps.map(sid=>{ const s=stepOf(pid,sid); const es=p.edges.filter(e=>e.step===sid);
        return `<li><details><summary><b>${esc(sid)}</b> <code>${esc(firstCode(s.script))}</code><div class="lbl muted">${md(s.layer||"")}</div></summary>
          <table class="kv"><tr><th>Runs</th><td>${md(s.script||"")}</td></tr><tr><th>Trigger</th><td>${md(s.trigger||"")}</td></tr><tr><th>In → Out</th><td>${md(s.io||"")}</td></tr><tr><th>Source</th><td>${md(s.source||"")}</td></tr><tr><th>Status</th><td>${md(s.status||"")}</td></tr>${es.length?`<tr><th>Moves</th><td><ol class="edges">${es.map(e=>`<li><span class="n">${esc(shortRes(nodeOf(e.s).label))}</span> → <span class="n">${esc(shortRes(nodeOf(e.t).label))}</span><div class="lbl">${esc(e.label.replace(/^S\d\d\s*/,""))}</div></li>`).join("")}</ol></td></tr>`:""}</table></details></li>`; }).join("");
      setPanel(`${d.name} — ${d.sub}`, `<p class="muted">${esc(pid)} · ${d.steps.length} step(s), in order. Applications: ${d.chips.map(c=>esc(c.text)).join(" → ")}</p><ol class="steps path">${items}</ol><p class="muted">Click a step to open its details.</p>`);
    }
    const start = pill(0,"START",""+"#111"), finish = pill(0,"FINISH","#111");
    chainLayout([start,...stops,finish], 0, 230);
    caption(`${pid} — ${i.name}: ${stops.length} phases, ${p.steps.length} steps, left to right`, -110);
    // step range under each phase bubble (above the chips)
    stops.forEach(s=>{ g.append("text").attr("x",s.x).attr("y",s.y+s.r+12).attr("text-anchor","middle").attr("font-size",10).attr("fill","#555").text(s.sub); });
    const seq=[start,...stops,finish];
    for (let k=0;k<seq.length-1;k++){ const a=seq[k], b=seq[k+1]; const lbl = b.steps ? `${b.steps.length} step${b.steps.length===1?"":"s"}` : ""; link(a,b,lbl); }
    bubble(g.append("g").selectAll("g").data(seq).join("g").attr("class","stop"));
    setPanel(`${pid} — ${i.name}`, `<p>The route runs left to right. Each stop is a phase; under it the step range and the applications it touches, in order.</p><ol>${stops.map(s=>`<li><b>${esc(s.name)}</b> <span class="muted">${esc(s.sub)}</span><div class="lbl">${s.chips.map(c=>esc(c.text)).join(" → ")}</div></li>`).join("")}</ol><p class="muted">Click a stop to list its steps (functions / prompts / scripts) here.</p>`);
    fitTo(svg,g,z,W,H);
  }

  // receipt as a panel list (no canvas change): producers, then consumers, in step order
  function receiptPanel(node){
    const n = nodeOf(node); const items=[]; procs.forEach(p=>p.edges.forEach(e=>{ if(e.s===node||e.t===node) items.push(Object.assign({pid:p.id},e)); }));
    items.sort((a,b)=>a.pid.localeCompare(b.pid)||(a.step||"").localeCompare(b.step||""));
    const inc=items.filter(e=>e.t===node&&e.s!==node), outg=items.filter(e=>e.s===node&&e.t!==node);
    const row = (e,dir) => `<li><b>${esc(e.step)}</b> <span class="muted">${esc(e.pid)}</span> ${dir==="in"?"←":"→"} <a href="#" data-node="${esc(dir==="in"?e.s:e.t)}" class="n">${esc(shortRes(nodeOf(dir==="in"?e.s:e.t).label))}</a><div class="lbl">${esc(e.label.replace(/^S\d\d\s*/,""))}</div><div class="lbl muted"><code>${esc(firstCode(stepOf(e.pid,e.step).script))}</code></div></li>`;
    setPanel(`Receipt — ${shortRes(n.label)}`, `<p class="muted">${esc(n.label)} · layer ${esc(n.lane)} · ${esc(n.cls)}</p><h4>Produced / fed by (${inc.length})</h4><ol class="edges">${inc.map(e=>row(e,"in")).join("")||"<li class='muted'>nothing in the mapped processes</li>"}</ol><h4>Consumed / read by (${outg.length})</h4><ol class="edges">${outg.map(e=>row(e,"out")).join("")||"<li class='muted'>nothing in the mapped processes</li>"}</ol><p class="muted">Click a name to follow the chain.</p>`);
    panelBody.querySelectorAll("a[data-node]").forEach(a=>a.onclick=ev=>{ ev.preventDefault(); receiptPanel(a.dataset.node); });
  }

  view.querySelector("[data-act=back]").onclick = back;
  view.querySelector("[data-act=home]").onclick = ()=>{ history.push(state); state={level:0}; render(); };
  view.querySelector("[data-act=fit]").onclick = ()=>fitTo(svg,g,z,W,H);
  render();
}
buildBubble();
"""

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Property Intel — Data Map</title>
<style>
 body{{font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;margin:0;color:#111;background:#fff}}
 header{{padding:12px 20px 6px;border-bottom:1px solid #e5e5e5}}
 h1{{font-size:19px;margin:0 0 4px}} h2{{font-size:15px;margin:10px 0 4px}} h3{{font-size:14px;margin:0 0 8px}} h4{{font-size:12.5px;margin:12px 0 4px}}
 .meta{{color:#555;font-size:12px}}
 #layers span{{display:inline-block;color:#fff;padding:1px 8px;margin:3px 4px 0 0;border-radius:11px;font-size:11px;font-weight:600}}
 #tabs{{padding:6px 20px;border-bottom:1px solid #e5e5e5;background:#fafafa}} #tabs button{{font-size:12.5px;padding:5px 12px;margin-right:6px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer}} #tabs button.on{{background:#111;color:#fff;border-color:#111}}
 #main{{display:flex;align-items:flex-start}} #views{{flex:1;min-width:0;padding:6px 14px 20px}} #panel{{width:360px;flex:none;border-left:1px solid #e5e5e5;padding:12px 14px;position:sticky;top:0;max-height:100vh;overflow:auto;font-size:12.5px}}
 .toolbar{{font-size:12px;color:#444;margin:4px 0 6px}} .crumbs{{margin-left:10px;font-size:13px}} .crumbs a{{color:#1565c0;text-decoration:none;font-weight:600}} .crumbs a:last-child{{color:#111}} .toolbar button{{font-size:12px;padding:2px 10px;margin-right:6px}} .hint{{color:#777}}
 .chip{{border:1px solid var(--c);color:var(--c);background:#fff;border-radius:12px;padding:2px 10px !important}} .chip.on{{background:var(--c);color:#fff}}
 .canvas{{border:1px solid #ddd;background:#fff;overflow:hidden;clear:both}} .toolbar select{{max-width:300px;font-size:12px}} .canvas svg{{display:block;width:100%}}
 .row.dim,.arrow.dim,.b.dim{{opacity:.1}} #bubble path.dim,#bubble line.dim,#bubble text.dim{{opacity:.06}} #bubble path.hl{{stroke-width:2.8;stroke-opacity:1}} .row.hl rect{{stroke-width:3}} .hdr.hl rect{{fill:#1565c0}} .arrow.hl line,.arrow.hl path{{stroke:#1565c0;stroke-width:3}}
 table.kv{{border-collapse:collapse;width:100%}} table.kv th{{text-align:left;vertical-align:top;color:#666;font-weight:600;padding:3px 6px 3px 0;width:88px}} table.kv td{{padding:3px 0;border-bottom:1px solid #eee}}
 ol.edges,ol.steps{{padding-left:18px;margin:4px 0}} ol.path li{{margin:0 0 8px;border-left:3px solid #4f83c8;padding-left:8px}} ol.path summary{{cursor:pointer;list-style:none}} ol.path summary::-webkit-details-marker{{display:none}} ol.path details[open] summary{{margin-bottom:6px}} ol.edges li,ol.steps li{{margin:0 0 6px}} .lbl{{color:#333;font-size:11.5px}} .n{{color:#1565c0}} .muted{{color:#777}} code{{background:#f3f3f3;padding:0 3px;border-radius:3px;font-size:11.5px}}
 .fallback{{margin:10px 14px}} .wrap{{overflow:auto;border:1px solid #ddd;padding:8px;background:#fafafa}} pre.mermaid{{margin:0;background:transparent}} pre.src{{font:11.5px/1.35 Consolas,monospace;white-space:pre-wrap;background:#f6f6f6;padding:8px;border:1px solid #e0e0e0}}
 .legend span{{display:inline-block;padding:1px 8px;margin:3px 5px 0 0;border:1px solid;border-radius:4px;font-size:11.5px}}
</style></head><body>
<header>
 <h1>Property Intel — Data Map</h1>
 <div class="meta">Generated {DATA['generated']} from <code>docs/audit/DATA_MAP.md</code>. <b>Home</b>: the 33 processes in stage columns, arrows = hand-offs between them (each cited to a step). <b>Click a bubble</b>: that process as one line of phases, start to finish; click a stop to list its steps on the right. <b>Receipt</b> (top right): everything that produced or consumed one resource. Mermaid source per process is collapsed at the bottom.</div>
 <div id="layers"></div>
 <div class="legend"><span style="border-color:#2e7d32">node border = layer colour · live</span><span style="background:#fdecea;border-color:#c62828">superseded / dead</span><span style="background:#fff8e1;border-color:#f9a825;border-style:dashed">[UNVERIFIED]</span><span style="background:#f3f3f3;border-color:#9e9e9e;border-style:dotted;color:#555">not found / not built</span><span style="border-color:#333">arrow solid = cited</span><span style="border-color:#f9a825;border-style:dashed">arrow dashed = [UNVERIFIED]</span><span style="border-color:#c62828">arrow red = superseded / dead</span></div>
</header>
<div id="main">
  <div id="views"></div>
  <aside id="panel"><h3>Nothing selected</h3><div class="body"><p class="muted">Hover a bubble, click an arrow, or click a bubble.</p></div></aside>
</div>
{fallbacks}
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script>const DATA = {json.dumps(DATA, ensure_ascii=False)};</script>
<script>{JS}
const lg = document.querySelector("#layers"); for (const [id,name,color] of DATA.layers) {{ const s=document.createElement("span"); s.style.background=color; s.textContent=id+" "+name; lg.appendChild(s); }}
</script>
</body></html>"""
io.open(OUT, "w", encoding="utf-8").write(page)
print("wrote", OUT, "processes:", [p["id"] for p in processes])
