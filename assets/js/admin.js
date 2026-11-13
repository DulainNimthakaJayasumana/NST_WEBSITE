/* ============================================================
   admin.js: admin.html (the control room)
   ------------------------------------------------------------
   Sign-in only opens the page. Anyone can read this file, so the
   real protection is firestore.rules. See README.
   ============================================================ */

import { SERIES, shortTitle } from "./data.js";
import { mountChrome, liveWatch, esc, fmt, statusOf } from "./ui.js";
import { buildWorkbook } from "./xlsx.js";
import { startScanner, parseCode } from "./qr.js";
import {
  getModeAsync, setLiveSettings, saveWorkshop,
  listRegistrations, listMessages, onLiveSettings,
  removeRegistration, removeMessage,
  signInWithGoogle, hasTeamAccess, signOutTeam, onAuth,
  onAttendance, markAttendance, unmarkAttendance, attendanceId,
  syncPasses, checkInOpen, cleanEmail
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
  }else if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){
    // Rehearsal on this computer: the data is this browser's own, nothing to guard.
    openPanel();
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
let att = new Map();          // attendanceId -> { workshopId, email, at, method, by }
let regsLoaded = false;
let booted = false;

async function boot(){
  if (booted) return;
  booted = true;

  const mode = await getModeAsync();
  document.getElementById("modeLine").innerHTML = mode === "cloud"
    ? `Connected to Firebase project <b>${esc(SERIES.name)}</b>. Changes are live for everyone.`
    : `<b>Rehearsal mode.</b> Everything here is saved in this browser only, not the real database.`;

  liveWatch.onData(w => {
    workshops = w.workshops;
    fillWorkshopSelect();
    renderEditors();
    fillRegFilter();
    fillAttSelects();
    renderStats();
    renderRegs();
  });
  liveWatch.on(() => renderAttWindow());

  onAttendance(rows => {
    att = new Map(rows.map(r => [r.id, r]));
    renderRegs();
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
  { title: "Attended",   width: 30, get: r => attendedIn(r).map(shortTitle).join(", "), ticks: true },
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
  const present = document.getElementById("regAttend")?.value || "";
  return regs.filter(r => {
    if (sess && !attends(r, sess)) return false;
    if (present){
      const was = sess ? isPresent(sess, r.email) : attendedIn(r).length > 0;
      if ((present === "yes") !== was) return false;
    }
    return !q || COLS.some(c => String(c.get(r) ?? "").toLowerCase().includes(q));
  });
}

/* ---------- attendance helpers ---------- */
const isPresent = (workshopId, email) => att.has(attendanceId(workshopId, email));
const sessionsOfReg = r => workshops.filter(w => attends(r, w.id));
const attendedIn = r => sessionsOfReg(r).filter(w => isPresent(w.id, r.email));

/* The little tick chips in the table: one per session the person booked
   (or only the filtered session). Green means marked present. */
function ticksHtml(r){
  const sess = document.getElementById("regSession")?.value || "";
  const list = sessionsOfReg(r).filter(w => !sess || w.id === sess);
  if (!list.length) return "-";
  return `<span class="attset">${list.map(w => {
    const a = att.get(attendanceId(w.id, r.email));
    const how = a ? ` · ${a.method === "qr" ? "scanned" : a.method === "self" ? "checked in online" : "ticked"}${a.at ? ` ${fmt.time(a.at)}` : ""}` : "";
    return `<label class="attchk${a ? " is-on" : ""}" title="${esc(w.title + how)}">
      <input type="checkbox" data-att="${esc(w.id)}" data-email="${esc(cleanEmail(r.email))}" data-name="${esc(r.name || "")}" data-ref="${esc(r.ref || "")}" ${a ? "checked" : ""}>${esc(shortTitle(w))}</label>`;
  }).join("")}</span>`;
}

function renderRegs(){
  if (!regsLoaded) return;
  const tbody = document.querySelector("#regTable tbody");
  const list = visibleRegs();
  document.getElementById("regCount").textContent = !regs.length
    ? "No registrations yet."
    : list.length === regs.length
      ? `${regs.length} ${regs.length === 1 ? "person" : "people"} registered.`
      : `Showing ${list.length} of ${regs.length}.`;

  tbody.innerHTML = list.length
    ? list.map(r => `<tr>${COLS.map(c => c.ticks ? `<td>${ticksHtml(r)}</td>` : `<td>${esc(c.get(r) || "-")}</td>`).join("")}
        <td class="rowdel-cell"><button class="rowdel" type="button" data-reg="${regs.indexOf(r)}" aria-label="Remove ${esc(r.name || "this registration")}">Remove</button></td></tr>`).join("")
    : `<tr><td colspan="${COLS.length + 1}" class="muted">${regs.length ? "Nobody matches that search." : "Nothing yet. Share the registration link."}</td></tr>`;
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
  document.querySelector("#regTable thead tr").innerHTML = COLS.map(c => `<th>${esc(c.title)}</th>`).join("") + `<th><span class="sr-only">Remove</span></th>`;
  try{
    regs = await listRegistrations();
    regsLoaded = true;
  }catch(err){
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="${COLS.length + 1}" class="muted">Could not load registrations.</td></tr>`;
    return;
  }
  renderRegs();
  renderStats();
  syncSeatCounts();
  // Give everyone who registered before passes existed a pass they can find by email.
  syncPasses(regs)
    .then(n => { if (n) console.info(`[NST] wrote ${n} pass${n === 1 ? "" : "es"}`); })
    .catch(err => console.warn("[NST] pass sync failed:", err));
}

document.getElementById("regSearch")?.addEventListener("input", renderRegs);
document.getElementById("regSession")?.addEventListener("change", renderRegs);
document.getElementById("regAttend")?.addEventListener("change", renderRegs);

/* Tick or untick attendance straight in the table. */
document.querySelector("#regTable tbody")?.addEventListener("change", async e => {
  const box = e.target.closest("input[data-att]");
  if (!box) return;
  const { att: workshopId, email, name, ref } = box.dataset;
  const chip = box.closest(".attchk");
  const w = workshops.find(x => x.id === workshopId);
  if (!box.checked && !confirm(`Remove ${name || email}'s attendance for ${w?.title || workshopId}?`)){
    box.checked = true;
    return;
  }
  chip.classList.add("is-busy");
  box.disabled = true;
  try{
    if (box.checked){
      const row = await markAttendance({ workshopId, email, name, ref, method: "manual" });
      att.set(row.id, row);
    }else{
      await unmarkAttendance(workshopId, email);
      att.delete(attendanceId(workshopId, email));
    }
    renderRegs();
    renderStats();
  }catch(err){
    console.error(err);
    box.checked = !box.checked;
    chip.classList.remove("is-busy");
    box.disabled = false;
    alert("Could not save that. Check you are signed in with a team account.");
  }
});

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

/* Remove one registration, after a confirm. Seat counts and stats follow. */
document.querySelector("#regTable tbody")?.addEventListener("click", async e => {
  const btn = e.target.closest(".rowdel");
  if (!btn) return;
  const r = regs[+btn.dataset.reg];
  if (!r) return;
  if (!confirm(`Remove ${r.name || "this person"}'s registration${r.ref ? ` (${r.ref})` : ""}? This cannot be undone.`)) return;
  btn.disabled = true;
  btn.textContent = "Removing…";
  try{
    await removeRegistration(r);
    regs = regs.filter(x => x !== r);
    renderRegs();
    renderStats();
    syncSeatCounts();
  }catch(err){
    console.error(err);
    btn.disabled = false;
    btn.textContent = "Remove";
    alert("Could not remove that registration. Check you are signed in with a team account.");
  }
});

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
    { name: "Attendance", columns: [
        { title: "Name", width: 24 }, { title: "Email", width: 30 }, { title: "Entity", width: 20 },
        { title: "Session", width: 36 }, { title: "Date", width: 14 }, { title: "Attended", width: 10 },
        { title: "Marked at", width: 18 }, { title: "How", width: 16 }],
      rows: attendanceRows(list) },
    { name: "By session", columns: [{ title: "Session", width: 40 }, { title: "People", width: 10 }, { title: "Attended", width: 10 }, { title: "Seats", width: 10 }],
      rows: workshops.map(w => {
        const booked = uniqueByEmail(list.filter(r => attends(r, w.id)));
        return [w.title, booked.length, booked.filter(r => isPresent(w.id, r.email)).length, Number.isFinite(w.capacity) ? w.capacity : "No limit"];
      }) },
    { name: "By entity", columns: [{ title: "Entity", width: 30 }, { title: "People", width: 10 }],
      rows: tally(list, r => r.entity) }
  ]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nextgen-storytellers-registrations-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* One row per person per session they booked: the list certificates are made from. */
const HOW = { qr: "QR scan", manual: "Ticked by team", self: "Online check-in" };
function uniqueByEmail(list){
  const seen = new Set();
  return list.filter(r => { const e = cleanEmail(r.email); if (seen.has(e)) return false; seen.add(e); return true; });
}
function attendanceRows(list){
  const rows = [];
  const seen = new Set();
  for (const r of list){
    for (const w of sessionsOfReg(r)){
      const id = attendanceId(w.id, r.email);
      if (seen.has(id)) continue;          // the same person registered twice
      seen.add(id);
      const a = att.get(id);
      rows.push([r.name, r.email, r.entity, w.title, w.startAt ? fmt.date(w.startAt) : "",
        a ? "Yes" : "No", a?.at ? `${fmt.date(a.at)} ${fmt.time(a.at)}` : "", a ? (HOW[a.method] || a.method || "") : ""]);
    }
  }
  return rows;
}

/* ---------- stats ---------- */
function renderStats(){
  const host = document.getElementById("kpis");
  if (!host) return;
  const online   = regs.filter(r => workshops.some(w => w.type === "online" && attends(r, w.id))).length;
  const physical = regs.filter(r => workshops.some(w => w.type === "physical" && attends(r, w.id))).length;
  const present  = new Set([...att.values()].map(a => a.email)).size;
  host.innerHTML = [
    [regs.length, "People registered"],
    [online, "For online sessions"],
    [physical, "For physical days"],
    [present, "Attended at least one"],
    [new Set(regs.map(r => r.entity).filter(Boolean)).size, "Entities"]
  ].map(([n, l]) => `<div class="kpi"><b>${n}</b><span>${esc(l)}</span></div>`).join("");

  const ac = document.getElementById("attCount");
  if (ac) ac.textContent = `${att.size} check-in${att.size === 1 ? "" : "s"} so far. Certificates go to the people marked here.`;
  renderAttDash();

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

  host.innerHTML = msgs.length ? msgs.map((m, i) => `
    <div class="msgrow">
      <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;margin-bottom:8px">
        <b>${esc(m.name)}</b>
        <a href="mailto:${esc(m.email)}" style="color:var(--violet-2);font-size:.86rem">${esc(m.email)}</a>
        <span class="badge">${esc(m.subject || "-")}</span>
        <span class="dim" style="font-size:.78rem;margin-left:auto">${esc(m.createdAt ? fmt.date(new Date(m.createdAt)) : "")}</span>
        <button class="rowdel" type="button" data-msg="${i}" aria-label="Remove the message from ${esc(m.name || "this sender")}">Remove</button>
      </div>
      <p class="muted" style="font-size:.9rem;white-space:pre-wrap">${esc(m.body)}</p>
    </div>`).join("") : "";

  /* Remove one message, after a confirm. */
  host.onclick = async e => {
    const btn = e.target.closest(".rowdel");
    const m = btn && msgs[+btn.dataset.msg];
    if (!m) return;
    if (!confirm(`Remove the message from ${m.name || "this sender"}? This cannot be undone.`)) return;
    btn.disabled = true;
    btn.textContent = "Removing…";
    try{
      await removeMessage(m);
      loadMsgs();
    }catch(err){
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Remove";
      alert("Could not remove that message. Check you are signed in with a team account.");
    }
  };
}

/* ============================================================
   Attendance: QR scanner at the door + online check-in window
   ============================================================ */
const scanSel   = document.getElementById("scanSession");
const attSel    = document.getElementById("attWorkshop");
const scanBox   = document.getElementById("scanBox");
const scanRes   = document.getElementById("scanResult");
const scanLog   = document.getElementById("scanLog");

/* Default the scanner to today's physical day (or the next one), and the
   online window to the session that is on now (or the next online one). */
function fillAttSelects(){
  const opts = list => list.map(w =>
    `<option value="${esc(w.id)}">${esc(w.title)}${w.startAt ? ` · ${esc(fmt.short(w.startAt))}` : ""}</option>`).join("");
  const now = new Date();
  const today = fmt.date(now);
  const upcoming = list => list.find(w => w.endAt && w.endAt > now) || list[list.length - 1];

  const keepScan = scanSel.value;
  const physical = workshops.filter(w => w.type === "physical");
  const online = workshops.filter(w => w.type !== "physical");
  scanSel.innerHTML = opts(physical) + `<optgroup label="Online">${opts(online)}</optgroup>`;
  scanSel.value = keepScan || (physical.find(w => w.startAt && fmt.date(w.startAt) === today) || upcoming(physical) || workshops[0])?.id || "";

  const keepAtt = attSel.value;
  attSel.innerHTML = opts(online) + `<optgroup label="Physical">${opts(physical)}</optgroup>`;
  attSel.value = keepAtt || (online.find(w => statusOf(w, now) === "live") || upcoming(online) || workshops[0])?.id || "";
  renderAttWindow();
}

/* ---------- who is this code? ---------- */
function lookup(code){
  const p = parseCode(code);
  if (!p) return null;
  let mine = p.email ? regs.filter(r => cleanEmail(r.email) === p.email) : [];
  if (!mine.length && p.ref){
    const byRef = regs.find(r => r.ref === p.ref);
    if (byRef) mine = regs.filter(r => cleanEmail(r.email) === cleanEmail(byRef.email));
  }
  const email = p.email || (mine[0] && cleanEmail(mine[0].email)) || "";
  return { ...p, email, regs: mine, person: mine[mine.length - 1] || null };
}

let lastCode = "", lastAt = 0;
function beep(ok){
  try{
    const ctx = beep.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = ok ? 880 : 300;
    g.gain.setValueAtTime(.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + (ok ? .18 : .35));
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + .4);
  }catch{ /* no audio, fine */ }
  try{ navigator.vibrate?.(ok ? 60 : [80, 60, 80]); }catch{}
}

