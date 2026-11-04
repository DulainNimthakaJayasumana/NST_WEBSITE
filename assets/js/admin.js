/* ============================================================
   admin.js: admin.html (the control room)
   ------------------------------------------------------------
   Sign-in only opens the page. Anyone can read this file, so the
   real protection is firestore.rules. See README.
   ============================================================ */

import { SERIES } from "./data.js";
import { mountChrome, liveWatch, esc, fmt, statusOf } from "./ui.js";
import { buildWorkbook } from "./xlsx.js";
import {
  getModeAsync, setLiveSettings, saveWorkshop,
  listRegistrations, listMessages, onLiveSettings,
  signInWithGoogle, hasTeamAccess, signOutTeam, onAuth
} from "./store.js";

mountChrome({ active: "" });

/* ---------- gate ----------
   Google sign-in, and firestore.rules decides which accounts get in. */
const gate   = document.getElementById("gate");
const panel  = document.getElementById("panel");
const gForm  = document.getElementById("gateForm");
const gMsg   = document.getElementById("gateMsg");

function gateMessage(text){
  gMsg.textContent = text;
  gMsg.classList.toggle("is-on", !!text);
}

/* Google lets any account sign in, so check this one is on the team's list. */
async function admit(user){
  gateMessage("");
  try{
    if (await hasTeamAccess()){
      document.getElementById("signOutBtn").hidden = false;
      document.getElementById("signedInAs").textContent = `Signed in as ${user.email}.`;
      openPanel();
    }else{
      await signOutTeam();
      gateMessage(`${user.email} does not have admin access. Sign in with a team account.`);
    }
  }catch(err){
    console.warn(err);
    gateMessage("Could not check your access. Check the connection and try again.");
  }
}

const SIGN_IN_ERRORS = {
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/unauthorized-domain": "This website address is not allowed yet. Add it under Authentication > Settings > Authorized domains in Firebase.",
  "auth/operation-not-allowed": "Google sign-in is not turned on yet. Enable it under Authentication > Sign-in method in Firebase."
};

function openPanel(){
  gate.hidden = true;
  panel.hidden = false;
  boot();
}

getModeAsync().then(mode => {
  if (mode === "cloud"){
    onAuth(user => { if (user) admit(user); });
  }else{
    gForm.hidden = true;
    document.getElementById("gateLead").textContent =
      "Could not reach the database. Check the connection and reload this page.";
  }
});

gForm.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = document.getElementById("gateBtn");
  btn.disabled = true;
  gateMessage("");
  try{
    await signInWithGoogle();         // onAuth takes it from here
  }catch(err){
    console.warn(err);
    if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request"){
      gateMessage(SIGN_IN_ERRORS[err.code] || "That did not sign in. Try again.");
    }
  }finally{
    btn.disabled = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOutTeam();
  location.reload();
});

/* ---------- boot ---------- */
let workshops = [];
let regs = [];
let booted = false;

async function boot(){
  if (booted) return;
  booted = true;

  document.getElementById("modeLine").innerHTML =
    `Connected to Firebase project <b>${esc(SERIES.name)}</b>. Changes are live for everyone.`;

  liveWatch.onData(w => {
    workshops = w.workshops;
    fillWorkshopSelect();
    renderEditors();
    fillRegFilter();
    renderStats();
  });

  onLiveSettings(s => {
    document.getElementById("liveMode").value = s.mode || "auto";
    document.getElementById("liveWorkshop").value = s.workshopId || "";
    document.getElementById("liveJoin").value = s.joinUrl || "";
    document.getElementById("liveMsg").value = s.message || "";
    hintMode();
  });

  await loadRegs();
  await loadMsgs();
}

/* ---------- live switch ---------- */
function fillWorkshopSelect(){
  const sel = document.getElementById("liveWorkshop");
  const keep = sel.value;
  sel.innerHTML = `<option value="">None</option>` + workshops.map(w =>
    `<option value="${esc(w.id)}">${esc(w.title)} · ${esc(fmt.short(w.startAt))}</option>`).join("");
  sel.value = keep;
}

