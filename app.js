const state={data:null,selected:null,query:"",risk:"all",horizon:"14",collapsedCountries:{},collapsedStations:{}};

function fmtPct(v){if(v===null||v===undefined||Number.isNaN(v)) return "—"; return `${(v*100).toFixed(1)}%`;}
function explainLabel(v){if(v>=0.75) return "очень высокий"; if(v>=0.55) return "повышенный"; if(v>=0.35) return "умеренный"; return "низкий";}
function activeRisk(w){return state.horizon==="14"?(w.risk14d??0):(w.risk90d??0)}
function activePred(w){return state.horizon==="14"?w.pred14d:w.pred90d}
function activeDrivers(w){return state.horizon==="14"?(w.drivers14d||[]):(w.drivers90d||[])}
function activeGroups(w){return state.horizon==="14"?(w.groupDrivers14d||[]):(w.groupDrivers90d||[])}
function activeShap(w){return state.horizon==="14"?(w.shap14d||[]):(w.shap90d||[])}

function showFatalError(message, details=""){
  const content=document.querySelector('.content');
  if(!content) return;
  content.innerHTML=`<section class="card" style="border:1px solid #f2b8b5; background:#fff7f7;"><h2 style="margin-bottom:10px; color:#b42318;">Ошибка загрузки данных</h2><p style="margin-bottom:10px; color:#344054;">${message}</p>${details?`<pre style="white-space:pre-wrap; background:#fff; padding:12px; border-radius:12px; border:1px solid #ead7d7; color:#7a271a;">${details}</pre>`:""}</section>`;
}

function renderSummary(){
  const s=state.data.summary;
  document.getElementById('summaryCards').innerHTML=`<div class="mini-card"><span>Всего вагонов</span><strong>${s.totalWagons??'—'}</strong></div><div class="mini-card"><span>Локаций</span><strong>${s.locations??'—'}</strong></div><div class="mini-card"><span>Высокий риск 14д</span><strong>${s.highRisk14d??'—'}</strong></div><div class="mini-card"><span>Высокий риск 90д</span><strong>${s.highRisk90d??'—'}</strong></div>`;
}

function countryOf(w){
  return w.countryFrom || "Неизвестная страна";
}

function stationOf(w){
  return w.location || "Неизвестная станция";
}

function filteredWagons(){
  return state.data.wagons.filter(w=>{
    const q=state.query.toLowerCase();
    const wagonId=String(w.wagonId??'').toLowerCase();
    const location=String(w.location??'').toLowerCase();
    const country=String(countryOf(w)).toLowerCase();
    const matchesQ=!q||wagonId.includes(q)||location.includes(q)||country.includes(q);
    const matchesRisk=state.risk==='all'||w.riskLevel===state.risk;
    return matchesQ&&matchesRisk;
  });
}

function groupedTree(){
  const tree={};
  for(const w of filteredWagons()){
    const country=countryOf(w);
    const station=stationOf(w);
    if(!tree[country]) tree[country]={count:0, stations:{}};
    if(!tree[country].stations[station]) tree[country].stations[station]=[];
    tree[country].stations[station].push(w);
    tree[country].count += 1;
  }
  return Object.entries(tree).sort((a,b)=>b[1].count-a[1].count);
}

function countryKey(country){return `country::${country}`;}
function stationKey(country,station){return `station::${country}::${station}`;}

function ensureCollapsedDefaults(){
  for(const [country, info] of groupedTree()){
    const ck = countryKey(country);
    if(!(ck in state.collapsedCountries)) state.collapsedCountries[ck] = true;
    for(const station of Object.keys(info.stations)){
      const sk = stationKey(country, station);
      if(!(sk in state.collapsedStations)) state.collapsedStations[sk] = true;
    }
  }
}

function toggleCountry(country){
  const key = countryKey(country);
  state.collapsedCountries[key] = !state.collapsedCountries[key];
  renderLocations();
}

function toggleStation(country, station){
  const key = stationKey(country, station);
  state.collapsedStations[key] = !state.collapsedStations[key];
  renderLocations();
}

