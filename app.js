const state = {
  data: null,
  selected: null,
  query: "",
  risk: "all"
};

function fmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function explainLabel(v) {
  if (v >= 0.75) return "Very high";
  if (v >= 0.55) return "Elevated";
  if (v >= 0.35) return "Moderate";
  return "Low";
}

function showFatalError(message, details = "") {
  const content = document.querySelector(".content");
  if (!content) return;

  content.innerHTML = `
    <section class="card" style="border:1px solid #f2b8b5; background:#fff7f7;">
      <h2 style="margin-bottom:10px; color:#b42318;">Data loading error</h2>
      <p style="margin-bottom:10px; color:#344054;">${message}</p>
      ${details ? `<pre style="white-space:pre-wrap; background:#fff; padding:12px; border-radius:12px; border:1px solid #ead7d7; color:#7a271a;">${details}</pre>` : ""}
      <p style="margin-top:12px; color:#667085;">
        Check that <strong>wagons_data.json</strong> is in the same folder as <strong>index.html</strong> and that the site is opened through a local server or GitHub Pages.
      </p>
    </section>
  `;
}

function renderSummary() {
  const s = state.data.summary;
  document.getElementById("summaryCards").innerHTML = `
    <div class="mini-card"><span>Total wagons</span><strong>${s.totalWagons ?? "—"}</strong></div>
    <div class="mini-card"><span>Locations</span><strong>${s.locations ?? "—"}</strong></div>
    <div class="mini-card"><span>High risk 14d</span><strong>${s.highRisk14d ?? "—"}</strong></div>
    <div class="mini-card"><span>High risk 90d</span><strong>${s.highRisk90d ?? "—"}</strong></div>
  `;
}