function flash(kind){
  scanBox.classList.remove("flash-ok", "flash-warn");
  void scanBox.offsetWidth;
  scanBox.classList.add(kind === "ok" ? "flash-ok" : "flash-warn");
  setTimeout(() => scanBox.classList.remove("flash-ok", "flash-warn"), 900);
}

function showResult(kind, title, lines = [], action = null){
  scanRes.className = `scanres scanres--${kind}`;
  scanRes.innerHTML = `<b>${esc(title)}</b>${lines.map(l => `<span>${esc(l)}</span>`).join("")}`;
  if (action){
    const b = document.createElement("button");
    b.className = "btn btn--sm";
    b.type = "button";
    b.textContent = action.label;
    b.addEventListener("click", action.run, { once: true });
    scanRes.appendChild(b);
  }
}

function logLine(text){
  scanLog.insertAdjacentHTML("afterbegin", `<span>${esc(fmt.time(new Date()))} · ${esc(text)}</span>`);
}

async function handleCode(code, method){
  const now = Date.now();
  if (code === lastCode && now - lastAt < 4000) return;     // the same pass held in front of the camera
  lastCode = code; lastAt = now;

  const w = workshops.find(x => x.id === scanSel.value);
  if (!w){ showResult("err", "Pick a session first."); return; }
  const who = lookup(code);
  if (!who || !who.email){
    beep(false); flash("warn");
    showResult("err", who?.ref ? `No registration with ${who.ref}` : "That is not a NextGen pass",
      who?.ref ? ["Check the code, or tap Refresh on the registrations list if they registered just now."] : []);
    return;
  }

  const name = who.person?.name || who.email;
  const entity = who.person?.entity || "";
  const prev = att.get(attendanceId(w.id, who.email));
  if (prev){
    beep(false); flash("warn");
    showResult("warn", `${name} is already checked in`,
      [entity, `${shortTitle(w)} · marked ${prev.at ? fmt.time(prev.at) : "earlier"}${prev.method === "qr" ? " by scan" : ""}`].filter(Boolean));
    return;
  }

  const mark = async () => {
    try{
      const row = await markAttendance({ workshopId: w.id, email: who.email, name: who.person?.name || "", ref: who.person?.ref || who.ref || "", method });
      att.set(row.id, row);
      beep(true); flash("ok");
      showResult("ok", `${name} checked in`, [entity, `${shortTitle(w)} · ${fmt.time(new Date())}`].filter(Boolean));
      logLine(`${name} · ${shortTitle(w)}`);
      renderRegs(); renderStats();
    }catch(err){
      console.error(err);
      beep(false);
      showResult("err", "Could not save that check-in", ["Check the connection and scan again."]);
      lastCode = "";
    }
  };

  if (!who.regs.length){
    beep(false); flash("warn");
    showResult("warn", `${who.email} is not on the registration list`,
      ["If they registered just now, tap Refresh on the list below first."],
      { label: "Mark present anyway", run: mark });
    return;
  }
  if (!who.regs.some(r => attends(r, w.id))){
    beep(false); flash("warn");
    const booked = [...new Set(who.regs.flatMap(r => sessionsOfReg(r).map(shortTitle)))].join(", ") || "nothing";
    showResult("warn", `${name} did not book ${shortTitle(w)}`, [entity, `Booked: ${booked}`].filter(Boolean),
      { label: "Mark present anyway", run: mark });
    return;
  }
  await mark();
}

