// ===== Storage keys =====
const LS_PERSONS = 'pf_persons';
const LS_ENTRIES = 'pf_entries';
const LS_SESSION = 'pf_session';
const LS_ACTIVE = 'pf_active_entries'; // active clock-in per user

// ===== Roles =====
const ROLES = [
  "Director",
  "Vice-Director",
  "Sef Spital",
  "Medic Sef",
  "Medic Specialist",
  "Medic Rezident",
  "Medic Militar",
  "Paramedic Sef",
  "Paramedic",
  "Asistent Sef",
  "Asistent Avansat",
  "Asistent"
];

// ===== Helpers =====
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const getPersons = () => JSON.parse(localStorage.getItem(LS_PERSONS) || '[]');
const savePersons = v => localStorage.setItem(LS_PERSONS, JSON.stringify(v));
const getEntries = () => JSON.parse(localStorage.getItem(LS_ENTRIES) || '[]');
const saveEntries = v => localStorage.setItem(LS_ENTRIES, JSON.stringify(v));
const getSession = () => JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
const setSession = v => localStorage.setItem(LS_SESSION, JSON.stringify(v));
const clearSession = () => localStorage.removeItem(LS_SESSION);
const getActive = () => JSON.parse(localStorage.getItem(LS_ACTIVE) || '{}');
const saveActive = v => localStorage.setItem(LS_ACTIVE, JSON.stringify(v));

function ensureGrades(selectEl){
  selectEl.innerHTML = '';
  ROLES.forEach(r => {
    const o = document.createElement('option');
    o.value = r; o.textContent = r;
    selectEl.appendChild(o);
  });
}

// Week bounds: start Saturday 20:00, end next Saturday 18:50
function getWeekBounds(now = new Date()){
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const diffToSat = (day >= 6) ? day - 6 : day + 1;
  const lastSat = new Date(now);
  lastSat.setHours(0,0,0,0);
  lastSat.setDate(now.getDate() - diffToSat);
  const weekStart = new Date(lastSat);
  weekStart.setHours(20,0,0,0);
  let weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setHours(18,50,0,0);
  if(now < weekStart){
    weekStart.setDate(weekStart.getDate() - 7);
    weekEnd.setDate(weekEnd.getDate() - 7);
  }
  return {weekStart, weekEnd};
}

function parseTimeHHMM(str){
  if(!/^\d{1,2}:\d{2}$/.test(str)) return null;
  const [h, m] = str.split(':').map(Number);
  if(h<0||h>23||m<0||m>59) return null;
  return h*60 + m;
}

function durationHours(startISO, endISO){
  const s = new Date(startISO), e = new Date(endISO);
  let diff = (e - s)/1000/60/60;
  if(diff < 0) diff += 24; // handle simple overnight
  return Number(diff.toFixed(2));
}

