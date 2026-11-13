/* ============================================================
   register.js: register.html
   ============================================================ */

import { SERIES, ENTITY_GROUPS } from "./data.js";
import { mountChrome, liveWatch, esc, fmt, icon, statusOf, isAiesecEmail } from "./ui.js";
import { register, getMode, findPass } from "./store.js";
import { qrSvg, passCode } from "./qr.js";

mountChrome({ active: "register.html" });

const form      = document.getElementById("regForm");
const pickersEl = document.getElementById("pickers");
const entitySel = document.getElementById("entity");
const msg       = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");
const modulesFld= document.getElementById("modulesField");

let workshops = [];
const preselect = new URLSearchParams(location.search).get("w") || "";

/* ---------- entity dropdown ---------- */
entitySel.innerHTML = `<option value="">Select your entity</option>` +
  ENTITY_GROUPS.map(g =>
    `<optgroup label="${esc(g.label)}">${g.items.map(i => `<option>${esc(i)}</option>`).join("")}</optgroup>`
  ).join("");

/* ---------- session pickers ---------- */
function renderPickers(){
  // If the schedule updates while someone is filling the form, keep their ticks.
  const keep = new Set([...pickersEl.querySelectorAll('input[name="workshop"]:checked')].map(i => i.value));
  const now = new Date();
  const open = workshops.filter(w => statusOf(w, now) !== "done" && w.registrationOpen !== false);
  const list = open.length ? open : workshops;

  if (!list.length){
    pickersEl.innerHTML = `<div class="empty">${icon("calendar")}<p>Sessions are being scheduled. Check back shortly.</p></div>`;
    return;
  }

  pickersEl.innerHTML = list.map(w => {
    const physical = w.type === "physical";
    const when = w.startAt
      ? `${fmt.date(w.startAt)} · ${fmt.time(w.startAt)}–${fmt.time(w.endAt)}`
      : "Date to be confirmed";
    const note = physical
      ? `${when} · ${esc(w.venue || "Venue TBA")}`
      : `${when} · ${esc(w.platform || "Online")} · link on this site when it starts`;
    const checked = (keep.size ? keep.has(w.id) : w.id === preselect) ? "checked" : "";
    return `
      <label class="picker" data-id="${esc(w.id)}" data-type="${esc(w.type)}">
        <input type="checkbox" name="workshop" value="${esc(w.id)}" ${checked}>
        <span class="picker__mark" aria-hidden="true"></span>
        <span class="picker__txt">
          <b>${esc(w.title)}</b>
          <span>${note}</span>
          ${w.dateConfirmed === false ? `<span class="dim"> · date still to be confirmed</span>` : ""}
          <span class="seats dim" data-seats="${esc(w.id)}"></span>
        </span>
      </label>`;
  }).join("");

  pickersEl.querySelectorAll('input[name="workshop"]').forEach(r =>
    r.addEventListener("change", onPick));
  onPick();
  showSeats(list);
}

/* Which sessions are ticked right now. */
function picked(){
  return [...pickersEl.querySelectorAll('input[name="workshop"]:checked')]
    .map(i => workshops.find(w => w.id === i.value))
    .filter(Boolean);
}

/* The physical-only fields appear as soon as any physical day is ticked. */
function onPick(){
  const anyPhysical = picked().some(w => w.type === "physical");
  modulesFld.hidden = !anyPhysical;
  const err = document.getElementById("errWorkshop");
  if (err) err.style.display = "";
}

/* Seat counts come off the public workshop document (seatsTaken is kept up
   to date by the control room) so visitors never need read access to the
   registration list itself. */
function showSeats(list){
  for (const w of list){
    if (!Number.isFinite(w.capacity)) continue;
    const taken = Number.isFinite(w.seatsTaken) ? w.seatsTaken : 0;
    const left = Math.max(0, w.capacity - taken);
    const el = pickersEl.querySelector(`[data-seats="${CSS.escape(w.id)}"]`);
    if (el) el.textContent = left > 0 ? ` · ${left} of ${w.capacity} seats left` : " · full";
    if (left <= 0){
      const label = pickersEl.querySelector(`.picker[data-id="${CSS.escape(w.id)}"]`);
      label?.classList.add("is-full");
      const input = label?.querySelector("input");
      if (input){ input.disabled = true; input.checked = false; }
    }
  }
}

liveWatch.onData(w => { workshops = w.workshops; renderPickers(); });