function hintMode(){
  const m = document.getElementById("liveMode").value;
  document.getElementById("modeHint").textContent =
    m === "auto"      ? "The live screen appears between each session's start and end time."
    : m === "force-on"? "The chosen session shows as live right now, whatever the clock says."
    :                   "No live screen at all. Use this if a session is cancelled.";
}
document.getElementById("liveMode").addEventListener("change", hintMode);

document.getElementById("saveLive").addEventListener("click", async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Applying…";
  try{
    await setLiveSettings({
      mode:       document.getElementById("liveMode").value,
      workshopId: document.getElementById("liveWorkshop").value,
      joinUrl:    document.getElementById("liveJoin").value.trim(),
      message:    document.getElementById("liveMsg").value.trim()
    });
    btn.textContent = "Applied";
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1400);
  }catch(err){
    console.error(err);
    btn.textContent = "Failed, see console";
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 2200);
  }
});

/* ---------- session editors ---------- */
/* datetime-local wants local wall-clock; the site stores Sri Lanka time. */
function toLocalInput(d){
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SERIES.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
const fromLocalInput = v => (v ? `${v}:00+05:30` : "");

function renderEditors(){
  const host = document.getElementById("editors");
  const openIds = new Set([...host.querySelectorAll("details[open]")].map(d => d.dataset.id));

  host.innerHTML = workshops.map(w => {
    const physical = w.type === "physical";
    return `
    <details data-id="${esc(w.id)}" ${openIds.has(w.id) ? "open" : ""}
             class="editor">
      <summary>
        <span>${esc(w.title)}</span>
        <span class="badge badge--${physical ? "physical" : "online"}"><i class="dot"></i>${physical ? "Physical" : "Online"}</span>
        <span class="badge badge--${statusOf(w) === "live" ? "live" : "done"}">${esc(statusOf(w))}</span>
      </summary>

      <div class="form" style="margin-top:20px" data-form="${esc(w.id)}">
        <div class="form__grid">
          <div class="field">
            <label>Starts (Sri Lanka time)</label>
            <input type="datetime-local" data-f="startAt" value="${esc(toLocalInput(w.startAt))}">
          </div>
          <div class="field">
            <label>Ends</label>
            <input type="datetime-local" data-f="endAt" value="${esc(toLocalInput(w.endAt))}">
          </div>
        </div>

        <div class="field">
          <label>${physical ? "Venue" : "Platform"}</label>
          <input type="text" data-f="${physical ? "venue" : "platform"}"
                 value="${esc(physical ? (w.venue || "") : (w.platform || ""))}"
                 placeholder="${physical ? "Hall name, address" : "Google Meet"}">
        </div>

        <div class="field">
          <label>Join link</label>
          <input type="url" data-f="joinUrl" value="${esc(w.joinUrl || "")}" placeholder="https://...">
          <span class="field__hint">Shown on the live screen and the session card.</span>
        </div>

        <div class="form__grid">
          <div class="field">
            <label>Seat capacity</label>
            <input type="number" min="0" data-f="capacity" value="${w.capacity ?? ""}" placeholder="blank = no limit">
          </div>
          <div class="field">
            <label>Date note (shown when unconfirmed)</label>
            <input type="text" data-f="dateNote" value="${esc(w.dateNote || "")}" placeholder="Provisional, to be confirmed">
          </div>
        </div>

        <label class="checkline"><input type="checkbox" data-f="dateConfirmed" ${w.dateConfirmed ? "checked" : ""}> Date is confirmed</label>
        <label class="checkline"><input type="checkbox" data-f="registrationOpen" ${w.registrationOpen !== false ? "checked" : ""}> Registration open</label>

        <div class="form__msg" data-msg></div>
        <button class="btn btn--sm" data-save="${esc(w.id)}">Save ${esc(w.title)}</button>
      </div>
    </details>`;
  }).join("");

  host.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", () => saveOne(btn.dataset.save, btn));
  });
}

