/* app.js
   LocalStorage-based Blood Donor Tracker
   Save as app.js and include in index.html
*/

/* -----------------------
   STORAGE KEYS & DEFAULTS
   ----------------------- */
const STORAGE_KEY = "blood_donor_app_v1";
const SETTINGS_KEY = "blood_donor_settings_v1";

const defaultSettings = {
  donationIntervalDays: 90,
  locale: "bn",
  theme: "light"
};

/* -----------------------
   UTILITIES
   ----------------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function loadSettings(){
  try{
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return s ? {...defaultSettings, ...s} : {...defaultSettings};
  }catch(e){ return {...defaultSettings}; }
}
function saveSettings(s){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applyTheme(s.theme);
}

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    return JSON.parse(raw);
  }catch(e){ return []; }
}
function saveData(arr){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/* id generator */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* date helpers (YYYY-MM-DD) */
function toISO(d){
  if(!d) return null;
  const dt = new Date(d);
  if(Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayISO(){ return toISO(new Date()); }
function addDaysISO(isoDate, days){
  if(!isoDate) return null;
  const dt = new Date(isoDate + "T00:00:00");
  dt.setDate(dt.getDate() + Number(days));
  return toISO(dt);
}
function daysBetween(aISO, bISO){
  // returns b - a in days (integer)
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / (1000*60*60*24));
}

/* -----------------------
   APP STATE
   ----------------------- */
let data = loadData();
let settings = loadSettings();

/* -----------------------
   UI ELEMENTS
   ----------------------- */
const profilesList = $("#profilesList");
const totalProfiles = $("#totalProfiles");
const eligibleToday = $("#eligibleToday");
const upcoming7 = $("#upcoming7");

const searchInput = $("#searchInput");
const filterGroup = $("#filterGroup");
const filterEligibility = $("#filterEligibility");
const btnAdd = $("#btnAdd");
const btnFastDonate = $("#btnFastDonate");

const modalOverlay = $("#modalOverlay");
const profileForm = $("#profileForm");
const modalTitle = $("#modalTitle");
const btnCancel = $("#btnCancel");

const detailOverlay = $("#detailOverlay");
const detailContent = $("#detailContent");
const closeDetail = $("#closeDetail");

const btnExport = $("#btnExport");
const btnImport = $("#btnImport");
const importFile = $("#importFile");

const btnSettings = $("#btnSettings");
const settingsOverlay = $("#settingsOverlay");
const settingsForm = $("#settingsForm");
const intervalDaysInput = $("#intervalDays");
const themeSelect = $("#themeSelect");
const closeSettings = $("#closeSettings");

/* -----------------------
   INIT
   ----------------------- */
function init(){
  applyTheme(settings.theme);
  intervalDaysInput.value = settings.donationIntervalDays;
  themeSelect.value = settings.theme;
  render();
  attachEvents();
}
function applyTheme(theme){
  if(theme === "dark"){
    document.documentElement.setAttribute("data-theme","dark");
  }else{
    document.documentElement.removeAttribute("data-theme");
  }
}

/* -----------------------
   CORE LOGIC
   ----------------------- */
function computeNextEligible(profile){
  // if donations array empty -> return null
  if(!profile.donations || profile.donations.length === 0) return null;
  // get latest donation (max)
  const latest = profile.donations.slice().sort().slice(-1)[0];
  return addDaysISO(latest, settings.donationIntervalDays);
}

function statusForNext(nextISO){
  if(!nextISO) return {status:"noData", text:"আগে দান নেই", cls:"status-red"};
  const t = todayISO();
  const daysLeft = daysBetween(t, nextISO);
  if(daysLeft <= 0) return {status:"eligible", text:"এখনই যোগ্য", cls:"status-green"};
  if(daysLeft <= 14) return {status:"soon", text:`${daysLeft} দিন বাকি`, cls:"status-amber"};
  return {status:"notSoon", text:`${daysLeft} দিন বাকি`, cls:"status-red"};
}

/* -----------------------
   RENDER
   ----------------------- */
function render(){
  // update dashboard counts
  totalProfiles.textContent = data.length;
  const t = todayISO();
  let eligibleCount = 0, upcomingCount = 0;
  data.forEach(p => {
    const next = computeNextEligible(p);
    if(next){
      const days = daysBetween(t, next);
      if(days <= 0) eligibleCount++;
      if(days <= 7 && days > 0) upcomingCount++;
    }
  });
  eligibleToday.textContent = eligibleCount;
  upcoming7.textContent = upcomingCount;

  // render profile cards based on filters & search
  const q = (searchInput.value || "").trim().toLowerCase();
  const grp = filterGroup.value;
  const elig = filterEligibility.value;

  let list = data.slice().sort((a,b)=> a.name.localeCompare(b.name));

  list = list.filter(p => {
    if(q && !p.name.toLowerCase().includes(q)) return false;
    if(grp !== "all" && p.bloodGroup !== grp) return false;
    const next = computeNextEligible(p);
    const daysLeft = next ? daysBetween(todayISO(), next) : null;
    if(elig === "eligibleToday" && !(daysLeft !== null && daysLeft <= 0)) return false;
    if(elig === "next7" && !(daysLeft !== null && daysLeft > 0 && daysLeft <= 7)) return false;
    if(elig === "next30" && !(daysLeft !== null && daysLeft > 0 && daysLeft <= 30)) return false;
    if(elig === "notEligible" && !(daysLeft !== null && daysLeft > 30)) return false;
    return true;
  });

  profilesList.innerHTML = "";
  if(list.length === 0){
    profilesList.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--muted)">কোনো প্রোফাইল পাওয়া যায়নি</div>`;
    return;
  }

  list.forEach(p => {
    const next = computeNextEligible(p);
    const status = statusForNext(next);
    const lastDonation = (p.donations && p.donations.length) ? p.donations.slice().sort().slice(-1)[0] : "ন/এ";
    const card = document.createElement("div");
    card.className = "profile-card";
    card.dataset.id = p.id;
    card.innerHTML = `
      <div class="avatar" aria-hidden="true">${p.name.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
      <div class="p-info">
        <div class="p-name">${p.name}</div>
        <div class="p-meta">
          <div>${p.age} yrs</div>
          <div class="badge" style="background:#111;color:#fff">${p.bloodGroup}</div>
          <div style="margin-left:auto" title="পরবর্তী যোগ্যতা"><span class="${status.cls} badge">${status.text}</span></div>
        </div>
        <div class="p-meta" style="margin-top:6px;color:var(--muted);font-size:13px">সর্বশেষ: ${lastDonation}${p.phone? ' • ' + p.phone : ''}</div>
      </div>
    `;
    card.addEventListener("click", () => openDetail(p.id));
    profilesList.appendChild(card);
  });
}

