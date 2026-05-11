const state={data:null,selected:null,query:"",risk:"all"};

function fmtPct(v){return `${(v*100).toFixed(1)}%`}

function explainLabel(v){
  if(v >= 0.75) return "Very high";
  if(v >= 0.55) return "Elevated";
  if(v >= 0.35) return "Moderate";
  return "Low";
}

async function loadData(){
  const res=await fetch('wagons_data.json');
  state.data=await res.json();
  document.getElementById('noteText').textContent=state.data.summary.notes;
  renderSummary();
  renderLocations();
  if(state.data.wagons.length){selectWagon(state.data.wagons[0].wagonId);}
}

function renderSummary(){
  const s=state.data.summary;
  document.getElementById('summaryCards').innerHTML=`<div class="mini-card"><span>Total wagons</span><strong>${s.totalWagons}</strong></div><div class="mini-card"><span>Locations</span><strong>${s.locations}</strong></div><div class="mini-card"><span>High risk 14d</span><strong>${s.highRisk14d}</strong></div><div class="mini-card"><span>High risk 90d</span><strong>${s.highRisk90d}</strong></div>`;
}

function groupedWagons(){
  let wagons=state.data.wagons.filter(w=>{
    const q=state.query.toLowerCase();
    const matchesQ=!q||w.wagonId.toLowerCase().includes(q)||w.location.toLowerCase().includes(q)||w.destination.toLowerCase().includes(q);
    const matchesRisk=state.risk==='all'||w.riskLevel===state.risk;
    return matchesQ&&matchesRisk;
  });
  const groups={};
  for(const w of wagons){
    if(!groups[w.location]) groups[w.location]=[];
    groups[w.location].push(w);
  }
  return Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
}

function renderLocations(){
  const root=document.getElementById('locationList');
  root.innerHTML='';
  for(const [location,wagons] of groupedWagons()){
    const group=document.createElement('div');
    group.className='location-group';
    group.innerHTML=`<div class="location-header"><h3>${location}</h3><span class="count-badge">${wagons.length} wagons</span></div>`;
    wagons.sort((a,b)=>Math.max(b.risk14d,b.risk90d)-Math.max(a.risk14d,a.risk90d));
    wagons.forEach(w=>{
      const btn=document.createElement('button');
      btn.className='wagon-item'+(state.selected&&state.selected.wagonId===w.wagonId?' active':'');
      btn.innerHTML=`<div class="wagon-top"><span class="wagon-id">${w.wagonId}</span><span class="risk-chip ${w.riskLevel}">${w.riskLevel}</span></div><div class="wagon-route">${w.route}</div><div class="wagon-meta"><span>14d ${fmtPct(w.risk14d)}</span><span>90d ${fmtPct(w.risk90d)}</span></div>`;
      btn.onclick=()=>selectWagon(w.wagonId);
      group.appendChild(btn);
    });
    root.appendChild(group);
  }
}

function selectWagon(id){
  state.selected=state.data.wagons.find(w=>w.wagonId===id);
  renderLocations();
  renderDetails();
}

function kv(label,value){return `<div class="kv-row"><span>${label}</span><span>${value ?? '—'}</span></div>`}

function driverCard(item){
  return `<div class="driver-item"><div class="topline"><strong>${item.feature}</strong></div><small>${item.value ?? ""}</small></div>`;
}

function groupCard(item){
  return `<div class="group-item"><div class="topline"><strong>${item.group}</strong></div></div>`;
}

function buildNarrative(w, horizon="14d"){
  const is14 = horizon === "14d";
  const risk = is14 ? w.risk14d : w.risk90d;
  const drivers = is14 ? (w.drivers14d || []) : (w.drivers90d || []);
  const groups = is14 ? (w.groupDrivers14d || []) : (w.groupDrivers90d || []);

  if(!drivers.length && !groups.length){
    return `<div class="explain-box"><div class="explain-title">Why this prediction?</div><p class="muted">The model produced a <strong>${explainLabel(risk).toLowerCase()}</strong> risk estimate for this wagon, but no attached factor explanation is available for this record.</p></div>`;
  }

  const topDriverNames = drivers.slice(0,3).map(d=>d.feature).join(", ");
  const topGroups = groups.slice(0,3).map(g=>g.group).join(", ");

  return `<div class="explain-box"><div class="explain-title">Why this prediction?</div><p class="explain-text">For the <strong>${horizon}</strong> horizon, the model estimates a <strong>${explainLabel(risk).toLowerCase()}</strong> failure risk (${fmtPct(risk)}).</p><p class="explain-text">The strongest attached drivers for this wagon are: <strong>${topDriverNames || "no individual feature drivers available"}</strong>.</p><p class="explain-text">At the group level, the prediction is mainly associated with: <strong>${topGroups || "no grouped drivers available"}</strong>.</p></div>`;
}

function renderDetails(){
  const w=state.selected;
  if(!w) return;
  document.getElementById('wagonTitle').textContent=w.wagonId;
  document.getElementById('wagonSubtitle').textContent=`${w.location} · ${w.route}`;
  document.getElementById('risk14').textContent=fmtPct(w.risk14d);
  document.getElementById('risk90').textContent=fmtPct(w.risk90d);
  document.getElementById('pred14').textContent=w.pred14d?'Failure likely':'Low risk';
  document.getElementById('pred90').textContent=w.pred90d?'Failure likely':'Low risk';
  document.getElementById('contextList').innerHTML=[kv('Current location',w.location),kv('Destination',w.destination),kv('Country from',w.countryFrom),kv('Country to',w.countryTo),kv('Weather',w.weather),kv('Temperature',w.temperature===null?'—':`${w.temperature} °C`),kv('Wind speed',w.windSpeed===null?'—':`${w.windSpeed} m/s`),kv('Actual label 14d',w.actual14d),kv('Actual label 90d',w.actual90d)].join('');
  document.getElementById('drivers14').innerHTML=buildNarrative(w, "14d") + (w.drivers14d.length?w.drivers14d.map(driverCard).join(''):'<p class="muted">No attached feature drivers.</p>');
  document.getElementById('drivers90').innerHTML=buildNarrative(w, "90d") + (w.drivers90d.length?w.drivers90d.map(driverCard).join(''):'<p class="muted">No attached feature drivers.</p>');
  document.getElementById('groups14').innerHTML=w.groupDrivers14d.length?w.groupDrivers14d.map(groupCard).join(''):'<p class="muted">No attached driver groups.</p>';
  document.getElementById('groups90').innerHTML=w.groupDrivers90d.length?w.groupDrivers90d.map(groupCard).join(''):'<p class="muted">No attached driver groups.</p>';
  document.getElementById('profileGrid').innerHTML=Object.entries(w.profile).map(([k,v])=>`<div class="profile-item"><span>${k}</span><strong>${v ?? '—'}</strong></div>`).join('');
}

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchInput').addEventListener('input',e=>{state.query=e.target.value;renderLocations();});
  document.getElementById('riskFilter').addEventListener('change',e=>{state.risk=e.target.value;renderLocations();});
  loadData();
});