function downloadCSV(filename, rows){
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

function guardLogged(){
  const ses = getSession();
  if(!ses) window.location.href = 'login.html';
  return ses;
}

function logoutBind(){
  const btn = $('#logout');
  if(btn) btn.addEventListener('click', () => { clearSession(); window.location.href='login.html'; });
}

// ===== Dashboard logic =====
function setupDashboard(){
  const ses = guardLogged();
  logoutBind();

  const roleInfo = $('#roleInfo');
  const adminSection = $('#adminSection');
  const reportAll = $('#reportAllSection');
  const reportSelf = $('#reportSelfSection');

  roleInfo.innerHTML = `<strong>Autentificat ca:</strong> ${ses.name} <span class="badge">${ses.grade}</span> | ID: ${ses.id}`;

  ensureGrades($('#p_grade'));

  if(ses.grade === 'Director' || ses.grade === 'Vice-Director'){
    adminSection.classList.remove('hidden');
    reportAll.classList.remove('hidden');
    renderPersonsTable(true);
    renderWeeklyAll();
    reportSelf.classList.remove('hidden');
    renderSelfPanels(ses);
    // Exports
    $('#exportCSVAll').addEventListener('click', exportAllPersons);
    $('#exportCSVWeek').addEventListener('click', exportWeekAll);
    $('#exportCSVSelf').addEventListener('click', ()=>exportSelfCSV(ses));
  } else if(ses.grade === 'Sef Spital'){
    reportAll.classList.remove('hidden');
    renderWeeklyAll();
    reportSelf.classList.remove('hidden');
    renderSelfPanels(ses);
    $('#exportCSVWeek').addEventListener('click', exportWeekAll);
    $('#exportCSVSelf').addEventListener('click', ()=>exportSelfCSV(ses));
  } else {
    reportSelf.classList.remove('hidden');
    renderSelfPanels(ses);
    $('#exportCSVSelf').addEventListener('click', ()=>exportSelfCSV(ses));
  }

  const addBtn = $('#addPerson');
  if(addBtn){
    addBtn.addEventListener('click', () => {
      const name = $('#p_name').value.trim();
      const id = $('#p_id').value.trim();
      const grade = $('#p_grade').value;
      if(!name || !id){ alert('Completează Nume și ID.'); return; }
      const persons = getPersons();
      if(persons.find(p => p.id===id && p.name.toLowerCase()===name.toLowerCase())){
        alert('Persoana există deja (același Nume + ID).'); return;
      }
      persons.push({name, id, grade});
      savePersons(persons);
      $('#p_name').value=''; $('#p_id').value='';
      renderPersonsTable(true);
      alert('Persoană adăugată.');
    });
  }
}

function renderPersonsTable(withActions){
  const tb = $('#personsTable tbody');
  if(!tb) return;
  tb.innerHTML='';
  const persons = getPersons();
  persons.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.id}</td><td>${p.grade}</td><td class="action-inline"></td>`;
    if(withActions){
      const del = document.createElement('button'); del.className='btn small'; del.textContent='Șterge';
      del.addEventListener('click', ()=> {
        if(!confirm('Ștergi această persoană și toate turele ei?')) return;
        removePersonCompletely(p.id, p.name);
        renderPersonsTable(true);
        renderWeeklyAll();
      });
      tr.querySelector('.action-inline').appendChild(del);
    } else {
      tr.querySelector('.action-inline').textContent='-';
    }
    tb.appendChild(tr);
  });
}

function removePersonCompletely(id, name){
  let persons = getPersons().filter(p => !(p.id===id && p.name===name));
  savePersons(persons);
  let entries = getEntries().filter(e => !(e.id===id && e.name===name));
  saveEntries(entries);
  const active = getActive();
  const key = `${id}::${name.toLowerCase()}`;
  delete active[key];
  saveActive(active);
}

// Weekly all
function renderWeeklyAll(){
  const tb = $('#weeklyAll tbody');
  const range = $('#weekRangeAll');
  tb.innerHTML='';
  const {weekStart, weekEnd} = getWeekBounds();
  range.textContent = `Perioadă: ${weekStart.toLocaleString()} → ${weekEnd.toLocaleString()}`;
  const entries = getEntries();
  const sums = {};
  entries.forEach(e => {
    const s = new Date(e.startISO);
    if(s >= weekStart && s <= weekEnd){
      const key = e.id + '::' + e.name.toLowerCase();
      if(!sums[key]) sums[key] = {id:e.id,name:e.name,grade:e.grade,ore:0,ture:0};
      sums[key].ore += durationHours(e.startISO, e.endISO);
      sums[key].ture += 1;
    }
  });
  Object.values(sums).sort((a,b)=>b.ore-a.ore).forEach(u=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.name}</td><td>${u.id}</td><td>${u.grade}</td><td>${u.ore.toFixed(2)}</td><td>${u.ture}</td>`;
    tb.appendChild(tr);
  });
}