/* -----------------------
   CRUD
   ----------------------- */
function openAddModal(){
  modalTitle.textContent = "নতুন প্রোফাইল";
  profileForm.reset();
  profileForm.id.value = "";
  modalOverlay.classList.remove("hidden");
  profileForm.name.focus();
}
function closeModal(){ modalOverlay.classList.add("hidden"); }

function upsertProfile(formData){
  const id = formData.get("id");
  const obj = {
    id: id || uid(),
    name: formData.get("name").trim(),
    age: Number(formData.get("age") || 0),
    bloodGroup: formData.get("bloodGroup"),
    phone: formData.get("phone") || "",
    donations: [],
    notes: formData.get("notes") || ""
  };
  const recent = formData.get("recentDonation");
  if(recent) obj.donations = [toISO(recent)];

  if(id){
    // update
    data = data.map(d => d.id === id ? {...d, ...obj, donations: d.donations.concat(obj.donations).filter(Boolean)} : d);
  }else{
    data.push(obj);
  }
  saveData(data);
  render();
}

/* -----------------------
   Detail view
   ----------------------- */
function openDetail(id){
  const p = data.find(x=>x.id===id);
  if(!p) return;
  const next = computeNextEligible(p);
  const status = statusForNext(next);
  detailContent.innerHTML = `
    <h3>${p.name} <span style="font-size:14px;color:var(--muted)">• ${p.bloodGroup}</span></h3>
    <div style="margin-top:6px;color:var(--muted)">বয়স: ${p.age} ${p.phone? ' • ফোন: '+p.phone : ''}</div>
    <div style="margin-top:8px;"><strong>পরবর্তী যোগ্যতা:</strong> ${ next || "নির্ধারিত নেই" } <span class="${status.cls} badge" style="margin-left:8px">${status.text}</span></div>
    <div style="margin-top:12px;"><strong>নোটস:</strong><div style="padding:8px;background:var(--card);border-radius:8px;margin-top:6px">${p.notes || "কোনো নোট নেই"}</div></div>

    <div style="margin-top:12px"><strong>ডোনেশন ইতিহাস</strong>
      <ul id="donList" style="margin-top:8px;padding-left:18px"></ul>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button id="addDonationBtn" class="primary">নতুন ডোনেশন যোগ করুন</button>
      <button id="deleteProfileBtn">প্রোফাইল মুছুন</button>
      <button id="editProfileBtn">এডিট</button>
    </div>
  `;
  // fill donations
  const donList = $("#donList");
  if(p.donations && p.donations.length){
    p.donations.slice().sort().reverse().forEach(d=>{
      const li = document.createElement("li");
      li.textContent = d;
      const rm = document.createElement("button");
      rm.textContent = "মুছুন";
      rm.style.marginLeft = "8px";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        if(!confirm("এই ডোনেশন রেকর্ড মুছে ফেলতে চান?")) return;
        p.donations = p.donations.filter(x=> x !== d);
        saveData(data);
        openDetail(id);
        render();
      });
      li.appendChild(rm);
      donList.appendChild(li);
    });
  } else {
    donList.innerHTML = "<li style='color:var(--muted)'>কোনো রেকর্ড নেই</li>";
  }

  // attach buttons
  $("#addDonationBtn").addEventListener("click", ()=> {
    const dt = prompt("ডোনেশনের তারিখ (YYYY-MM-DD) লিখুন — উদাহরণ: 2025-08-12", todayISO());
    if(!dt) return;
    const iso = toISO(dt);
    if(!iso){ alert("তারিখ সঠিক নয়।"); return; }
    p.donations = (p.donations || []).concat([iso]);
    saveData(data);
    openDetail(id);
    render();
  });

  $("#deleteProfileBtn").addEventListener("click", ()=> {
    if(!confirm("এই প্রোফাইল সম্পূর্ণভাবে মুছে যাবে। আপনি কি নিশ্চিত?")) return;
    data = data.filter(x=> x.id !== id);
    saveData(data);
    closeDetailFn();
    render();
  });

  $("#editProfileBtn").addEventListener("click", ()=> {
    // open edit modal
    openAddModal();
    modalTitle.textContent = "প্রোফাইল এডিট";
    profileForm.id.value = p.id;
    profileForm.name.value = p.name;
    profileForm.age.value = p.age;
    profileForm.bloodGroup.value = p.bloodGroup;
    profileForm.phone.value = p.phone || "";
    profileForm.notes.value = p.notes || "";
    // recentDonation leave blank
    closeDetailFn();
  });

  detailOverlay.classList.remove("hidden");
}
function closeDetailFn(){ detailOverlay.classList.add("hidden"); detailContent.innerHTML = ""; }