/* ---------- camera ---------- */
let stopScan = null;
const startBtn = document.getElementById("scanStart");
const stopBtn  = document.getElementById("scanStop");

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "Starting…";
  try{
    stopScan = await startScanner(document.getElementById("scanVideo"), text => handleCode(text, "qr"));
    scanBox.dataset.on = "true";
    document.getElementById("scanIdle").hidden = true;
    startBtn.hidden = true;
    stopBtn.hidden = false;
    showResult("ok", "Camera on", [`Scanning for ${shortTitle(workshops.find(x => x.id === scanSel.value))}. Hold a pass QR inside the frame.`]);
  }catch(err){
    console.warn(err);
    showResult("err", "Could not start the camera",
      [err.name === "NotAllowedError" ? "Allow camera access for this site in the browser, then try again." : (err.message || String(err))]);
  }finally{
    startBtn.disabled = false;
    startBtn.textContent = "Start camera";
  }
});

stopBtn.addEventListener("click", () => {
  stopScan?.(); stopScan = null;
  scanBox.dataset.on = "false";
  document.getElementById("scanIdle").hidden = false;
  startBtn.hidden = false;
  stopBtn.hidden = true;
});

scanSel.addEventListener("change", () => { lastCode = ""; });

document.getElementById("scanManualForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("scanManual");
  const v = input.value.trim();
  if (!v) return;
  lastCode = "";
  handleCode(v, "manual").then(() => { input.value = ""; });
});