function renderSelfPanels(ses){
  const dailyTB = $('#dailySelf tbody');
  const range = $('#weekRangeSelf');
  const totalBox = $('#selfTotal');
  if(!dailyTB || !range || !totalBox) return;
  dailyTB.innerHTML='';
  const {weekStart, weekEnd} = getWeekBounds();
  range.textContent = `Perioadă: ${weekStart.toLocaleString()} → ${weekEnd.toLocaleString()}`;
  const entries = getEntries().filter(e => e.id===ses.id && e.name.toLowerCase()===ses.name.toLowerCase());
  const days = {};
  entries.forEach(e => {
    const s = new Date(e.startISO);
    if(s >= weekStart && s <= weekEnd){
      const key = s.toISOString().slice(0,10);
      if(!days[key]) days[key] = {ore:0,ture:0};
      days[key].ore += durationHours(e.startISO, e.endISO);
      days[key].ture += 1;
    }
  });
  let total = 0, count=0;
  Object.keys(days).sort().forEach(d => {
    const row = days[d];
    total += row.ore; count += row.ture;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d}</td><td>${row.ore.toFixed(2)}</td><td>${row.ture}</td>`;
    dailyTB.appendChild(tr);
  });
  totalBox.innerHTML = `<strong>Total săptămână:</strong> ${total.toFixed(2)} ore în ${count} ture.`;
}

// ===== Login logic =====
function setupLogin(){
  ensureGrades($('#l_grade'));
  $('#loginBtn').addEventListener('click', () => {
    const name = $('#l_name').value.trim();
    const id = $('#l_id').value.trim();
    const grade = $('#l_grade').value;
    const tura = $('#l_tura').value;
    if(!name || !id){ alert('Completează Nume și ID.'); return; }
    const person = getPersons().find(p => p.id===id && p.name.toLowerCase()===name.toLowerCase() && p.grade===grade);
    if(!person){ alert('Utilizatorul nu există sau gradul nu corespunde. Solicită adăugare la Director/Vice-Director.'); return; }
    setSession({name: person.name, id: person.id, grade: person.grade, tura});
    window.location.href = 'tura.html';
  });
}

// ===== Clock-in/out logic (tura page) =====
function setupTuraPage(){
  const ses = guardLogged();
  logoutBind();
  $('#uName').textContent = ses.name;
  $('#uId').textContent = ses.id;
  $('#uGrade').textContent = ses.grade;
  $('#uTura').textContent = ses.tura;

  // UI elements
  const dateDay = $('#dateDay');
  const timeStart = $('#timeStart');
  const timeEnd = $('#timeEnd');
  const btnStart = $('#btnStart');
  const btnEnd = $('#btnEnd');
  const clockState = $('#clockState');

  function refreshClockUI(){
    const active = getActive();
    const key = `${ses.id}::${ses.name.toLowerCase()}`;
    const a = active[key];
    if(a){
      // Active shift exists -> show end input enabled, start disabled
      btnStart.disabled = true;
      timeStart.disabled = true;
      btnEnd.disabled = false;
      timeEnd.disabled = false;
      clockState.innerHTML = `Ai început tura la <strong>${new Date(a.startISO).toLocaleString([], {hour:'2-digit', minute:'2-digit'})}</strong> pe data de ${a.startISO.slice(0,10)}. Introdu ora de sfârșit și apasă <em>Termin tura</em>.`;
      // prefill dateDay to the active day
      dateDay.value = a.startISO.slice(0,10);
    } else {
      // No active -> can start new shift
      btnStart.disabled = false;
      timeStart.disabled = false;
      btnEnd.disabled = true;
      timeEnd.disabled = true;
      timeEnd.value = '';
      clockState.textContent = 'Nu ai o tură activă. Introdu ora de start și apasă „Începe tura”.';
      dateDay.value = ''; // user can select today or custom
    }
  }

  btnStart.addEventListener('click', () => {
    const ms = parseTimeHHMM(timeStart.value.trim());
    if(ms===null){ alert('Ora de start invalidă (folosește hh:mm).'); return; }
    const day = dateDay.value ? new Date(dateDay.value) : new Date();
    const s = new Date(day);
    s.setHours(Math.floor(ms/60), ms%60, 0, 0);
    const active = getActive();
    const key = `${ses.id}::${ses.name.toLowerCase()}`;
    if(active[key]){ alert('Ai deja o tură activă. Închide-o înainte de a începe alta.'); return; }
    active[key] = {id:ses.id, name:ses.name, grade:ses.grade, tura:ses.tura, startISO:s.toISOString()};
    saveActive(active);
    timeStart.value='';
    refreshClockUI();
    renderMyEntries();
  });

  btnEnd.addEventListener('click', () => {
    const me = parseTimeHHMM(timeEnd.value.trim());
    if(me===null){ alert('Ora de sfârșit invalidă (folosește hh:mm).'); return; }
    const active = getActive();
    const key = `${ses.id}::${ses.name.toLowerCase()}`;
    const a = active[key];
    if(!a){ alert('Nu ai o tură activă.'); return; }
    const start = new Date(a.startISO);
    const end = new Date(a.startISO);
    end.setHours(Math.floor(me/60), me%60, 0, 0);
    if(end < start){ end.setDate(end.getDate()+1); } // allow overnight
    // Save entry
    const entries = getEntries();
    entries.push({id:ses.id, name:ses.name, grade:ses.grade, startISO:start.toISOString(), endISO:end.toISOString(), tura:ses.tura});
    saveEntries(entries);
    // Clear active
    delete active[key];
    saveActive(active);
    timeEnd.value='';
    refreshClockUI();
    renderMyEntries();
  });

  refreshClockUI();
  renderMyEntries();

  // Export my CSV
  $('#exportCSVMy').addEventListener('click', ()=>exportSelfCSV(ses));
}

function renderMyEntries(){
  const ses = getSession();
  const tb = $('#myEntries tbody');
  const sumBox = $('#sumSelf');
  const range = $('#weekRangeSelf');
  if(!tb) return;
  tb.innerHTML='';
  const {weekStart, weekEnd} = getWeekBounds();
  range.textContent = `Perioadă: ${weekStart.toLocaleString()} → ${weekEnd.toLocaleString()}`;

  const entries = getEntries().filter(e => e.id===ses.id && e.name.toLowerCase()===ses.name.toLowerCase())
                              .filter(e => new Date(e.startISO) >= weekStart && new Date(e.startISO) <= weekEnd)
                              .sort((a,b)=> new Date(b.startISO)-new Date(a.startISO));
  let total = 0;
  entries.forEach(e => {
    const dur = durationHours(e.startISO, e.endISO);
    total += dur;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.startISO.slice(0,10)}</td>
                    <td>${new Date(e.startISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
                    <td>${new Date(e.endISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
                    <td>${dur.toFixed(2)}</td>
                    <td>${e.tura}</td>
                    <td class="action-inline">-</td>`;
    // Admins can delete entries
    const sesRole = ses.grade;
    if(sesRole === 'Director' || sesRole === 'Vice-Director'){
      const del = document.createElement('button'); del.className='btn small'; del.textContent='Șterge';
      del.addEventListener('click', () => {
        if(!confirm('Ștergi această intrare?')) return;
        let all = getEntries();
        all = all.filter(x => !(x.id===e.id && x.name===e.name && x.startISO===e.startISO && x.endISO===e.endISO));
        saveEntries(all);
        renderMyEntries();
      });
      tr.querySelector('.action-inline').innerHTML = '';
      tr.querySelector('.action-inline').appendChild(del);
    }
    tb.appendChild(tr);
  });
  sumBox.innerHTML = `<strong>Total săptămână:</strong> ${total.toFixed(2)} ore.`;
}