function renderLocations(){
  const root=document.getElementById('locationList');
  root.innerHTML='';
  const tree=groupedTree();
  ensureCollapsedDefaults();

  if(!tree.length){
    root.innerHTML='<div class="country-group"><div class="muted">Нет вагонов по текущему фильтру.</div></div>';
    return;
  }

  for(const [country, info] of tree){
    const cGroup=document.createElement('div');
    const cCollapsed = state.collapsedCountries[countryKey(country)];
    cGroup.className='country-group'+(cCollapsed?' collapsed':'');

    const cHeader=document.createElement('div');
    cHeader.className='country-header';
    cHeader.innerHTML=`<div class="header-left"><span class="collapse-icon">▾</span><h3>${country}</h3></div><span class="count-badge">${info.count} вагонов</span>`;
    cHeader.onclick=()=>toggleCountry(country);
    cGroup.appendChild(cHeader);

    const stationsWrap=document.createElement('div');
    stationsWrap.className='station-list';

    const stations = Object.entries(info.stations).sort((a,b)=>b[1].length-a[1].length);
    for(const [station, wagons] of stations){
      const sGroup=document.createElement('div');
      const sCollapsed = state.collapsedStations[stationKey(country, station)];
      sGroup.className='station-group'+(sCollapsed?' collapsed':'');

      const sHeader=document.createElement('div');
      sHeader.className='station-header';
      sHeader.innerHTML=`<div class="header-left"><span class="collapse-icon">▾</span><h4>${station}</h4></div><span class="count-badge">${wagons.length}</span>`;
      sHeader.onclick=(e)=>{e.stopPropagation(); toggleStation(country, station);};
      sGroup.appendChild(sHeader);

      const items=document.createElement('div');
      items.className='wagon-items';
      wagons.sort((a,b)=>activeRisk(b)-activeRisk(a));

      wagons.forEach(w=>{
        const btn=document.createElement('button');
        btn.className='wagon-item'+(state.selected&&state.selected.wagonId===w.wagonId?' active':'');
        btn.innerHTML=`<div class="wagon-top"><span class="wagon-id">${w.wagonId??'—'}</span><span class="risk-chip ${w.riskLevel??'Low'}">${w.riskLevel??'Low'}</span></div><div class="wagon-route">${station}</div><div class="wagon-meta"><span>${state.horizon}д ${fmtPct(activeRisk(w))}</span><span>${activePred(w)?'риск':'низкий риск'}</span></div>`;
        btn.onclick=()=>selectWagon(w.wagonId);
        items.appendChild(btn);
      });

      sGroup.appendChild(items);
      stationsWrap.appendChild(sGroup);
    }

    cGroup.appendChild(stationsWrap);
    root.appendChild(cGroup);
  }
}

function selectWagon(id){
  state.selected=state.data.wagons.find(w=>w.wagonId===id);
  renderLocations();
  renderDetails();
}

function kv(label,value){return `<div class="kv-row"><span>${label}</span><span>${value ?? '—'}</span></div>`}
function driverCard(item){return `<div class="driver-item"><div class="topline"><strong>${item.feature??'—'}</strong></div><small>${item.value??''}</small></div>`}
function groupCard(item){return `<div class="group-item"><div class="topline"><strong>${item.group??'—'}</strong></div></div>`}

function buildNarrative(w){
  const risk = activeRisk(w);
  const drivers = activeDrivers(w);
  const groups = activeGroups(w);

  if(!drivers.length && !groups.length){
    return `<div class="explain-box"><div class="explain-title">Почему такой прогноз</div><p class="muted">Модель оценивает риск как <strong>${explainLabel(risk)}</strong>, но для этой записи нет прикрепленного текстового объяснения.</p></div>`;
  }

  const topDriverNames = drivers.slice(0,3).map(d=>d.feature).join(", ");
  const topGroups = groups.slice(0,3).map(g=>g.group).join(", ");

  return `<div class="explain-box"><div class="explain-title">Почему такой прогноз</div><p class="explain-text">Для горизонта <strong>${state.horizon} дней</strong> модель оценивает риск поломки как <strong>${explainLabel(risk)}</strong> (${fmtPct(risk)}).</p><p class="explain-text">Наиболее важные прикрепленные факторы: <strong>${topDriverNames || "нет данных"}</strong>.</p><p class="explain-text">На уровне групп факторов прогноз в основном связан с: <strong>${topGroups || "нет данных"}</strong>.</p></div>`;
}