/* ---------- online check-in window ---------- */
function attLink(id){
  return new URL(`attend.html?w=${encodeURIComponent(id)}`, location.href).href;
}

let lastWinKey = "";
function renderAttWindow(){
  const w = workshops.find(x => x.id === attSel?.value);
  const state = document.getElementById("attState");
  if (!w || !state) return;
  const link = document.getElementById("attLink");
  if (link.value !== attLink(w.id)) link.value = attLink(w.id);
  const now = new Date();
  const open = checkInOpen(w, now);
  let text;
  if (open){
    const left = Math.max(0, Math.round((w.attendUntil - now) / 1000));
    const hh = Math.floor(left / 3600), mm = Math.floor(left / 60) % 60, ss = String(left % 60).padStart(2, "0");
    const clock = hh ? `${hh}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
    text = `Open now, until ${fmt.time(w.attendUntil)} (${clock} left).`;
  }else if (w.attendFrom && w.attendFrom > now){
    text = `Opens at ${fmt.time(w.attendFrom)}.`;
  }else if (w.attendUntil){
    text = `Closed. It was last open until ${fmt.date(w.attendUntil)} ${fmt.time(w.attendUntil)}.`;
  }else{
    text = "Closed. Not opened yet for this session.";
  }
  const key = `${w.id}|${text}`;
  if (key === lastWinKey) return;
  lastWinKey = key;
  state.textContent = text;
  state.classList.toggle("is-open", open);
  renderAttDash();
}
attSel.addEventListener("change", renderAttWindow);

/* ---------- live attendance count for the session picked above ----------
   Re-drawn whenever a check-in arrives (onAttendance → renderStats), when the
   session changes, and when the window opens or closes. */
function renderAttDash(){
  const host = document.getElementById("attDash");
  const w = workshops.find(x => x.id === attSel?.value);
  if (!host || !w) return;

  const booked = new Set(regs.filter(r => attends(r, w.id)).map(r => cleanEmail(r.email)));
  const rows = [...att.values()].filter(a => a.workshopId === w.id);
  const fromBooked = rows.filter(a => booked.has(a.email)).length;
  const walkIns = rows.length - fromBooked;
  const pct = booked.size ? Math.round((fromBooked / booked.size) * 100) : 0;
  const by = m => rows.filter(a => (a.method || "manual") === m).length;
  const sinceOpen = w.attendFrom ? rows.filter(a => a.method === "self" && a.at && a.at >= w.attendFrom).length : 0;
  const nameOf = email => regs.find(r => cleanEmail(r.email) === email)?.name || email;
  const recent = [...rows].sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0)).slice(0, 6);
  const HOW_SHORT = { self: "online", qr: "scanned", manual: "ticked" };

  host.innerHTML = `
    <div class="attdash__top">
      <b>${rows.length}</b>
      <span>marked present<br>${fromBooked} of ${booked.size} booked · ${pct}%${walkIns ? ` · ${walkIns} not booked` : ""}</span>
    </div>
    <div class="attdash__bar" role="img" aria-label="${pct}% of booked people marked present"><i style="width:${pct}%"></i></div>
    <div class="attdash__split">
      <span><i class="dot" style="background:var(--ok)"></i>Online ${by("self")}</span>
      <span><i class="dot" style="background:var(--violet-2)"></i>Scanned ${by("qr")}</span>
      <span><i class="dot" style="background:var(--gold)"></i>Ticked ${by("manual")}</span>
      ${w.attendFrom ? `<span class="dim">${sinceOpen} via the link since ${esc(fmt.time(w.attendFrom))}</span>` : ""}
    </div>
    ${recent.length ? `<ul class="attdash__recent">${recent.map(a =>
      `<li><span>${esc(nameOf(a.email))}</span><span class="dim">${a.at ? esc(fmt.time(a.at)) : ""} · ${HOW_SHORT[a.method] || "ticked"}</span></li>`).join("")}</ul>`
      : `<p class="dim" style="font-size:.88rem">Nobody marked for this session yet.</p>`}`;
}

async function setWindow(open){
  const w = workshops.find(x => x.id === attSel.value);
  if (!w) return;
  const btn = document.getElementById(open ? "attOpen" : "attClose");
  btn.disabled = true;
  try{
    const now = new Date();
    const mins = Number(document.getElementById("attMinutes").value) || 15;
    await saveWorkshop(w.id, open
      ? { id: w.id, attendFrom: now, attendUntil: new Date(now.getTime() + mins * 60e3) }
      : { id: w.id, attendUntil: now });
  }catch(err){
    console.error(err);
    alert("Could not change the check-in window. Check you are signed in with a team account.");
  }finally{
    btn.disabled = false;
  }
}
document.getElementById("attOpen").addEventListener("click", () => setWindow(true));
document.getElementById("attClose").addEventListener("click", () => setWindow(false));

document.getElementById("attCopy").addEventListener("click", async () => {
  const link = document.getElementById("attLink");
  const btn = document.getElementById("attCopy");
  try{ await navigator.clipboard.writeText(link.value); }
  catch{ link.select(); document.execCommand("copy"); }
  btn.textContent = "Copied";
  setTimeout(() => { btn.textContent = "Copy"; }, 1400);
});