async function saveOne(id, btn){
  const form = document.querySelector(`[data-form="${CSS.escape(id)}"]`);
  const msg = form.querySelector("[data-msg]");
  const get = f => form.querySelector(`[data-f="${f}"]`);

  const patch = { id };
  const start = get("startAt")?.value;
  const end   = get("endAt")?.value;
  if (start) patch.startAt = fromLocalInput(start);
  if (end)   patch.endAt   = fromLocalInput(end);

  ["venue", "platform", "joinUrl", "dateNote"].forEach(f => {
    const el = get(f);
    if (el) patch[f] = el.value.trim();
  });

  const cap = get("capacity")?.value;
  patch.capacity = cap === "" ? null : Number(cap);
  patch.dateConfirmed    = !!get("dateConfirmed")?.checked;
  patch.registrationOpen = !!get("registrationOpen")?.checked;

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Saving…";
  try{
    await saveWorkshop(id, patch);
    msg.className = "form__msg form__msg--ok is-on";
    msg.textContent = "Saved. Every open tab has it already.";
  }catch(err){
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = err.message || "Could not save.";
  }finally{
    btn.disabled = false;
    btn.textContent = prev;
    setTimeout(() => { msg.className = "form__msg"; }, 4000);
  }
}

/* ---------- registrations ---------- */
const COLS = [
  { title: "Ref",        width: 14, get: r => r.ref || "" },
  { title: "Name",       width: 24, get: r => r.name },
  { title: "Email",      width: 30, get: r => r.email },
  { title: "WhatsApp",   width: 16, get: r => r.phone },
  { title: "Entity",     width: 20, get: r => r.entity },
  { title: "Sessions",   width: 48, get: r => r.workshopTitle || r.workshopId },
  { title: "Role",       width: 20, get: r => r.role || "" },
  { title: "Experience", width: 30, get: r => r.level || "" },
  { title: "Focus",      width: 20, get: r => (r.modules || []).join(", ") },
  { title: "Diet",       width: 20, get: r => r.diet || "" },
  { title: "Notes",      width: 40, get: r => r.notes || "" },
  { title: "Registered", width: 20, get: r => r.createdAt ? `${fmt.date(new Date(r.createdAt))} ${fmt.time(new Date(r.createdAt))}` : "" }
];

/* What the table currently shows: the export follows the same filter. */
function visibleRegs(){
  const q = (document.getElementById("regSearch")?.value || "").trim().toLowerCase();
  const sess = document.getElementById("regSession")?.value || "";
  return regs.filter(r =>
    (!sess || attends(r, sess)) &&
    (!q || COLS.some(c => String(c.get(r) ?? "").toLowerCase().includes(q))));
}

