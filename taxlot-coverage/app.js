/* Taxlot GIS — County Coverage dashboard (light Vyanet-style UI) */
(function () {
  const STATUS_PILLS = [
    { id: "", label: "All" },
    { id: "sourcing", label: "Sourcing" },
    { id: "downloaded", label: "Downloaded" },
    { id: "inspected", label: "Inspected" },
    { id: "policy-review", label: "Policy review" },
    { id: "no-source", label: "No source" },
    { id: "deferred-tail", label: "Deferred tail" },
    { id: "blocked-license", label: "Blocked license", red: true },
    { id: "published", label: "Published" },
    { id: "viewer-outline", label: "Viewer outline OK" },
    { id: "workflow-clip", label: "Workflow clip OK" },
    { id: "derive-ok", label: "Derive & sell OK" },
    { id: "retrieved", label: "Retrieved/sourced" }
  ];

  let DATA = null;
  let counties = [];
  let view = "county";
  let sortKey = "sites";
  let sortDir = -1;
  let selectedStates = new Set();
  let selectedCounties = new Set(); // ids
  let statusFilter = "";
  let selectedId = null;
  let maxSites = 1;

  const $ = (id) => document.getElementById(id);

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function fmtDate(d) {
    if (!d) return "—";
    return String(d).slice(0, 10);
  }

  function retrievedLabel(c) {
    const log = c.retrieval_log || [];
    if (c.status === "published" || c.promote?.published_at) return "Published";
    if (c.artifacts?.normalized_file || c.artifacts?.raw_file) return "Downloaded";
    if (c.source_url) return "Sourced";
    if (log.some((x) => x.action && x.action !== "portfolio_seed" && x.action !== "template")) return "Partial";
    return "Not yet";
  }

  function isRetrieved(c) {
    return retrievedLabel(c) !== "Not yet";
  }

  function matches(c) {
    if (selectedStates.size && !selectedStates.has(c.state)) return false;
    if (selectedCounties.size && !selectedCounties.has(c.id)) return false;
    if (statusFilter === "derive-ok") {
      if (!c.policy?.derive_and_sell) return false;
    } else if (statusFilter === "viewer-outline") {
      if (!c.policy?.use_cases?.viewer_outline?.allowed) return false;
    } else if (statusFilter === "workflow-clip") {
      if (!c.policy?.use_cases?.workflow_clip?.allowed) return false;
    } else if (statusFilter === "retrieved") {
      if (!isRetrieved(c)) return false;
    } else if (statusFilter && c.status !== statusFilter) {
      return false;
    }
    return true;
  }

  function filtered() {
    return counties.filter(matches);
  }

  function sortList(list) {
    const arr = list.slice();
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "name":
          av = `${a.county}, ${a.state}`;
          bv = `${b.county}, ${b.state}`;
          break;
        case "sites":
          av = a.portfolio_sites || 0;
          bv = b.portfolio_sites || 0;
          break;
        case "status":
          av = a.status || "";
          bv = b.status || "";
          break;
        case "policy":
          av = a.policy?.class || "";
          bv = b.policy?.class || "";
          break;
        case "derive":
          av = a.policy?.derive_and_sell ? 1 : 0;
          bv = b.policy?.derive_and_sell ? 1 : 0;
          break;
        case "features":
          av = a.metrics?.feature_count || 0;
          bv = b.metrics?.feature_count || 0;
          break;
        case "source_updated":
          av = a.source_last_updated || "";
          bv = b.source_last_updated || "";
          break;
        case "retrieved":
          av = retrievedLabel(a);
          bv = retrievedLabel(b);
          break;
        default:
          av = a.portfolio_sites || 0;
          bv = b.portfolio_sites || 0;
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return `${a.county}${a.state}`.localeCompare(`${b.county}${b.state}`);
    });
    return arr;
  }

  function kpiCounts(list) {
    const all = counties;
    return {
      counties: list.length,
      retrieved: list.filter(isRetrieved).length,
      sourcing: list.filter((c) => c.status === "sourcing").length,
      inspected: list.filter((c) => c.status === "inspected").length,
      noSource: list.filter((c) => c.status === "no-source").length,
      deferred: list.filter((c) => c.status === "deferred-tail").length,
      policyReview: list.filter((c) => c.status === "policy-review").length,
      blocked: list.filter((c) => c.status === "blocked-license").length,
      published: list.filter((c) => c.status === "published").length,
      deriveOk: list.filter((c) => c.policy?.derive_and_sell).length,
      viewerOutline: list.filter((c) => c.policy?.use_cases?.viewer_outline?.allowed).length,
      workflowClip: list.filter((c) => c.policy?.use_cases?.workflow_clip?.allowed).length,
      sites: list.reduce((s, c) => s + (c.portfolio_sites || 0), 0),
      states: new Set(list.map((c) => c.state)).size,
      allCounties: all.length,
      allSites: DATA?.meta?.total_sites || 0
    };
  }

  function renderKpis() {
    const list = filtered();
    const k = kpiCounts(list);
    const items = [
      { key: "", label: "Counties", value: k.counties, hint: `${k.states} states`, filter: "" },
      { key: "retrieved", label: "Retrieved/sourced", value: k.retrieved, hint: "of filtered", filter: "retrieved" },
      { key: "sourcing", label: "Sourcing", value: k.sourcing, hint: "not started", filter: "sourcing" },
      { key: "inspected", label: "Inspected", value: k.inspected, hint: "staged locally", filter: "inspected" },
      { key: "no-source", label: "No source", value: k.noSource, hint: "gap", filter: "no-source" },
      { key: "deferred-tail", label: "Deferred", value: k.deferred, hint: "≤5 sites", filter: "deferred-tail" },
      { key: "policy-review", label: "Policy review", value: k.policyReview, hint: "in queue", filter: "policy-review" },
      { key: "blocked-license", label: "Blocked license", value: k.blocked, hint: "hold", filter: "blocked-license", accent: true },
      { key: "published", label: "Published", value: k.published, hint: "CDN live", filter: "published" },
      { key: "viewer-outline", label: "Viewer outline OK", value: k.viewerOutline, hint: "lot line to customer", filter: "viewer-outline" },
      { key: "workflow-clip", label: "Workflow clip OK", value: k.workflowClip, hint: "server-side clip", filter: "workflow-clip" },
      { key: "derive-ok", label: "Derive & sell OK", value: k.deriveOk, hint: "cleared", filter: "derive-ok", accent: true }
    ];
    $("kpis").innerHTML = items
      .map(
        (it) => `
      <button type="button" class="kpi ${it.accent ? "accent" : ""} ${statusFilter === it.filter ? "active" : ""}" data-filter="${it.filter}">
        <div class="label">${it.label}</div>
        <div class="value">${fmt(it.value)}</div>
        <div class="hint">${it.hint}</div>
      </button>`
      )
      .join("");
    $("kpis").querySelectorAll(".kpi").forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = btn.getAttribute("data-filter") || "";
        statusFilter = statusFilter === f ? "" : f;
        renderAll();
      });
    });
  }

  function renderSelection() {
    const list = filtered();
    const sites = list.reduce((s, c) => s + (c.portfolio_sites || 0), 0);
    $("selection-count").textContent = fmt(sites);
    const parts = [];
    if (selectedStates.size) parts.push(`${selectedStates.size} state${selectedStates.size > 1 ? "s" : ""}`);
    if (selectedCounties.size) parts.push(`${selectedCounties.size} count${selectedCounties.size > 1 ? "ies" : "y"}`);
    if (statusFilter) parts.push(`status: ${statusFilter}`);
    if (!parts.length) {
      $("selection-msg").textContent =
        "All counties. Check any combination of states and counties below — selections add together.";
    } else {
      $("selection-msg").textContent = `${list.length} counties · ${parts.join(" · ")} · ${fmt(sites)} sites`;
    }
  }

  function stateTotals() {
    const map = new Map();
    for (const c of counties) {
      const cur = map.get(c.state) || { state: c.state, sites: 0, n: 0 };
      cur.sites += c.portfolio_sites || 0;
      cur.n += 1;
      map.set(c.state, cur);
    }
    return [...map.values()].sort((a, b) => b.sites - a.sites);
  }

  function renderStateList() {
    const q = ($("state-search").value || "").trim().toLowerCase();
    const totals = stateTotals().filter((s) => !q || s.state.toLowerCase().includes(q));
    $("state-list").innerHTML = totals
      .map(
        (s) => `
      <label class="check-item ${selectedStates.has(s.state) ? "checked" : ""}">
        <input type="checkbox" data-state="${s.state}" ${selectedStates.has(s.state) ? "checked" : ""} />
        <span class="lbl">${s.state}</span>
        <span class="cnt">${fmt(s.sites)}</span>
      </label>`
      )
      .join("");
    $("state-list").querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const st = inp.getAttribute("data-state");
        if (inp.checked) selectedStates.add(st);
        else selectedStates.delete(st);
        renderAll();
      });
    });
    const n = selectedStates.size;
    $("state-hint").textContent = n ? `${n} selected` : "none";
    $("state-hint").hidden = !!n;
    $("state-clear").hidden = !n;
  }

  function renderCountyList() {
    const q = ($("county-search").value || "").trim().toLowerCase();
    let list = counties.slice();
    if (selectedStates.size) list = list.filter((c) => selectedStates.has(c.state));
    list = list.filter((c) => {
      if (!q) return true;
      const hay = `${c.county}, ${c.state} ${c.id}`.toLowerCase();
      return hay.includes(q);
    });
    list.sort((a, b) => (b.portfolio_sites || 0) - (a.portfolio_sites || 0));
    $("county-list").innerHTML = list
      .map(
        (c) => `
      <label class="check-item ${selectedCounties.has(c.id) ? "checked" : ""}">
        <input type="checkbox" data-id="${c.id}" ${selectedCounties.has(c.id) ? "checked" : ""} />
        <span class="lbl">${c.county}, ${c.state}</span>
        <span class="cnt">${fmt(c.portfolio_sites)}</span>
      </label>`
      )
      .join("");
    $("county-list").querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const id = inp.getAttribute("data-id");
        if (inp.checked) selectedCounties.add(id);
        else selectedCounties.delete(id);
        renderAll();
      });
    });
    const n = selectedCounties.size;
    $("county-hint").textContent = n ? `${n} selected` : "none";
    $("county-hint").hidden = !!n;
    $("county-clear").hidden = !n;
  }

  function renderPills() {
    $("status-pills").innerHTML = STATUS_PILLS.map(
      (p) => `
      <button type="button" class="pill ${p.red ? "pill-red" : ""} ${statusFilter === p.id ? "active" : ""}" data-filter="${p.id}">${p.label}</button>`
    ).join("");
    $("status-pills").querySelectorAll(".pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = btn.getAttribute("data-filter") || "";
        statusFilter = statusFilter === f ? "" : f;
        renderAll();
      });
    });
    $("status-hint").textContent = statusFilter || "none";
  }

  function renderTable() {
    const list = sortList(filtered());
    const empty = $("empty");
    const tbody = $("tbody");
    const tfoot = $("tfoot");

    if (view === "state") {
      const byState = new Map();
      for (const c of list) {
        const cur = byState.get(c.state) || {
          state: c.state,
          sites: 0,
          n: 0,
          retrieved: 0,
          blocked: 0,
          published: 0,
          derive: 0,
          features: 0
        };
        cur.sites += c.portfolio_sites || 0;
        cur.n += 1;
        if (isRetrieved(c)) cur.retrieved += 1;
        if (c.status === "blocked-license") cur.blocked += 1;
        if (c.status === "published") cur.published += 1;
        if (c.policy?.derive_and_sell) cur.derive += 1;
        cur.features += c.metrics?.feature_count || 0;
        byState.set(c.state, cur);
      }
      let rows = [...byState.values()].sort((a, b) => b.sites - a.sites);
      tbody.innerHTML = rows
        .map((r, i) => {
          const w = Math.max(4, Math.round((r.sites / maxSites) * 72));
          return `<tr data-state-row="${r.state}">
            <td class="num">${i + 1}</td>
            <td><strong>${r.state}</strong> <span style="color:var(--muted);font-size:.85rem">${r.n} counties</span></td>
            <td class="num"><div class="sites-cell"><span class="sites-bar" style="width:${w}px"></span><span class="sites-n">${fmt(r.sites)}</span></div></td>
            <td colspan="2">${r.retrieved} sourced · ${r.blocked} blocked · ${r.published} published</td>
            <td class="num">${r.derive}</td>
            <td class="num">${r.features ? fmt(r.features) : "—"}</td>
            <td>—</td>
            <td>—</td>
          </tr>`;
        })
        .join("");
      tbody.querySelectorAll("tr[data-state-row]").forEach((tr) => {
        tr.addEventListener("click", () => {
          selectedStates.clear();
          selectedStates.add(tr.getAttribute("data-state-row"));
          view = "county";
          document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === "county"));
          renderAll();
        });
      });
      const totSites = rows.reduce((s, r) => s + r.sites, 0);
      tfoot.innerHTML = `<tr><td></td><td>Total — ${rows.length} rows</td><td class="num">${fmt(totSites)}</td><td colspan="6"></td></tr>`;
      empty.hidden = rows.length > 0;
      return;
    }

    tbody.innerHTML = list
      .map((c, i) => {
        const w = Math.max(4, Math.round(((c.portfolio_sites || 0) / maxSites) * 72));
        const derive = c.policy?.derive_and_sell;
        return `<tr data-id="${c.id}" class="${selectedId === c.id ? "selected" : ""}">
          <td class="num">${i + 1}</td>
          <td><strong>${c.county}</strong>, ${c.state}</td>
          <td class="num"><div class="sites-cell"><span class="sites-bar" style="width:${w}px"></span><span class="sites-n">${fmt(c.portfolio_sites)}</span></div></td>
          <td><span class="badge ${c.status || "sourcing"}">${c.status || "sourcing"}</span></td>
          <td>${c.policy?.class || "unknown"}</td>
          <td class="num ${derive ? "yes" : "no"}">${derive ? "Yes" : "No"}</td>
          <td class="num">${c.metrics?.feature_count != null ? fmt(c.metrics.feature_count) : "—"}</td>
          <td>${fmtDate(c.source_last_updated)}</td>
          <td>${retrievedLabel(c)}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", () => openDetail(tr.getAttribute("data-id")));
    });

    const totSites = list.reduce((s, c) => s + (c.portfolio_sites || 0), 0);
    tfoot.innerHTML = `<tr><td></td><td>Total — ${list.length} rows</td><td class="num">${fmt(totSites)}</td><td colspan="6"></td></tr>`;
    empty.hidden = list.length > 0;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function text(value, fallback = "—") {
    return value === null || value === undefined || value === "" ? fallback : esc(value);
  }

  function yesNo(value) {
    return `<span class="${value ? "yes" : "no"}">${value ? "Yes" : "No"}</span>`;
  }

  function link(value) {
    if (!value) return "—";
    const safe = String(value);
    if (!/^https?:\/\//i.test(safe)) return text(safe);
    return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(safe)}</a>`;
  }

  function detailRow(label, value) {
    return `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  }

  function openDetail(id) {
    const c = counties.find((x) => x.id === id);
    if (!c) return;
    selectedId = id;
    const policy = c.policy || {};
    const useCases = policy.use_cases || {};
    const viewer = useCases.viewer_outline || {};
    const workflow = useCases.workflow_clip || {};
    const schema = c.schema || {};
    const metrics = c.metrics || {};
    const artifacts = c.artifacts || {};
    const promote = c.promote || {};
    const rawJson = JSON.stringify(c, null, 2);
    const log = (c.retrieval_log || [])
      .slice()
      .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
      .map(
        (e) => `<li>
        <div class="at">${text(e.at)} · <span class="action">${text(e.action, "Unspecified action")}</span></div>
        <div>${text(e.detail, "No detail recorded.")}</div>
      </li>`
      )
      .join("");
    const keepProperties = Array.isArray(schema.keep_properties) && schema.keep_properties.length
      ? `<ul class="chip-list">${schema.keep_properties.map((field) => `<li><code>${esc(field)}</code></li>`).join("")}</ul>`
      : "—";
    const rawPath = `data/records/${encodeURIComponent(c.id)}.json`;
    $("detail-title").textContent = `${c.county}, ${c.state}`;
    $("detail-status").textContent = "Record loaded from local data/records — staged on Taxlot GIS Agent computer";
    $("detail-body").innerHTML = `
      <div class="detail-section">
        <h3>Overview</h3>
        <dl class="detail-kv">
          ${detailRow("Id", `<code>${text(c.id)}</code>`)}
          ${detailRow("County", text(c.county))}
          ${detailRow("State", text(c.state))}
          ${detailRow("Sites", fmt(c.portfolio_sites))}
          ${detailRow("Status", `<span class="badge ${esc(c.status || "sourcing")}">${text(c.status, "sourcing")}</span>`)}
          ${detailRow("Retrieved label", text(retrievedLabel(c)))}
          ${detailRow("Cadence", c.cadence_days == null ? "—" : `${fmt(c.cadence_days)} days`)}
          ${detailRow("Next check", fmtDate(c.next_check))}
        </dl>
      </div>
      <div class="detail-section">
        <h3>Product use cases</h3>
        <div class="use-case-card">
          <h4>Viewer outline <span>${yesNo(!!viewer.allowed)}</span></h4>
          <p>${text(viewer.notes, "No notes recorded.")}</p>
        </div>
        <div class="use-case-card">
          <h4>Workflow clip <span>${yesNo(!!workflow.allowed)}</span></h4>
          <p>${text(workflow.notes, "No notes recorded.")}</p>
        </div>
      </div>
      <div class="detail-section">
        <h3>Legal / policy</h3>
        <dl class="detail-kv">
          ${detailRow("Class", text(policy.class, "unknown"))}
          ${detailRow("Redistribute", yesNo(!!policy.redistribute_public))}
          ${detailRow("Derive & sell", yesNo(!!policy.derive_and_sell))}
          ${detailRow("Reviewed", `${fmtDate(policy.reviewed_at)}${policy.reviewed_by ? ` · ${esc(policy.reviewed_by)}` : ""}`)}
          ${detailRow("License URL", link(c.license_url))}
        </dl>
        <p class="detail-copy"><strong>Summary:</strong> ${text(policy.summary, "No policy summary yet.")}</p>
        <p class="detail-copy muted-copy"><strong>Terms notes:</strong> ${text(policy.terms_notes, "No terms notes yet.")}</p>
      </div>
      <div class="detail-section">
        <h3>Source</h3>
        <dl class="detail-kv">
          ${detailRow("Source URL", link(c.source_url))}
          ${detailRow("Layer", text(c.source_layer))}
          ${detailRow("Format", text(c.source_format))}
          ${detailRow("Source last updated", fmtDate(c.source_last_updated))}
        </dl>
      </div>
      <div class="detail-section">
        <h3>Schema</h3>
        <dl class="detail-kv">
          ${detailRow("Join field", text(schema.join_field))}
          ${detailRow("Feature ID field", text(schema.feature_id_field))}
          ${detailRow("CRS", text(schema.crs_published))}
          ${detailRow("Keep properties", keepProperties)}
        </dl>
      </div>
      <div class="detail-section">
        <h3>Metrics</h3>
        <dl class="detail-kv">
          ${detailRow("Feature count", metrics.feature_count == null ? "—" : fmt(metrics.feature_count))}
          ${detailRow("Content hash", text(metrics.content_hash))}
        </dl>
      </div>
      <div class="detail-section">
        <h3>Staging on agent computer</h3>
        <dl class="detail-kv">
          ${detailRow("Scratch dir", text(artifacts.scratch_dir))}
          ${detailRow("Raw file", text(artifacts.raw_file, "not downloaded yet"))}
          ${detailRow("Normalized file", text(artifacts.normalized_file, "not downloaded yet"))}
          ${detailRow("Inspect report", text(artifacts.inspect_report, "not downloaded yet"))}
        </dl>
      </div>
      <div class="detail-section">
        <h3>Promote</h3>
        <dl class="detail-kv">
          ${detailRow("Grant", text(promote.grant))}
          ${detailRow("Verified", fmtDate(promote.verified_at))}
          ${detailRow("Ready", fmtDate(promote.ready_to_promote_at))}
          ${detailRow("Published", fmtDate(promote.published_at))}
          ${detailRow("CDN index", link(promote.cdn_index))}
          ${detailRow("S3 prefix", text(promote.s3_prefix))}
        </dl>
      </div>
      <div class="detail-section">
        <h3>Notes</h3>
        <p>${text(c.notes, "No notes recorded.")}</p>
      </div>
      <div class="detail-section">
        <h3>Retrieval log</h3>
        <ul class="log-list">${log || "<li>No log entries.</li>"}</ul>
      </div>
      <div class="detail-section raw-record">
        <h3>Raw record</h3>
        <p><a href="${rawPath}" target="_blank" rel="noopener noreferrer">Open ${esc(c.id)}.json</a></p>
        <details>
          <summary>Show pretty-printed JSON</summary>
          <pre><code>${esc(rawJson)}</code></pre>
        </details>
      </div>`;
    $("detail").hidden = false;
    $("detail-backdrop").hidden = false;
    renderTable();
  }

  function closeDetail() {
    selectedId = null;
    $("detail").hidden = true;
    $("detail-backdrop").hidden = true;
    renderTable();
  }

  function renderSubtitle() {
    const m = DATA.meta;
    const asOf = m.as_of || (DATA.updated_at || "").slice(0, 10);
    $("subtitle").textContent = `${fmt(m.total_sites)} portfolio sites · ${m.states} states · ${m.counties} counties · GIS coverage as of ${asOf}`;
  }

  function renderAll() {
    renderSubtitle();
    renderSelection();
    renderKpis();
    renderStateList();
    renderCountyList();
    renderPills();
    renderTable();
  }

  function resetFilters() {
    selectedStates.clear();
    selectedCounties.clear();
    statusFilter = "";
    $("state-search").value = "";
    $("county-search").value = "";
    closeDetail();
    renderAll();
  }

  function wire() {
    $("state-search").addEventListener("input", () => renderStateList());
    $("county-search").addEventListener("input", () => renderCountyList());
    $("state-clear").addEventListener("click", () => {
      selectedStates.clear();
      renderAll();
    });
    $("county-clear").addEventListener("click", () => {
      selectedCounties.clear();
      renderAll();
    });
    $("reset").addEventListener("click", resetFilters);
    $("detail-close").addEventListener("click", closeDetail);
    $("detail-backdrop").addEventListener("click", closeDetail);
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        view = btn.dataset.view;
        document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b === btn));
        renderTable();
      });
    });
    document.querySelectorAll("#county-table thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (sortKey === key) sortDir *= -1;
        else {
          sortKey = key;
          sortDir = key === "name" || key === "status" || key === "policy" || key === "retrieved" ? 1 : -1;
        }
        renderTable();
      });
    });
  }

  fetch("data/counties.json")
    .then((r) => {
      if (!r.ok) throw new Error("Failed to load data/counties.json");
      return r.json();
    })
    .then((data) => {
      DATA = data;
      counties = data.counties || [];
      maxSites = Math.max(1, ...counties.map((c) => c.portfolio_sites || 0));
      wire();
      renderAll();
    })
    .catch((err) => {
      $("subtitle").textContent = "Failed to load counties.json — serve this folder over HTTP.";
      console.error(err);
    });
})();