/* -----------------------
   EXPORT / IMPORT
   ----------------------- */
function exportJSON(){
  const blob = new Blob([JSON.stringify({settings, data}, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `donors_backup_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function exportCSV(){
  // produce CSV rows: id,name,age,bloodGroup,phone,notes,donations(semi-colon)
  const header = ["id","name","age","bloodGroup","phone","notes","donations"].join(",");
  const rows = data.map(p => {
    const line = [
      `"${p.id}"`,
      `"${p.name.replace(/"/g,'""')}"`,
      p.age,
      p.bloodGroup,
      `"${(p.phone||"").replace(/"/g,'""')}"`,
      `"${(p.notes||"").replace(/"/g,'""')}"`,
      `"${(p.donations||[]).join(";")}"`,
    ];
    return line.join(",");
  });
  const csv = [header].concat(rows).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `donors_${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(file){
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const obj = JSON.parse(e.target.result);
      if(Array.isArray(obj.data)){
        // merge carefully: avoid id collisions
        const existingIds = new Set(data.map(d=>d.id));
        const toAdd = obj.data.map(d => {
          if(!d.id || existingIds.has(d.id)) d.id = uid();
          // ensure fields
          return {
            id:d.id,
            name:d.name||"অজানা",
            age:Number(d.age||0),
            bloodGroup:d.bloodGroup||"O+",
            phone:d.phone||"",
            donations:Array.isArray(d.donations)?d.donations.map(toISO).filter(Boolean):[],
            notes:d.notes||""
          };
        });
        data = data.concat(toAdd);
        saveData(data);
        if(obj.settings) settings = {...settings, ...obj.settings}, saveSettings(settings);
        alert("Import সফল: নতুন প্রোফাইল যোগ করা হয়েছে");
        render();
      } else {
        alert("ফাইলটি প্রত্যাশিত ফরম্যাটে নেই।")
      }
    }catch(err){
      alert("Import ব্যর্থ: ফাইলটি সঠিক JSON নয়।");
    }
  };
  reader.readAsText(file);
}

/* -----------------------
   EVENTS
   ----------------------- */
function attachEvents(){
  btnAdd.addEventListener("click", openAddModal);
  btnCancel.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e)=>{
    if(e.target === modalOverlay) closeModal();
  });

  profileForm.addEventListener("submit", (ev)=>{
    ev.preventDefault();
    const fd = new FormData(profileForm);
    upsertProfile(fd);
    closeModal();
  });

  searchInput.addEventListener("input", render);
  filterGroup.addEventListener("change", render);
  filterEligibility.addEventListener("change", render);

  btnFastDonate.addEventListener("click", ()=>{
    // quick add donation for a selected profile (if only one in search)
    const q = (searchInput.value||"").trim();
    if(!q){
      alert("দয়া করে প্রথমে সার্চ করে প্রোফাইল সিলেক্ট করুন অথবা প্রোফাইল লিস্ট থেকে খুলুন।");
      return;
    }
    const matches = data.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    if(matches.length === 0){ alert("কোনো মিল পাওয়া যায়নি।"); return; }
    if(matches.length > 1){
      alert("একাধিক মিল পাওয়া গেছে — অনুগ্রহ করে প্রোফাইল লিস্ট থেকে সিলেক্ট করে 'আজ দান' যুক্ত করুন।");
      return;
    }
    const p = matches[0];
    p.donations = (p.donations||[]).concat([todayISO()]);
    saveData(data);
    render();
    alert(`${p.name} — আজকের তারিখ যোগ করা হলো।`);
  });

  // Detail overlay close
  closeDetail.addEventListener("click", closeDetailFn);
  detailOverlay.addEventListener("click", (e)=> { if(e.target === detailOverlay) closeDetailFn(); });

  // export/import
  btnExport.addEventListener("click", ()=>{
    const ok = confirm("Export করা হলে JSON ও CSV দুটো ডাউনলোড করা হবে — চালিয়ে যাবেন?");
    if(!ok) return;
    exportJSON();
    exportCSV();
  });
  btnImport.addEventListener("click", ()=> importFile.click());
  importFile.addEventListener("change", (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    handleImportFile(f);
    importFile.value = "";
  });

  // settings
  btnSettings.addEventListener("click", ()=> settingsOverlay.classList.remove("hidden"));
  closeSettings.addEventListener("click", ()=> settingsOverlay.classList.add("hidden"));
  settingsForm.addEventListener("submit", (ev)=>{
    ev.preventDefault();
    const d = Number(intervalDaysInput.value) || 90;
    settings.donationIntervalDays = d;
    settings.theme = themeSelect.value || "light";
    saveSettings(settings);
    settingsOverlay.classList.add("hidden");
    render();
  });
}

/* -----------------------
   Kickoff
   ----------------------- */
init();

/* End of app.js */
