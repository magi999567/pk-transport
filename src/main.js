import "./style.css";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from "firebase/firestore";

const $ = (s) => document.querySelector(s);
const app = $("#app");
let currentUser = null;
let currentRole = "";
let currentSection = "overview";
let cached = { vehicles: [], routes: [], trips: [], income: [], expenses: [] };

const labels = {
  overview: "Dashboard", vehicles: "Vehicles", routes: "Routes", trips: "Trips",
  income: "Income", expenses: "Expenses"
};
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const safe = (v = "") => String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const today = () => new Date().toISOString().slice(0,10);

function loginView(message = "") {
  app.innerHTML = `
    <div class="login-shell">
      <section class="intro">
        <img src="/pk-transport-logo.png" alt="PK TRANSPORT" style="width:100%;max-width:420px;height:auto;object-fit:contain;">
        <div class="eyebrow">TRANSPORT MANAGEMENT SYSTEM</div>
        <h1>Move your business<br><span>forward.</span></h1>
        <p>Manage vehicles, trips, income and expenses from one simple workspace.</p>
        <div class="intro-points"><span>🚚 Vehicle tracking</span><span>🗺️ Trip records</span><span>📊 Financial reports</span></div>
      </section>
      <section class="login-panel">
        <div class="mini-brand">PK <span>TRANSPORT</span></div>
        <h2>Welcome back</h2><p class="muted">Sign in to your PK Transport account.</p>
        <form id="loginForm">
          <label>Email address</label><input id="email" type="email" placeholder="name@example.com" required autocomplete="username">
          <label>Password</label><input id="password" type="password" placeholder="Enter password" required autocomplete="current-password">
          <button class="primary full" type="submit">Sign in <span>→</span></button>
          <button class="text-button" id="forgot" type="button">Forgot password?</button>
          <p class="message" id="message">${safe(message)}</p>
        </form>
        <div class="hint">Access is provided by your PK Transport administrator.</div>
      </section>
    </div>`;
  $("#loginForm").addEventListener("submit", login);
  $("#forgot").addEventListener("click", resetPassword);
}
async function login(e) {
  e.preventDefault();
  const msg = $("#message");
  msg.textContent = "Signing in…";
  try {
    const cred = await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
    await loadUser(cred.user);
  } catch (err) {
    msg.textContent = friendlyError(err);
  }
}
async function resetPassword() {
  const email = $("#email").value.trim();
  if (!email) { $("#message").textContent = "Enter your email address first."; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    $("#message").textContent = "Password reset email sent. Check your inbox.";
  } catch (err) { $("#message").textContent = friendlyError(err); }
}
function friendlyError(err) {
  const map = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account exists for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };
  return map[err.code] || err.message || "Something went wrong.";
}
async function loadUser(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || !["admin","staff","driver"].includes(snap.data().role)) {
    await signOut(auth);
    loginView("Your account has no valid role. Ask the administrator to configure your access.");
    return;
  }
  currentUser = user;
  currentRole = snap.data().role;
  currentSection = "overview";
  await dashboard();
}
function navItems() {
  const items = ["overview","vehicles","routes","trips","income","expenses"];
  return items.filter(x => currentRole === "admin" || (currentRole === "staff" && !["vehicles"].includes(x)) || (currentRole === "driver" && x === "trips"));
}
async function fetchCollection(name) {
  const snap = await getDocs(query(collection(db, name), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function refreshData() {
  for (const name of ["vehicles","routes","trips","income","expenses"]) {
    try { cached[name] = await fetchCollection(name); }
    catch { cached[name] = []; }
  }
}
async function dashboard() {
  await refreshData();
  const roleName = currentRole === "admin" ? "Administrator" : currentRole === "staff" ? "Office Staff" : "Driver";
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="side-brand"><b>PK</b><span>PK TRANSPORT<small>Management System</small></span></div>
        <div class="side-caption">WORKSPACE</div>
        <nav>${navItems().map(x => `<button class="nav-item ${currentSection===x?"active":""}" data-nav="${x}"><span>${({overview:"▦",vehicles:"🚚",routes:"📍",trips:"🗺️",income:"↗",expenses:"↘"})[x]}</span>${labels[x]}</button>`).join("")}</nav>
        <div class="side-bottom"><div class="user-dot">${safe((currentUser.email||"P").slice(0,1).toUpperCase())}</div><div class="user-info">${safe(currentUser.email)}<small>${roleName}</small></div><button id="logout" class="logout" title="Sign out">↪</button></div>
      </aside>
      <main class="main">
        <header class="page-head"><div><div class="eyebrow dark">PK TRANSPORT / WORKSPACE</div><h1>${labels[currentSection]}</h1></div><div class="head-right"><span class="online"><i></i> System online</span><span class="date">${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span></div></header>
        <div id="content">${renderSection()}</div>
      </main>
    </div>`;
  document.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", async () => { currentSection=b.dataset.nav; await dashboard(); }));
  $("#logout").addEventListener("click", () => signOut(auth));
  bindSection();
}
function renderSection() {
  if (currentSection === "overview") {
    const totalIncome = cached.income.reduce((s,x)=>s+Number(x.amount||0),0);
    const totalExpense = cached.expenses.reduce((s,x)=>s+Number(x.amount||0),0);
    const activeTrips = cached.trips.filter(x=>x.status==="In progress").length;
    return `<div class="welcome-strip"><div><span class="eyebrow">GOOD TO SEE YOU</span><h2>Welcome to your workspace</h2><p>Here is the latest activity recorded in PK Transport.</p></div><div class="strip-icon">🚚</div></div>
      <div class="stats">
        ${stat("Vehicles",cached.vehicles.length,"🚚","Registered fleet")}
        ${stat("Total trips",cached.trips.length,"🗺️",`${activeTrips} in progress`)}
        ${stat("Income",money(totalIncome),"↗","Recorded income")}
        ${stat("Expenses",money(totalExpense),"↘","Recorded expenses")}
      </div>
      <div class="panel"><div class="panel-head"><div><h3>Recent trips</h3><p>Latest trip records</p></div><button class="outline" data-goto="trips">View trips →</button></div>${table(["Date","Route","Total KM","Extra KM","Driver"],cached.trips.slice(0,5).map(x=>[x.date,`${x.startLocation||""} → ${x.endLocation||""}`,x.totalKm,x.extraKm,x.driverName]))}</div>`;
  }
  const data = cached[currentSection];
  const config = {
    vehicles:{title:"Vehicle register",desc:"Keep your fleet details up to date.",fields:[["vehicleNumber","Vehicle number"],["type","Vehicle type"],["capacity","Capacity"],["driver","Assigned driver"]],cols:["Vehicle number","Type","Capacity","Driver"]},
    routes:{title:"Route register",desc:"Set the allowed kilometres once for each route.",fields:[["startLocation","Start location"],["endLocation","End location"],["allowedKm","Allowed KM","number"]],cols:["Start location","End location","Allowed KM"]},
    trips:{title:"Trip register",desc:"Enter the vehicle meter readings. KM and extra KM are calculated automatically.",fields:[["date","Date","date"],["startLocation","Start location"],["endLocation","End location"],["startKm","Start KM","number"],["endKm","End KM","number"],["totalKm","Total KM","number"],["extraKm","Extra KM","number"],["driverName","Driver name"]],cols:["Date","Start location","End location","Start KM","End KM","Total KM","Extra KM","Driver name"]},
    income:{title:"Income register",desc:"Record payments and other income.",fields:[["date","Date","date"],["category","Category"],["description","Description"],["amount","Amount (₹)","number"]],cols:["Date","Category","Description","Amount"]},
    expenses:{title:"Expense register",desc:"Record fuel, maintenance and other expenses.",fields:[["date","Date","date"],["category","Category"],["description","Description"],["amount","Amount (₹)","number"]],cols:["Date","Category","Description","Amount"]}
  }[currentSection];
  const rows = data.map(x => config.cols.map(c => {
    const key = ({
      "Vehicle number":"vehicleNumber","Type":"type","Capacity":"capacity","Driver":"driver",
      "Start location":"startLocation","End location":"endLocation","Allowed KM":"allowedKm",
      "Date":"date","Start KM":"startKm","End KM":"endKm","Total KM":"totalKm","Extra KM":"extraKm","Driver name":"driverName",
      "Amount":"amount","Category":"category","Description":"description"
    })[c];
    return c==="Amount" ? money(x[key]) : (x[key] ?? "—");
  }));
  return `<div class="panel"><div class="panel-head"><div><h3>${config.title}</h3><p>${config.desc}</p></div>${currentRole!=="driver"?`<button class="primary" id="addRecord">＋ Add new</button>`:""}</div>${table(config.cols,rows,true)}</div>
    ${currentRole!=="driver"?`<div class="note">Only authorized users can add or change records. Data is saved in your PK Transport Firestore database.</div>`:""}`;
}
function stat(title,value,icon,sub){return `<div class="stat-card"><div class="stat-top"><span>${title}</span><b>${icon}</b></div><strong>${value}</strong><small>${sub}</small></div>`;}
function table(headers,rows,actions=false) {
  if (!rows.length) return `<div class="empty"><div>▤</div><b>No records yet</b><span>New records will appear here.</span></div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}${actions&&currentRole==="admin"?"<th></th>":""}</tr></thead><tbody>${rows.map((r,i)=>`<tr>${r.map(v=>`<td>${safe(v)}</td>`).join("")}${actions&&currentRole==="admin"?`<td><button class="delete" data-delete="${cached[currentSection][i].id}">Delete</button></td>`:""}</tr>`).join("")}</tbody></table></div>`;
}
function bindSection() {
  document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",async()=>{currentSection=b.dataset.goto;await dashboard();}));
  $("#addRecord")?.addEventListener("click",()=>openRecordForm());
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm("Delete this record?")) return;
    try { await deleteDoc(doc(db,currentSection,b.dataset.delete)); await dashboard(); }
    catch(e){alert(friendlyError(e));}
  }));
}
function openRecordForm() {
  const fields = {
    vehicles:[["vehicleNumber","Vehicle number"],["type","Vehicle type"],["capacity","Capacity"],["driver","Assigned driver"]],
    routes:[["startLocation","Start location"],["endLocation","End location"],["allowedKm","Allowed KM","number"]],
    trips:[["date","Date","date"],["startLocation","Start location"],["endLocation","End location"],["startKm","Start KM","number"],["endKm","End KM","number"],["totalKm","Total KM","number"],["allowedKm","Allowed KM","number"],["extraKm","Extra KM","number"],["driverName","Driver name"]],
    income:[["date","Date","date"],["category","Category"],["description","Description"],["amount","Amount (₹)","number"]],
    expenses:[["date","Date","date"],["category","Category"],["description","Description"],["amount","Amount (₹)","number"]]
  }[currentSection];
  const modal = document.createElement("div");
  modal.className="modal-backdrop";
  modal.innerHTML=`<form class="modal" id="recordForm"><button type="button" class="modal-close" id="closeModal">×</button><h2>Add ${labels[currentSection].slice(0,-1)} record</h2><p class="muted">Enter the details below.</p>
    ${fields.map(([id,label,type])=>`<label>${label}${type==="route"?`<select name="${id}" required><option value="">Choose a saved route</option>${cached.routes.map(r=>`<option value="${r.id}">${safe(r.startLocation)} → ${safe(r.endLocation)} (${Number(r.allowedKm)} KM)</option>`).join("")}</select>`:`<input name="${id}" type="${type||"text"}" ${type==="date"?`value="${today()}"`:""} ${type==="number"?'min="0" step="0.01"':""} ${["totalKm","extraKm"].includes(id) && currentSection==="trips"?'readonly':""} required>`}</label>`).join("")}
    <div class="modal-actions"><button type="button" class="outline" id="cancelModal">Cancel</button><button class="primary" type="submit">Save record</button></div><p class="message" id="formMessage"></p></form>`;
  document.body.append(modal);
  const close=()=>modal.remove();
  $("#closeModal").onclick=close; $("#cancelModal").onclick=close;
  if (currentSection === "trips") {
    const form = $("#recordForm");
    const startLocInput = form.querySelector('[name="startLocation"]');
    const endLocInput = form.querySelector('[name="endLocation"]');
    const startInput = form.querySelector('[name="startKm"]');
    const endInput = form.querySelector('[name="endKm"]');
    const totalInput = form.querySelector('[name="totalKm"]');
    const allowedInput = form.querySelector('[name="allowedKm"]');
    const extraInput = form.querySelector('[name="extraKm"]');
    totalInput.placeholder = "Calculated automatically";
    allowedInput.placeholder = "Auto-filled for saved routes; otherwise enter KM";
    extraInput.placeholder = "Calculated automatically";
    const calculate = () => {
      const start = Number(startInput.value), end = Number(endInput.value);
      if (startInput.value === "" || endInput.value === "" || end < start) {
        totalInput.value = ""; extraInput.value = ""; return;
      }
      const total = end - start;
      const allowed = Number(allowedInput.value || 0);
      totalInput.value = total;
      extraInput.value = Math.max(0, total - allowed);
    };
    const matchSavedRoute = () => {
      const start = startLocInput.value.trim().toLowerCase();
      const end = endLocInput.value.trim().toLowerCase();
      const route = cached.routes.find(r => String(r.startLocation).trim().toLowerCase() === start && String(r.endLocation).trim().toLowerCase() === end);
      if (route) {
        allowedInput.value = Number(route.allowedKm);
        allowedInput.dataset.routeMatched = "true";
        $("#formMessage").textContent = `Saved route matched. Allowed KM: ${route.allowedKm}`;
      } else {
        allowedInput.dataset.routeMatched = "false";
        $("#formMessage").textContent = "No saved route matched. Enter Allowed KM manually.";
      }
      calculate();
    };
    startLocInput.addEventListener("change", matchSavedRoute);
    endLocInput.addEventListener("change", matchSavedRoute);
    allowedInput.addEventListener("input", calculate);
    startInput.addEventListener("input", calculate);
    endInput.addEventListener("input", calculate);
  }
  $("#recordForm").onsubmit=async e=>{
    e.preventDefault(); const payload=Object.fromEntries(new FormData(e.currentTarget).entries());
    for (const key of ["amount","allowedKm","startKm","endKm","totalKm","extraKm"]) {
      if (payload[key] !== undefined) payload[key] = Number(payload[key]);
    }
    if(payload.capacity!==undefined) payload.capacity=Number(payload.capacity)||payload.capacity;
    if (currentSection === "trips") {
      if (!payload.startLocation?.trim() || !payload.endLocation?.trim()) { $("#formMessage").textContent = "Enter both Start location and End location."; return; }
      if (payload.endKm < payload.startKm) { $("#formMessage").textContent = "End KM cannot be less than Start KM."; return; }
      if (payload.allowedKm === undefined || payload.allowedKm === "" || Number(payload.allowedKm) < 0) { $("#formMessage").textContent = "Enter a valid Allowed KM."; return; }
      payload.allowedKm = Number(payload.allowedKm);
      payload.totalKm = payload.endKm - payload.startKm;
      payload.extraKm = Math.max(0, payload.totalKm - payload.allowedKm);
      payload.route = `${payload.startLocation.trim()} → ${payload.endLocation.trim()}`;
    }
    try {
      await addDoc(collection(db,currentSection),{...payload,createdBy:currentUser.uid,createdAt:serverTimestamp()});
      close(); await dashboard();
    } catch(err){$("#formMessage").textContent=friendlyError(err);}
  };
}
onAuthStateChanged(auth, async user => {
  if (!user) { currentUser=null; currentRole=""; loginView(); return; }
  try { await loadUser(user); }
  catch(e) { await signOut(auth); loginView(friendlyError(e)); }
});