function renderShapChart(items){
  const root = document.getElementById('shapMain');
  if(!items || !items.length){
    root.innerHTML = '<div class="empty-box">Для этого вагона SHAP-факторы пока не рассчитаны.</div>';
    return;
  }
  const maxVal = Math.max(...items.map(x => Math.abs(Number(x.value ?? 0))), 0.0001);
  root.innerHTML = items.map(item => {
    const val = Number(item.value ?? 0);
    const width = Math.max(6, Math.round(Math.abs(val) / maxVal * 100));
    return `<div class="shap-bar-row"><div class="shap-label" title="${item.feature ?? ''}">${item.feature ?? '—'}</div><div class="shap-bar-track"><div class="shap-bar-fill" style="width:${width}%"></div></div><div class="shap-number">${val >= 0 ? '+' : ''}${val.toFixed(4)}</div></div>`;
  }).join('');
}

function updateHorizonTexts(){
  const h = state.horizon;
  document.getElementById('riskBlockTitle').textContent = `Прогноз риска · ${h} дней`;
  document.getElementById('factorsTitle').textContent = `Факторы риска · ${h} дней`;
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.horizon === h);
  });
}

function renderDetails(){
  updateHorizonTexts();
  const w=state.selected;
  if(!w){
    document.getElementById('wagonTitle').textContent='Выберите вагон';
    document.getElementById('wagonSubtitle').textContent='Нажмите на вагон слева, чтобы посмотреть прогноз и факторы риска.';
    document.getElementById('riskMain').textContent='—';
    document.getElementById('predMain').textContent='—';
    document.getElementById('contextList').innerHTML='';
    document.getElementById('driversMain').innerHTML='';
    document.getElementById('groupsMain').innerHTML='';
    const profileEl = document.getElementById('profileGrid');
    if (profileEl) profileEl.innerHTML='';
    document.getElementById('shapMain').innerHTML='<div class="empty-box">Нет данных.</div>';
    return;
  }

  document.getElementById('wagonTitle').textContent=w.wagonId??'—';
  document.getElementById('wagonSubtitle').textContent=`${countryOf(w)} · ${stationOf(w)}`;
  document.getElementById('riskMain').textContent=fmtPct(activeRisk(w));
  document.getElementById('predMain').textContent=activePred(w)?'Поломка вероятна':'Низкий риск';

  document.getElementById('contextList').innerHTML=[
    kv('Страна', countryOf(w)),
    kv('Станция', stationOf(w)),
    kv('Погода', w.weather),
    kv('Температура', w.temperature===null||w.temperature===undefined ? '—' : `${w.temperature} °C`),
    kv('Скорость ветра', w.windSpeed===null||w.windSpeed===undefined ? '—' : `${w.windSpeed} м/с`)
  ].join('');

  document.getElementById('driversMain').innerHTML = buildNarrative(w) + (activeDrivers(w).length ? activeDrivers(w).map(driverCard).join('') : '<p class="muted">Нет прикрепленных факторов.</p>');
  document.getElementById('groupsMain').innerHTML = activeGroups(w).length ? activeGroups(w).map(groupCard).join('') : '<p class="muted">Нет групп факторов.</p>';
  const profileEl2 = document.getElementById('profileGrid');
  if (profileEl2) {
    profileEl2.innerHTML = Object.entries(w.profile || {}).map(([k,v])=>`<div class="profile-item"><span>${k}</span><strong>${v ?? '—'}</strong></div>`).join('');
  }
  renderShapChart(activeShap(w));
}

async function loadData(){
  try{
    const res = await fetch('wagons_data.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if(!data || typeof data !== 'object') throw new Error('JSON пустой или битый.');
    if(!data.summary || !Array.isArray(data.wagons)) throw new Error('В JSON должны быть ключи summary и wagons.');
    state.data = data;
    renderSummary();
    renderLocations();
    if(state.data.wagons.length) selectWagon(state.data.wagons[0].wagonId);
    else renderDetails();
  }catch(err){
    console.error(err);
    showFatalError('Не удалось загрузить wagons_data.json', String(err));
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchInput').addEventListener('input',e=>{state.query=e.target.value; renderLocations();});
  document.getElementById('riskFilter').addEventListener('change',e=>{state.risk=e.target.value; renderLocations();});
  document.querySelectorAll('.toggle-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      state.horizon = btn.dataset.horizon;
      renderLocations();
      renderDetails();
    });
  });
  loadData();
});