function groupedWagons() {
  let wagons = state.data.wagons.filter(w => {
    const q = state.query.toLowerCase();

    const wagonId = String(w.wagonId ?? "").toLowerCase();
    const location = String(w.location ?? "").toLowerCase();
    const destination = String(w.destination ?? "").toLowerCase();

    const matchesQ =
      !q ||
      wagonId.includes(q) ||
      location.includes(q) ||
      destination.includes(q);

    const matchesRisk =
      state.risk === "all" || w.riskLevel === state.risk;

    return matchesQ && matchesRisk;
  });

  const groups = {};
  for (const w of wagons) {
    const location = w.location || "Unknown location";
    if (!groups[location]) groups[location] = [];
    groups[location].push(w);
  }

  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

function renderLocations() {
  const root = document.getElementById("locationList");
  root.innerHTML = "";

  const groups = groupedWagons();

  if (!groups.length) {
    root.innerHTML = `<div class="location-group"><div class="muted">No wagons match the current filters.</div></div>`;
    return;
  }

  for (const [location, wagons] of groups) {
    const group = document.createElement("div");
    group.className = "location-group";
    group.innerHTML = `
      <div class="location-header">
        <h3>${location}</h3>
        <span class="count-badge">${wagons.length} wagons</span>
      </div>
    `;

    wagons.sort((a, b) => Math.max(b.risk14d ?? 0, b.risk90d ?? 0) - Math.max(a.risk14d ?? 0, a.risk90d ?? 0));

    wagons.forEach(w => {
      const btn = document.createElement("button");
      btn.className = "wagon-item" + (state.selected && state.selected.wagonId === w.wagonId ? " active" : "");
      btn.innerHTML = `
        <div class="wagon-top">
          <span class="wagon-id">${w.wagonId ?? "—"}</span>
          <span class="risk-chip ${w.riskLevel ?? "Low"}">${w.riskLevel ?? "Low"}</span>
        </div>
        <div class="wagon-route">${w.route ?? "—"}</div>
        <div class="wagon-meta">
          <span>14d ${fmtPct(w.risk14d)}</span>
          <span>90d ${fmtPct(w.risk90d)}</span>
        </div>
      `;
      btn.onclick = () => selectWagon(w.wagonId);
      group.appendChild(btn);
    });

    root.appendChild(group);
  }
}

function selectWagon(id) {
  state.selected = state.data.wagons.find(w => w.wagonId === id) || null;
  renderLocations();
  renderDetails();
}

function kv(label, value) {
  return `<div class="kv-row"><span>${label}</span><span>${value ?? "—"}</span></div>`;
}

function driverCard(item) {
  return `
    <div class="driver-item">
      <div class="topline">
        <strong>${item.feature ?? "—"}</strong>
      </div>
      <small>${item.value ?? ""}</small>
    </div>
  `;
}

function groupCard(item) {
  return `
    <div class="group-item">
      <div class="topline">
        <strong>${item.group ?? "—"}</strong>
      </div>
    </div>
  `;
}

function buildNarrative(w, horizon = "14d") {
  const is14 = horizon === "14d";
  const risk = is14 ? w.risk14d : w.risk90d;
  const drivers = is14 ? (w.drivers14d || []) : (w.drivers90d || []);
  const groups = is14 ? (w.groupDrivers14d || []) : (w.groupDrivers90d || []);

  if (!drivers.length && !groups.length) {
    return `
      <div class="explain-box">
        <div class="explain-title">Why this prediction?</div>
        <p class="muted">
          The model produced a <strong>${explainLabel(risk).toLowerCase()}</strong> risk estimate for this wagon,
          but no attached factor explanation is available for this record.
        </p>
      </div>
    `;
  }

  const topDriverNames = drivers.slice(0, 3).map(d => d.feature).join(", ");
  const topGroups = groups.slice(0, 3).map(g => g.group).join(", ");

  return `
    <div class="explain-box">
      <div class="explain-title">Why this prediction?</div>
      <p class="explain-text">
        For the <strong>${horizon}</strong> horizon, the model estimates a
        <strong>${explainLabel(risk).toLowerCase()}</strong> failure risk (${fmtPct(risk)}).
      </p>
      <p class="explain-text">
        The strongest attached drivers for this wagon are:
        <strong>${topDriverNames || "no individual feature drivers available"}</strong>.
      </p>
      <p class="explain-text">
        At the group level, the prediction is mainly associated with:
        <strong>${topGroups || "no grouped drivers available"}</strong>.
      </p>
    </div>
  `;
}

function renderDetails() {
  const w = state.selected;
  if (!w) {
    document.getElementById("wagonTitle").textContent = "Select a wagon";
    document.getElementById("wagonSubtitle").textContent = "Click a wagon to inspect predicted failure risk and explanation factors.";
    document.getElementById("risk14").textContent = "—";
    document.getElementById("risk90").textContent = "—";
    document.getElementById("pred14").textContent = "—";
    document.getElementById("pred90").textContent = "—";
    document.getElementById("contextList").innerHTML = "";
    document.getElementById("drivers14").innerHTML = "";
    document.getElementById("drivers90").innerHTML = "";
    document.getElementById("groups14").innerHTML = "";
    document.getElementById("groups90").innerHTML = "";
    document.getElementById("profileGrid").innerHTML = "";
    return;
  }

  document.getElementById("wagonTitle").textContent = w.wagonId ?? "—";
  document.getElementById("wagonSubtitle").textContent = `${w.location ?? "—"} · ${w.route ?? "—"}`;

  document.getElementById("risk14").textContent = fmtPct(w.risk14d);
  document.getElementById("risk90").textContent = fmtPct(w.risk90d);
  document.getElementById("pred14").textContent = w.pred14d ? "Failure likely" : "Low risk";
  document.getElementById("pred90").textContent = w.pred90d ? "Failure likely" : "Low risk";

  document.getElementById("contextList").innerHTML = [
    kv("Current location", w.location),
    kv("Destination", w.destination),
    kv("Country from", w.countryFrom),
    kv("Country to", w.countryTo),
    kv("Weather", w.weather),
    kv("Temperature", w.temperature === null || w.temperature === undefined ? "—" : `${w.temperature} °C`),
    kv("Wind speed", w.windSpeed === null || w.windSpeed === undefined ? "—" : `${w.windSpeed} m/s`)
  ].join("");

  document.getElementById("drivers14").innerHTML =
    buildNarrative(w, "14d") +
    ((w.drivers14d || []).length ? w.drivers14d.map(driverCard).join("") : `<p class="muted">No attached feature drivers.</p>`);

  document.getElementById("drivers90").innerHTML =
    buildNarrative(w, "90d") +
    ((w.drivers90d || []).length ? w.drivers90d.map(driverCard).join("") : `<p class="muted">No attached feature drivers.</p>`);

  document.getElementById("groups14").innerHTML =
    ((w.groupDrivers14d || []).length ? w.groupDrivers14d.map(groupCard).join("") : `<p class="muted">No attached driver groups.</p>`);

  document.getElementById("groups90").innerHTML =
    ((w.groupDrivers90d || []).length ? w.groupDrivers90d.map(groupCard).join("") : `<p class="muted">No attached driver groups.</p>`);

  document.getElementById("profileGrid").innerHTML =
    Object.entries(w.profile || {}).map(([k, v]) => `
      <div class="profile-item">
        <span>${k}</span>
        <strong>${v ?? "—"}</strong>
      </div>
    `).join("");
}

async function loadData() {
  try {
    const res = await fetch("wagons_data.json", { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (!data || typeof data !== "object") {
      throw new Error("JSON is empty or invalid.");
    }

    if (!data.summary || !Array.isArray(data.wagons)) {
      throw new Error("JSON must contain keys: summary and wagons.");
    }

    state.data = data;

    const noteEl = document.getElementById("noteText");
    if (noteEl) {
      noteEl.textContent = state.data.summary.notes || "";
    }

    renderSummary();
    renderLocations();

    if (state.data.wagons.length) {
      selectWagon(state.data.wagons[0].wagonId);
    } else {
      renderDetails();
      showFatalError("The JSON file was loaded, but wagons array is empty.");
    }
  } catch (err) {
    console.error("Failed to load wagons_data.json:", err);
    showFatalError(
      "The interface could not load wagons_data.json.",
      String(err)
    );
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("searchInput");
  const filter = document.getElementById("riskFilter");

  if (search) {
    search.addEventListener("input", e => {
      state.query = e.target.value;
      renderLocations();
    });
  }

  if (filter) {
    filter.addEventListener("change", e => {
      state.risk = e.target.value;
      renderLocations();
    });
  }

  loadData();
});