function renderRegs(){
  const tbody = document.querySelector("#regTable tbody");
  const list = visibleRegs();
  document.getElementById("regCount").textContent = !regs.length
    ? "No registrations yet."
    : list.length === regs.length
      ? `${regs.length} ${regs.length === 1 ? "person" : "people"} registered.`
      : `Showing ${list.length} of ${regs.length}.`;

  tbody.innerHTML = list.length
    ? list.map(r => `<tr>${COLS.map(c => `<td>${esc(c.get(r) || "-")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${COLS.length}" class="muted">${regs.length ? "Nobody matches that search." : "Nothing yet. Share the registration link."}</td></tr>`;
  document.getElementById("xlsxBtn").disabled = !list.length;
}

function fillRegFilter(){
  const sel = document.getElementById("regSession");
  const keep = sel.value;
  sel.innerHTML = `<option value="">All sessions</option>` +
    workshops.map(w => `<option value="${esc(w.id)}">${esc(w.title)}</option>`).join("");
  sel.value = keep;
}

async function loadRegs(){
  const tbody = document.querySelector("#regTable tbody");
  document.querySelector("#regTable thead tr").innerHTML = COLS.map(c => `<th>${esc(c.title)}</th>`).join("");
  try{
    regs = await listRegistrations();
  }catch(err){
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="${COLS.length}" class="muted">Could not load registrations.</td></tr>`;
    return;
  }
  renderRegs();
  renderStats();
  syncSeatCounts();
}

document.getElementById("regSearch")?.addEventListener("input", renderRegs);
document.getElementById("regSession")?.addEventListener("change", renderRegs);

/* One person can book several sessions, so a registration counts towards
   every workshop in workshopIds (older rows only have workshopId). */
function attends(r, id){
  return Array.isArray(r.workshopIds) ? r.workshopIds.includes(id) : r.workshopId === id;
}

/* Publish the per-session head count onto the workshop document, so the
   registration page can show "N seats left" without anyone needing read
   access to the registration list. */
async function syncSeatCounts(){
  if (await getModeAsync() !== "cloud") return;
  for (const w of workshops){
    const taken = regs.filter(r => attends(r, w.id)).length;
    if (w.seatsTaken === taken) continue;
    try{ await saveWorkshop(w.id, { seatsTaken: taken }); }
    catch(err){ console.warn("[NST] could not publish seat count for", w.id, err); }
  }
}

document.getElementById("refreshBtn")?.addEventListener("click", loadRegs);

/* ---------- Excel export ---------- */
function tally(list, key){
  const m = new Map();
  list.forEach(r => { const k = key(r) || "Not given"; m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

document.getElementById("xlsxBtn")?.addEventListener("click", () => {
  const list = visibleRegs();
  const blob = buildWorkbook([
    { name: "Registrations", columns: COLS, rows: list.map(r => COLS.map(c => String(c.get(r) ?? ""))) },
    { name: "By session", columns: [{ title: "Session", width: 40 }, { title: "People", width: 10 }, { title: "Seats", width: 10 }],
      rows: workshops.map(w => [w.title, list.filter(r => attends(r, w.id)).length, Number.isFinite(w.capacity) ? w.capacity : "No limit"]) },
    { name: "By entity", columns: [{ title: "Entity", width: 30 }, { title: "People", width: 10 }],
      rows: tally(list, r => r.entity) }
  ]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nextgen-storytellers-registrations-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ---------- stats ---------- */
function renderStats(){
  const host = document.getElementById("kpis");
  if (!host) return;
  const online   = regs.filter(r => workshops.some(w => w.type === "online" && attends(r, w.id))).length;
  const physical = regs.filter(r => workshops.some(w => w.type === "physical" && attends(r, w.id))).length;
  host.innerHTML = [
    [regs.length, "People registered"],
    [online, "For online sessions"],
    [physical, "For physical days"],
    [new Set(regs.map(r => r.entity).filter(Boolean)).size, "Entities"]
  ].map(([n, l]) => `<div class="kpi"><b>${n}</b><span>${esc(l)}</span></div>`).join("");

  const bars = (rows, cap) => {
    const max = Math.max(1, ...rows.map(r => r[1]));
    return rows.length ? rows.map(([label, n, seats]) => `
      <div class="bar">
        <span class="bar__l">${esc(label)}</span>
        <span class="bar__n">${n}${seats ? ` / ${seats}` : ""}</span>
        <i style="width:${(n / (seats || max)) * 100}%"></i>
      </div>`).join("") : `<p class="muted">Nothing yet.</p>`;
  };
  document.getElementById("statSessions").innerHTML = bars(workshops.map(w =>
    [w.title, regs.filter(r => attends(r, w.id)).length, Number.isFinite(w.capacity) ? w.capacity : 0]));
  document.getElementById("statEntities").innerHTML = bars(tally(regs, r => r.entity).slice(0, 8));
  fillRegFilter();
}

/* ---------- messages ---------- */
async function loadMsgs(){
  const host = document.getElementById("msgList");
  let msgs = [];
  try{ msgs = await listMessages(); }catch{ /* ignore */ }

  document.getElementById("msgCount").textContent =
    msgs.length ? `${msgs.length} message${msgs.length === 1 ? "" : "s"}.` : "No messages yet.";

  host.innerHTML = msgs.length ? msgs.map(m => `
    <div class="msgrow">
      <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;margin-bottom:8px">
        <b>${esc(m.name)}</b>
        <a href="mailto:${esc(m.email)}" style="color:var(--violet-2);font-size:.86rem">${esc(m.email)}</a>
        <span class="badge">${esc(m.subject || "-")}</span>
        <span class="dim" style="font-size:.78rem;margin-left:auto">${esc(m.createdAt ? fmt.date(new Date(m.createdAt)) : "")}</span>
      </div>
      <p class="muted" style="font-size:.9rem;white-space:pre-wrap">${esc(m.body)}</p>
    </div>`).join("") : "";
}