// ===== Exports =====
function exportSelfCSV(ses){
  const {weekStart, weekEnd} = getWeekBounds();
  const entries = getEntries().filter(e => e.id===ses.id && e.name.toLowerCase()===ses.name.toLowerCase())
                              .filter(e => new Date(e.startISO) >= weekStart && new Date(e.startISO) <= weekEnd);
  const rows = [['Nume','ID','Grad','Data','Start','Stop','Durata (h)','Tura']];
  entries.forEach(e => rows.push([e.name, e.id, e.grade, e.startISO.slice(0,10),
                                  new Date(e.startISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
                                  new Date(e.endISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
                                  durationHours(e.startISO, e.endISO).toFixed(2), e.tura]));
  downloadCSV(`ore_${ses.name}_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportAllPersons(){
  const persons = getPersons();
  const rows = [['Nume','ID','Grad']];
  persons.forEach(p=> rows.push([p.name,p.id,p.grade]));
  downloadCSV('persoane.csv', rows);
}

function exportWeekAll(){
  const {weekStart, weekEnd} = getWeekBounds();
  const entries = getEntries().filter(e => new Date(e.startISO) >= weekStart && new Date(e.startISO) <= weekEnd);
  const rows = [['Nume','ID','Grad','Data','Start','Stop','Durata (h)','Tura']];
  entries.forEach(e => rows.push([e.name, e.id, e.grade, e.startISO.slice(0,10),
                                  new Date(e.startISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
                                  new Date(e.endISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
                                  durationHours(e.startISO, e.endISO).toFixed(2), e.tura]));
  downloadCSV(`raport_saptamanal_${new Date().toISOString().slice(0,10)}.csv`, rows);
}