/* ---------- validation ---------- */
function setErr(el, on){
  el?.closest(".field")?.classList.toggle("has-err", on);
  return !on;
}

function validate(){
  let ok = true;
  const name  = document.getElementById("name");
  const email = document.getElementById("email");
  const phone = document.getElementById("phone");
  if (!picked().length){
    document.getElementById("errWorkshop").style.display = "block";
    ok = false;
  }else{
    document.getElementById("errWorkshop").style.display = "";
  }

  ok = setErr(name,  !name.value.trim()) && ok;
  ok = setErr(email, !isAiesecEmail(email.value)) && ok;
  ok = setErr(phone, phone.value.replace(/\D/g, "").length < 9) && ok;
  ok = setErr(entitySel, !entitySel.value) && ok;

  if (!document.getElementById("consent").checked){
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = "Please tick the consent box so we are allowed to contact you.";
    ok = false;
  }
  return ok;
}

["name", "email", "phone"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", e =>
    e.target.closest(".field")?.classList.remove("has-err"));
});
entitySel.addEventListener("change", () => entitySel.closest(".field")?.classList.remove("has-err"));

/* ---------- submit ---------- */
form.addEventListener("submit", async e => {
  e.preventDefault();
  msg.className = "form__msg";
  if (!validate()) return;

  const chosen = picked();

  const payload = {
    // workshopId / workshopTitle stay as the first pick so older exports and
    // the security rules keep working; the full set is in workshopIds.
    workshopId:    chosen[0].id,
    workshopTitle: chosen.map(w => w.title).join(" + "),
    workshopType:  chosen.every(w => w.type === "online") ? "online"
                 : chosen.every(w => w.type === "physical") ? "physical" : "mixed",
    workshopIds:   chosen.map(w => w.id),
    workshopDate:  chosen[0].startAt ? chosen[0].startAt.toISOString() : "",
    name:   document.getElementById("name").value.trim(),
    email:  document.getElementById("email").value.trim().toLowerCase(),
    phone:  document.getElementById("phone").value.trim(),
    entity: entitySel.value,
    role:   document.getElementById("role").value,
    level:  document.getElementById("level").value,
    modules: [...form.querySelectorAll('input[name="modules"]:checked')].map(c => c.value),
    notes:  document.getElementById("notes").value.trim()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving your place…";

  try{
    const rec = await register(payload);
    showPass(rec, chosen);
  }catch(err){
    console.error(err);
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = "We could not save that. Check your connection and try again, " +
                      "or message us from the contact page and we will add you by hand.";
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm my place";
  }
});

/* ---------- the confirmation pass ----------
   rec is the new registration (or a pass found by email). When it carries a
   pass, that is shown instead: the pass covers every session this email has
   booked, under its first reference. */
function showPass(rec, chosen, { found = false } = {}){
  const p = rec.pass || rec;
  if (p.workshopIds?.length && workshops.length){
    const all = p.workshopIds.map(id => workshops.find(w => w.id === id)).filter(Boolean);
    if (all.length) chosen = all;
  }
  rec = { ...rec, ...p, modules: p.modules?.length ? p.modules : rec.modules };

  const pass = document.getElementById("pass");
  const n = chosen.length;
  const anyPhysical = chosen.some(w => w.type === "physical");
  const anyTbc = chosen.some(w => w.dateConfirmed === false);
  const link = chosen.find(w => w.joinUrl);

  const lines = chosen.map(w => {
    const where = w.type === "online" ? (w.platform || "Online") : (w.venue || "Venue to be announced");
    return `<div class="pass__sess">
      <b>${esc(w.title)}</b>
      <span>${w.startAt ? esc(fmt.range(w.startAt, w.endAt)) : "Date to be confirmed"}</span>
      <span class="dim">${esc(where)}</span>
    </div>`;
  }).join("");

  pass.innerHTML = `
    <div class="pass__top">
      <span class="eyebrow eyebrow--center">${esc(SERIES.name)}</span>
      <h3>${n} session${n === 1 ? "" : "s"} booked</h3>
      <p class="muted" style="font-size:.9rem">${esc(SERIES.presenter)} &middot; ${esc(SERIES.org)}</p>
      <div class="pass__id">
        <div class="pass__qr" id="passQr" aria-busy="true"></div>
        <div>
          <div class="pass__code">${esc(rec.ref)}</div>
          <p class="pass__hint">${anyPhysical
            ? "Show this QR at the door on the physical day. The team scans it to mark your attendance."
            : "Online sessions: when the team shares the check-in link, enter this email to mark your attendance."}
            Lost it? Use <b>Find my pass</b> on the register page with your email.</p>
        </div>
      </div>
    </div>
    <div class="pass__rows">
      <div class="pass__row"><b>Name</b><span>${esc(rec.name)}</span></div>
      <div class="pass__row"><b>Entity</b><span>${esc(rec.entity)}</span></div>
      <div class="pass__row"><b>Sessions</b><span class="pass__list">${lines}</span></div>
      ${rec.modules?.length ? `<div class="pass__row"><b>Focus</b><span>${esc(rec.modules.join(", "))}</span></div>` : ""}
      <div class="pass__row"><b>Email</b><span>${esc(rec.email)}</span></div>
      <div class="pass__row"><b>Times</b><span>${esc(SERIES.tzLabel)}</span></div>
      ${anyTbc ? `<div class="pass__row"><b>Note</b><span>Some dates are still being confirmed. Check this site for the final dates.</span></div>` : ""}
    </div>
    <div class="pass__foot">
      <button class="btn btn--sm" id="printBtn">${icon("ticket")} Save / print this</button>
      ${link ? `<a class="btn btn--ghost btn--sm" href="${esc(link.joinUrl)}" target="_blank" rel="noopener">Meeting link</a>` : ""}
    </div>`;

  pass.querySelectorAll("svg").forEach(s => { s.style.width = "15px"; s.style.height = "15px"; s.style.fill = "currentColor"; });
  pass.querySelector("#printBtn")?.addEventListener("click", () => window.print());

  const qrBox = pass.querySelector("#passQr");
  qrSvg(passCode(rec), { label: `QR code for pass ${rec.ref}` })
    .then(svg => { qrBox.innerHTML = svg; qrBox.removeAttribute("aria-busy"); })
    .catch(err => {
      console.warn("[NST] QR could not be drawn:", err);
      qrBox.classList.add("is-off");
      qrBox.textContent = "QR unavailable offline. The team can type your reference instead.";
    });

  document.getElementById("doneTitle").textContent = found ? "Your pass" : "See you there";
  document.getElementById("formWrap").hidden = true;
  const done = document.getElementById("doneWrap");
  done.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if ((rec._local || getMode() !== "cloud") && !document.getElementById("localNote")){
    done.insertAdjacentHTML("beforeend",
      `<p class="muted" id="localNote" style="text-align:center;margin-top:20px;font-size:.84rem">
         Saved on this device only. Connect Firebase so registrations reach the team.
       </p>`);
  }
}

document.getElementById("againBtn")?.addEventListener("click", () => {
  form.reset();
  document.getElementById("doneWrap").hidden = true;
  document.getElementById("formWrap").hidden = false;
  submitBtn.disabled = false;
  submitBtn.textContent = "Confirm my place";
  msg.className = "form__msg";
  renderPickers();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- find my pass ----------
   Type the email you registered with and the pass comes back, QR and all. */
const findForm = document.getElementById("findForm");
const findMsg  = document.getElementById("findMsg");
const findBox  = document.getElementById("findBox");

document.getElementById("findToggle")?.addEventListener("click", () => {
  findBox.hidden = !findBox.hidden;
  if (!findBox.hidden) document.getElementById("findEmail").focus();
});

findForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const input = document.getElementById("findEmail");
  const btn = document.getElementById("findBtn");
  findMsg.className = "form__msg";
  if (!isAiesecEmail(input.value)){
    findMsg.className = "form__msg form__msg--err is-on";
    findMsg.textContent = "Enter the AIESEC email you registered with, like name@aiesec.net.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Looking…";
  try{
    const p = await findPass(input.value);
    if (!p){
      findMsg.className = "form__msg form__msg--err is-on";
      findMsg.textContent = "No pass for that email yet. Check the spelling, or register below. " +
        "If you registered earlier and it still is not found, message the team from the contact page.";
      return;
    }
    showPass({ pass: p }, [], { found: true });
  }catch(err){
    console.error(err);
    findMsg.className = "form__msg form__msg--err is-on";
    findMsg.textContent = "Could not look that up. Check your connection and try again.";
  }finally{
    btn.disabled = false;
    btn.textContent = "Show my pass";
  }
});

/* register.html?find=1 opens the lookup straight away (handy to share). */
if (new URLSearchParams(location.search).has("find") && findBox) findBox.hidden = false;
